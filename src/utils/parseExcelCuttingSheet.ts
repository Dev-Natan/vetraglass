import * as XLSX from 'xlsx';

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
}

export interface ParsedProduct {
  name: string;
  category: string;
  linha: string;
  description: string;
  items: ParsedCuttingItem[];
  fileName: string;
}

export interface ExcelParseResult {
  success: boolean;
  products: ParsedProduct[];
  errors: string[];
  warnings: string[];
}

// Common column name patterns
const COLUMN_PATTERNS = {
  code: ['código', 'codigo', 'cod', 'code', 'ref', 'referência', 'referencia'],
  name: ['nome', 'descrição', 'descricao', 'description', 'material', 'item', 'peça', 'peca'],
  quantity: ['qtd', 'quantidade', 'qty', 'quant', 'pcs', 'peças', 'pecas'],
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
  
  // If we can't find basic columns, try a more flexible approach
  const items: ParsedCuttingItem[] = [];
  
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) continue;
    
    // Try to extract item data
    const code = codeIdx >= 0 ? String(row[codeIdx] || '') : '';
    let name = nameIdx >= 0 ? String(row[nameIdx] || '') : '';
    
    // If no name but has code, use code as name
    if (!name && code) name = code;
    
    // Skip if no name or code
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
      rawData: Object.fromEntries(headers.map((h, idx) => [h, row[idx]])),
    };
    
    items.push(item);
  }
  
  if (items.length === 0) return null;
  
  const productName = extractProductNameFromFileName(fileName);
  
  return {
    name: productName,
    category: 'door', // Default category for gates
    linha: 'Portões',
    description: `Produto importado de ${fileName}`,
    items,
    fileName,
  };
}

export async function parseMultipleExcelFiles(files: FileList | File[]): Promise<ExcelParseResult> {
  const result: ExcelParseResult = {
    success: true,
    products: [],
    errors: [],
    warnings: [],
  };
  
  for (const file of Array.from(files)) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const product = parseExcelCuttingSheet(workbook, file.name);
      
      if (product) {
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
