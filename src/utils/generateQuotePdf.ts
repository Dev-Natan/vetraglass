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
}

const categoryLabels: Record<string, string> = {
  window: 'Janela',
  door: 'Porta',
  partition: 'Divisória',
  mirror: 'Espelho',
  shower: 'Box',
  facade: 'Fachada',
  guarda_corpo: 'Guarda Corpo',
  other: 'Outros',
};

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

export async function generateQuotePdf(quote: Quote, items: QuoteItem[], company: Company | null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Colors
  const primaryColor: [number, number, number] = [0, 102, 204]; // Blue
  const textColor: [number, number, number] = [0, 0, 0]; // Black
  const mutedColor: [number, number, number] = [100, 100, 100]; // Gray
  const headerBg: [number, number, number] = [240, 240, 240]; // Light gray
  
  let y = 15;
  const marginLeft = 15;
  const marginRight = pageWidth - 15;
  
  // ========== HEADER ==========
  // Title "Orçamento"
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('Orçamento', marginLeft, y);
  
  y += 12;
  
  // Company info section
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Empresa:', marginLeft, y);
  doc.setFont('helvetica', 'normal');
  doc.text(company?.name || '-', marginLeft + 25, y);
  
  // Quote code on the right
  doc.setFont('helvetica', 'bold');
  doc.text('Código:', marginRight - 60, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`ORC${quote.quote_number.toString().padStart(2, '0')}`, marginRight - 35, y);
  
  y += 6;
  
  doc.setFont('helvetica', 'bold');
  doc.text('CNPJ:', marginLeft, y);
  doc.setFont('helvetica', 'normal');
  doc.text(company?.cnpj || '-', marginLeft + 25, y);
  
  y += 6;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Telefone:', marginLeft, y);
  doc.setFont('helvetica', 'normal');
  doc.text(company?.phone || '-', marginLeft + 25, y);
  
  y += 6;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Email:', marginLeft, y);
  doc.setFont('helvetica', 'normal');
  doc.text(company?.email || '-', marginLeft + 25, y);
  
  y += 12;
  
  // ========== CLIENT SECTION ==========
  doc.setFillColor(...primaryColor);
  doc.rect(marginLeft, y, pageWidth - 30, 7, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Cliente:', marginLeft + 3, y + 5);
  
  y += 7;
  
  // Client name
  doc.setFillColor(...headerBg);
  doc.rect(marginLeft, y, pageWidth - 30, 7, 'F');
  
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(quote.customer_name.toUpperCase(), marginLeft + 3, y + 5);
  
  y += 10;
  
  // Date
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.text(`Data de elaboração do orçamento: ${format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}`, marginLeft, y);
  
  y += 12;
  
  // ========== ITEMS SECTION ==========
  doc.setFillColor(...primaryColor);
  doc.rect(marginLeft, y, pageWidth - 30, 7, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Itens', marginLeft + 3, y + 5);
  
  y += 12;
  
  // Loop through items
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Check if we need a new page
    if (y + 60 > pageHeight - 40) {
      doc.addPage();
      y = 15;
    }
    
    // Item header with number
    doc.setFillColor(...headerBg);
    doc.rect(marginLeft, y, pageWidth - 30, 7, 'F');
    
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Item: ${i + 1}`, marginLeft + 3, y + 5);
    
    y += 10;
    
    // Item details
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Localização (if notes contain location info)
    doc.setFont('helvetica', 'bold');
    doc.text('Localização:', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.text('', marginLeft + 30, y); // Empty or could be derived from notes
    
    y += 5;
    
    // Linha
    doc.setFont('helvetica', 'bold');
    doc.text('Linha:', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.text(item.linha || '-', marginLeft + 30, y);
    
    y += 5;
    
    // Modelo (description)
    doc.setFont('helvetica', 'bold');
    doc.text('Modelo:', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    const modelText = item.description.length > 60 ? item.description.substring(0, 60) + '...' : item.description;
    doc.text(modelText, marginLeft + 30, y);
    
    y += 5;
    
    // Cor (from category or could be extracted)
    doc.setFont('helvetica', 'bold');
    doc.text('Cor:', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.text(item.glass_color || '-', marginLeft + 30, y);
    
    y += 5;
    
    // Vidro(s)
    doc.setFont('helvetica', 'bold');
    doc.text('Vidro(s):', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    let glassInfo = '-';
    if (item.has_glass && item.glass_thickness) {
      glassInfo = `${item.glass_color || 'Vidro'} ${item.glass_thickness}`;
    } else if (item.has_glass === false) {
      glassInfo = 'Sem vidro';
    }
    doc.text(glassInfo, marginLeft + 30, y);
    
    y += 5;
    
    // Observação
    doc.setFont('helvetica', 'bold');
    doc.text('Observação:', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.text(item.notes || '', marginLeft + 30, y);
    
    y += 8;
    
    // Calculate area (in cm² as shown in the example: 1900x2100 = 3990)
    const width = item.width || 0;
    const height = item.height || 0;
    const areaValue = Math.round((width * height) / 1000); // Simplified area calc
    
    // Table for dimensions
    autoTable(doc, {
      startY: y,
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
        fontSize: 9,
        cellPadding: 3,
        halign: 'center',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        textColor: [0, 0, 0],
      },
      margin: { left: marginLeft, right: 15 },
      tableWidth: pageWidth - 30,
    });
    
    y = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // ========== TOTALS SECTION ==========
  // Check if we need a new page for totals
  if (y + 50 > pageHeight - 20) {
    doc.addPage();
    y = 15;
  }
  
  // Valor total header
  doc.setFillColor(...primaryColor);
  doc.rect(marginLeft, y, pageWidth - 30, 7, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Valor total', marginLeft + 3, y + 5);
  
  y += 12;
  
  // Total value
  doc.setTextColor(...textColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(quote.total_amount), marginLeft, y);
  
  y += 10;
  
  // Desconto header
  doc.setFillColor(...primaryColor);
  doc.rect(marginLeft, y, pageWidth - 30, 7, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Desconto', marginLeft + 3, y + 5);
  
  y += 12;
  
  // Discount value
  doc.setTextColor(...textColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const discountDisplay = quote.discount_amount && quote.discount_amount > 0 
    ? formatCurrency(quote.discount_amount) 
    : '0';
  doc.text(discountDisplay, marginLeft, y);
  
  y += 10;
  
  // Valor líquido header
  doc.setFillColor(...primaryColor);
  doc.rect(marginLeft, y, pageWidth - 30, 7, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Valor líquido', marginLeft + 3, y + 5);
  
  y += 12;
  
  // Final value
  doc.setTextColor(...textColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(quote.final_amount), marginLeft, y);
  
  y += 10;
  
  // Formas de pagamento header
  doc.setFillColor(...primaryColor);
  doc.rect(marginLeft, y, pageWidth - 30, 7, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Formas de pagamento', marginLeft + 3, y + 5);
  
  y += 12;
  
  // Payment terms
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(quote.payment_terms || 'A combinar', marginLeft, y);
  
  // Save PDF
  const customerSlug = quote.customer_name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  doc.save(`orcamento-orc${quote.quote_number.toString().padStart(2, '0')}-${customerSlug}.pdf`);
}
