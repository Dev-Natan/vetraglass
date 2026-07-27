import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

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
  quote_id?: string | null;
  paid_amount?: number | null;
  pending_amount?: number | null;
  sale_type?: string | null;
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
  cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito',
  pix: 'PIX',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  a_prazo: 'A Prazo',
  misto: 'Misto',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface QuoteFinancialSummary {
  quoteNumber: number | null;
  quoteTotal: number;
  previouslyPaid: number;
  thisPayment: number;
  totalPaidToDate: number;
  remaining: number;
  description: string | null;
}

async function loadQuoteSummary(sale: Sale, items: SaleItem[]): Promise<QuoteFinancialSummary> {
  const thisPayment = Number(sale.paid_amount ?? sale.total_amount ?? 0);
  const fallbackDescription = items[0]?.item_name
    ? `${items[0].item_name}${items.length > 1 ? ` e mais ${items.length - 1} item(s)` : ''}`
    : null;

  if (!sale.quote_id) {
    return {
      quoteNumber: null,
      quoteTotal: Number(sale.total_amount || 0),
      previouslyPaid: 0,
      thisPayment,
      totalPaidToDate: thisPayment,
      remaining: Math.max(0, Number(sale.total_amount || 0) - thisPayment),
      description: fallbackDescription,
    };
  }

  try {
    const [{ data: quote }, { data: deposits }, { data: otherSales }] = await Promise.all([
      supabase
        .from('quotes')
        .select('quote_number, total_amount, final_amount, valor_final_aprovado, notes')
        .eq('id', sale.quote_id)
        .maybeSingle(),
      supabase
        .from('quote_deposits')
        .select('amount, status, received_at, created_at')
        .eq('quote_id', sale.quote_id),
      supabase
        .from('sales')
        .select('id, total_amount, paid_amount, payment_status, created_at')
        .eq('quote_id', sale.quote_id)
        .neq('id', sale.id),
    ]);

    const quoteTotal = Number(
      (quote as any)?.valor_final_aprovado ??
        (quote as any)?.final_amount ??
        (quote as any)?.total_amount ??
        sale.total_amount ??
        0,
    );

    const depositsPaid = (deposits || [])
      .filter((d: any) => d.status === 'received')
      .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

    const otherSalesPaid = (otherSales || [])
      .filter((s: any) => s.payment_status !== 'cancelled')
      .reduce((sum: number, s: any) => sum + Number(s.paid_amount ?? s.total_amount ?? 0), 0);

    const previouslyPaid = depositsPaid + otherSalesPaid;
    const totalPaidToDate = previouslyPaid + thisPayment;

    return {
      quoteNumber: (quote as any)?.quote_number ?? null,
      quoteTotal,
      previouslyPaid,
      thisPayment,
      totalPaidToDate,
      remaining: Math.max(0, quoteTotal - totalPaidToDate),
      description: (quote as any)?.notes || fallbackDescription,
    };
  } catch {
    return {
      quoteNumber: null,
      quoteTotal: Number(sale.total_amount || 0),
      previouslyPaid: 0,
      thisPayment,
      totalPaidToDate: thisPayment,
      remaining: Math.max(0, Number(sale.total_amount || 0) - thisPayment),
      description: fallbackDescription,
    };
  }
}

