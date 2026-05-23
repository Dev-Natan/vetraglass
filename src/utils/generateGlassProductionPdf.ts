import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Panel {
  index: number;
  name: string;
  width: number;
  height: number;
  areaM2: number;
  quantity: number;
  isMovable: boolean;
  side?: string;
  holes?: Array<{ x: number; y: number; diameter: number }>;
  cutouts?: Array<{ x: number; y: number; width: number; height: number }>;
}

interface GlassProject {
  id: string;
  product_name: string;
  vao_width: number;
  vao_width_b?: number | null;
  vao_height: number;
  vao_height_b?: number | null;
  quantity: number;
  panels_data: Panel[];
  glass_type: string | null;
  glass_color: string | null;
  total_area_m2: number | null;
}

interface OSInfo {
  os_number: number;
  customer_name: string;
  estimated_end?: string | null;
}

interface Company {
  name: string;
  cnpj?: string | null;
  phone?: string | null;
}

// Panel colors for visualization
const PANEL_COLORS: Array<{ fill: [number, number, number]; stroke: [number, number, number] }> = [
  { fill: [219, 234, 254], stroke: [59, 130, 246] },   // Blue
  { fill: [220, 252, 231], stroke: [34, 197, 94] },    // Green
  { fill: [254, 249, 195], stroke: [234, 179, 8] },    // Yellow
  { fill: [254, 226, 226], stroke: [239, 68, 68] },    // Red
];

/**
 * Generate Glass Production PDF with visual panels
 */
