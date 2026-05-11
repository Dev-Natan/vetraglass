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

interface QuoteItem {
  description: string;
  width: number | null;
  height: number | null;
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

// Calculate installment value with fee
function calculateInstallmentValue(baseValue: number, installments: number, feePercent: number): number {
  const totalWithFee = baseValue * (1 + feePercent / 100);
  return totalWithFee / installments;
}

type JsPdfImageFormat = 'PNG' | 'JPEG';

function inferJsPdfImageFormat(dataUrl: string): JsPdfImageFormat {
  const head = dataUrl.slice(0, 32).toLowerCase();
  if (head.startsWith('data:image/png')) return 'PNG';
  if (head.startsWith('data:image/jpg') || head.startsWith('data:image/jpeg')) return 'JPEG';
  // Our PDF pipeline compresses to JPEG by default.
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
  // Preload all images in parallel before generating PDF
  const imageUrls = collectQuoteImageUrls(items, company?.logo_url);
  await preloadImages(imageUrls);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Colors
  const lightBlue: [number, number, number] = [204, 229, 255];
  const headerBlue: [number, number, number] = [173, 216, 230];
  const textColor: [number, number, number] = [0, 0, 0];
  const mutedColor: [number, number, number] = [80, 80, 80];
  const cardBorder: [number, number, number] = [200, 200, 200];
  const greenColor: [number, number, number] = [34, 139, 34];
  
  let y = 15;
  const marginLeft = 15;
  const marginRight = pageWidth - 15;
  const contentWidth = pageWidth - 30;
  
  // ========== HEADER WITH LOGO ==========
  let logoLoaded = false;
  let logoWidth = 0;
  if (company?.logo_url) {
    const logoBase64 = getCachedImage(company.logo_url);
    if (logoBase64) {
      logoWidth = company.logo_size || 40;
      const logoHeight = logoWidth * 0.625;
      doc.addImage(logoBase64, inferJsPdfImageFormat(logoBase64), marginLeft, y, logoWidth, logoHeight);
      logoLoaded = true;
    }
  }
  
  // Quote code on the top right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...textColor);
  doc.text(`ORC${quote.quote_number.toString().padStart(2, '0')}`, marginRight, y + 8, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text(format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR }), marginRight, y + 14, { align: 'right' });
  
  y += (logoLoaded ? Math.max(logoWidth * 0.625, 20) : 5) + 8;
  
  // ========== INFO BAR: EMPRESA + CLIENTE ==========
  doc.setFillColor(...lightBlue);
  doc.rect(marginLeft, y, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...textColor);
  doc.text('DADOS DA EMPRESA', marginLeft + 3, y + 5);
  y += 7;
  
  // Company info box
  doc.setDrawColor(...cardBorder);
  doc.setLineWidth(0.3);
  const companyBoxH = 22;
  doc.rect(marginLeft, y, contentWidth, companyBoxH, 'S');
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  
  const col1X = marginLeft + 3;
  const col2X = marginLeft + contentWidth / 2 + 3;
  
