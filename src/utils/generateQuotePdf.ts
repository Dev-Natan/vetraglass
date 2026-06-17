import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  preloadImages, 
  getCachedImage, 
  getProductImageUrl,
  collectQuoteImageUrls 
} from './pdfImageLoader';
import { cropImageToCircle } from './cropImageToCircle';

interface QuoteComponent {
  description: string;
  quantity: number;
  unit_price: number;
}

interface QuoteItem {
  description: string;
  width: number | null;
  height: number | null;
  width_b?: number | null;
  height_b?: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url?: string | null;
  linha?: string | null;
  category?: string;
  has_glass?: boolean;
  glass_color?: string;
  glass_thickness?: string;
  aluminum_color?: string | null;
  notes?: string | null;
  location?: string | null;
  components?: QuoteComponent[];
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
  payment_terms?: string | null;
}

interface Company {
  name: string;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logo_url?: string | null;
  logo_size?: number | null;
}

interface InstallmentFee {
  installment: number;
  fee: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  maxInstallments?: number;
  discountPercent?: number;
  feePercent?: number;
  installmentFees?: InstallmentFee[];
  noFeeInstallments?: number;
}

export interface PaymentSettings {
  methods: PaymentMethod[];
  customConditions: string;
  showFeesToCustomer: boolean;
  displayMode: 'simple' | 'detailed';
  showOtherMethods: boolean;
  showInstallments: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCurrencyValue(value: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

type JsPdfImageFormat = 'PNG' | 'JPEG';

function inferJsPdfImageFormat(dataUrl: string): JsPdfImageFormat {
  const head = dataUrl.slice(0, 32).toLowerCase();
  if (head.startsWith('data:image/png')) return 'PNG';
  if (head.startsWith('data:image/jpg') || head.startsWith('data:image/jpeg')) return 'JPEG';
  return 'JPEG';
}




export interface QuotePdfOptions {
  showMeasuresColumn?: boolean;
  showM2Column?: boolean;
}

export async function generateQuotePdf(
  quote: Quote, 
  items: QuoteItem[], 
  company: Company | null, 
  mode: 'download' | 'print' = 'download',
  paymentSettings?: PaymentSettings | null,
  options: QuotePdfOptions = {}
) {
  const showMeasuresColumn = options.showMeasuresColumn !== false;
  const showM2Column = options.showM2Column !== false;
  
  const logoUrl = company?.logo_url ? getProductImageUrl(company.logo_url) : null;
  const imageUrls = collectQuoteImageUrls(items, logoUrl);
  await preloadImages(imageUrls);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  let y = 15;
  const marginLeft = 15;
  const marginRight = pageWidth - 15;
  const contentWidth = pageWidth - 30;
  
  // ========== SLIM HEADER ==========
  let logoHeight = 0;
  let logoRenderedWidth = 0;
  const maxLogoBox = company?.logo_size || 15;
  if (logoUrl) {
    const logoBase64 = getCachedImage(logoUrl);
    if (logoBase64) {
      try {
        const circularPng = await cropImageToCircle(logoBase64);
        logoRenderedWidth = maxLogoBox;
        logoHeight = maxLogoBox;
        doc.addImage(circularPng, 'PNG', marginLeft, y, logoRenderedWidth, logoHeight);
      } catch {
        logoRenderedWidth = maxLogoBox;
        logoHeight = maxLogoBox;
        try {
          doc.addImage(logoBase64, inferJsPdfImageFormat(logoBase64), marginLeft, y, logoRenderedWidth, logoHeight);
        } catch {}
      }
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const companyInfoX = logoRenderedWidth > 0 ? marginLeft + logoRenderedWidth + 5 : marginLeft;
  
  doc.text(company?.name || '', companyInfoX, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  
  let companyInfoY = y + 9;
  if (company?.cnpj) {
    doc.text(`CNPJ: ${company.cnpj}`, companyInfoX, companyInfoY);
    companyInfoY += 4;
  }
  if (company?.phone || company?.email) {
    const contact = [company?.phone, company?.email].filter(Boolean).join('  |  ');
    doc.text(contact, companyInfoX, companyInfoY);
    companyInfoY += 4;
  }
  if (company?.address) {
    doc.text(company.address, companyInfoX, companyInfoY);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`ORÇAMENTO #${quote.quote_number.toString().padStart(4, '0')}`, marginRight, y + 5, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const emissionDate = quote.created_at ? new Date(quote.created_at) : new Date();
  const validUntilDate = quote.valid_until ? new Date(quote.valid_until) : null;

  doc.text(`Emissão: ${format(emissionDate, "dd/MM/yyyy", { locale: ptBR })}`, marginRight, y + 10, { align: 'right' });
  if (validUntilDate && !isNaN(validUntilDate.getTime())) {
    doc.text(`Validade: ${format(validUntilDate, "dd/MM/yyyy", { locale: ptBR })}`, marginRight, y + 14, { align: 'right' });
  }

  y = Math.max(y + logoHeight, companyInfoY) + 10;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.1);
  doc.line(marginLeft, y, marginRight, y);
  y += 8;

  // ========== CUSTOMER INFO ==========
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('DADOS DO CLIENTE', marginLeft, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(quote.customer_name.toUpperCase(), marginLeft, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  
  let customerDetails = [];
  if (quote.customer_phone) customerDetails.push(`Tel: ${quote.customer_phone}`);
  if (quote.customer_email) customerDetails.push(`Email: ${quote.customer_email}`);
  
  if (customerDetails.length > 0) {
    y += 4;
    doc.text(customerDetails.join('   |   '), marginLeft, y);
  }
  
  if (quote.customer_address) {
    y += 4;
    doc.text(`Endereço: ${quote.customer_address}`, marginLeft, y);
  }

  y += 10;

  // ========== ITEMS TABLE ==========
  const tableHead = [
    '#',
    'Imagem',
    'Descrição / Detalhes',
    ...(showMeasuresColumn ? ['Medidas'] : []),
    ...(showM2Column ? ['Área'] : []),
    'Qtd',
    'V. Unit',
    'Total'
  ];

  const tableBody = items.map((item, index) => {
    const areaValue = (((item.width || 0) + (item.width_b || 0)) * (item.height || 0)) / 1_000_000;
    
    let description = `${item.description}`;
    let details = [];
    if (item.linha) details.push(`Linha: ${item.linha}`);
    if (item.has_glass && item.glass_thickness) {
      details.push(`Vidro: ${item.glass_color || ''} ${item.glass_thickness}`);
    }
    if (item.aluminum_color) details.push(`Acabamento: ${item.aluminum_color}`);
    
    const detailsStr = details.length > 0 ? `\n${details.join('  |  ')}` : '';
    
    let componentsStr = '';
    if (item.components && item.components.length > 0) {
      componentsStr = '\nComponentes: ' + item.components.map(c => 
        `${c.description} (${c.quantity} un x ${formatCurrencyValue(c.unit_price)})`
      ).join(', ');
    }

    const obsStr = item.notes ? `\nObs: ${item.notes}` : '';

    return [
      (index + 1).toString(),
      '', 
      `${description}${detailsStr}${componentsStr}${obsStr}`,
      ...(showMeasuresColumn ? [
        item.width_b 
          ? `A: ${item.width || 0}x${item.height || 0} | B: ${item.width_b}x${item.height_b || item.height}`
          : `${item.width || 0} x ${item.height || 0}`
      ] : []),
      ...(showM2Column ? [`${areaValue.toFixed(2)} m²`] : []),
      item.quantity.toString(),
      formatCurrencyValue(item.unit_price),
      formatCurrencyValue(item.total_price)
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [tableHead],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      valign: 'middle',
      textColor: [60, 60, 60],
      lineColor: [240, 240, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [250, 250, 250],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineWidth: 0.1,
      lineColor: [220, 220, 220],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20, minCellHeight: 18 }, 
      2: { cellWidth: 'auto' }, 
      [tableHead.indexOf('Qtd')]: { cellWidth: 10, halign: 'center' },
      [tableHead.indexOf('V. Unit')]: { cellWidth: 20, halign: 'right' },
      [tableHead.indexOf('Total')]: { cellWidth: 20, halign: 'right' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const item = items[data.row.index];
        const imageUrl = getProductImageUrl(item.image_url);
        if (imageUrl) {
          const base64 = getCachedImage(imageUrl);
          if (base64) {
            const padding = 1.5;
            const maxSize = Math.min(data.cell.width, data.cell.height) - padding * 2;
            const imgSize = Math.max(6, Math.min(14, maxSize));
            const x = data.cell.x + (data.cell.width - imgSize) / 2;
            const y = data.cell.y + (data.cell.height - imgSize) / 2;
            doc.addImage(base64, inferJsPdfImageFormat(base64), x, y, imgSize, imgSize);
          }
        }
      }
    },
  });

  y = ((doc as any).lastAutoTable.finalY || y) + 10;

  // ========== OBSERVATIONS ==========
  if (quote.notes || quote.payment_terms) {
    if (y + 30 > pageHeight - 40) {
      doc.addPage();
      y = 15;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('OBSERVAÇÕES', marginLeft, y);
    y += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    
    const obsText = [];
    if (quote.notes) obsText.push(quote.notes);
    if (quote.payment_terms) obsText.push(`Condições de pagamento: ${quote.payment_terms}`);
    
    const fullText = obsText.join('\n');
    const lines = doc.splitTextToSize(fullText, contentWidth);
    doc.text(lines, marginLeft, y);
    y += (lines.length * 4) + 8;
  }

  // ========== TOTALS SECTION ==========
  if (y + 50 > pageHeight - 20) {
    doc.addPage();
    y = 15;
  }

  const totalsX = marginRight - 80;
  
  doc.setDrawColor(220, 220, 220);
  doc.line(totalsX, y, marginRight, y);
  y += 6;

  const drawTotalLine = (label: string, value: string, isBold = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isBold ? 10 : 9);
    if (isBold) {
      doc.setTextColor(0, 0, 0);
    } else {
      doc.setTextColor(80, 80, 80);
    }
    doc.text(label, totalsX, y);
    doc.text(value, marginRight, y, { align: 'right' });
    y += 6;
  };

  drawTotalLine('Subtotal dos produtos:', formatCurrency(quote.total_amount));
  
  if ((quote.discount_amount && quote.discount_amount > 0) || (quote.discount_percent && quote.discount_percent > 0)) {
    const discountLabel = quote.discount_percent ? `Desconto (${quote.discount_percent}%):` : 'Desconto:';
    drawTotalLine(discountLabel, `- ${formatCurrency(quote.discount_amount || 0)}`);
  }

  y += 2;
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);
  doc.line(totalsX, y, marginRight, y);
  y += 8;

  drawTotalLine('VALOR TOTAL:', formatCurrency(quote.final_amount), true);
  
  y += 10;
  
  // Payment options logic
  const methods = paymentSettings?.methods || [];
  
  // 1. Credit Card Option (usually without the standard discount)
  // We show the total amount before the quote discount if applicable, 
  // or just the total amount clearly labeled for card.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('OPÇÕES DE PAGAMENTO:', marginRight, y, { align: 'right' });
  y += 6;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Cartão de Crédito: ${formatCurrency(quote.total_amount)} (sem desconto)`, marginRight, y, { align: 'right' });
  y += 5;

  // 2. Cash Option (with discount)
  const cashMethods = methods.filter(m => m.enabled && m.discountPercent && m.discountPercent > 0);
  const maxDiscount = cashMethods.length > 0 ? Math.max(...cashMethods.map(m => m.discountPercent || 0)) : 0;
  
  if (maxDiscount > 0 || quote.discount_amount) {
    // If quote already has a discount, we use final_amount as the "discounted" price
    // If not, we calculate based on maxDiscount from settings
    const cashValue = quote.final_amount; 
    const discountLabel = quote.discount_percent ? `${quote.discount_percent}%` : `${maxDiscount}%`;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(34, 139, 34);
    doc.text(`Pagamento à Vista: ${formatCurrency(cashValue)}`, marginRight, y, { align: 'right' });
  }

  const customerSlug = quote.customer_name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  if (mode === 'print') {
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  } else {
    doc.save(`orcamento-orc${quote.quote_number.toString().padStart(4, '0')}-${customerSlug}.pdf`);
  }
}
