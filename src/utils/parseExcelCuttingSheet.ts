/**
 * Excel Cutting Sheet Parser
 * 
 * Uses ExcelJS for parsing Excel files (replacing vulnerable xlsx package)
 */
import ExcelJS from 'exceljs';
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

// Get cell value from ExcelJS cell
function getCellValue(cell: ExcelJS.Cell | undefined): any {
  if (!cell) return null;
  
  // If cell has a formula, get the result
  if (cell.formula) {
    return cell.result ?? cell.value;
  }
  
  // Handle different value types
  const value = cell.value;
  if (value === null || value === undefined) return null;
  
  // Handle rich text
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((rt: { text: string }) => rt.text).join('');
  }
  
  // Handle formula result object
  if (typeof value === 'object' && 'result' in value) {
    return value.result;
  }
  
  return value;
}

// Get formula from ExcelJS cell
function getCellFormula(cell: ExcelJS.Cell | undefined): string | null {
  if (!cell) return null;
  
  if (cell.formula) {
    return cell.formula;
  }
  
  // Check if value is a formula object
  const value = cell.value;
  if (typeof value === 'object' && value !== null && 'formula' in value) {
    return (value as { formula: string }).formula;
  }
  
  return null;
}

// Pattern to detect cutting list rows
function isValidCuttingRow(row: (string | number | null)[]): boolean {
  if (!row || row.length < 5) return false;
  
  const firstCell = String(row[0] || '').trim();
  const hasProfileCode = /^(PC|LB|PU|TRD|TUBO|25-|BL-|E0)/i.test(firstCell);
  
  const hasLAIndicator = row.some(cell => {
    const val = String(cell || '').trim().toUpperCase();
    return val === 'L' || val === 'A';
  });
  
  const hasNumericValues = row.filter(cell => {
    const num = Number(cell);
    return !isNaN(num) && num > 0;
  }).length >= 2;
  
  return hasProfileCode && hasLAIndicator && hasNumericValues;
}

// Pattern to detect accessory rows
function isAccessoryRow(row: (string | number | null)[]): boolean {
  if (!row || row.length < 2) return false;
  
  const firstCell = String(row[0] || '').toLowerCase();
  
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
  
  if (!isNaN(Number(strValue))) {
    return strValue;
  }
  
  let formula = strValue
    .replace(/LARGURA/gi, 'L')
    .replace(/ALTURA/gi, 'A')
    .replace(/\s+/g, ' ')
    .trim();
  
  formula = formula.replace(/([LA])([+\-*/])(\d+)/gi, '$1 $2 $3');
  
  return formula || '0';
}

function extractProductNameFromFileName(fileName: string): string {
  let name = fileName.replace(/\.(xlsx?|csv)$/i, '');
  name = name.replace(/_/g, ' ');
  name = name.replace(/\b\w/g, l => l.toUpperCase());
  return name.trim();
}

function determineItemType(name: string, code: string): 'profile' | 'accessory' {
  const lowerName = (name + ' ' + code).toLowerCase();
  
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

// Extract formula from cell, normalizing to use L/A variables
function extractCellFormulaFromWorksheet(
  worksheet: ExcelJS.Worksheet,
  rowIndex: number,
  colIndex: number,
  cellValue: any
): string | null {
  const cell = worksheet.getCell(rowIndex + 1, colIndex + 1);
  const formula = getCellFormula(cell);
  
  if (formula) {
    let normalized = formula.toUpperCase()
      .replace(/LARGURA/gi, 'L')
      .replace(/ALTURA/gi, 'A')
      .trim();
    
    if (/[LA]/.test(normalized) || /[+\-*/]/.test(normalized)) {
      return parseFormula(normalized);
    }
  }
  
  if (cellValue !== null && cellValue !== undefined) {
    const strValue = String(cellValue).trim().toUpperCase();
    if (/[LA]/.test(strValue) && /[+\-*/]/.test(strValue)) {
      return parseFormula(strValue);
    }
  }
  
  return null;
}

// Parse a cutting row
function parseCuttingRow(
  row: (string | number | null)[], 
  rowIndex: number,
  worksheet: ExcelJS.Worksheet
): ParsedCuttingItem | null {
  const firstCell = String(row[0] || '').trim();
  if (!firstCell) return null;
  
  let code = '';
  let name = firstCell;
  
  if (firstCell.includes(' / ')) {
    const slashParts = firstCell.split(' / ');
    code = slashParts[0].trim();
    name = slashParts.slice(1).join(' / ').trim();
  } else if (firstCell.includes(' - ')) {
    const dashParts = firstCell.split(' - ');
    if (dashParts[0].length <= 15 && /^[A-Z0-9\-]+$/i.test(dashParts[0].trim())) {
      code = dashParts[0].trim();
      name = dashParts.slice(1).join(' - ').trim();
    }
  } else if (/^[A-Z0-9\-]+$/i.test(firstCell) && firstCell.length <= 20) {
    code = firstCell;
    name = firstCell;
  }
  
  let dimensionType: 'L' | 'A' | null = null;
  let quantity: number = 1;
  let cutAngle: number | null = null;
  let extractedFormula: string | null = null;

  const isLikelyCount = (value: unknown, max: number) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || n > max) return false;
    return Math.abs(n - Math.round(n)) < 1e-6;
  };
  
  for (let j = 1; j < row.length; j++) {
    const cellValue = String(row[j] || '').trim().toUpperCase();
    
    if (cellValue === 'L' || cellValue === 'A') {
      dimensionType = cellValue as 'L' | 'A';
      
      if (j + 1 < row.length) {
        extractedFormula = extractCellFormulaFromWorksheet(worksheet, rowIndex, j + 1, row[j + 1]);
      }
      
      for (let k = j + 2; k < Math.min(row.length, j + 7); k++) {
        if (isLikelyCount(row[k], 999)) {
          quantity = Math.round(Number(row[k]));
          break;
        }
      }
    }
    
    if (/^\d+\/\d+$/.test(cellValue)) {
      const angleParts = cellValue.split('/');
      cutAngle = Number(angleParts[0]);
    }
  }
  
  let widthFormula: string | null = null;
  let heightFormula: string | null = null;
  
  if (dimensionType === 'L') {
    widthFormula = extractedFormula || 'L';
  } else if (dimensionType === 'A') {
    heightFormula = extractedFormula || 'A';
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
      if (cell !== undefined && cell !== null) acc[String(idx)] = cell;
      return acc;
    }, {} as Record<string, any>),
  };
}

