import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CutData {
  profileName: string;
  formula: string;
  calculatedLength: number;
  quantity: number;
  cutAngle: number;
  position: string;
}

interface GlassCutData {
  glassName: string;
  widthFormula: string;
  heightFormula: string;
  calculatedWidth: number;
  calculatedHeight: number;
  areaM2: number;
  quantity: number;
}

interface CuttingPlan {
  id: string;
  product_name: string;
  vao_width: number;
  vao_height: number;
  quantity: number;
  cuts_data: CutData[];
  glass_cuts_data: GlassCutData[];
}

interface OSInfo {
  os_number: number;
  customer_name: string;
  estimated_end?: string | null;
}

interface Company {
  name: string;
  cnpj: string;
  phone?: string | null;
}

/**
 * Generate Cutting Plan PDF for workshop use
 */
export function generateCuttingPlanPdf(
  plans: CuttingPlan[],
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
  const lightGray: [number, number, number] = [240, 240, 240];
  const darkText: [number, number, number] = [30, 30, 30];
  const mutedText: [number, number, number] = [100, 100, 100];
  
  let y = margin;
  
  // ========== HEADER ==========
  doc.setFillColor(...primaryBlue);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PLANO DE CORTE', margin, 15);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`OS #${osInfo.os_number.toString().padStart(4, '0')}`, margin, 24);
  
  doc.setFontSize(10);
  doc.text(osInfo.customer_name, margin, 31);
  
  // Company info on the right
  if (company) {
    doc.setFontSize(9);
    doc.text(company.name, pageWidth - margin, 15, { align: 'right' });
    doc.text(`CNPJ: ${company.cnpj}`, pageWidth - margin, 22, { align: 'right' });
    if (company.phone) {
      doc.text(company.phone, pageWidth - margin, 29, { align: 'right' });
    }
  }
  
  y = 45;
  
  // Date info
  doc.setTextColor(...mutedText);
  doc.setFontSize(9);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
  if (osInfo.estimated_end) {
    doc.text(`Previsão: ${format(new Date(osInfo.estimated_end), 'dd/MM/yyyy', { locale: ptBR })}`, pageWidth - margin, y, { align: 'right' });
  }
  
  y += 10;
  
  // ========== CUTTING PLANS ==========
  for (let planIndex = 0; planIndex < plans.length; planIndex++) {
    const plan = plans[planIndex];
    
    // Check page break
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }
    
    // Product header
    doc.setFillColor(...lightGray);
    doc.rect(margin, y, contentWidth, 14, 'F');
    
    doc.setTextColor(...darkText);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(plan.product_name, margin + 4, y + 9);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Vão: ${plan.vao_width} x ${plan.vao_height} mm`, pageWidth - margin - 60, y + 6);
    doc.text(`Qtd: ${plan.quantity}x`, pageWidth - margin - 4, y + 6, { align: 'right' });
    
    y += 18;
    
    // Profile Cuts Table
    if (plan.cuts_data && plan.cuts_data.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryBlue);
      doc.text('✂ CORTES DE PERFIL', margin, y + 4);
      y += 8;
      
      const profileTableData = plan.cuts_data.map((cut) => [
        cut.profileName,
        cut.formula,
        cut.position,
        `${cut.calculatedLength} mm`,
        `${cut.quantity}`,
        `${cut.cutAngle}°`
      ]);
      
      autoTable(doc, {
        startY: y,
        head: [['Perfil', 'Fórmula', 'Posição', 'Medida', 'Qtd', 'Ângulo']],
        body: profileTableData,
        theme: 'grid',
        headStyles: {
          fillColor: primaryBlue,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 9,
          textColor: darkText
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 40, halign: 'center' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
          4: { cellWidth: 15, halign: 'center' },
          5: { cellWidth: 20, halign: 'center' }
        },
        margin: { left: margin, right: margin }
      });
      
      y = (doc as any).lastAutoTable.finalY + 8;
    }
    
    // Glass Cuts Table
    if (plan.glass_cuts_data && plan.glass_cuts_data.length > 0) {
      // Check page break
      if (y > pageHeight - 60) {
        doc.addPage();
        y = margin;
      }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryBlue);
      doc.text('🔲 CORTES DE VIDRO', margin, y + 4);
      y += 8;
      
      const glassTableData = plan.glass_cuts_data.map((glass) => [
        glass.glassName,
        `L: ${glass.widthFormula}`,
        `A: ${glass.heightFormula}`,
        `${glass.calculatedWidth} x ${glass.calculatedHeight}`,
        `${glass.quantity}`,
        `${glass.areaM2.toFixed(2)} m²`
      ]);
      
      autoTable(doc, {
        startY: y,
        head: [['Vidro', 'Fórm. Largura', 'Fórm. Altura', 'Dimensões (mm)', 'Qtd', 'Área']],
        body: glassTableData,
        theme: 'grid',
        headStyles: {
          fillColor: [16, 185, 129], // Green
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 9,
          textColor: darkText
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 35, halign: 'center' },
          3: { cellWidth: 40, halign: 'center', fontStyle: 'bold' },
          4: { cellWidth: 15, halign: 'center' },
          5: { cellWidth: 25, halign: 'center' }
        },
        margin: { left: margin, right: margin }
      });
      
      y = (doc as any).lastAutoTable.finalY + 12;
    }
    
    // Add separator between products
    if (planIndex < plans.length - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, y - 4, pageWidth - margin, y - 4);
    }
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
  const filename = `plano-corte-OS${osInfo.os_number.toString().padStart(4, '0')}.pdf`;
  
  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(filename);
  }
}
