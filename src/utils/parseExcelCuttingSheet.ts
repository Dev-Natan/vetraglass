import * as XLSX from 'xlsx';
import { extractImagesFromExcel, ExcelImageResult, ExtractedImage } from './excelImageExtractor';

export { extractImagesFromExcel };
export type { ExcelImageResult, ExtractedImage };
export interface ParsedCuttingItem {
  code: string;
  name: string;
  type: 'profile' | 'accessory';
  unit: string;
  quantityFormula: string;
  widthFormula: string | null;
  heightFormula: string | null;
  cutAngle: number | null;
  piecesQuantity: number;
  rawData: Record<string, any>;
  // Image data
  imageUrl?: string | null;
  imageBuffer?: ArrayBuffer | null;
  imageExtension?: string;
  rowIndex?: number;
}

export interface ParsedProduct {
  name: string;
  category: string;
  linha: string;
  description: string;
  items: ParsedCuttingItem[];
  fileName: string;
  // Image data
  productImageUrl?: string | null;
  productImageBuffer?: ArrayBuffer | null;
  productImageExtension?: string;
}

export interface ExcelParseResult {
  success: boolean;
  products: ParsedProduct[];
  errors: string[];
  warnings: string[];
  extractedImages: ExtractedImage[];
}

// Common column name patterns
const COLUMN_PATTERNS = {
  code: ['código', 'codigo', 'cod', 'code', 'ref', 'referência', 'referencia'],
  name: ['nome', 'descrição', 'descricao', 'description', 'material', 'item', 'peça', 'peca'],
  quantity: ['qtd', 'quantidade', 'qty', 'quant', 'pcs', 'peças', 'pecas', 'x peça', 'x peca'],
  width: ['largura', 'larg', 'width', 'l', 'medida l', 'comprimento'],
  height: ['altura', 'alt', 'height', 'a', 'medida a', 'h'],
  angle: ['ângulo', 'angulo', 'angle', 'corte'],
  unit: ['unidade', 'un', 'unit', 'und'],
};

function normalizeColumnName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function findColumnIndex(headers: string[], patterns: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const normalized = normalizeColumnName(headers[i] || '');
    if (patterns.some(p => normalized.includes(p) || normalized === p)) {
      return i;
    }
  }
  return -1;
}

// Pattern to detect cutting list rows in the specific format:
// "PC 027 / TUBÃO - MOLDURA PORTÃO" | ... | L | 4050 | 2 | ... | 45/45
function isValidCuttingRow(row: any[]): boolean {
  if (!row || row.length < 5) return false;
  
  // Check if first cell contains a profile code pattern (PC xxx, LB-xxx, PU-xxx, etc.)
  const firstCell = String(row[0] || '').trim();
  const hasProfileCode = /^(PC|LB|PU|TRD|TUBO|25-|BL-|E0)/i.test(firstCell);
  
  // Check if row has L or A dimension indicator
  const hasLAIndicator = row.some(cell => {
    const val = String(cell || '').trim().toUpperCase();
    return val === 'L' || val === 'A';
  });
  
  // Check if row has numeric values (dimensions and quantities)
  const hasNumericValues = row.filter(cell => {
    const num = Number(cell);
    return !isNaN(num) && num > 0;
  }).length >= 2;
  
  return hasProfileCode && hasLAIndicator && hasNumericValues;
}

// Pattern to detect accessory rows
function isAccessoryRow(row: any[]): boolean {
  if (!row || row.length < 2) return false;
  
  const firstCell = String(row[0] || '').toLowerCase();
  
  // Skip rows that are clearly not accessories
  if (firstCell.includes('#ref') || firstCell.includes('total') || firstCell.includes('perfis usados')) {
    return false;
  }
  
  const accessoryPatterns = [
    'fechadura', 'roldana', 'guia', 'dobradiça', 'dobradica',
    'trinco', 'puxador', 'fecho', 'maçaneta', 'macaneta',
    'cadeirinha', 'carrinho', 'batente', 'trava'
  ];
  
  return accessoryPatterns.some(p => firstCell.includes(p));
}

function parseFormula(value: any): string {
  if (value === null || value === undefined || value === '') return '0';
  
  const strValue = String(value).trim().toUpperCase();
  
  // Check if it's a direct number
  if (!isNaN(Number(strValue))) {
    return strValue;
  }
  
  // Convert common patterns to formulas
  // L + 50, A - 20, L * 2, etc.
  let formula = strValue
    .replace(/LARGURA/gi, 'L')
    .replace(/ALTURA/gi, 'A')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Handle "L+50" without spaces
  formula = formula.replace(/([LA])([+\-*/])(\d+)/gi, '$1 $2 $3');
  
  return formula || '0';
}