// Parse accessory row
function parseAccessoryRow(row: (string | number | null)[], rowIndex: number): ParsedCuttingItem | null {
  const name = String(row[0] || '').trim();
  if (!name) return null;
  
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
      if (cell !== undefined && cell !== null) acc[String(idx)] = cell;
      return acc;
    }, {} as Record<string, any>),
  };
}

// Fallback: traditional header-based parsing
function parseWithHeaders(data: (string | number | null)[][], fileName: string): ParsedProduct | null {
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (row && row.filter(cell => cell !== null && cell !== undefined && cell !== '').length >= 3) {
      headerRowIndex = i;
      break;
    }
  }
  
  const headers = (data[headerRowIndex] || []).map(h => String(h || ''));
  
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
    category: 'portas',
    linha: 'Portões',
    description: `Produto importado de ${fileName}`,
    items,
    fileName,
  };
}

export async function parseExcelCuttingSheetAsync(fileBuffer: ArrayBuffer, fileName: string): Promise<ParsedProduct | null> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) return null;
  
  // Convert worksheet to 2D array
  const data: (string | number | null)[][] = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const rowData: (string | number | null)[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      // Pad array if needed
      while (rowData.length < colNumber - 1) {
        rowData.push(null);
      }
      rowData.push(getCellValue(cell));
    });
    // Pad data array if needed
    while (data.length < rowNumber - 1) {
      data.push([]);
    }
    data.push(rowData);
  });
  
  if (data.length < 2) return null;
  
  const items: ParsedCuttingItem[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 3) continue;
    
    if (isValidCuttingRow(row)) {
      const item = parseCuttingRow(row, i, worksheet);
      if (item) {
        items.push(item);
      }
      continue;
    }
    
    if (isAccessoryRow(row)) {
      const item = parseAccessoryRow(row, i);
      if (item) {
        items.push(item);
      }
    }
  }
  
  if (items.length === 0) {
    return parseWithHeaders(data, fileName);
  }
  
  const productName = extractProductNameFromFileName(fileName);
  
  return {
    name: productName,
    category: 'portas',
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
      
      // Use async parser with ExcelJS
      const product = await parseExcelCuttingSheetAsync(arrayBuffer, file.name);
      
      if (product) {
        // Try to extract images
        if (extractImages) {
          try {
            const imageResult = await extractImagesFromExcel(arrayBuffer);
            
            for (const img of imageResult.allImages) {
              result.extractedImages.push({
                ...img,
                filename: `${file.name}_${img.filename}`,
              });
            }
            
            if (imageResult.productImage) {
              product.productImageBuffer = imageResult.productImage.buffer;
              product.productImageExtension = imageResult.productImage.extension;
            }
            
            if (imageResult.allImages.length > 0) {
              result.warnings.push(`${file.name}: ${imageResult.allImages.length} imagem(ns) encontrada(s) - associe manualmente`);
            }
          } catch (imgError) {
            console.warn('Error extracting images:', imgError);
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
