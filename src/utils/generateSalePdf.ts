import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SaleItem {
  item_name: string;
  item_unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  width?: number | null;
  height?: number | null;
  notes?: string | null;
}

interface Sale {
  id: string;
  sale_number: number;
  customer_name: string | null;
  total_amount: number;
  subtotal: number;
  discount_amount: number | null;
  discount_percent: number | null;
  payment_method: string;
  payment_status: string;
  created_at: string;
  notes?: string | null;
}

interface Company {
  name: string;
  cnpj: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

const paymentMethodLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function generateSalePdf(sale: Sale, items: SaleItem[], company: Company | null) {
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 200], // Receipt format (80mm width)
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 4;
  const contentWidth = pageWidth - (margin * 2);
  
  let y = 8;
  
  // Company header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(company?.name || 'Empresa', pageWidth / 2, y, { align: 'center' });
  y += 5;
  
  if (company?.cnpj) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`CNPJ: ${company.cnpj}`, pageWidth / 2, y, { align: 'center' });
    y += 3;
  }
  
  if (company?.phone) {
    doc.setFontSize(7);
    doc.text(`Tel: ${company.phone}`, pageWidth / 2, y, { align: 'center' });
    y += 3;
  }
  
  if (company?.address) {
    doc.setFontSize(6);
    const addressLines = doc.splitTextToSize(company.address, contentWidth);
    doc.text(addressLines, pageWidth / 2, y, { align: 'center' });
    y += addressLines.length * 3;
  }
  
  y += 2;
  
  // Separator
  doc.setDrawColor(0);
  doc.setLineWidth(0.1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;
  
  // Sale header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROVANTE DE VENDA', pageWidth / 2, y, { align: 'center' });
  y += 5;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº ${String(sale.sale_number).padStart(4, '0')}`, margin, y);
  doc.text(format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }), pageWidth - margin, y, { align: 'right' });
  y += 5;
  
  // Customer
  if (sale.customer_name) {
    doc.setFontSize(7);
    doc.text(`Cliente: ${sale.customer_name}`, margin, y);
    y += 4;
  }
  
  // Separator
  doc.line(margin, y, pageWidth - margin, y);
  y += 3;
  
  // Items header
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEM', margin, y);
  doc.text('QTD', 40, y);
  doc.text('UNIT', 52, y);
  doc.text('TOTAL', pageWidth - margin, y, { align: 'right' });
  y += 3;
  
  // Separator
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0);
  y += 3;
  
  // Items
  doc.setFont('helvetica', 'normal');
  items.forEach((item) => {
    // Item name (may wrap)
    const itemName = item.item_name.length > 25 ? item.item_name.substring(0, 25) + '...' : item.item_name;
    doc.setFontSize(6);
    doc.text(itemName, margin, y);
    y += 3;
    
    // Quantity, price info
    doc.setFontSize(7);
    const qtyText = `${item.quantity} ${item.item_unit}`;
    doc.text(qtyText, margin, y);
    doc.text(formatCurrency(item.unit_price), 42, y);
    doc.text(formatCurrency(item.total_price), pageWidth - margin, y, { align: 'right' });
    y += 4;
    
    // Dimensions if available
    if (item.width && item.height) {
      doc.setFontSize(6);
      doc.text(`  ${item.width} x ${item.height} mm`, margin, y);
      y += 3;
    }
  });
  
  // Separator
  y += 1;
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0);
  y += 4;
  
  // Totals
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', margin, y);
  doc.text(formatCurrency(sale.subtotal), pageWidth - margin, y, { align: 'right' });
  y += 4;
  
  if (sale.discount_amount && sale.discount_amount > 0) {
    doc.text(`Desconto (${sale.discount_percent || 0}%):`, margin, y);
    doc.text(`-${formatCurrency(sale.discount_amount)}`, pageWidth - margin, y, { align: 'right' });
    y += 4;
  }
  
  // Total line
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', margin, y);
  doc.text(formatCurrency(sale.total_amount), pageWidth - margin, y, { align: 'right' });
  y += 6;
  
  // Payment method
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const paymentLabel = paymentMethodLabels[sale.payment_method] || sale.payment_method;
  doc.text(`Forma de Pagamento: ${paymentLabel}`, margin, y);
  y += 5;
  
  // Status
  if (sale.payment_status === 'cancelled') {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('*** VENDA CANCELADA ***', pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 5;
  }
  
  // Notes
  if (sale.notes) {
    y += 2;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Obs:', margin, y);
    y += 3;
    const notesLines = doc.splitTextToSize(sale.notes, contentWidth);
    doc.text(notesLines.slice(0, 3), margin, y);
    y += notesLines.slice(0, 3).length * 3;
  }
  
  // Footer separator
  y += 3;
  doc.setLineWidth(0.1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;
  
  // Footer
  doc.setFontSize(6);
  doc.text('Obrigado pela preferência!', pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text(format(new Date(), "'Impresso em' dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), pageWidth / 2, y, { align: 'center' });
  
  // Adjust page height to content
  const finalHeight = y + 10;
  
  // Create new doc with correct height
  const finalDoc = new jsPDF({
    unit: 'mm',
    format: [80, finalHeight],
  });
  
  // Copy content (we need to regenerate - simpler approach)
  // For now, just save with fixed height and user can trim
  
  // Save PDF
  doc.save(`venda-${String(sale.sale_number).padStart(4, '0')}.pdf`);
}