function extractProductNameFromFileName(fileName: string): string {
  // Remove extension
  let name = fileName.replace(/\.(xlsx?|csv)$/i, '');
  
  // Replace underscores with spaces
  name = name.replace(/_/g, ' ');
  
  // Capitalize first letter of each word
  name = name.replace(/\b\w/g, l => l.toUpperCase());
  
  return name.trim();
}

function determineItemType(name: string, code: string): 'profile' | 'accessory' {
  const lowerName = (name + ' ' + code).toLowerCase();
  
  // Accessories patterns
  const accessoryPatterns = [
    'fechadura', 'roldana', 'guia', 'parafuso', 'rebite', 
    'dobradiça', 'dobradica', 'trinco', 'puxador', 'fecho',
    'borracha', 'silicone', 'vedação', 'vedacao', 'kit',
    'carrinho', 'batente', 'trava', 'maçaneta', 'macaneta'
  ];
  
  if (accessoryPatterns.some(p => lowerName.includes(p))) {
    return 'accessory';
  }
  
  return 'profile';
}

function determineUnit(name: string, type: 'profile' | 'accessory'): string {
  if (type === 'accessory') return 'un';
  
  const lowerName = name.toLowerCase();
  if (lowerName.includes('barra') || lowerName.includes('perfil') || lowerName.includes('tubo')) {
    return 'barra';
  }
  
  return 'barra';
}

export function parseExcelCuttingSheet(workbook: XLSX.WorkBook, fileName: string): ParsedProduct | null {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  if (!sheet) return null;
  
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  if (data.length < 2) return null;
  
  const items: ParsedCuttingItem[] = [];
  
  // Parse cutting items in the specific format used by the gate spreadsheets
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 3) continue;
    
    // Check if this is a valid cutting row (profile/material)
    if (isValidCuttingRow(row)) {
      const item = parseCuttingRow(row, i);
      if (item) {
        items.push(item);
      }
      continue;
    }
    
    // Check if this is an accessory row
    if (isAccessoryRow(row)) {
      const item = parseAccessoryRow(row, i);
      if (item) {
        items.push(item);
      }
    }
  }
  
  if (items.length === 0) {
    // Fallback to traditional header-based parsing
    return parseWithHeaders(data, fileName);
  }
  
  const productName = extractProductNameFromFileName(fileName);
  
  return {
    name: productName,
    category: 'door',
    linha: 'Portões',
    description: `Produto importado de ${fileName}`,
    items,
    fileName,
  };
}

