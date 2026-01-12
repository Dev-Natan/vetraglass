import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DasData {
  companyName: string;
  cnpj: string;
  periodo: string;
  competencia: Date;
  faturamentoBruto: number;
  aliquotaEfetiva: number;
  valorDas: number;
  vencimento: Date;
  anexo: string;
  faixa: number;
}

interface DasComposicao {
  tributo: string;
  percentual: number;
  valor: number;
}

const anexoLabels: Record<string, string> = {
  anexo_i: 'Anexo I - Comércio',
  anexo_ii: 'Anexo II - Indústria',
  anexo_iii: 'Anexo III - Serviços',
  anexo_iv: 'Anexo IV - Serviços',
  anexo_v: 'Anexo V - Serviços',
};

// Composição aproximada do DAS por anexo (valores típicos)
const getComposicao = (anexo: string, valorTotal: number): DasComposicao[] => {
  // Percentuais aproximados do Anexo III (mais comum para vidraçarias)
  const composicoes: Record<string, { tributo: string; percentual: number }[]> = {
    anexo_i: [
      { tributo: 'IRPJ', percentual: 5.5 },
      { tributo: 'CSLL', percentual: 3.5 },
      { tributo: 'COFINS', percentual: 12.74 },
      { tributo: 'PIS/Pasep', percentual: 2.76 },
      { tributo: 'CPP', percentual: 41.5 },
      { tributo: 'ICMS', percentual: 34.0 },
    ],
    anexo_ii: [
      { tributo: 'IRPJ', percentual: 5.5 },
      { tributo: 'CSLL', percentual: 3.5 },
      { tributo: 'COFINS', percentual: 11.51 },
      { tributo: 'PIS/Pasep', percentual: 2.49 },
      { tributo: 'CPP', percentual: 37.5 },
      { tributo: 'IPI', percentual: 7.5 },
      { tributo: 'ICMS', percentual: 32.0 },
    ],
    anexo_iii: [
      { tributo: 'IRPJ', percentual: 6.0 },
      { tributo: 'CSLL', percentual: 3.5 },
      { tributo: 'COFINS', percentual: 12.82 },
      { tributo: 'PIS/Pasep', percentual: 2.78 },
      { tributo: 'CPP', percentual: 43.4 },
      { tributo: 'ISS', percentual: 31.5 },
    ],
    anexo_iv: [
      { tributo: 'IRPJ', percentual: 18.8 },
      { tributo: 'CSLL', percentual: 15.2 },
      { tributo: 'COFINS', percentual: 17.67 },
      { tributo: 'PIS/Pasep', percentual: 3.83 },
      { tributo: 'ISS', percentual: 44.5 },
    ],
    anexo_v: [
      { tributo: 'IRPJ', percentual: 25.0 },
      { tributo: 'CSLL', percentual: 15.0 },
      { tributo: 'COFINS', percentual: 14.1 },
      { tributo: 'PIS/Pasep', percentual: 3.05 },
      { tributo: 'CPP', percentual: 28.85 },
      { tributo: 'ISS', percentual: 14.0 },
    ],
  };

  const comp = composicoes[anexo] || composicoes.anexo_iii;
  return comp.map(c => ({
    ...c,
    valor: valorTotal * (c.percentual / 100),
  }));
};

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj: string): string => {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export function generateDasPdf(data: DasData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors
  const primaryColor: [number, number, number] = [0, 82, 155]; // Blue
  const secondaryColor: [number, number, number] = [240, 240, 240];
  
  let yPos = 15;

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DOCUMENTO DE ARRECADAÇÃO DO SIMPLES NACIONAL', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('DAS - Guia de Recolhimento', pageWidth / 2, 23, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Competência: ${format(data.competencia, 'MMMM/yyyy', { locale: ptBR }).toUpperCase()}`, pageWidth / 2, 30, { align: 'center' });

  yPos = 45;

  // Company Info Box
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(...secondaryColor);
  doc.roundedRect(10, yPos, pageWidth - 20, 30, 3, 3, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('CONTRIBUINTE', 15, yPos + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(data.companyName, 15, yPos + 16);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('CNPJ:', 15, yPos + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCnpj(data.cnpj), 32, yPos + 24);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Enquadramento:', pageWidth / 2, yPos + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(`${anexoLabels[data.anexo]} - Faixa ${data.faixa}`, pageWidth / 2 + 32, yPos + 24);

  yPos += 40;

  // Período e Vencimento
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(10, yPos, (pageWidth - 30) / 2, 25, 2, 2, 'FD');
  doc.roundedRect(10 + (pageWidth - 30) / 2 + 10, yPos, (pageWidth - 30) / 2, 25, 2, 2, 'FD');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('PERÍODO DE APURAÇÃO', 15, yPos + 7);
  doc.text('DATA DE VENCIMENTO', 15 + (pageWidth - 30) / 2 + 10, yPos + 7);
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(format(data.competencia, 'MM/yyyy'), 15, yPos + 18);
  
  const isOverdue = data.vencimento < new Date();
  if (isOverdue) {
    doc.setTextColor(200, 0, 0);
  }
  doc.text(format(data.vencimento, 'dd/MM/yyyy'), 15 + (pageWidth - 30) / 2 + 10, yPos + 18);
  doc.setTextColor(0, 0, 0);

  yPos += 35;

  // Valores principais
  doc.setFillColor(...secondaryColor);
  doc.roundedRect(10, yPos, pageWidth - 20, 35, 3, 3, 'F');
  
  const colWidth = (pageWidth - 20) / 3;
  
  // Faturamento
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('RECEITA BRUTA (R$)', 15, yPos + 10);
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(formatCurrency(data.faturamentoBruto), 15, yPos + 22);
  
  // Alíquota
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('ALÍQUOTA EFETIVA', 15 + colWidth, yPos + 10);
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`${data.aliquotaEfetiva.toFixed(2)}%`, 15 + colWidth, yPos + 22);
  
  // Valor DAS
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('VALOR DO DAS', 15 + colWidth * 2, yPos + 10);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(formatCurrency(data.valorDas), 15 + colWidth * 2, yPos + 24);

  yPos += 45;

  // Composição do DAS
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPOSIÇÃO DO DAS', 10, yPos);

  yPos += 5;

  const composicao = getComposicao(data.anexo, data.valorDas);
  
  autoTable(doc, {
    startY: yPos,
    head: [['Tributo', 'Participação (%)', 'Valor (R$)']],
    body: composicao.map(c => [
      c.tributo,
      `${c.percentual.toFixed(2)}%`,
      formatCurrency(c.valor),
    ]),
    foot: [['TOTAL', '100%', formatCurrency(data.valorDas)]],
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
    },
    footStyles: {
      fillColor: [220, 220, 220],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9,
    },
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 50, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'right' },
    },
  });

  // @ts-ignore
  yPos = doc.lastAutoTable.finalY + 15;

  // Instruções
  doc.setFillColor(255, 250, 240);
  doc.setDrawColor(255, 200, 100);
  doc.roundedRect(10, yPos, pageWidth - 20, 40, 3, 3, 'FD');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(150, 100, 0);
  doc.text('INSTRUÇÕES PARA PAGAMENTO', 15, yPos + 10);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const instructions = [
    '1. Este documento é uma simulação para fins de controle interno.',
    '2. Para emitir o DAS oficial, acesse o Portal do Simples Nacional (www8.receita.fazenda.gov.br/simplesnacional).',
    '3. O pagamento deve ser efetuado até a data de vencimento para evitar multas e juros.',
    '4. Em caso de pagamento em atraso, o DAS deve ser recalculado com os acréscimos legais.',
  ];
  
  instructions.forEach((inst, idx) => {
    doc.text(inst, 15, yPos + 18 + (idx * 5));
  });

  yPos += 50;

  // Footer
  doc.setDrawColor(200, 200, 200);
  doc.line(10, yPos, pageWidth - 10, yPos);
  
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 10, yPos + 7);
  doc.text('Este documento não tem valor fiscal - apenas para controle interno', pageWidth - 10, yPos + 7, { align: 'right' });

  // Save
  const fileName = `DAS_${format(data.competencia, 'yyyy-MM')}_${data.cnpj.replace(/\D/g, '')}.pdf`;
  doc.save(fileName);
}

export function generateDasFromMonthData(
  monthData: {
    month: Date;
    faturamento: number;
    imposto: number;
    vencimentoDAS: Date;
  },
  company: {
    name: string;
    cnpj: string;
  },
  taxConfig: {
    aliquota_efetiva: number;
    anexo_simples: string;
    faixa_simples: number;
  } | null
): void {
  const dasData: DasData = {
    companyName: company.name,
    cnpj: company.cnpj,
    periodo: format(monthData.month, 'MMMM/yyyy', { locale: ptBR }),
    competencia: monthData.month,
    faturamentoBruto: monthData.faturamento,
    aliquotaEfetiva: taxConfig?.aliquota_efetiva || 4.0,
    valorDas: monthData.imposto,
    vencimento: monthData.vencimentoDAS,
    anexo: taxConfig?.anexo_simples || 'anexo_iii',
    faixa: taxConfig?.faixa_simples || 1,
  };

  generateDasPdf(dasData);
}
