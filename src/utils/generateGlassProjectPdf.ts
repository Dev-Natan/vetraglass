import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GlassPanelData } from '@/pages/ProjetoVidro';
import { Hole, Cutout } from '@/components/projeto-vidro/HoleCutoutEditor';

interface GenerateGlassProjectPdfParams {
  productName: string;
  productImage?: string | null;
  categoria: string;
  linha: string;
  vaoWidth: number;
  vaoHeight: number;
  quantity: number;
  lockHeight: number;
  panels: GlassPanelData[];
  groupedPanels: {
    letters: string[];
    width: number;
    height: number;
    quantity: number;
    widthFormula: string | null;
    heightFormula: string | null;
  }[];
  panelModifications: Record<string, { holes: Hole[]; cutouts: Cutout[] }>;
  companyName?: string;
}

export function generateGlassProjectPdf(params: GenerateGlassProjectPdfParams) {
  const {
    productName,
    categoria,
    linha,
    vaoWidth,
    vaoHeight,
    quantity,
    lockHeight,
    panels,
    groupedPanels,
    panelModifications,
    companyName = 'Vetra Glass'
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, margin, yPos);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('PROJETO DE VIDRO', pageWidth - margin, yPos, { align: 'right' });
  
  yPos += 15;
  
  // Product Info Box
  doc.setDrawColor(200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 35, 3, 3, 'F');
  
  yPos += 8;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(productName || 'Produto', margin + 5, yPos);
  
  yPos += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  if (linha) doc.text(`Linha: ${linha}`, margin + 5, yPos);
  if (categoria) doc.text(`Categoria: ${categoria}`, margin + 80, yPos);
  
  yPos += 7;
  doc.text(`VÃO: ${vaoWidth} x ${vaoHeight} mm`, margin + 5, yPos);
  doc.text(`Quantidade: ${quantity} unidade${quantity > 1 ? 's' : ''}`, margin + 80, yPos);
  
  if (lockHeight > 0) {
    yPos += 5;
    doc.text(`Altura do Fecho: ${lockHeight} mm`, margin + 5, yPos);
  }
  
  yPos += 20;
  
  // Pieces Table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('TABELA DE PEÇAS', margin, yPos);
  
  yPos += 5;
  
  const tableData = groupedPanels.map(group => [
    group.letters.join(', '),
    group.quantity.toString(),
    `${group.width} mm`,
    group.widthFormula ? 'Def' : '-',
    `${group.height} mm`,
    group.heightFormula ? 'Def' : '-'
  ]);
  
  // Add total row
  tableData.push([
    'Total',
    panels.length.toString(),
    'Peças',
    '',
    '',
    ''
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['Peça', 'Qtd', 'Largura', '-', 'Altura', '-']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 9
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' }
    },
    margin: { left: margin, right: margin }
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // Modifications section (holes and cutouts)
  const panelsWithMods = panels.filter(p => {
    const mods = panelModifications[p.id];
    return mods && (mods.holes.length > 0 || mods.cutouts.length > 0);
  });
  
  if (panelsWithMods.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('FUROS E RECORTES', margin, yPos);
    yPos += 8;
    
    panelsWithMods.forEach(panel => {
      const mods = panelModifications[panel.id];
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Vidro ${panel.letter} (${panel.width} x ${panel.height} mm)`, margin, yPos);
      yPos += 5;
      
      doc.setFont('helvetica', 'normal');
      
      if (mods.holes.length > 0) {
        doc.text('Furos:', margin + 5, yPos);
        yPos += 4;
        mods.holes.forEach((hole, i) => {
          doc.text(`  ${i + 1}. Posição: X=${hole.x}mm, Y=${hole.y}mm, Diâmetro: ${hole.diameter}mm`, margin + 5, yPos);
          yPos += 4;
        });
      }
      
      if (mods.cutouts.length > 0) {
        doc.text('Recortes:', margin + 5, yPos);
        yPos += 4;
        mods.cutouts.forEach((cutout, i) => {
          doc.text(`  ${i + 1}. Posição: X=${cutout.x}mm, Y=${cutout.y}mm, Tamanho: ${cutout.width}x${cutout.height}mm`, margin + 5, yPos);
          yPos += 4;
        });
      }
      
      yPos += 5;
    });
  }
  
  // Draw glass visualization
  if (yPos < 180) { // Only if there's enough space
    yPos = Math.max(yPos, 160);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('VISUALIZAÇÃO', margin, yPos);
    yPos += 10;
    
    // Calculate scale
    const drawWidth = pageWidth - 2 * margin - 20;
    const drawHeight = 80;
    const totalGlassWidth = panels.reduce((sum, p) => sum + p.width, 0);
    const maxGlassHeight = Math.max(...panels.map(p => p.height), 1);
    const scale = Math.min(drawWidth / totalGlassWidth, drawHeight / maxGlassHeight);
    
    // Draw panels
    let xOffset = margin + 10;
    panels.forEach((panel, index) => {
      const w = panel.width * scale;
      const h = panel.height * scale;
      const y = yPos + (drawHeight - h);
      
      // Panel background
      const colors = [
        [219, 234, 254], // Blue
        [220, 252, 231], // Green
        [254, 249, 195], // Yellow
        [254, 215, 170], // Orange
      ];
      const color = colors[index % colors.length];
      doc.setFillColor(color[0], color[1], color[2]);
      doc.setDrawColor(100);
      doc.rect(xOffset, y, w, h, 'FD');
      
      // Panel letter
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text(panel.letter, xOffset + w / 2, y + h / 2, { align: 'center' });
      
      // Width dimension
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`${panel.width}`, xOffset + w / 2, y + h + 5, { align: 'center' });
      
      // Height dimension
      doc.text(`${panel.height}`, xOffset + w + 3, y + h / 2, { align: 'left' });
      
      xOffset += w + 3;
    });
    
    // Total dimension
    yPos += drawHeight + 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`VÃO TOTAL: ${vaoWidth} x ${vaoHeight} mm`, margin, yPos);
  }
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, footerY);
  doc.text('Projeto de Vidro - Vetra', pageWidth - margin, footerY, { align: 'right' });
  
  return doc;
}