// Parse a cutting row in the format: "PC 027 / TUBÃO - MOLDURA" | ... | L | 4050 | 2 | ... | 45/45
function parseCuttingRow(row: any[], rowIndex: number): ParsedCuttingItem | null {
  const firstCell = String(row[0] || '').trim();
  if (!firstCell) return null;
  
  // Extract code and name from first cell
  // Examples:
  //   "PC 027 / TUBÃO - MOLDURA PORTÃO" -> code: "PC 027", name: "TUBÃO - MOLDURA PORTÃO"
  //   "25-517 / BL-02 MARCO LATERAL" -> code: "25-517", name: "BL-02 MARCO LATERAL"
  //   "LB-050 / E051A - LAMBRI FIXO" -> code: "LB-050", name: "E051A - LAMBRI FIXO"
  //   "TUBO RETANGULAR 2/1 REFORÇO" -> code: "", name: "TUBO RETANGULAR 2/1 REFORÇO"
  //   "TRD - 5/8" -> code: "TRD", name: "5/8"
  
  let code = '';
  let name = firstCell;
  
  // First try to split by " / " (space-slash-space) which is the main separator
  if (firstCell.includes(' / ')) {
    const slashParts = firstCell.split(' / ');
    code = slashParts[0].trim();
    name = slashParts.slice(1).join(' / ').trim();
  } 
  // If no " / ", try splitting by " - " for patterns like "TRD - 5/8"
  else if (firstCell.includes(' - ')) {
    const dashParts = firstCell.split(' - ');
    // Only use first part as code if it looks like a code (short, alphanumeric)
    if (dashParts[0].length <= 15 && /^[A-Z0-9\-]+$/i.test(dashParts[0].trim())) {
      code = dashParts[0].trim();
      name = dashParts.slice(1).join(' - ').trim();
    }
  }
  // For patterns like "25-517" without space separators, use as-is
  else if (/^[A-Z0-9\-]+$/i.test(firstCell) && firstCell.length <= 20) {
    code = firstCell;
    name = firstCell;
  }
  
  // Find L or A indicator and get dimension value
  let dimensionType: 'L' | 'A' | null = null;
  let dimensionValue: number | null = null;
  let quantity: number = 1;
  let cutAngle: number | null = null;

  const isLikelyCount = (value: unknown, max: number) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || n > max) return false;
    // quantities must be integer-like; avoid decimals like 10.73333333
    return Math.abs(n - Math.round(n)) < 1e-6;
  };
  
  for (let j = 1; j < row.length; j++) {
    const cellValue = String(row[j] || '').trim().toUpperCase();
    
    // Check for L or A indicator
    if (cellValue === 'L' || cellValue === 'A') {
      dimensionType = cellValue as 'L' | 'A';
      // Next cell should be the dimension value
      if (j + 1 < row.length) {
        const nextValue = Number(row[j + 1]);
        if (!isNaN(nextValue) && nextValue > 0) {
          dimensionValue = nextValue;
        }
      }
       // After dimension, scan next cells for a small integer quantity.
       // Some spreadsheets put totals/metros (decimal) right after the dimension.
       for (let k = j + 2; k < Math.min(row.length, j + 7); k++) {
         if (isLikelyCount(row[k], 999)) {
           quantity = Math.round(Number(row[k]));
           break;
         }
       }
    }
    
    // Check for angle pattern (e.g., "45/45" or "90/90")
    if (/^\d+\/\d+$/.test(cellValue)) {
      const angleParts = cellValue.split('/');
      cutAngle = Number(angleParts[0]);
    }
  }
  
  // Build formula based on dimension type and value
  // If L is used, the formula relates to width (Largura)
  // If A is used, the formula relates to height (Altura)
  let widthFormula: string | null = null;
  let heightFormula: string | null = null;
  
  if (dimensionType === 'L' && dimensionValue !== null) {
    // This dimension uses Largura (L) - store as a formula hint
    widthFormula = `L`; // Will be refined based on actual formulas
  } else if (dimensionType === 'A' && dimensionValue !== null) {
    heightFormula = `A`; // Will be refined based on actual formulas
  }
  
  return {
    code,
    name: name || code,
    type: 'profile',
    unit: 'barra',
    quantityFormula: String(quantity),
    widthFormula,
    heightFormula,
    cutAngle,
    piecesQuantity: quantity,
    rowIndex,
    rawData: row.reduce((acc, cell, idx) => {
      if (cell !== undefined) acc[String(idx)] = cell;
      return acc;
    }, {} as Record<string, any>),
  };
}

// Parse accessory row in the format: "FECHADURA BICO-DE-PAPAGAIO" | ... | 1 | ...
function parseAccessoryRow(row: any[], rowIndex: number): ParsedCuttingItem | null {
  const name = String(row[0] || '').trim();
  if (!name) return null;
  
  // Find quantity (usually after "QUANTIDADE" header or just a number in the row)
  let quantity = 1;
  for (let j = 1; j < row.length; j++) {
    const cellValue = Number(row[j]);
    if (Number.isFinite(cellValue) && cellValue > 0 && cellValue < 100 && Math.abs(cellValue - Math.round(cellValue)) < 1e-6) {
      quantity = Math.round(cellValue);
      break;
    }
  }
  
  return {
    code: '',
    name,
    type: 'accessory',
    unit: 'un',
    quantityFormula: String(quantity),
    widthFormula: null,
    heightFormula: null,
    cutAngle: null,
    piecesQuantity: quantity,
    rowIndex,
    rawData: row.reduce((acc, cell, idx) => {
      if (cell !== undefined) acc[String(idx)] = cell;
      return acc;
    }, {} as Record<string, any>),
  };
}

