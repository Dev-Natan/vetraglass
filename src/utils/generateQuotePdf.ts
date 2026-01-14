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
  image_url?: string | null;
  linha?: string | null;
  category?: string;
  has_glass?: boolean;
  glass_color?: string;
  glass_thickness?: string;
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
  cnpj: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logo_url?: string | null;
  logo_size?: number | null;
}

// Helper to load image as base64
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getProductImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${window.location.origin}/products/${imageUrl}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCurrencyValue(value: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export async function generateQuotePdf(quote: Quote, items: QuoteItem[], company: Company | null, mode: 'download' | 'print' = 'download') {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Colors
  const lightBlue: [number, number, number] = [204, 229, 255]; // Light blue background
  const headerBlue: [number, number, number] = [173, 216, 230]; // Header blue
  const textColor: [number, number, number] = [0, 0, 0]; // Black
  const mutedColor: [number, number, number] = [80, 80, 80]; // Dark gray
  const cardBorder: [number, number, number] = [200, 200, 200]; // Card border
  
  let y = 15;
  const marginLeft = 15;
  const marginRight = pageWidth - 15;
  const contentWidth = pageWidth - 30;
  
  // ========== HEADER WITH LOGO ==========
  // Try to load company logo
  let logoLoaded = false;
  let logoWidth = 0;
  if (company?.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(company.logo_url);
      if (logoBase64) {
        // Use configured logo size or default to 40mm
        logoWidth = company.logo_size || 40;
        const logoHeight = logoWidth * 0.625; // Maintain 8:5 aspect ratio
        doc.addImage(logoBase64, 'PNG', marginLeft, y, logoWidth, logoHeight);
        logoLoaded = true;
      }
    } catch {
      // Logo failed to load
    }
  }
  
  // Company info (next to logo or at start)
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
  doc.text(company?.cnpj || '-', companyInfoX + 22, y + 11);
  
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
    
    // Calculate item card height (approximate)
    const itemCardHeight = 75;
    
    // Check if we need a new page
    if (y + itemCardHeight > pageHeight - 60) {
      doc.addPage();
      y = 15;
    }
    
    // Item card header (light blue bar)
    doc.setFillColor(...headerBlue);
    doc.rect(marginLeft, y, contentWidth, 8, 'F');
    
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Localização:', marginLeft + 3, y + 5.5);
    doc.text(`Item: ${i + 1}`, marginRight - 3, y + 5.5, { align: 'right' });
    
    y += 8;
    
    // Card body with border
    const cardBodyStartY = y;
    const cardBodyHeight = 60;
    
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.5);
    doc.rect(marginLeft, y, contentWidth, cardBodyHeight, 'S');
    
    // Product image
    const imgSize = 45;
    const imgX = marginLeft + 5;
    const imgY = y + 7;
    
    // Draw image placeholder/border
    doc.setDrawColor(...cardBorder);
    doc.rect(imgX, imgY, imgSize, imgSize, 'S');
    
    // Try to load product image
    const imageUrl = getProductImageUrl(item.image_url);
    if (imageUrl) {
      try {
        const base64 = await loadImageAsBase64(imageUrl);
        if (base64) {
          doc.addImage(base64, 'PNG', imgX + 1, imgY + 1, imgSize - 2, imgSize - 2);
        }
      } catch {
        // Image failed to load
      }
    }
    
    // Item details (right of image)
    const detailsX = imgX + imgSize + 8;
    let detailsY = y + 7;
    
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    
    // Linha
    doc.setFont('helvetica', 'bold');
    doc.text('Linha:', detailsX, detailsY);
    doc.setFont('helvetica', 'normal');
    doc.text(item.linha || '-', detailsX + 20, detailsY);
    
    detailsY += 5;
    
    // Modelo
    doc.setFont('helvetica', 'bold');
    doc.text('Modelo:', detailsX, detailsY);
    doc.setFont('helvetica', 'normal');
    const modelText = item.description.length > 50 ? item.description.substring(0, 50) + '...' : item.description;
    doc.text(modelText, detailsX + 20, detailsY);
    
    detailsY += 5;
    
    // Cor
    doc.setFont('helvetica', 'bold');
    doc.text('Cor:', detailsX, detailsY);
    doc.setFont('helvetica', 'normal');
    doc.text(item.glass_color || '-', detailsX + 20, detailsY);
    
    detailsY += 5;
    
    // Vidro(s)
    doc.setFont('helvetica', 'bold');
    doc.text('Vidro(s):', detailsX, detailsY);
    doc.setFont('helvetica', 'normal');
    let glassInfo = '-';
    if (item.has_glass && item.glass_thickness) {
      const glassColor = item.glass_color || 'Vidro';
      glassInfo = `${glassColor} ${item.glass_thickness}`;
    } else if (item.has_glass === false) {
      glassInfo = 'Sem vidro';
    }
    const glassText = glassInfo.length > 45 ? glassInfo.substring(0, 45) + '...' : glassInfo;
    doc.text(glassText, detailsX + 20, detailsY);
    
    detailsY += 5;
    
    // Observação
    doc.setFont('helvetica', 'bold');
    doc.text('Observação:', detailsX, detailsY);
    doc.setFont('helvetica', 'normal');
    const obsText = item.notes || '';
    doc.text(obsText.length > 40 ? obsText.substring(0, 40) + '...' : obsText, detailsX + 28, detailsY);
    
    // Table inside card
    const tableY = cardBodyStartY + 32;
    const tableWidth = contentWidth - imgSize - 18;
    
    // Calculate area
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
  // Check if we need a new page for totals
  if (y + 100 > pageHeight - 20) {
    doc.addPage();
    y = 15;
  }
  
  // Valor total dos produtos row
  doc.setFillColor(...headerBlue);
  doc.rect(marginLeft, y, contentWidth, 10, 'F');
  
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL DOS PRODUTOS', marginLeft + 5, y + 7);
  doc.text(formatCurrency(quote.total_amount), marginRight - 5, y + 7, { align: 'right' });
  
  y += 15;
  
  // ========== FORMAS DE PAGAMENTO ==========
  doc.setFillColor(...lightBlue);
  doc.rect(marginLeft, y, contentWidth, 10, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('FORMAS DE PAGAMENTO', marginLeft + 5, y + 7);
  
  y += 15;
  
  // À Vista com desconto
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
    doc.text(`Desconto de ${quote.discount_percent}%: -${formatCurrency(quote.discount_amount || 0)}`, marginLeft + 5, y + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 128, 0); // Green for discount price
    doc.text(formatCurrency(quote.final_amount), marginRight - 5, y + 14, { align: 'right' });
    y += 20;
  } else {
    doc.setTextColor(...textColor);
    doc.text(formatCurrency(quote.total_amount), marginRight - 5, y + 7, { align: 'right' });
    y += 12;
  }
  
  y += 5;
  
  // Cartão de Crédito
  doc.setDrawColor(...cardBorder);
  doc.rect(marginLeft, y, contentWidth, 12, 'S');
  
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.text('CARTAO DE CREDITO', marginLeft + 5, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(quote.total_amount), marginRight - 5, y + 8, { align: 'right' });
  
  y += 17;
  
  // Condições de pagamento personalizadas
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
  
  // Valor final destacado
  doc.setFillColor(...headerBlue);
  doc.rect(marginLeft, y, contentWidth, 12, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...textColor);
  doc.text('VALOR À VISTA COM DESCONTO', marginLeft + 5, y + 8);
  doc.text(formatCurrency(quote.final_amount), marginRight - 5, y + 8, { align: 'right' });
  
  // Save or Print PDF
  const customerSlug = quote.customer_name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  if (mode === 'print') {
    // Open PDF in new window for printing
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