  doc.text('Razão Social:', col1X, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(company?.name || '-', col1X + 26, y + 5);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('CNPJ:', col1X, y + 11);
  doc.setTextColor(...textColor);
  doc.text(company?.cnpj || '-', col1X + 26, y + 11);
  
  doc.setTextColor(...mutedColor);
  doc.text('Telefone:', col2X, y + 5);
  doc.setTextColor(...textColor);
  doc.text(company?.phone || '-', col2X + 20, y + 5);
  
  doc.setTextColor(...mutedColor);
  doc.text('Email:', col2X, y + 11);
  doc.setTextColor(...textColor);
  doc.text(company?.email || '-', col2X + 20, y + 11);
  
  if (company?.address) {
    doc.setTextColor(...mutedColor);
    doc.text('Endereço:', col1X, y + 17);
    doc.setTextColor(...textColor);
    const addrText = company.address.length > 80 ? company.address.substring(0, 80) + '...' : company.address;
    doc.text(addrText, col1X + 26, y + 17);
  }
  
  y += companyBoxH + 4;
  
  // Client section header
  doc.setFillColor(...lightBlue);
  doc.rect(marginLeft, y, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...textColor);
  doc.text('DADOS DO CLIENTE', marginLeft + 3, y + 5);
  y += 7;
  
  // Client info box
  const hasClientDetails = quote.customer_phone || quote.customer_email || quote.customer_address;
  const clientBoxH = hasClientDetails ? 16 : 10;
  doc.setDrawColor(...cardBorder);
  doc.rect(marginLeft, y, contentWidth, clientBoxH, 'S');
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text('Nome:', col1X, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(quote.customer_name.toUpperCase(), col1X + 14, y + 5);
  
  if (hasClientDetails) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (quote.customer_phone) {
      doc.setTextColor(...mutedColor);
      doc.text('Telefone:', col1X, y + 11);
      doc.setTextColor(...textColor);
      doc.text(quote.customer_phone, col1X + 20, y + 11);
    }
    if (quote.customer_email) {
      doc.setTextColor(...mutedColor);
      doc.text('Email:', col2X, y + 11);
      doc.setTextColor(...textColor);
      doc.text(quote.customer_email, col2X + 14, y + 11);
    }
  }
  
  y += clientBoxH + 8;
  
  // ========== ITEMS SECTION ==========
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Calculate dynamic detail lines count
    let detailLinesCount = 2; // Linha + Modelo (always shown)
    if (item.has_glass !== false) detailLinesCount += 2; // Cor + Vidro
    if (item.aluminum_color) detailLinesCount += 1; // Acabamento
    detailLinesCount += 1; // Observação
    
    const detailsHeight = 7 + (detailLinesCount * 5) + 3; // top padding + lines + gap before table
    const tableHeight = 18; // approximate height of the mini table (header + 1 row)
    const imgSize = 45;
    const minContentHeight = Math.max(imgSize + 14, detailsHeight + tableHeight); // image or details, whichever is taller
    const cardBodyHeight = minContentHeight;
    const itemCardHeight = 8 + cardBodyHeight + 8; // header + body + gap
    
    if (y + itemCardHeight > pageHeight - 30) {
      doc.addPage();
      y = 15;
    }
    
    doc.setFillColor(...headerBlue);
    doc.rect(marginLeft, y, contentWidth, 8, 'F');
    
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Localização:', marginLeft + 3, y + 5.5);
    doc.text(`Item: ${i + 1}`, marginRight - 3, y + 5.5, { align: 'right' });
    
    y += 8;
    
    const cardBodyStartY = y;
    
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.5);
    doc.rect(marginLeft, y, contentWidth, cardBodyHeight, 'S');
    
    const imgX = marginLeft + 5;
    const imgY = y + 7;
    
    doc.setDrawColor(...cardBorder);
    doc.rect(imgX, imgY, imgSize, imgSize, 'S');
    
    const imageUrl = getProductImageUrl(item.image_url);
    if (imageUrl) {
      const base64 = getCachedImage(imageUrl);
      if (base64) {
        doc.addImage(base64, inferJsPdfImageFormat(base64), imgX + 1, imgY + 1, imgSize - 2, imgSize - 2);
      }
    }
    
    const detailsX = imgX + imgSize + 8;
    let detailsY = y + 7;
    
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Linha:', detailsX, detailsY);
    doc.setFont('helvetica', 'normal');
    doc.text(item.linha || '-', detailsX + 20, detailsY);
    
    detailsY += 5;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Modelo:', detailsX, detailsY);
    doc.setFont('helvetica', 'normal');
    const modelText = item.description.length > 50 ? item.description.substring(0, 50) + '...' : item.description;
    doc.text(modelText, detailsX + 20, detailsY);
    
    detailsY += 5;
    
    // Only show glass-related fields when the product uses glass
    if (item.has_glass !== false) {
      doc.setFont('helvetica', 'bold');
      doc.text('Cor:', detailsX, detailsY);
      doc.setFont('helvetica', 'normal');
      doc.text(item.glass_color || '-', detailsX + 20, detailsY);
      
      detailsY += 5;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Vidro(s):', detailsX, detailsY);
      doc.setFont('helvetica', 'normal');
      let glassInfo = '-';
      if (item.has_glass && item.glass_thickness) {
        const glassColor = item.glass_color || 'Vidro';
        glassInfo = `${glassColor} ${item.glass_thickness}`;
      }
      const glassText = glassInfo.length > 45 ? glassInfo.substring(0, 45) + '...' : glassInfo;
      doc.text(glassText, detailsX + 20, detailsY);
      
      detailsY += 5;
    }
    
    // Show aluminum/finish color
    if (item.aluminum_color) {
      doc.setFont('helvetica', 'bold');
      doc.text('Acabamento:', detailsX, detailsY);
      doc.setFont('helvetica', 'normal');
      doc.text(item.aluminum_color, detailsX + 28, detailsY);
      
      detailsY += 5;
    }
    
    detailsY += 3;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Observação:', detailsX, detailsY);
    doc.setFont('helvetica', 'normal');
    const obsText = item.notes || '';
    doc.text(obsText.length > 40 ? obsText.substring(0, 40) + '...' : obsText, detailsX + 28, detailsY);
    
    // Place the table after the details text
    const tableY = detailsY + 4;
    const tableWidth = contentWidth - imgSize - 18;
    
