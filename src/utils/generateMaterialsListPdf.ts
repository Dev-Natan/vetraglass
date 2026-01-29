import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Material {
  id: string;
  item_name: string;
  item_type: string;
  pieces_count: number;
  total_length_mm: number | null;
  bar_length_mm: number | null;
  bars_needed: number | null;
  waste_mm: number | null;
  waste_percent: number | null;
  notes: string | null;
  unit: string | null;
}

interface OSInfo {
  os_number: number;
  customer_name: string;
  customer_address?: string | null;
  estimated_end?: string | null;
}

interface Company {
  name: string;
  cnpj?: string | null;
  phone?: string | null;
}

function formatMm(mm: number | null): string {
  if (mm === null || mm === undefined) return '-';
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(2)}m`;
  }
  return `${mm}mm`;
}

/**
 * Generate Materials List PDF for workshop use
 */
export function generateMaterialsListPdf(
  materials: Material[],
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
  const successGreen: [number, number, number] = [16, 185, 129];
  const warningOrange: [number, number, number] = [245, 158, 11];
  const dangerRed: [number, number, number] = [239, 68, 68];
  const lightGray: [number, number, number] = [245, 245, 245];
  const darkText: [number, number, number] = [30, 30, 30];
  const mutedText: [number, number, number] = [100, 100, 100];
  
  let y = margin;
  
  // ========== HEADER ==========
  doc.setFillColor(...primaryBlue);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('LISTA DE MATERIAIS', margin, 15);
  
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
  
  // Date and delivery info
  doc.setTextColor(...mutedText);
  doc.setFontSize(9);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
  if (osInfo.estimated_end) {
    doc.text(`Entrega prevista: ${format(new Date(osInfo.estimated_end), 'dd/MM/yyyy', { locale: ptBR })}`, pageWidth - margin, y, { align: 'right' });
  }
  
  y += 8;
  
  // Address if available
  if (osInfo.customer_address) {
    doc.setTextColor(...darkText);
    doc.setFontSize(9);
    const addressLines = doc.splitTextToSize(`📍 ${osInfo.customer_address}`, contentWidth);
    doc.text(addressLines, margin, y);
    y += addressLines.length * 5 + 5;
  }
  
  y += 5;
  
  // ========== SUMMARY CARDS ==========
  const profiles = materials.filter(m => m.item_type === 'profile');
  const totalBars = profiles.reduce((sum, p) => sum + (p.bars_needed || 0), 0);
  const totalLength = profiles.reduce((sum, p) => sum + (p.total_length_mm || 0), 0);
  const totalWaste = profiles.reduce((sum, p) => sum + (p.waste_mm || 0), 0);
  const avgWaste = totalLength > 0 
    ? Math.round((totalWaste / (totalLength + totalWaste)) * 1000) / 10 
    : 0;
  
  const cardWidth = (contentWidth - 10) / 4;
  const cardHeight = 25;
  
  // Card 1 - Profile Types
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, y, cardWidth, cardHeight, 3, 3, 'F');
  doc.setTextColor(...primaryBlue);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${profiles.length}`, margin + cardWidth / 2, y + 12, { align: 'center' });
  doc.setTextColor(...mutedText);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Tipos de Perfis', margin + cardWidth / 2, y + 20, { align: 'center' });
  
  // Card 2 - Total Bars
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin + cardWidth + 3, y, cardWidth, cardHeight, 3, 3, 'F');
  doc.setTextColor(...primaryBlue);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totalBars}`, margin + cardWidth + 3 + cardWidth / 2, y + 12, { align: 'center' });
  doc.setTextColor(...mutedText);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Barras Necessárias', margin + cardWidth + 3 + cardWidth / 2, y + 20, { align: 'center' });
  
  // Card 3 - Total Length
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin + (cardWidth + 3) * 2, y, cardWidth, cardHeight, 3, 3, 'F');
  doc.setTextColor(...darkText);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatMm(totalLength), margin + (cardWidth + 3) * 2 + cardWidth / 2, y + 12, { align: 'center' });
  doc.setTextColor(...mutedText);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Comprimento Total', margin + (cardWidth + 3) * 2 + cardWidth / 2, y + 20, { align: 'center' });
  
  // Card 4 - Waste %
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin + (cardWidth + 3) * 3, y, cardWidth, cardHeight, 3, 3, 'F');
  const wasteColor = avgWaste > 20 ? dangerRed : avgWaste > 10 ? warningOrange : successGreen;
  doc.setTextColor(...wasteColor);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${avgWaste}%`, margin + (cardWidth + 3) * 3 + cardWidth / 2, y + 12, { align: 'center' });
  doc.setTextColor(...mutedText);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Desperdício Médio', margin + (cardWidth + 3) * 3 + cardWidth / 2, y + 20, { align: 'center' });
  
  y += cardHeight + 12;
  
  // ========== PROFILES TABLE ==========
  if (profiles.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryBlue);
    doc.text('📦 PERFIS DE ALUMÍNIO', margin, y);
    y += 6;
    
    const profileTableData = profiles.map((profile) => {
      const wastePercent = profile.waste_percent || 0;
      let wasteStatus = '✓';
      if (wastePercent > 20) wasteStatus = '⚠';
      else if (wastePercent > 10) wasteStatus = '○';
      
      return [
        profile.item_name,
        formatMm(profile.bar_length_mm),
        `${profile.pieces_count}`,
        formatMm(profile.total_length_mm),
        `${profile.bars_needed || 0}`,
        `${wasteStatus} ${wastePercent.toFixed(1)}%`,
        profile.notes || '-'
      ];
    });
    
    autoTable(doc, {
      startY: y,
      head: [['Perfil', 'Barra', 'Peças', 'Total', 'Barras', 'Sobra', 'Cortes']],
      body: profileTableData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryBlue,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8,
        textColor: darkText
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 22, halign: 'center' },
        6: { cellWidth: 'auto' }
      },
      margin: { left: margin, right: margin },
      didParseCell: function(data) {
        // Color waste column based on value
        if (data.column.index === 5 && data.section === 'body') {
          const text = data.cell.text.join('');
          if (text.includes('⚠')) {
            data.cell.styles.textColor = dangerRed;
          } else if (text.includes('○')) {
            data.cell.styles.textColor = warningOrange;
          } else if (text.includes('✓')) {
            data.cell.styles.textColor = successGreen;
          }
        }
      }
    });
    
    y = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // ========== CHECKLIST ==========
  // Check page break
  if (y > pageHeight - 80) {
    doc.addPage();
    y = margin;
  }
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkText);
  doc.text('☑ CHECKLIST DE PRODUÇÃO', margin, y);
  y += 8;
  
  const checklistItems = [
    'Perfis cortados',
    'Vidros cortados',
    'Acessórios separados',
    'Montagem concluída',
    'Qualidade verificada',
    'Pronto para entrega'
  ];
  
  const checkSize = 4;
  const colWidth = contentWidth / 2;
  
  checklistItems.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const xPos = margin + col * colWidth;
    const yPos = y + row * 8;
    
    doc.setDrawColor(150);
    doc.setLineWidth(0.5);
    doc.rect(xPos, yPos - 3, checkSize, checkSize);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkText);
    doc.text(item, xPos + checkSize + 3, yPos);
  });
  
  y += Math.ceil(checklistItems.length / 2) * 8 + 10;
  
  // ========== SIGNATURE ==========
  doc.setDrawColor(150);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 15, margin + 70, y + 15);
  doc.line(pageWidth - margin - 70, y + 15, pageWidth - margin, y + 15);
  
  doc.setFontSize(8);
  doc.setTextColor(...mutedText);
  doc.text('Responsável Produção', margin, y + 20);
  doc.text('Data: ___/___/______', pageWidth - margin, y + 20, { align: 'right' });
  
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
  const filename = `materiais-OS${osInfo.os_number.toString().padStart(4, '0')}.pdf`;
  
  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(filename);
  }
}
