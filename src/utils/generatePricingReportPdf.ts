import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { PricingComponent, PricingSummary } from '@/hooks/usePricingCalculator';

interface PricingReportData {
  productName: string;
  linha: string | null;
  category: string | null;
  width: number;
  height: number;
  quantity: number;
  summary: PricingSummary;
  companyName: string;
  generatedAt: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const categoryLabels: Record<string, string> = {
  janelas: 'Janela',
  portas: 'Porta',
  fachadas: 'Fachada',
  box: 'Box de Banheiro',
  espelhos: 'Espelho',
  'guarda-corpo': 'Guarda Corpo',
  'maxim-ar': 'Maxim-Ar',
  portao: 'Portão',
  basculante: 'Basculante',
  corrimao: 'Corrimão',
  other: 'Outros',
};

const typeLabels: Record<string, string> = {
  profile: 'Perfil',
  glass: 'Vidro',
  accessory: 'Acessório',
  service: 'Serviço',
};

export function generatePricingReportPdf(data: PricingReportData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 14;
  const contentWidth = pageWidth - marginLeft * 2;
  let y = 15;

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE PRECIFICAÇÃO', marginLeft, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em: ${data.generatedAt}`, marginLeft, y);
  doc.text(data.companyName, pageWidth - marginLeft, y, { align: 'right' });
  y += 10;

  // Product info box
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(240, 245, 255);
  doc.rect(marginLeft, y, contentWidth, 22, 'F');
  doc.setDrawColor(200, 210, 230);
  doc.rect(marginLeft, y, contentWidth, 22, 'S');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(data.productName, marginLeft + 4, y + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const infoLine = [
    data.linha ? `Linha: ${data.linha}` : null,
    data.category ? `Categoria: ${categoryLabels[data.category] || data.category}` : null,
    `Dimensões: ${data.width} × ${data.height} mm`,
    `Qtd: ${data.quantity}`,
    `Área: ${data.summary.areaM2.toFixed(4)} m²`,
  ].filter(Boolean).join('  |  ');
  doc.text(infoLine, marginLeft + 4, y + 14);
  y += 28;

  // Components table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPOSIÇÃO E CUSTOS', marginLeft, y);
  y += 5;

  const groupedByType: Record<string, PricingComponent[]> = {};
  data.summary.components.forEach(c => {
    const type = c.itemType;
    if (!groupedByType[type]) groupedByType[type] = [];
    groupedByType[type].push(c);
  });

  const tableBody: any[][] = [];
  const typeOrder = ['profile', 'glass', 'accessory', 'service'];

  typeOrder.forEach(type => {
    const items = groupedByType[type];
    if (!items || items.length === 0) return;

    // Group header
    tableBody.push([{
      content: typeLabels[type] || type,
      colSpan: 6,
      styles: { fillColor: [230, 240, 250], fontStyle: 'bold', fontSize: 9 },
    }]);

    items.forEach(c => {
      const dimensionInfo = c.itemType === 'glass'
        ? `${c.calculatedLength.toFixed(4)} m²`
        : c.itemType === 'profile'
          ? `${c.calculatedLength} mm`
          : '-';

      tableBody.push([
        c.itemName + (c.notes ? ` (${c.notes})` : ''),
        dimensionInfo,
        String(c.calculatedQuantity),
        formatCurrency(c.unitCost) + `/${c.unit}`,
        formatCurrency(c.totalCost),
        formatCurrency(c.totalPrice),
      ]);
    });
  });

  (doc as any).autoTable({
    startY: y,
    head: [['Componente', 'Medida', 'Qtd', 'Custo Unit.', 'Custo Total', 'Preço Total']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [41, 98, 255], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 55 },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    margin: { left: marginLeft, right: marginLeft },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Summary box
  if (y > 240) {
    doc.addPage();
    y = 15;
  }

  doc.setFillColor(245, 250, 255);
  doc.rect(marginLeft, y, contentWidth, 40, 'F');
  doc.setDrawColor(41, 98, 255);
  doc.rect(marginLeft, y, contentWidth, 40, 'S');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO FINANCEIRO', marginLeft + 4, y + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const col1 = marginLeft + 4;
  const col2 = marginLeft + contentWidth / 2 + 4;

  doc.text(`Custo Total: ${formatCurrency(data.summary.totalComponentCost)}`, col1, y + 15);
  doc.text(`Preço Total: ${formatCurrency(data.summary.totalComponentPrice)}`, col1, y + 22);
  doc.text(`Custo/m²: ${formatCurrency(data.summary.costPerSqm)}`, col2, y + 15);
  doc.text(`Preço/m²: ${formatCurrency(data.summary.pricePerSqm)}`, col2, y + 22);

  const marginColor = data.summary.marginPercent >= 30 ? [0, 150, 0] :
    data.summary.marginPercent >= 15 ? [200, 150, 0] : [200, 0, 0];
  doc.setTextColor(marginColor[0], marginColor[1], marginColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Margem: ${formatCurrency(data.summary.margin)} (${data.summary.marginPercent.toFixed(1)}%)`,
    col1, y + 32
  );
  doc.setTextColor(0, 0, 0);

  // Save
  const fileName = `precificacao-${data.productName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;
  doc.save(fileName);
}