export function generateGlassProductionPdf(
  projects: GlassProject[],
  osInfo: OSInfo,
  company: Company | null,
  mode: 'download' | 'print' = 'download'
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  
  // Colors
  const primaryBlue: [number, number, number] = [37, 99, 235];
  const emeraldGreen: [number, number, number] = [16, 185, 129];
  const lightGray: [number, number, number] = [245, 245, 245];
  const darkText: [number, number, number] = [30, 30, 30];
  const mutedText: [number, number, number] = [100, 100, 100];
  
  let y = margin;
  
  // ========== HEADER ==========
  doc.setFillColor(...emeraldGreen);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PROJETO DE VIDROS', margin, 15);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`OS #${osInfo.os_number.toString().padStart(4, '0')}`, margin, 24);
  
  doc.setFontSize(10);
  doc.text(osInfo.customer_name, margin, 31);
  
  // Company info on the right
  if (company) {
    doc.setFontSize(9);
    doc.text(company.name, pageWidth - margin, 15, { align: 'right' });
    if (company.cnpj) {
      doc.text(`CNPJ: ${company.cnpj}`, pageWidth - margin, 22, { align: 'right' });
    }
  }
  
  y = 45;
  
  // Date info
  doc.setTextColor(...mutedText);
  doc.setFontSize(9);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
  if (osInfo.estimated_end) {
    doc.text(`Entrega: ${format(new Date(osInfo.estimated_end), 'dd/MM/yyyy', { locale: ptBR })}`, pageWidth - margin, y, { align: 'right' });
  }
  
  y += 12;
  
  // ========== GLASS PROJECTS ==========
  for (let projectIndex = 0; projectIndex < projects.length; projectIndex++) {
    const project = projects[projectIndex];
    const panels = project.panels_data || [];
    
    // Check page break
    if (y > pageHeight - 120) {
      doc.addPage();
      y = margin;
    }
    
    // Product header
    doc.setFillColor(...lightGray);
    doc.rect(margin, y, contentWidth, 18, 'F');
    
    doc.setTextColor(...darkText);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(project.product_name, margin + 4, y + 7);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Vão: ${project.vao_width} ${project.vao_width_b ? `x ${project.vao_width_b}` : ''} x ${project.vao_height} mm`, margin + 4, y + 14);
    
    // Glass info on right
    const glassInfo = [
      project.glass_type ? `Espessura: ${project.glass_type}` : null,
      project.glass_color ? `Cor: ${project.glass_color}` : null,
      `Qtd: ${project.quantity}x`
    ].filter(Boolean).join(' | ');
    
    doc.text(glassInfo, pageWidth - margin - 4, y + 10, { align: 'right' });
    
    y += 24;
    
    // ========== VISUAL REPRESENTATION ==========
    if (panels.length > 0) {
      const drawHeight = 60;
      const drawWidth = contentWidth - 20;
      
      // Calculate scale
      const totalPanelWidth = panels.reduce((sum, p) => sum + p.width, 0);
      const maxPanelHeight = Math.max(...panels.map(p => p.height), 1);
      const scale = Math.min(drawWidth / totalPanelWidth, drawHeight / maxPanelHeight) * 0.85;
      
      // Center the drawing
      const actualWidth = totalPanelWidth * scale;
      const startX = margin + (contentWidth - actualWidth) / 2;
      
      // Draw frame (VÃO)
      const frameWidth = project.vao_width * scale;
      const frameHeight = project.vao_height * scale;
      const frameX = margin + (contentWidth - frameWidth) / 2;
      
      doc.setDrawColor(150);
      doc.setLineWidth(0.5);
      doc.setLineDashPattern([2, 2], 0);
      doc.rect(frameX, y, frameWidth, frameHeight);
      doc.setLineDashPattern([], 0);
      
      // VÃO dimension label
      doc.setFontSize(7);
      doc.setTextColor(...mutedText);
      doc.text(`VÃO ${project.vao_width}mm`, frameX + frameWidth / 2, y - 2, { align: 'center' });
      
      // Draw panels
      let xOffset = startX;
      panels.forEach((panel, index) => {
        const w = panel.width * scale;
        const h = panel.height * scale;
        const panelY = y + (frameHeight - h) / 2;
        
        const colorIndex = index % PANEL_COLORS.length;
        const color = PANEL_COLORS[colorIndex];
        
        // Panel background
        doc.setFillColor(...color.fill);
        doc.setDrawColor(...color.stroke);
        doc.setLineWidth(1);
        doc.rect(xOffset, panelY, w, h, 'FD');
        
        // Panel letter
        const letter = String.fromCharCode(65 + index); // A, B, C, D...
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...color.stroke);
        doc.text(letter, xOffset + w / 2, panelY + h / 2 + 4, { align: 'center' });
        
        // Movable indicator (rollers at bottom)
        if (panel.isMovable) {
          const rollerRadius = 2;
          const rollerY = panelY + h - rollerRadius;
          doc.setFillColor(80, 80, 80);
          doc.circle(xOffset + 8, rollerY, rollerRadius, 'F');
          doc.circle(xOffset + w - 8, rollerY, rollerRadius, 'F');
        }
        
        // Panel dimensions below
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...darkText);
        doc.text(`${panel.width}`, xOffset + w / 2, panelY + h + 6, { align: 'center' });
        
        // Height on the side (only for first panel to avoid clutter)
        if (index === 0) {
          doc.text(`${panel.height}`, xOffset - 4, panelY + h / 2, { align: 'right' });
        }
        
        xOffset += w + 2;
      });
      
      y += frameHeight + 15;
    }
    
    // ========== PIECES TABLE ==========
    if (panels.length > 0) {
      const tableData = panels.map((panel, index) => {
        const letter = String.fromCharCode(65 + index);
        return [
          letter,
          panel.side ? `${panel.name} (Lado ${panel.side})` : panel.name,
          `${panel.width}`,
          `${panel.height}`,
          `${panel.quantity}`,
          panel.areaM2.toFixed(2),
          panel.isMovable ? 'Móvel ⚙' : 'Fixo'
        ];
      });
      
      // Add totals row
      const totalArea = panels.reduce((sum, p) => sum + (p.areaM2 * p.quantity), 0);
      const totalPieces = panels.reduce((sum, p) => sum + p.quantity, 0);
      
      autoTable(doc, {
        startY: y,
        head: [['#', 'Peça', 'Larg. (mm)', 'Alt. (mm)', 'Qtd', 'Área (m²)', 'Tipo']],
        body: tableData,
        foot: [['', 'TOTAL', '', '', `${totalPieces}`, totalArea.toFixed(2), '']],
        theme: 'grid',
        headStyles: {
          fillColor: emeraldGreen,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 9,
          textColor: darkText
        },
        footStyles: {
          fillColor: lightGray,
          textColor: darkText,
          fontStyle: 'bold',
          fontSize: 9
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 40 },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 15, halign: 'center' },
          5: { cellWidth: 25, halign: 'center' },
          6: { cellWidth: 'auto', halign: 'center' }
        },
        margin: { left: margin, right: margin }
      });
      
      y = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Glass color/type reminder box
    if (project.glass_type || project.glass_color) {
      doc.setFillColor(254, 249, 195); // Yellow-ish
      doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 100, 0);
      const glassSpec = `⚠ VIDRO: ${[project.glass_type, project.glass_color].filter(Boolean).join(' - ')}`;
      doc.text(glassSpec, margin + 4, y + 8);
      
      y += 16;
    }
    
    // Separator
    if (projectIndex < projects.length - 1) {
      doc.setDrawColor(200);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
    }
  }
  
  // ========== LEGEND ==========
  if (y < pageHeight - 30) {
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedText);
    doc.text('Legenda:', margin, y);
    
    doc.setFont('helvetica', 'normal');
    doc.text('⚙ = Folha móvel (com roldanas)  |  Fixo = Vidro fixo (sem movimento)', margin + 20, y);
  }
  
  // ========== FOOTER ==========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...mutedText);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }
  
  // Output
  const filename = `vidros-OS${osInfo.os_number.toString().padStart(4, '0')}.pdf`;
  
  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(filename);
  }
}
