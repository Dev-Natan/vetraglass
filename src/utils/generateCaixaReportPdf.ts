import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Movement {
  id: string;
  created_at: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  balance_after: number;
}

interface Summary {
  totalEntradas: number;
  totalSaidas: number;
  saldoLiquido: number;
  byCategory: Record<string, { entradas: number; saidas: number }>;
  registersOpened: number;
  registersClosed: number;
  totalExcessCollected: number;
  totalDifferences: number;
  countMovements: number;
}

interface Company {
  name: string;
  cnpj: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
}

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    abertura_caixa: 'Abertura de Caixa',
    fechamento_caixa: 'Fechamento de Caixa',
    reforco_caixa: 'Reforço de Caixa',
    recolhimento: 'Recolhimento',
    deposito: 'Depósito',
    retirada: 'Retirada',
    ajuste: 'Ajuste',
    compensacao: 'Compensação',
    outro: 'Outro',
  };
  return labels[category] || category;
};

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export function generateCaixaReportPdf(
  movements: Movement[],
  summary: Summary,
  periodLabel: string,
  company: Company | null,
  mode: 'download' | 'print' = 'download'
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let currentY = 20;

  // Header with company info
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Caixa', pageWidth / 2, currentY, { align: 'center' });
  currentY += 8;

  if (company) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(company.name, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;

    doc.setFontSize(9);
    doc.setTextColor(100);
    const cnpjFormatted = company.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    doc.text(`CNPJ: ${cnpjFormatted}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;

    if (company.address) {
      doc.text(company.address, pageWidth / 2, currentY, { align: 'center' });
      currentY += 4;
    }
  }

  doc.setTextColor(0);
  currentY += 4;

  // Period info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Período: ${periodLabel}`, margin, currentY);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 10;

  // Summary Cards
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');
  
  const cardWidth = (pageWidth - margin * 2 - 12) / 4;
  const cardStartX = margin + 3;
  const cardY = currentY + 5;

  // Card 1 - Entradas
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Total Entradas', cardStartX, cardY);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 139, 34);
  doc.text(formatCurrency(summary.totalEntradas), cardStartX, cardY + 7);

  // Card 2 - Saídas
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Total Saídas', cardStartX + cardWidth, cardY);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 53, 69);
  doc.text(formatCurrency(summary.totalSaidas), cardStartX + cardWidth, cardY + 7);

  // Card 3 - Saldo Líquido
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Saldo Líquido', cardStartX + cardWidth * 2, cardY);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(summary.saldoLiquido >= 0 ? 34 : 220, summary.saldoLiquido >= 0 ? 139 : 53, summary.saldoLiquido >= 0 ? 34 : 69);
  doc.text(formatCurrency(summary.saldoLiquido), cardStartX + cardWidth * 2, cardY + 7);

  // Card 4 - Caixas
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Caixas Fechados', cardStartX + cardWidth * 3, cardY);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(`${summary.registersClosed} de ${summary.registersOpened}`, cardStartX + cardWidth * 3, cardY + 7);

  // Movements count
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`${summary.countMovements} movimentações`, cardStartX, cardY + 16);

  currentY += 35;

  // Category Summary
  if (Object.keys(summary.byCategory).length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Resumo por Categoria', margin, currentY);
    currentY += 6;

    const categoryData = Object.entries(summary.byCategory).map(([category, values]) => [
      getCategoryLabel(category),
      formatCurrency(values.entradas),
      formatCurrency(values.saidas),
      formatCurrency(values.entradas - values.saidas),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Categoria', 'Entradas', 'Saídas', 'Saldo']],
      body: categoryData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: {
        1: { halign: 'right', textColor: [34, 139, 34] },
        2: { halign: 'right', textColor: [220, 53, 69] },
        3: { halign: 'right' },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Movements Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Movimentações Detalhadas', margin, currentY);
  currentY += 6;

  if (movements.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('Nenhuma movimentação encontrada no período selecionado.', margin, currentY + 5);
  } else {
    const movementData = movements.map((m) => [
      format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      m.type === 'entrada' ? 'Entrada' : 'Saída',
      getCategoryLabel(m.category),
      m.description.length > 35 ? m.description.substring(0, 35) + '...' : m.description,
      formatCurrency(m.amount),
      formatCurrency(m.balance_after),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Data/Hora', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Saldo Após']],
      body: movementData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 18 },
        2: { cellWidth: 30 },
        3: { cellWidth: 'auto' },
        4: { halign: 'right', cellWidth: 25 },
        5: { halign: 'right', cellWidth: 25 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const cellText = data.cell.raw as string;
          if (cellText === 'Entrada') {
            data.cell.styles.textColor = [34, 139, 34];
          } else {
            data.cell.styles.textColor = [220, 53, 69];
          }
        }
      },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Output
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
    doc.save(`relatorio-caixa-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }
}
