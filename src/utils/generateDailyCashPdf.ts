import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CashMovement {
  id: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  created_at: string;
  payment_method?: string | null;
}

interface Sale {
  id: string;
  sale_number: number;
  customer_name: string | null;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

interface CashRegister {
  id: string;
  opened_at: string;
  opening_amount: number;
  status: string;
}

interface Company {
  name: string;
  cnpj?: string | null;
  address?: string | null;
  phone?: string | null;
}

interface DailyCashSummary {
  openingAmount: number;
  totalDinheiro: number;
  totalCartao: number;
  totalPix: number;
  totalVendas: number;
  totalEntradas: number;
  totalSaidas: number;
  saldoDinheiro: number;
}

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    venda: 'Venda',
    sangria: 'Sangria',
    reforco: 'Reforço',
    despesa: 'Despesa',
    recebimento: 'Recebimento',
    ajuste: 'Ajuste',
    recolhimento: 'Recolhimento',
    abertura_caixa: 'Abertura',
    fechamento_caixa: 'Fechamento',
    deposito: 'Depósito',
    retirada: 'Retirada',
  };
  return labels[category] || category;
};

const getPaymentMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    dinheiro: 'Dinheiro',
    cartao_credito: 'Cartão Crédito',
    cartao_debito: 'Cartão Débito',
    pix: 'PIX',
    boleto: 'Boleto',
    transferencia: 'Transferência',
    a_prazo: 'A Prazo',
    misto: 'Misto',
  };
  return labels[method] || method;
};

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export function generateDailyCashPdf(
  cashRegister: CashRegister,
  movements: CashMovement[],
  sales: Sale[],
  summary: DailyCashSummary,
  company: Company | null,
  mode: 'download' | 'print' = 'download'
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let currentY = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório do Caixa do Dia', pageWidth / 2, currentY, { align: 'center' });
  currentY += 8;

  if (company) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(company.name, pageWidth / 2, currentY, { align: 'center' });
    currentY += 5;

    doc.setFontSize(9);
    doc.setTextColor(100);
    
    if (company.cnpj) {
      const cnpjFormatted = company.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      doc.text(`CNPJ: ${cnpjFormatted}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 4;
    }

    if (company.address) {
      doc.text(company.address, pageWidth / 2, currentY, { align: 'center' });
      currentY += 4;
    }
  }

  doc.setTextColor(0);
  currentY += 4;

  // Cash register info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const openedDate = format(new Date(cashRegister.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Aberto em: ${openedDate}`, margin, currentY);
  doc.text(`Status: ${cashRegister.status === 'open' ? 'Aberto' : 'Fechado'}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 10;

  // Summary Cards
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 35, 3, 3, 'F');

  const cardWidth = (pageWidth - margin * 2 - 15) / 4;
  const cardStartX = margin + 4;
  const cardY = currentY + 6;

  // Card 1 - Abertura
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Abertura', cardStartX, cardY);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text(formatCurrency(summary.openingAmount), cardStartX, cardY + 6);

  // Card 2 - Vendas Dinheiro
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Vendas Dinheiro', cardStartX + cardWidth, cardY);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 139, 34);
  doc.text(formatCurrency(summary.totalDinheiro), cardStartX + cardWidth, cardY + 6);

  // Card 3 - Cartão/PIX
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Cartão/PIX', cardStartX + cardWidth * 2, cardY);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text(formatCurrency(summary.totalCartao + summary.totalPix), cardStartX + cardWidth * 2, cardY + 6);

  // Card 4 - Total Vendas
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Total Vendas', cardStartX + cardWidth * 3, cardY);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(formatCurrency(summary.totalVendas), cardStartX + cardWidth * 3, cardY + 6);

  // Second row
  const cardY2 = cardY + 16;
  
  // Entradas
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Outras Entradas', cardStartX, cardY2);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 139, 34);
  doc.text(formatCurrency(summary.totalEntradas), cardStartX, cardY2 + 6);

  // Saídas
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Saídas', cardStartX + cardWidth, cardY2);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 53, 69);
  doc.text(formatCurrency(summary.totalSaidas), cardStartX + cardWidth, cardY2 + 6);

  // Saldo Dinheiro
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Saldo em Dinheiro', cardStartX + cardWidth * 2, cardY2);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(summary.saldoDinheiro >= 0 ? 34 : 220, summary.saldoDinheiro >= 0 ? 139 : 53, summary.saldoDinheiro >= 0 ? 34 : 69);
  doc.text(formatCurrency(summary.saldoDinheiro), cardStartX + cardWidth * 2, cardY2 + 6);

  // Qtd Vendas
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Quantidade Vendas', cardStartX + cardWidth * 3, cardY2);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text(String(sales.length), cardStartX + cardWidth * 3, cardY2 + 6);

  currentY += 42;

  // Sales Table
  if (sales.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Vendas', margin, currentY);
    currentY += 5;

    const salesData = sales.map((s) => [
      `#${s.sale_number}`,
      format(new Date(s.created_at), 'HH:mm', { locale: ptBR }),
      s.customer_name || '-',
      getPaymentMethodLabel(s.payment_method),
      formatCurrency(s.total_amount),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Nº', 'Hora', 'Cliente', 'Pagamento', 'Valor']],
      body: salesData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 20 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 35 },
        4: { halign: 'right', cellWidth: 30 },
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Movements Table
  if (movements.length > 0) {
    // Check if we need a new page
    if (currentY > 220) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Movimentações', margin, currentY);
    currentY += 5;

    const movementsData = movements.map((m) => [
      format(new Date(m.created_at), 'HH:mm', { locale: ptBR }),
      m.type === 'entrada' ? 'Entrada' : 'Saída',
      getCategoryLabel(m.category),
      m.description.length > 40 ? m.description.substring(0, 40) + '...' : m.description,
      formatCurrency(m.amount),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Hora', 'Tipo', 'Categoria', 'Descrição', 'Valor']],
      body: movementsData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 20 },
        2: { cellWidth: 30 },
        3: { cellWidth: 'auto' },
        4: { halign: 'right', cellWidth: 30 },
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
      `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Output
  const dateStr = format(new Date(cashRegister.opened_at), 'yyyy-MM-dd');
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
    doc.save(`caixa-dia-${dateStr}.pdf`);
  }
}
