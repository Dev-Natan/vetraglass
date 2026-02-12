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

export async function generateQuotePdf(
  quote: Quote, 
  items: QuoteItem[], 
  company: Company | null, 
  mode: 'download' | 'print' = 'download',
  paymentSettings?: PaymentSettings | null
) {
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
  
  const companyInfoX = logoLoaded ? marginLeft + logoWidth + 5 : marginLeft;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  
  doc.text('Empresa:', companyInfoX, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(company?.name || '-', companyInfoX + 22, y + 5);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text('CNPJ:', companyInfoX, y + 11);
  doc.setTextColor(...textColor);
  doc.text(company?.cnpj ? company.cnpj : '-', companyInfoX + 22, y + 11);
  
  doc.setTextColor(...mutedColor);
  doc.text('Telefone:', companyInfoX, y + 17);
  doc.setTextColor(...textColor);
  doc.text(company?.phone || '-', companyInfoX + 22, y + 17);
  
  doc.setTextColor(...mutedColor);
  doc.text('Email:', companyInfoX, y + 23);
  doc.setTextColor(...textColor);
  doc.text(company?.email || '-', companyInfoX + 22, y + 23);
  
  // Quote code on the right
  doc.setTextColor(...mutedColor);
  doc.setFontSize(9);
  doc.text('Código:', marginRight - 35, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.text(`ORC${quote.quote_number.toString().padStart(2, '0')}`, marginRight - 35, y + 12);
  
  y += 35;
  
  // ========== CLIENT SECTION ==========
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  doc.text('Cliente:', marginLeft, y);
  
  y += 5;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(quote.customer_name.toUpperCase(), marginLeft, y);
  
  y += 6;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Data de elaboração do orçamento:', marginLeft, y);
  
  y += 5;
  
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR }), marginLeft, y);
  
  y += 12;
  
  // ========== ITEMS SECTION ==========
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    const itemCardHeight = 75;
    
    if (y + itemCardHeight > pageHeight - 60) {
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
    const cardBodyHeight = 60;
    
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.5);
    doc.rect(marginLeft, y, contentWidth, cardBodyHeight, 'S');
    
    const imgSize = 45;
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
    
    detailsY += 5;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Observação:', detailsX, detailsY);
    doc.setFont('helvetica', 'normal');
    const obsText = item.notes || '';
    doc.text(obsText.length > 40 ? obsText.substring(0, 40) + '...' : obsText, detailsX + 28, detailsY);
    
    const tableY = cardBodyStartY + 32;
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
  
  // ========== TOTALS AND PAYMENT SECTION ==========
  if (y + 100 > pageHeight - 20) {
    doc.addPage();
    y = 15;
  }
  
  doc.setFillColor(...headerBlue);
  doc.rect(marginLeft, y, contentWidth, 10, 'F');
  
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL DOS PRODUTOS', marginLeft + 5, y + 7);
  doc.text(formatCurrency(quote.total_amount), marginRight - 5, y + 7, { align: 'right' });
  
  y += 15;
  
  // ========== FORMAS DE PAGAMENTO (ENHANCED) ==========
  doc.setFillColor(...lightBlue);
  doc.rect(marginLeft, y, contentWidth, 10, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('FORMAS DE PAGAMENTO', marginLeft + 5, y + 7);
  
  y += 15;

  // Get payment methods and settings
  const methods = paymentSettings?.methods || [];
  const showFees = paymentSettings?.showFeesToCustomer ?? false;
  const showOtherMethods = paymentSettings?.showOtherMethods ?? true;
  const showInstallments = paymentSettings?.showInstallments ?? true;
  const displayMode = paymentSettings?.displayMode || 'simple';
  const customConditions = paymentSettings?.customConditions || '';

  // Check if we have configured payment methods
  const hasConfiguredMethods = methods.length > 0;

  if (hasConfiguredMethods) {
    // ===== À VISTA (PIX/Dinheiro with discount) =====
    const discountMethods = methods.filter(m => m.enabled && m.discountPercent && m.discountPercent > 0);
    
    if (discountMethods.length > 0) {
      const maxDiscount = Math.max(...discountMethods.map(m => m.discountPercent || 0));
      const methodNames = discountMethods.map(m => m.name).join(' / ');
      const discountedValue = quote.total_amount * (1 - maxDiscount / 100);
      
      doc.setDrawColor(...cardBorder);
      doc.setLineWidth(0.5);
      doc.rect(marginLeft, y, contentWidth, 18, 'S');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...greenColor);
      doc.text('A VISTA', marginLeft + 5, y + 6);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...textColor);
      doc.text(`${methodNames}: `, marginLeft + 5, y + 13);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...greenColor);
      doc.text(formatCurrency(discountedValue), marginLeft + 45, y + 13);
      
      y += 23;
    }

    // ===== CARTÃO DE CRÉDITO =====
    if (showInstallments) {
      const creditMethod = methods.find(m => m.id === 'credito' && m.enabled);
      
      if (creditMethod && creditMethod.maxInstallments && creditMethod.maxInstallments > 0) {
        const noFeeInstallments = creditMethod.noFeeInstallments || 0;
        const maxInstallments = creditMethod.maxInstallments;
        const installmentFees = creditMethod.installmentFees || [];
        
        // Determine which installments to show
        let installmentsToShow: number[] = [];
        if (displayMode === 'simple') {
          // Show main installments: 1, 3, 6, 10, 12 (if available)
          installmentsToShow = [1, 3, 6, 10, 12].filter(i => i <= maxInstallments);
        } else {
          // Show all installments
          installmentsToShow = Array.from({ length: maxInstallments }, (_, i) => i + 1);
        }
        
        // Calculate card height based on content
        const cardHeight = displayMode === 'simple' ? 35 : 20 + (Math.ceil(installmentsToShow.length / 3) * 8);
        
        doc.setDrawColor(...cardBorder);
        doc.rect(marginLeft, y, contentWidth, cardHeight, 'S');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...textColor);
        doc.text('PARCELAMENTO NO CARTAO', marginLeft + 5, y + 6);
        
        y += 10;
        
        // Separate interest-free and with-interest installments
        const noFeeOptions = installmentsToShow.filter(i => i <= noFeeInstallments);
        const withFeeOptions = installmentsToShow.filter(i => i > noFeeInstallments);
        
        // Interest-free installments
        if (noFeeOptions.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...greenColor);
          doc.text('SEM JUROS', marginLeft + 5, y + 4);
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...textColor);
          
          let xPos = marginLeft + 35;
          noFeeOptions.forEach((inst, idx) => {
            const value = quote.total_amount / inst;
            const text = `${inst}x ${formatCurrency(value)}`;
            doc.text(text, xPos, y + 4);
            xPos += 45;
            if (idx < noFeeOptions.length - 1 && xPos < marginRight - 50) {
              doc.text('|', xPos - 5, y + 4);
            }
          });
          
          y += 8;
        }
        
        // With-interest installments
        if (withFeeOptions.length > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...mutedColor);
          doc.text('PARCELADO', marginLeft + 5, y + 4);
          
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...textColor);
          
          let xPos = marginLeft + 35;
          withFeeOptions.forEach((inst, idx) => {
            const fee = installmentFees.find(f => f.installment === inst)?.fee || 0;
            const installmentValue = calculateInstallmentValue(quote.total_amount, inst, fee);
            
            let text = `${inst}x ${formatCurrency(installmentValue)}`;
            
            // Show fees if enabled
            if (showFees && fee > 0) {
              const totalWithFee = quote.total_amount * (1 + fee / 100);
              text = `${inst}x ${formatCurrency(installmentValue)} (${fee.toFixed(2)}% - Total ${formatCurrency(totalWithFee)})`;
            }
            
            doc.text(text, xPos, y + 4);
            
            if (showFees) {
              xPos += 90;
            } else {
              xPos += 45;
              if (idx < withFeeOptions.length - 1 && xPos < marginRight - 50) {
                doc.text('|', xPos - 5, y + 4);
              }
            }
            
            // Line break for detailed mode with fees
            if (showFees && idx < withFeeOptions.length - 1) {
              y += 6;
              xPos = marginLeft + 35;
            }
          });
          
          y += 8;
        }
        
        y += 5;
      }
    }

    // ===== OTHER PAYMENT METHODS =====
    if (showOtherMethods) {
      const otherMethods = methods.filter(m => 
        m.enabled && 
        m.id !== 'pix' && 
        m.id !== 'dinheiro' && 
        m.id !== 'credito' &&
        !m.discountPercent
      );
      
      if (otherMethods.length > 0) {
        doc.setDrawColor(...cardBorder);
        doc.rect(marginLeft, y, contentWidth, 12, 'S');
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...textColor);
        
        const methodTexts = otherMethods.map(m => {
          if (m.feePercent && m.feePercent > 0 && showFees) {
            return `${m.name} (+${m.feePercent}%)`;
          }
          return m.name;
        });
        
        doc.text(`Também aceitamos: ${methodTexts.join(', ')}`, marginLeft + 5, y + 8);
        
        y += 17;
      }
    }

    // ===== CONDIÇÕES ESPECIAIS =====
    if (customConditions.trim()) {
      const lines = customConditions.split('\n');
      const boxHeight = 10 + (lines.length * 5);
      
      doc.setDrawColor(...cardBorder);
      doc.rect(marginLeft, y, contentWidth, boxHeight, 'S');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...mutedColor);
      doc.text('CONDICOES ESPECIAIS:', marginLeft + 5, y + 6);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textColor);
      lines.forEach((line, idx) => {
        doc.text(line.substring(0, 80), marginLeft + 5, y + 11 + (idx * 5));
      });
      
      y += boxHeight + 5;
    }

  } else {
    // ===== FALLBACK: Original payment section when no settings configured =====
    const hasDiscount = quote.discount_percent && quote.discount_percent > 0;
    
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.5);
    doc.rect(marginLeft, y, contentWidth, hasDiscount ? 20 : 12, 'S');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('A VISTA (PIX / Dinheiro / Transferencia)', marginLeft + 5, y + 7);
    
    if (hasDiscount) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mutedColor);
      doc.text(`Desconto: -${formatCurrency(quote.discount_amount || 0)}`, marginLeft + 5, y + 14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 128, 0);
      doc.text(formatCurrency(quote.final_amount), marginRight - 5, y + 14, { align: 'right' });
      y += 20;
    } else {
      doc.setTextColor(...textColor);
      doc.text(formatCurrency(quote.total_amount), marginRight - 5, y + 7, { align: 'right' });
      y += 12;
    }
    
    y += 5;
    
    doc.setDrawColor(...cardBorder);
    doc.rect(marginLeft, y, contentWidth, 12, 'S');
    
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('CARTAO DE CREDITO', marginLeft + 5, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(quote.total_amount), marginRight - 5, y + 8, { align: 'right' });
    
    y += 17;
    
    if (quote.payment_terms) {
      doc.setDrawColor(...cardBorder);
      doc.rect(marginLeft, y, contentWidth, 12, 'S');
      
      doc.setFont('helvetica', 'bold');
      doc.text('CONDICOES ESPECIAIS:', marginLeft + 5, y + 8);
      doc.setFont('helvetica', 'normal');
      const termsText = quote.payment_terms.length > 60 ? quote.payment_terms.substring(0, 60) + '...' : quote.payment_terms;
      doc.text(termsText, marginLeft + 48, y + 8);
      
      y += 17;
    }
  }
  
  // ===== VALOR FINAL DESTACADO =====
  doc.setFillColor(...headerBlue);
  doc.rect(marginLeft, y, contentWidth, 12, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...textColor);
  doc.text('VALOR FINAL', marginLeft + 5, y + 8);
  doc.text(formatCurrency(quote.final_amount), marginRight - 5, y + 8, { align: 'right' });
  
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