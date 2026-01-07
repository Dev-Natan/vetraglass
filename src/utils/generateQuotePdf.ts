import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QuoteItem {
  description: string;
  width: number | null;
  height: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Quote {
  quote_number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address?: string | null;
  total_amount: number;
  discount_percent?: number;
  discount_amount?: number;
  final_amount: number;
  notes?: string | null;
  valid_until: string | null;
  created_at: string;
}

interface Company {
  name: string;
  cnpj: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export function generateQuotePdf(quote: Quote, items: QuoteItem[], company: Company | null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // blue-500
  const textColor: [number, number, number] = [30, 41, 59]; // slate-800
  const mutedColor: [number, number, number] = [100, 116, 139]; // slate-500
  
  let y = 20;
  
  // Header with company info
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(company?.name || 'Empresa', 15, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (company?.phone) doc.text(`Tel: ${company.phone}`, 15, 33);
  if (company?.email) doc.text(company.email, 80, 33);
  
  // Quote number on the right
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`ORÇAMENTO #${quote.quote_number.toString().padStart(4, '0')}`, pageWidth - 15, 25, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emissão: ${format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}`, pageWidth - 15, 33, { align: 'right' });
  
  y = 55;
  
  // Customer info section
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(15, y, pageWidth - 30, 35, 3, 3, 'F');
  
  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', 20, y + 10);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(quote.customer_name, 20, y + 18);
  
  doc.setTextColor(...mutedColor);
  doc.setFontSize(9);
  const contactInfo: string[] = [];
  if (quote.customer_phone) contactInfo.push(`Tel: ${quote.customer_phone}`);
  if (quote.customer_email) contactInfo.push(quote.customer_email);
  doc.text(contactInfo.join('  |  '), 20, y + 25);
  
  if (quote.customer_address) {
    doc.text(quote.customer_address, 20, y + 31);
  }
  
  // Validity info
  if (quote.valid_until) {
    doc.setTextColor(...primaryColor);
    doc.setFontSize(9);
    doc.text(`Válido até: ${format(new Date(quote.valid_until), "dd/MM/yyyy", { locale: ptBR })}`, pageWidth - 20, y + 10, { align: 'right' });
  }
  
  y += 45;
  
  // Items table
  const tableData = items.map((item, index) => [
    (index + 1).toString(),
    item.description,
    item.width && item.height ? `${item.width} x ${item.height} mm` : '-',
    item.quantity.toString(),
    formatCurrency(item.unit_price),
    formatCurrency(item.total_price),
  ]);
  
  autoTable(doc, {
    startY: y,
    head: [['#', 'Descrição', 'Medidas', 'Qtd', 'Unitário', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: textColor,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 15, right: 15 },
  });
  
  // Get final Y position after table
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  // Totals section
  const totalsX = pageWidth - 80;
  let totalsY = finalY;
  
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(totalsX - 10, totalsY - 5, pageWidth - 15, totalsY - 5);
  
  doc.setTextColor(...mutedColor);
  doc.setFontSize(10);
  doc.text('Subtotal:', totalsX, totalsY);
  doc.setTextColor(...textColor);
  doc.text(formatCurrency(quote.total_amount), pageWidth - 15, totalsY, { align: 'right' });
  
  if (quote.discount_amount && quote.discount_amount > 0) {
    totalsY += 8;
    doc.setTextColor(220, 38, 38); // red-600
    doc.text(`Desconto (${quote.discount_percent || 0}%):`, totalsX, totalsY);
    doc.text(`-${formatCurrency(quote.discount_amount)}`, pageWidth - 15, totalsY, { align: 'right' });
  }
  
  totalsY += 12;
  doc.setDrawColor(226, 232, 240);
  doc.line(totalsX - 10, totalsY - 5, pageWidth - 15, totalsY - 5);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('TOTAL:', totalsX, totalsY);
  doc.text(formatCurrency(quote.final_amount), pageWidth - 15, totalsY, { align: 'right' });
  
  // Notes
  if (quote.notes) {
    const notesY = totalsY + 20;
    doc.setFillColor(254, 249, 195); // yellow-100
    doc.roundedRect(15, notesY, pageWidth - 30, 25, 3, 3, 'F');
    
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações:', 20, notesY + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    const splitNotes = doc.splitTextToSize(quote.notes, pageWidth - 50);
    doc.text(splitNotes.slice(0, 2), 20, notesY + 16);
  }
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(226, 232, 240);
  doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
  
  doc.setTextColor(...mutedColor);
  doc.setFontSize(8);
  doc.text('Este orçamento é válido conforme as condições estabelecidas.', pageWidth / 2, footerY, { align: 'center' });
  
  if (company?.cnpj) {
    doc.text(`CNPJ: ${company.cnpj}`, pageWidth / 2, footerY + 6, { align: 'center' });
  }
  
  // Save PDF
  doc.save(`orcamento-${quote.quote_number.toString().padStart(4, '0')}.pdf`);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
