import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ReciboData {
  os_number: number;
  customer_name: string;
  customer_document?: string | null;
  customer_address?: string | null;
  total_amount: number;
  paid_amount: number;
  payment_date?: string | null;
  description?: string | null;
}

export interface ReciboCompany {
  name: string;
  cnpj?: string | null;
  phone?: string | null;
  address?: string | null;
}

function currency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function extenso(v: number): string {
  // Simplified — shows numeric form. Full extenso would require a heavier lib.
  return currency(v);
}

export function generateReciboPdf(
  data: ReciboData,
  company: ReciboCompany | null,
  mode: 'download' | 'blob' = 'download',
): Blob | void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 25;

  // Header
  if (company) {
    doc.setFontSize(14).setFont('helvetica', 'bold');
    doc.text(company.name, pageW / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(9).setFont('helvetica', 'normal');
    const sub = [company.cnpj && `CNPJ: ${company.cnpj}`, company.phone, company.address]
      .filter(Boolean)
      .join(' • ');
    if (sub) {
      doc.text(sub, pageW / 2, y, { align: 'center' });
      y += 6;
    }
  }

  y += 4;
  doc.setDrawColor(200).line(margin, y, pageW - margin, y);
  y += 10;

  // Title
  doc.setFontSize(18).setFont('helvetica', 'bold');
  doc.text('RECIBO DE PAGAMENTO', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(11).setFont('helvetica', 'normal');
  doc.text(`OS Nº ${data.os_number.toString().padStart(4, '0')}`, pageW / 2, y, { align: 'center' });
  y += 4;
  doc.setFontSize(16).setFont('helvetica', 'bold');
  doc.text(currency(data.paid_amount), pageW / 2, y + 6, { align: 'center' });
  y += 18;

  // Body text
  doc.setFontSize(11).setFont('helvetica', 'normal');
  const paymentDate = data.payment_date
    ? format(new Date(data.payment_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const body =
    `Recebemos de ${data.customer_name}` +
    (data.customer_document ? `, inscrito sob ${data.customer_document}` : '') +
    `, a importância de ${extenso(data.paid_amount)}` +
    (data.total_amount && data.total_amount !== data.paid_amount
      ? ` (valor total da OS: ${currency(data.total_amount)})`
      : '') +
    `, referente a ${data.description || `serviços/produtos da Ordem de Serviço Nº ${data.os_number}`}.`;

  const lines = doc.splitTextToSize(body, pageW - margin * 2);
  doc.text(lines, margin, y);
  y += lines.length * 6 + 4;

  doc.text(
    `Para clareza e validade, firmamos o presente recibo em ${paymentDate}.`,
    margin,
    y,
  );
  y += 30;

  // Signature
  const sigW = 80;
  const sigX = (pageW - sigW) / 2;
  doc.line(sigX, y, sigX + sigW, y);
  y += 5;
  doc.setFontSize(10);
  doc.text(company?.name || 'Emitente', pageW / 2, y, { align: 'center' });

  // Footer
  doc.setFontSize(8).setTextColor(120);
  doc.text(
    `Recibo gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageW / 2,
    285,
    { align: 'center' },
  );

  const filename = `recibo-os-${data.os_number.toString().padStart(4, '0')}.pdf`;
  if (mode === 'blob') return doc.output('blob');
  doc.save(filename);
}
