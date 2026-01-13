import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QuoteItem {
  description: string;
  width?: number | null;
  height?: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  has_glass?: boolean;
  glass_color?: string | null;
  glass_thickness?: string | null;
}

interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  customer_document?: string | null;
  customer_document_type?: string | null;
  customer_profession?: string | null;
  customer_marital_status?: string | null;
  status: string;
  total_amount: number;
  discount_percent?: number | null;
  discount_amount?: number | null;
  final_amount: number;
  payment_terms?: string | null;
  notes?: string | null;
  valid_until?: string | null;
  created_at: string;
}

interface Company {
  name: string;
  cnpj: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const getDocumentLabel = (type: string | null | undefined): string => {
  if (type === 'juridica') return 'CNPJ';
  return 'CPF';
};

const getPersonType = (type: string | null | undefined): string => {
  if (type === 'juridica') return 'jurídica';
  return 'física';
};

const extractCityFromAddress = (address: string | null | undefined): string => {
  if (!address) return '';
  // Try to extract city from address - assumes format like "Rua X, 123, Cidade - UF"
  const parts = address.split(',');
  if (parts.length >= 3) {
    const cityPart = parts[parts.length - 1].trim();
    const cityMatch = cityPart.match(/^([^-]+)/);
    if (cityMatch) return cityMatch[1].trim();
  }
  return '';
};

export async function generateContractPdf(
  quote: Quote,
  items: QuoteItem[],
  company: Company | null
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 25;
  const marginRight = 25;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let yPos = 30;

  // Helper to add new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 30) {
      doc.addPage();
      yPos = 30;
    }
  };

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Company name centered
  doc.setFontSize(14);
  doc.text(company?.name || 'EMPRESA', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Helper to write justified paragraph
  const writeParagraph = (text: string, fontSize: number = 11) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth);
    
    lines.forEach((line: string) => {
      checkPageBreak(7);
      doc.text(line, marginLeft, yPos);
      yPos += 6;
    });
    yPos += 3;
  };

  const writeSection = (title: string, content: string) => {
    checkPageBreak(15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, marginLeft, yPos);
    yPos += 8;
    writeParagraph(content);
  };

  // DAS PARTES
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DAS PARTES', marginLeft, yPos);
  yPos += 8;

  const companyDocument = company?.cnpj ? `CNPJ ${company.cnpj}` : 'CNPJ não informado';
  const customerDocLabel = getDocumentLabel(quote.customer_document_type);
  const customerDocValue = quote.customer_document || 'não informado';
  const customerPersonType = getPersonType(quote.customer_document_type);
  const companyPersonType = 'jurídica';

  const partesText = `${company?.name || 'EMPRESA'}, pessoa ${companyPersonType} de direito privado, com sede na ${company?.address || 'endereço não informado'}, inscrita no ${companyDocument}, doravante denominada CONTRATADA e por outro lado ${quote.customer_name}, pessoa ${customerPersonType} de direito privado, situada em ${quote.customer_address || 'endereço não informado'}, inscrita no ${customerDocLabel} ${customerDocValue}, ${quote.customer_profession || 'profissão não informada'} e estado civil ${quote.customer_marital_status || 'não informado'}, doravante denominada CONTRATANTE.`;
  writeParagraph(partesText);

  writeParagraph('Decidem as partes, na melhor forma de direito, celebrar o presente contrato, que reger-se-á mediante as cláusulas e condições adiante estipuladas.');

  // DA APROVAÇÃO
  writeSection('DA APROVAÇÃO', '');
  yPos -= 3;
  
  writeParagraph(`1.1 O presente contrato, cuja lavratura decorre da autorização de ${quote.customer_name}, é celebrado com a empresa ${company?.name || 'EMPRESA'}.`);
  
  writeParagraph(`1.2 A prestação dos serviços e produtos que geram este contrato foi concedida através da proposta de número ${quote.quote_number.toString().padStart(4, '0')}.`);

  // DO OBJETO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  checkPageBreak(15);
  doc.text('DO OBJETO', marginLeft, yPos);
  yPos += 10;

  // Product list
  items.forEach((item, index) => {
    checkPageBreak(12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    let itemDescription = `${index + 1}. ${item.description}`;
    if (item.width && item.height) {
      itemDescription += ` - ${item.width}mm x ${item.height}mm`;
    }
    itemDescription += ` - Qtd: ${item.quantity}`;
    
    if (item.has_glass && item.glass_color && item.glass_thickness) {
      itemDescription += ` - Vidro: ${item.glass_color} ${item.glass_thickness}`;
    }
    
    itemDescription += ` - ${formatCurrency(item.total_price)}`;
    
    const lines = doc.splitTextToSize(itemDescription, contentWidth);
    lines.forEach((line: string) => {
      doc.text(line, marginLeft, yPos);
      yPos += 5;
    });
    yPos += 2;
  });

  yPos += 5;

  writeParagraph(`2.1 A contratada por força deste instrumento e em submissão às condições estabelecidas, obriga-se e compromete-se a fornecer e instalar os produtos descritos acima no seguinte endereço: ${quote.customer_address || 'endereço não informado'}.`);
  
  writeParagraph('2.2 Caso haja qualquer alteração no modelo, quantidade ou medida das esquadrias haverá um adendo ao presente contrato.');

  // DOS PRAZOS
  writeSection('DOS PRAZOS', '');
  yPos -= 3;
  
  writeParagraph('3.1 O prazo para início do objeto de contrato é de 10 a 15 dias após a medição definitiva dos vãos para esquadrias em vidro temperado e 60 a 75 dias após a medição definitiva dos vãos para esquadrias em linha suprema ou alto padrão; no caso de coberturas e sacadas são necessárias duas fases de instalação. Na primeira é montada a estrutura, e num segundo momento instalam-se os vidros, este processo pode levar de 20 a 60 dias após a contratação ou medição definitiva, dependendo da situação; para esquadrias que contenham vidros laminados e/ou insulados (vidros duplos) dentro do caixilho de linha suprema ou alto padrão o prazo é de 40 a 80 dias após medição definitiva, visto que é necessário primeiro a montagem das esquadrias e depois a produção dos vidros; os contra marcos são entregues no período de 2 a 10 dias após a solicitação dos mesmos.');
  
  writeParagraph('3.2 A medição definitiva ocorrerá quando os vãos estiverem totalmente liberados, ou seja, a medição não será efetuada de forma parcial. Se não for possível medir todos os vãos durante a visita técnica, uma nova visita será necessária e, por sua vez, cobrada. O valor será estipulado de acordo com a localização da obra e a disponibilidade do técnico.');
  
  writeParagraph('3.3 Os vãos são considerados liberados quando estiverem requadrados, calfinados e com soleira. As portas devem estar com piso definido para que seja realizada a medição. Se no momento da compra os vãos não estiverem liberados, é dever da contratante informar a contratada quando os mesmos estiverem acabados e prontos para realização da medição definitiva. No caso dos contra marcos, procede-se na mesma forma, assim que estiverem instalados a contratante deve informar a contratada, assim é possível realizar a medição definitiva.');
  
  writeParagraph('3.4 A contratada não se responsabiliza por quebras ou danos em cerâmicas, porcelanatos ou granitos durante a instalação das esquadrias. Visto que quebras ou danos podem ser influenciados pela má instalação das peças, ou seja, se a massa utilizada para fixação de cerâmicas, porcelanatos ou granitos não for suficiente e reforçada, a pedra pode ficar oca, causando assim a quebra.');

  // DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO
  writeSection('DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO', '');
  yPos -= 3;
  
  writeParagraph(`4.1 Os serviços presentes no OBJETO deste contrato serão remunerados pelo valor de ${formatCurrency(quote.final_amount)}, certos, fixos e irreajustáveis em moeda corrente do país.`);
  
  writeParagraph(`4.2 O pagamento deverá ser efetuado da seguinte forma: ${quote.payment_terms || 'À combinar'}`);
  
  writeParagraph('4.3 A contratada pode tomar as medidas legais cabíveis, inclusive protestos e inscrição dos nomes do contratante e garantidores nos cadastros de serviços de proteção ao crédito, caso os títulos não sejam pagos. A falta de pagamento também motivará cobrança judicial ou extrajudicial com atualização monetária aplicada sobre os valores não pagos.');
  
  writeParagraph('4.4 Fica eleito o foro de domicílio da contratada para discussão dos termos do presente contrato e cobrança dos valores dele derivados.');

  // Closing
  checkPageBreak(30);
  yPos += 5;
  writeParagraph('E, por estarem de acordo, justas e contratadas, as partes assinam o presente contrato em 2 (duas) vias de igual teor e forma.');

  yPos += 10;
  const cityFromAddress = extractCityFromAddress(company?.address);
  const contractDate = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${cityFromAddress || 'Local'}, ${contractDate}.`, marginLeft, yPos);

  // Signature lines
  yPos += 25;
  checkPageBreak(40);

  const signatureWidth = (contentWidth - 20) / 2;
  
  // CONTRATADA signature
  doc.line(marginLeft, yPos, marginLeft + signatureWidth, yPos);
  yPos += 5;
  doc.setFontSize(10);
  doc.text('CONTRATADA', marginLeft + signatureWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.setFontSize(9);
  doc.text(company?.name || 'EMPRESA', marginLeft + signatureWidth / 2, yPos, { align: 'center' });

  // Reset Y for CONTRATANTE signature
  yPos -= 10;
  
  // CONTRATANTE signature
  const contratanteX = marginLeft + signatureWidth + 20;
  doc.line(contratanteX, yPos, contratanteX + signatureWidth, yPos);
  yPos += 5;
  doc.setFontSize(10);
  doc.text('CONTRATANTE', contratanteX + signatureWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  doc.setFontSize(9);
  doc.text(quote.customer_name, contratanteX + signatureWidth / 2, yPos, { align: 'center' });

  // Save PDF
  const fileName = `Contrato_${quote.quote_number.toString().padStart(4, '0')}_${quote.customer_name.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