    const width = item.width || 0;
    const height = item.height || 0;
    const areaValue = Math.round((width * height) / 1000);
    
    autoTable(doc, {
      startY: tableY,
      head: [['Largura', 'Altura', 'Quantidade', 'Área', 'Valor unitário', 'Valor total']],
      body: [[
        width.toString(),
        height.toString(),
        item.quantity.toString(),
        areaValue.toString(),
        formatCurrency(item.unit_price),
        formatCurrencyValue(item.total_price)
      ]],
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        halign: 'center',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [230, 230, 230],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 7,
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      margin: { left: detailsX - 2, right: marginLeft },
      tableWidth: tableWidth,
    });
    
    y = cardBodyStartY + cardBodyHeight + 8;
  }
  
  // ========== OBSERVATIONS AND PAYMENT TERMS ==========
  if (quote.notes || quote.payment_terms) {
    if (y + 30 > pageHeight - 30) {
      doc.addPage();
      y = 15;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text('OBSERVAÇÕES DO ORÇAMENTO', marginLeft, y);
    y += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    
    const obsText = [];
    if (quote.notes) obsText.push(quote.notes);
    if (quote.payment_terms) obsText.push(`Condições de pagamento: ${quote.payment_terms}`);
    
    const fullText = obsText.join('\n\n');
    const lines = doc.splitTextToSize(fullText, contentWidth);
    doc.text(lines, marginLeft, y);
    y += (lines.length * 5) + 10;
  }

  // ========== TOTALS AND PAYMENT SECTION ==========
  if (y + 60 > pageHeight - 15) {
    doc.addPage();
    y = 15;
  }
  
  doc.setFillColor(...headerBlue);
  doc.rect(marginLeft, y, contentWidth, 14, 'F');
  
  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL DOS PRODUTOS', marginLeft + 5, y + 10);
  doc.setFontSize(13);
  doc.text(formatCurrency(quote.total_amount), marginRight - 5, y + 10, { align: 'right' });
  
  y += 16;
  
  // Show discount line if quote has discount
  const hasQuoteDiscount = (quote.discount_amount && quote.discount_amount > 0) || (quote.discount_percent && quote.discount_percent > 0);
  if (hasQuoteDiscount) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(220, 53, 69);
    const discountLabel = `Desconto: -${formatCurrency(quote.discount_amount || 0)}`;
    doc.text(discountLabel, marginLeft + 5, y + 8);
    doc.text(formatCurrency(quote.final_amount), marginRight - 5, y + 8, { align: 'right' });
    y += 12;
  }
  
  y += 4;
  
  // Get payment methods to calculate values
  const methods = paymentSettings?.methods || [];
  
  // Calculate cash value (with discount if applicable)
  const discountMethodsForFinal = methods.filter(m => m.enabled && m.discountPercent && m.discountPercent > 0);
  const maxDiscountFinal = discountMethodsForFinal.length > 0 
    ? Math.max(...discountMethodsForFinal.map(m => m.discountPercent || 0)) 
    : 0;
  // Cash value: apply payment discount on already-discounted amount (final_amount)
  const baseForPayment = hasQuoteDiscount ? quote.final_amount : quote.total_amount;
  const cashFinalValue = maxDiscountFinal > 0 
    ? baseForPayment * (1 - maxDiscountFinal / 100) 
    : baseForPayment;
  const cardFinalValue = quote.total_amount;
  
  // Check page break
  if (y + 35 > pageHeight - 15) {
    doc.addPage();
    y = 15;
  }
  
  // VALOR À VISTA
  doc.setFillColor(220, 245, 220);
  doc.rect(marginLeft, y, contentWidth, 14, 'F');
  doc.setDrawColor(...cardBorder);
  doc.rect(marginLeft, y, contentWidth, 14, 'S');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...greenColor);
  doc.text('VALOR À VISTA', marginLeft + 5, y + 10);
  doc.setFontSize(13);
  doc.text(formatCurrency(cashFinalValue), marginRight - 5, y + 10, { align: 'right' });
  
  y += 16;
  
  // VALOR NO CARTÃO
  doc.setFillColor(...headerBlue);
  doc.rect(marginLeft, y, contentWidth, 14, 'F');
  doc.setDrawColor(...cardBorder);
  doc.rect(marginLeft, y, contentWidth, 14, 'S');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...textColor);
  doc.text('VALOR NO CARTÃO', marginLeft + 5, y + 10);
  doc.setFontSize(13);
  doc.text(formatCurrency(cardFinalValue), marginRight - 5, y + 10, { align: 'right' });
  
  // Save or Print PDF
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
    doc.save(`orcamento-orc${quote.quote_number.toString().padStart(2, '0')}-${customerSlug}.pdf`);
  }
}