export async function generateSalePdf(sale: Sale, items: SaleItem[], company: Company | null) {
  const summary = await loadQuoteSummary(sale, items);

  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 4;
  const contentWidth = pageWidth - margin * 2;

  let y = 8;

  // Company header
  doc.setFontSize(12).setFont('helvetica', 'bold');
  doc.text(company?.name || 'Empresa', pageWidth / 2, y, { align: 'center' });
  y += 5;

  if (company?.cnpj) {
    doc.setFontSize(7).setFont('helvetica', 'normal');
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
    const lines = doc.splitTextToSize(company.address, contentWidth);
    doc.text(lines, pageWidth / 2, y, { align: 'center' });
    y += lines.length * 3;
  }

  y += 2;
  doc.setDrawColor(0).setLineWidth(0.1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Title
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text('RECIBO DE PAGAMENTO', pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text(`Venda Nº ${String(sale.sale_number).padStart(4, '0')}`, margin, y);
  doc.text(format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }), pageWidth - margin, y, { align: 'right' });
  y += 4;

  if (summary.quoteNumber) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Orçamento Nº ${String(summary.quoteNumber).padStart(4, '0')}`, margin, y);
    doc.setFont('helvetica', 'normal');
    y += 4;
  }

  if (sale.customer_name) {
    doc.setFontSize(7);
    doc.text(`Cliente: ${sale.customer_name}`, margin, y);
    y += 4;
  }

  if (summary.description) {
    doc.setFontSize(7);
    const descLines = doc.splitTextToSize(`Ref: ${summary.description}`, contentWidth);
    doc.text(descLines.slice(0, 3), margin, y);
    y += Math.min(descLines.length, 3) * 3 + 1;
  }

  // Separator
  doc.line(margin, y, pageWidth - margin, y);
  y += 3;

  // Items header
  doc.setFontSize(7).setFont('helvetica', 'bold');
  doc.text('ITEM', margin, y);
  doc.text('QTD', 40, y);
  doc.text('UNIT', 52, y);
  doc.text('TOTAL', pageWidth - margin, y, { align: 'right' });
  y += 3;

  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0);
  y += 3;

  doc.setFont('helvetica', 'normal');
  items.forEach((item) => {
    const itemName = item.item_name.length > 25 ? item.item_name.substring(0, 25) + '...' : item.item_name;
    doc.setFontSize(6);
    doc.text(itemName, margin, y);
    y += 3;

    doc.setFontSize(7);
    doc.text(`${item.quantity} ${item.item_unit}`, margin, y);
    doc.text(formatCurrency(item.unit_price), 42, y);
    doc.text(formatCurrency(item.total_price), pageWidth - margin, y, { align: 'right' });
    y += 4;

    if (item.width && item.height) {
      doc.setFontSize(6);
      doc.text(`  ${item.width} x ${item.height} mm`, margin, y);
      y += 3;
    }
  });

  y += 1;
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0);
  y += 4;

  // Sale subtotal/discount (this transaction)
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text('Subtotal desta venda:', margin, y);
  doc.text(formatCurrency(Number(sale.subtotal || 0)), pageWidth - margin, y, { align: 'right' });
  y += 4;

  if (sale.discount_amount && sale.discount_amount > 0) {
    doc.text(`Desconto (${sale.discount_percent || 0}%):`, margin, y);
    doc.text(`-${formatCurrency(sale.discount_amount)}`, pageWidth - margin, y, { align: 'right' });
    y += 4;
  }

  // ============ RESUMO FINANCEIRO ============
  y += 2;
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.text('RESUMO FINANCEIRO', pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Valor Total (Orçamento/Serviço)
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text(summary.quoteNumber ? 'Total do Orçamento:' : 'Total do Serviço:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(summary.quoteTotal), pageWidth - margin, y, { align: 'right' });
  y += 5;

  // Pagamentos anteriores
  if (summary.previouslyPaid > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('Pagamentos anteriores:', margin, y);
    doc.text(`-${formatCurrency(summary.previouslyPaid)}`, pageWidth - margin, y, { align: 'right' });
    y += 4;
  }

  // Este pagamento (destaque)
  doc.setFillColor(230, 245, 230);
  doc.rect(margin, y - 3, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(9);
  doc.text('Valor Pago (este recibo):', margin + 1, y + 1);
  doc.text(formatCurrency(summary.thisPayment), pageWidth - margin - 1, y + 1, { align: 'right' });
  y += 7;

  // Total pago acumulado
  doc.setFontSize(8).setFont('helvetica', 'normal');
  doc.text('Total pago até o momento:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(summary.totalPaidToDate), pageWidth - margin, y, { align: 'right' });
  y += 5;

  // Saldo restante (destaque)
  const isQuitado = summary.remaining <= 0.01;
  if (isQuitado) {
    doc.setFillColor(220, 240, 255);
  } else {
    doc.setFillColor(255, 240, 220);
  }
  doc.rect(margin, y - 3, contentWidth, 7, 'F');
  doc.setFontSize(10).setFont('helvetica', 'bold');
  if (isQuitado) {
    doc.setTextColor(0, 100, 0);
    doc.text('QUITADO', pageWidth / 2, y + 1.5, { align: 'center' });
  } else {
    doc.setTextColor(180, 60, 0);
    doc.text('Saldo a Pagar:', margin + 1, y + 1.5);
    doc.text(formatCurrency(summary.remaining), pageWidth - margin - 1, y + 1.5, { align: 'right' });
  }
  doc.setTextColor(0);
  y += 9;

  // Forma de pagamento
  doc.setFontSize(8).setFont('helvetica', 'normal');
  const paymentLabel = paymentMethodLabels[sale.payment_method] || sale.payment_method;
  doc.text(`Forma de Pagamento: ${paymentLabel}`, margin, y);
  y += 5;

  // Status cancelado
  if (sale.payment_status === 'cancelled') {
    doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(220, 38, 38);
    doc.text('*** VENDA CANCELADA ***', pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 5;
  }

  if (sale.notes) {
    y += 2;
    doc.setFontSize(7).setFont('helvetica', 'normal');
    doc.text('Obs:', margin, y);
    y += 3;
    const notesLines = doc.splitTextToSize(sale.notes, contentWidth);
    doc.text(notesLines.slice(0, 3), margin, y);
    y += notesLines.slice(0, 3).length * 3;
  }

  y += 3;
  doc.setLineWidth(0.1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFontSize(6);
  doc.text('Obrigado pela preferência!', pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text(format(new Date(), "'Impresso em' dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), pageWidth / 2, y, { align: 'center' });

  doc.save(`recibo-venda-${String(sale.sale_number).padStart(4, '0')}.pdf`);
}
