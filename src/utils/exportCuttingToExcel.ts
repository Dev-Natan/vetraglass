// Cutting Plan Export Utilities

export interface ProfileExportData {
  profileName: string;
  length: number;
  quantity: number;
  angle: number;
  angleStart?: number;
  angleEnd?: number;
  position: string;
  formula?: string;
}

export interface GlassExportData {
  glassName: string;
  width: number;
  height: number;
  area: number;
  quantity: number;
  widthFormula?: string;
  heightFormula?: string;
}

export interface CuttingPlanExport {
  productName: string;
  vaoWidth: number;
  vaoHeight: number;
  productQuantity: number;
  profiles: ProfileExportData[];
  glasses: GlassExportData[];
  generatedAt: string;
}

/**
 * Exports cutting plan data to CSV format
 */
export function exportCuttingPlanToCSV(data: CuttingPlanExport): void {
  const lines: string[] = [];
  
  // Header info
  lines.push(`Produto:,${data.productName}`);
  lines.push(`Vão (L x A):,${data.vaoWidth} x ${data.vaoHeight} mm`);
  lines.push(`Quantidade:,${data.productQuantity}`);
  lines.push(`Gerado em:,${data.generatedAt}`);
  lines.push('');

  // Profiles section
  if (data.profiles.length > 0) {
    lines.push('PERFIS DE ALUMÍNIO');
    lines.push('Perfil,Medida (mm),Quantidade,Ângulo Início,Ângulo Fim,Posição,Fórmula');
    data.profiles.forEach(p => {
      lines.push(`"${p.profileName}",${p.length},${p.quantity},${p.angleStart ?? p.angle}°,${p.angleEnd ?? p.angle}°,${p.position},"${p.formula || ''}"`);
    });
    lines.push('');
  }

  // Glass section
  if (data.glasses.length > 0) {
    lines.push('VIDROS');
    lines.push('Vidro,Largura (mm),Altura (mm),Área (m²),Quantidade,Fórmula L,Fórmula A');
    data.glasses.forEach(g => {
      lines.push(`"${g.glassName}",${g.width},${g.height},${g.area.toFixed(3)},${g.quantity},"${g.widthFormula || ''}","${g.heightFormula || ''}"`);
    });
  }

  // Create and download file
  const csvContent = lines.join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `plano-corte-${data.productName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports cutting plan to a simple text format for CNC machines
 * Format: PROFILE_NAME;LENGTH;QTY;ANGLE_LEFT;ANGLE_RIGHT
 */
export function exportCuttingPlanToCNC(
  profiles: ProfileExportData[],
  productName: string
): void {
  const lines: string[] = [];
  
  // Header
  lines.push(`; Plano de Corte CNC - ${productName}`);
  lines.push(`; Gerado em: ${new Date().toLocaleString('pt-BR')}`);
  lines.push(`; Formato: PERFIL;MEDIDA;QTD;ANGULO_ESQ;ANGULO_DIR`);
  lines.push('');

  // Profile data
  profiles.forEach(p => {
    // Expand by quantity for CNC
    for (let i = 0; i < p.quantity; i++) {
      lines.push(`${p.profileName};${p.length};1;${p.angleStart ?? p.angle};${p.angleEnd ?? p.angle}`);
    }
  });

  // Create and download file
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `cnc-${productName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.txt`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a summary table for glass cuts
 */
export function generateGlassSummary(glasses: GlassExportData[]): {
  totalPieces: number;
  totalArea: number;
  uniqueSizes: number;
} {
  const totalPieces = glasses.reduce((sum, g) => sum + g.quantity, 0);
  const totalArea = glasses.reduce((sum, g) => sum + (g.area * g.quantity), 0);
  const uniqueSizes = new Set(glasses.map(g => `${g.width}x${g.height}`)).size;

  return { totalPieces, totalArea, uniqueSizes };
}

/**
 * Generate a summary table for profile cuts
 */
export function generateProfileSummary(profiles: ProfileExportData[]): {
  totalPieces: number;
  totalLength: number;
  uniqueProfiles: number;
  uniqueLengths: number;
} {
  const totalPieces = profiles.reduce((sum, p) => sum + p.quantity, 0);
  const totalLength = profiles.reduce((sum, p) => sum + (p.length * p.quantity), 0);
  const uniqueProfiles = new Set(profiles.map(p => p.profileName)).size;
  const uniqueLengths = new Set(profiles.map(p => p.length)).size;

  return { totalPieces, totalLength, uniqueProfiles, uniqueLengths };
}