// Fallback: traditional header-based parsing
function parseWithHeaders(data: any[][], fileName: string): ParsedProduct | null {
  // Find header row (first row with multiple non-empty cells)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (row && row.filter(cell => cell !== null && cell !== undefined && cell !== '').length >= 3) {
      headerRowIndex = i;
      break;
    }
  }
  
  const headers = (data[headerRowIndex] || []).map(h => String(h || ''));
  
  // Find column indices
  const codeIdx = findColumnIndex(headers, COLUMN_PATTERNS.code);
  const nameIdx = findColumnIndex(headers, COLUMN_PATTERNS.name);
  const qtyIdx = findColumnIndex(headers, COLUMN_PATTERNS.quantity);
  const widthIdx = findColumnIndex(headers, COLUMN_PATTERNS.width);
  const heightIdx = findColumnIndex(headers, COLUMN_PATTERNS.height);
  const angleIdx = findColumnIndex(headers, COLUMN_PATTERNS.angle);
  const unitIdx = findColumnIndex(headers, COLUMN_PATTERNS.unit);
  
  const items: ParsedCuttingItem[] = [];
  
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) continue;
    
    const code = codeIdx >= 0 ? String(row[codeIdx] || '') : '';
    let name = nameIdx >= 0 ? String(row[nameIdx] || '') : '';
    
    if (!name && code) name = code;
    if (!name && !code) continue;
    
    const qtyRaw = qtyIdx >= 0 ? row[qtyIdx] : 1;
    const widthRaw = widthIdx >= 0 ? row[widthIdx] : null;
    const heightRaw = heightIdx >= 0 ? row[heightIdx] : null;
    const angleRaw = angleIdx >= 0 ? row[angleIdx] : null;
    const unitRaw = unitIdx >= 0 ? String(row[unitIdx] || '') : '';
    
    const type = determineItemType(name, code);
    const unit = unitRaw || determineUnit(name, type);
    
    const item: ParsedCuttingItem = {
      code: code.trim(),
      name: name.trim(),
      type,
      unit,
      quantityFormula: parseFormula(qtyRaw),
      widthFormula: widthRaw !== null ? parseFormula(widthRaw) : null,
      heightFormula: heightRaw !== null ? parseFormula(heightRaw) : null,
      cutAngle: angleRaw !== null && !isNaN(Number(angleRaw)) ? Number(angleRaw) : null,
      piecesQuantity: 1,
      rawData: headers.reduce((acc, h, idx) => {
        if (h && row[idx] !== undefined) acc[h] = row[idx];
        return acc;
      }, {} as Record<string, any>),
    };
    
    items.push(item);
  }
  
  if (items.length === 0) return null;
  
  const productName = extractProductNameFromFileName(fileName);
  
  return {
    name: productName,
    category: 'door',
    linha: 'Portões',
    description: `Produto importado de ${fileName}`,
    items,
    fileName,
  };
}

export async function parseMultipleExcelFiles(files: FileList | File[], extractImages = true): Promise<ExcelParseResult> {
  const result: ExcelParseResult = {
    success: true,
    products: [],
    errors: [],
    warnings: [],
    extractedImages: [],
  };
  
  for (const file of Array.from(files)) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const product = parseExcelCuttingSheet(workbook, file.name);
      
      if (product) {
        // Try to extract images
        if (extractImages) {
          try {
            const imageResult = await extractImagesFromExcel(arrayBuffer);
            
            // Store ALL extracted images for manual association
            // Add file source info to each image
            for (const img of imageResult.allImages) {
              result.extractedImages.push({
                ...img,
                filename: `${file.name}_${img.filename}`,
              });
            }
            
            // Auto-attach product image (first image in header area)
            if (imageResult.productImage) {
              product.productImageBuffer = imageResult.productImage.buffer;
              product.productImageExtension = imageResult.productImage.extension;
            }
            
            // Don't auto-attach item images anymore - let user manually associate
            // This prevents incorrect associations
            
            if (imageResult.allImages.length > 0) {
              result.warnings.push(`${file.name}: ${imageResult.allImages.length} imagem(ns) encontrada(s) - associe manualmente`);
            }
          } catch (imgError) {
            console.warn('Error extracting images:', imgError);
            // Don't fail the whole import if image extraction fails
          }
        }
        
        result.products.push(product);
      } else {
        result.warnings.push(`Arquivo ${file.name}: Não foi possível extrair dados de corte`);
      }
    } catch (error) {
      result.errors.push(`Erro ao processar ${file.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }
  
  if (result.products.length === 0 && result.errors.length > 0) {
    result.success = false;
  }
  
  return result;
}

// Group items by name/code to consolidate duplicates
export function consolidateItems(items: ParsedCuttingItem[]): ParsedCuttingItem[] {
  const map = new Map<string, ParsedCuttingItem>();
  
  for (const item of items) {
    const key = item.code || item.name;
    if (!map.has(key)) {
      map.set(key, { ...item });
    }
  }
  
  return Array.from(map.values());
}

// Extract unique item templates from multiple products
export function extractUniqueItemTemplates(products: ParsedProduct[]): ParsedCuttingItem[] {
  const allItems: ParsedCuttingItem[] = [];
  
  for (const product of products) {
    allItems.push(...product.items);
  }
  
  return consolidateItems(allItems);
}
