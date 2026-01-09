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
  logo_url?: string | null;
}

const glassColorLabels: Record<string, string> = {
  incolor: 'Incolor',
  verde: 'Verde',
  fume: 'Fumê',
};

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

export async function generateQuotePdf(quote: Quote, items: QuoteItem[], company: Company | null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // blue-500
  const textColor: [number, number, number] = [30, 41, 59]; // slate-800
  const mutedColor: [number, number, number] = [100, 116, 139]; // slate-500
  const successColor: [number, number, number] = [34, 197, 94]; // green-500
  const warningColor: [number, number, number] = [234, 179, 8]; // yellow-500
  
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
  
  // Section title - Products
  doc.setTextColor(...textColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUTOS', 15, y);
  y += 8;
  
  // Product cards with images
  const cardHeight = 45;
  const imageSize = 35;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Check if we need a new page
    if (y + cardHeight > pageHeight - 60) {
      doc.addPage();
      y = 20;
    }
    
    // Card background
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(15, y, pageWidth - 30, cardHeight, 3, 3, 'FD');
    
    // Item number badge
    doc.setFillColor(...primaryColor);
    doc.circle(22, y + 8, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text((i + 1).toString(), 22, y + 9.5, { align: 'center' });
    
    // Product image placeholder
    const imgX = 30;
    const imgY = y + 5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(imgX, imgY, imageSize, imageSize, 2, 2, 'FD');
    
    // Try to load and add product image
    const imageUrl = getProductImageUrl(item.image_url);
    if (imageUrl) {
      try {
        const base64 = await loadImageAsBase64(imageUrl);
        if (base64) {
          doc.addImage(base64, 'PNG', imgX + 2, imgY + 2, imageSize - 4, imageSize - 4);
        }
      } catch {
        // Image failed to load, keep placeholder
      }
    }
    
    // Product info - starts after image
    const infoX = imgX + imageSize + 8;
    
    // Product name
    doc.setTextColor(...textColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const productName = item.description.length > 40 ? item.description.substring(0, 40) + '...' : item.description;
    doc.text(productName, infoX, y + 10);
    
    // Linha and Category badges
    let badgeX = infoX;
    doc.setFontSize(7);
    
    if (item.linha) {
      doc.setFillColor(229, 231, 235); // gray-200
      const linhaWidth = doc.getTextWidth(item.linha) + 6;
      doc.roundedRect(badgeX, y + 13, linhaWidth, 6, 1, 1, 'F');
      doc.setTextColor(...mutedColor);
      doc.setFont('helvetica', 'normal');
      doc.text(item.linha, badgeX + 3, y + 17);
      badgeX += linhaWidth + 3;
    }
    
    if (item.category) {
      const catLabel = categoryLabels[item.category] || item.category;
      doc.setFillColor(219, 234, 254); // blue-100
      const catWidth = doc.getTextWidth(catLabel) + 6;
      doc.roundedRect(badgeX, y + 13, catWidth, 6, 1, 1, 'F');
      doc.setTextColor(59, 130, 246); // blue-500
      doc.text(catLabel, badgeX + 3, y + 17);
      badgeX += catWidth + 3;
    }
    
    // Glass info badges
    if (item.has_glass !== undefined) {
      if (item.has_glass) {
        // Com Vidro badge
        doc.setFillColor(220, 252, 231); // green-100
        const glassText = 'Com Vidro';
        const glassWidth = doc.getTextWidth(glassText) + 6;
        doc.roundedRect(badgeX, y + 13, glassWidth, 6, 1, 1, 'F');
        doc.setTextColor(34, 197, 94); // green-500
        doc.text(glassText, badgeX + 3, y + 17);
        badgeX += glassWidth + 3;
        
        // Glass color
        if (item.glass_color) {
          const colorLabel = glassColorLabels[item.glass_color] || item.glass_color;
          doc.setFillColor(191, 219, 254); // blue-200
          const colorWidth = doc.getTextWidth(colorLabel) + 6;
          doc.roundedRect(badgeX, y + 13, colorWidth, 6, 1, 1, 'F');
          doc.setTextColor(30, 64, 175); // blue-800
          doc.text(colorLabel, badgeX + 3, y + 17);
          badgeX += colorWidth + 3;
        }
        
        // Glass thickness
        if (item.glass_thickness) {
          doc.setFillColor(187, 247, 208); // green-200
          const thickWidth = doc.getTextWidth(item.glass_thickness) + 6;
          doc.roundedRect(badgeX, y + 13, thickWidth, 6, 1, 1, 'F');
          doc.setTextColor(21, 128, 61); // green-700
          doc.text(item.glass_thickness, badgeX + 3, y + 17);
        }
      } else {
        // Sem Vidro badge
        doc.setFillColor(254, 226, 226); // red-100
        const noGlassText = 'Sem Vidro';
        const noGlassWidth = doc.getTextWidth(noGlassText) + 6;
        doc.roundedRect(badgeX, y + 13, noGlassWidth, 6, 1, 1, 'F');
        doc.setTextColor(220, 38, 38); // red-600
        doc.text(noGlassText, badgeX + 3, y + 17);
      }
    }
    
    // Dimensions and quantity row
    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    const dimensions = item.width && item.height ? `${item.width} x ${item.height} mm` : '-';
    const area = item.width && item.height ? ((item.width / 1000) * (item.height / 1000)).toFixed(2) + ' m²' : '';
    doc.text(`Medidas: ${dimensions}  ${area ? '|  Área: ' + area : ''}  |  Qtd: ${item.quantity}`, infoX, y + 28);
    
    // Price info on the right
    const priceX = pageWidth - 20;
    
    doc.setTextColor(...mutedColor);
    doc.setFontSize(8);
    doc.text('Unitário:', priceX - 35, y + 12);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(item.unit_price), priceX, y + 12, { align: 'right' });
    
    doc.setTextColor(...primaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(item.total_price), priceX, y + 24, { align: 'right' });
    
    doc.setTextColor(...mutedColor);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Total do item', priceX, y + 30, { align: 'right' });
    
    y += cardHeight + 5;
  }
  
  // Check if we need a new page for totals
  if (y + 60 > pageHeight - 30) {
    doc.addPage();
    y = 20;
  }
  
  y += 10;
  
  // Totals section
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(pageWidth - 95, y, 80, 50, 3, 3, 'F');
  
  let totalsY = y + 12;
  const totalsX = pageWidth - 90;
  
  doc.setTextColor(...mutedColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', totalsX, totalsY);
  doc.setTextColor(...textColor);
  doc.text(formatCurrency(quote.total_amount), pageWidth - 20, totalsY, { align: 'right' });
  
  if (quote.discount_amount && quote.discount_amount > 0) {
    totalsY += 10;
    doc.setTextColor(220, 38, 38); // red-600
    doc.text(`Desconto (${quote.discount_percent || 0}%):`, totalsX, totalsY);
    doc.text(`-${formatCurrency(quote.discount_amount)}`, pageWidth - 20, totalsY, { align: 'right' });
  }
  
  totalsY += 15;
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.line(totalsX, totalsY - 5, pageWidth - 20, totalsY - 5);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('TOTAL:', totalsX, totalsY);
  doc.text(formatCurrency(quote.final_amount), pageWidth - 20, totalsY, { align: 'right' });
  
  // Notes
  if (quote.notes) {
    const notesY = y;
    const notesWidth = pageWidth - 115;
    
    doc.setFillColor(254, 249, 195); // yellow-100
    doc.roundedRect(15, notesY, notesWidth, 50, 3, 3, 'F');
    
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações:', 20, notesY + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    const splitNotes = doc.splitTextToSize(quote.notes, notesWidth - 15);
    doc.text(splitNotes.slice(0, 4), 20, notesY + 18);
  }
  
  // Footer
  const footerY = pageHeight - 15;
  doc.setDrawColor(226, 232, 240);
  doc.line(15, footerY - 8, pageWidth - 15, footerY - 8);
  
  doc.setTextColor(...mutedColor);
  doc.setFontSize(8);
  doc.text('Este orçamento é válido conforme as condições estabelecidas.', pageWidth / 2, footerY - 2, { align: 'center' });
  
  if (company?.cnpj) {
    doc.text(`CNPJ: ${company.cnpj}`, pageWidth / 2, footerY + 4, { align: 'center' });
  }
  
  // Save PDF
  doc.save(`orcamento-${quote.quote_number.toString().padStart(4, '0')}.pdf`);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
