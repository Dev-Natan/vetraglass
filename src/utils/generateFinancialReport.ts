import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FinancialData {
  month: Date;
  revenue: {
    sales: number;
    receivables: number;
    total: number;
  };
  expenses: {
    byCategory: Record<string, number>;
    total: number;
  };
  commissions: {
    total: number;
  };
  netProfit: number;
}

interface Company {
  name: string;
  cnpj: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function generateFinancialReport(data: FinancialData, company: Company | null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Fechamento Mensal', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${company?.name || 'Sua Empresa'} - CNPJ: ${company?.cnpj || ''}`, pageWidth / 2, 28, { align: 'center' });
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Referente a: ${format(data.month, 'MMMM / yyyy', { locale: ptBR })}`, pageWidth / 2, 36, { align: 'center' });
  
  doc.line(20, 42, pageWidth - 20, 42);
  
  // Section: Receitas
  doc.setFontSize(14);
  doc.text('1. RECEITAS', 20, 52);
  
  const revenueRows = [
    ['Vendas à Vista', formatCurrency(data.revenue.sales)],
    ['Recebimentos de Parcelas', formatCurrency(data.revenue.receivables)],
    ['TOTAL DE ENTRADAS', formatCurrency(data.revenue.total)],
  ];
  
  autoTable(doc, {
    startY: 55,
    head: [['Descrição', 'Valor']],
    body: revenueRows,
    theme: 'striped',
    headStyles: { fillColor: [34, 197, 94] },
    columnStyles: { 1: { halign: 'right' } },
  });
  
  // Section: Despesas
  let lastY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(14);
  doc.text('2. DESPESAS / SAÍDAS', 20, lastY);
  
  const expenseRows = Object.entries(data.expenses.byCategory).map(([cat, amount]) => [
    cat.charAt(0).toUpperCase() + cat.slice(1),
    formatCurrency(amount)
  ]);
  
  expenseRows.push(['Comissões Pagas', formatCurrency(data.commissions.total)]);
  expenseRows.push(['TOTAL DE SAÍDAS', formatCurrency(data.expenses.total + data.commissions.total)]);
  
  autoTable(doc, {
    startY: lastY + 3,
    head: [['Categoria', 'Valor']],
    body: expenseRows,
    theme: 'striped',
    headStyles: { fillStyle: 'DF', fillColor: [239, 68, 68] },
    columnStyles: { 1: { halign: 'right' } },
  });
  
  // Section: Resultado
  lastY = (doc as any).lastAutoTable.finalY + 15;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(20, lastY, pageWidth - 40, 25);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RESULTADO LÍQUIDO DO MÊS:', 25, lastY + 15);
  
  const profitColor = data.netProfit >= 0 ? [34, 197, 94] : [239, 68, 68];
  doc.setTextColor(profitColor[0], profitColor[1], profitColor[2]);
  doc.text(formatCurrency(data.netProfit), pageWidth - 25, lastY + 15, { align: 'right' });
  
  doc.setTextColor(0);
  
  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(`Relatório gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  
  doc.save(`fechamento-${format(data.month, 'yyyy-MM')}.pdf`);
}
