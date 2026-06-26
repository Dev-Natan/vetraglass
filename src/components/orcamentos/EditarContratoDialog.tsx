import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileSignature, Download, Edit3, Building2, User } from 'lucide-react';

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
  linha?: string | null;
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

interface ContractData {
  // Empresa
  companyName: string;
  companyCnpj: string;
  companyAddress: string;
  
  // Cliente
  customerName: string;
  customerDocument: string;
  customerDocumentType: string;
  customerAddress: string;
  customerProfession: string;
  customerMaritalStatus: string;
  
  // Contrato
  quoteNumber: string;
  finalAmount: string;
  paymentTerms: string;
  
  // Prazos (textos editaveis)
  prazoInicio: string;
  prazoMedicao: string;
  prazoVaos: string;
  prazoResponsabilidade: string;
  
  // Local e data
  contractCity: string;
  contractDate: string;
}

interface EditarContratoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
  items: QuoteItem[];
  company: Company | null;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const extractCityFromAddress = (address: string | null | undefined): string => {
  if (!address) return '';
  const parts = address.split(',');
  if (parts.length >= 3) {
    const cityPart = parts[parts.length - 1].trim();
    const cityMatch = cityPart.match(/^([^-]+)/);
    if (cityMatch) return cityMatch[1].trim();
  }
  return '';
};

export function EditarContratoDialog({ 
  open, 
  onOpenChange, 
  quote, 
  items, 
  company 
}: EditarContratoDialogProps) {
  const { toast } = useToast();
  
  const [contractData, setContractData] = useState<ContractData>({
    companyName: '',
    companyCnpj: '',
    companyAddress: '',
    customerName: '',
    customerDocument: '',
    customerDocumentType: 'fisica',
    customerAddress: '',
    customerProfession: '',
    customerMaritalStatus: '',
    quoteNumber: '',
    finalAmount: '',
    paymentTerms: '',
    prazoInicio: '10 a 15 dias apos a medicao definitiva dos vaos para esquadrias em vidro temperado e 60 a 75 dias apos a medicao definitiva dos vaos para esquadrias em linha suprema ou alto padrao; no caso de coberturas e sacadas sao necessarias duas fases de instalacao. Na primeira e montada a estrutura, e num segundo momento instalam-se os vidros, este processo pode levar de 20 a 60 dias apos a contratacao ou medicao definitiva, dependendo da situacao; para esquadrias que contenham vidros laminados e/ou insulados (vidros duplos) dentro do caixilho de linha suprema ou alto padrao o prazo e de 40 a 80 dias apos medicao definitiva, visto que e necessario primeiro a montagem das esquadrias e depois a producao dos vidros; os contra marcos sao entregues no periodo de 2 a 10 dias apos a solicitacao dos mesmos.',
    prazoMedicao: 'A medicao definitiva ocorrera quando os vaos estiverem totalmente liberados, ou seja, a medicao nao sera efetuada de forma parcial. Se nao for possivel medir todos os vaos durante a visita tecnica, uma nova visita sera necessaria e, por sua vez, cobrada. O valor sera estipulado de acordo com a localizacao da obra e a disponibilidade do tecnico.',
    prazoVaos: 'Os vaos sao considerados liberados quando estiverem requadrados, calfinados e com soleira. As portas devem estar com piso definido para que seja realizada a medicao. Se no momento da compra os vaos nao estiverem liberados, e dever da contratante informar a contratada quando os mesmos estiverem acabados e prontos para realizacao da medicao definitiva. No caso dos contra marcos, procede-se na mesma forma, assim que estiverem instalados a contratante deve informar a contratada, assim e possivel realizar a medicao definitiva.',
    prazoResponsabilidade: 'A contratada nao se responsabiliza por quebras ou danos em ceramicas, porcelanatos ou granitos durante a instalacao das esquadrias. Visto que quebras ou danos podem ser influenciados pela ma instalacao das pecas, ou seja, se a massa utilizada para fixacao de ceramicas, porcelanatos ou granitos nao for suficiente e reforcada, a pedra pode ficar oca, causando assim a quebra.',
    contractCity: '',
    contractDate: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
  });

  useEffect(() => {
    if (quote && company && open) {
      setContractData({
        companyName: company.name || '',
        companyCnpj: company.cnpj || '',
        companyAddress: company.address || 'Endereco nao informado',
        customerName: quote.customer_name || '',
        customerDocument: quote.customer_document || 'Nao informado',
        customerDocumentType: quote.customer_document_type || 'fisica',
        customerAddress: quote.customer_address || 'Endereco nao informado',
        customerProfession: quote.customer_profession || 'Nao informada',
        customerMaritalStatus: quote.customer_marital_status || 'Nao informado',
        quoteNumber: quote.quote_number.toString().padStart(4, '0'),
        finalAmount: formatCurrency(quote.final_amount),
        paymentTerms: quote.payment_terms || 'A combinar',
        prazoInicio: '10 a 15 dias apos a medicao definitiva dos vaos para esquadrias em vidro temperado e 60 a 75 dias apos a medicao definitiva dos vaos para esquadrias em linha suprema ou alto padrao; no caso de coberturas e sacadas sao necessarias duas fases de instalacao. Na primeira e montada a estrutura, e num segundo momento instalam-se os vidros, este processo pode levar de 20 a 60 dias apos a contratacao ou medicao definitiva, dependendo da situacao; para esquadrias que contenham vidros laminados e/ou insulados (vidros duplos) dentro do caixilho de linha suprema ou alto padrao o prazo e de 40 a 80 dias apos medicao definitiva, visto que e necessario primeiro a montagem das esquadrias e depois a producao dos vidros; os contra marcos sao entregues no periodo de 2 a 10 dias apos a solicitacao dos mesmos.',
        prazoMedicao: 'A medicao definitiva ocorrera quando os vaos estiverem totalmente liberados, ou seja, a medicao nao sera efetuada de forma parcial. Se nao for possivel medir todos os vaos durante a visita tecnica, uma nova visita sera necessaria e, por sua vez, cobrada. O valor sera estipulado de acordo com a localizacao da obra e a disponibilidade do tecnico.',
        prazoVaos: 'Os vaos sao considerados liberados quando estiverem requadrados, calfinados e com soleira. As portas devem estar com piso definido para que seja realizada a medicao. Se no momento da compra os vaos nao estiverem liberados, e dever da contratante informar a contratada quando os mesmos estiverem acabados e prontos para realizacao da medicao definitiva. No caso dos contra marcos, procede-se na mesma forma, assim que estiverem instalados a contratante deve informar a contratada, assim e possivel realizar a medicao definitiva.',
        prazoResponsabilidade: 'A contratada nao se responsabiliza por quebras ou danos em ceramicas, porcelanatos ou granitos durante a instalacao das esquadrias. Visto que quebras ou danos podem ser influenciados pela ma instalacao das pecas, ou seja, se a massa utilizada para fixacao de ceramicas, porcelanatos ou granitos nao for suficiente e reforcada, a pedra pode ficar oca, causando assim a quebra.',
        contractCity: extractCityFromAddress(company.address) || 'Local',
        contractDate: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
      });
    }
  }, [quote, company, open]);

  const handleChange = (field: keyof ContractData, value: string) => {
    setContractData(prev => ({ ...prev, [field]: value }));
  };

  const generatePdf = () => {
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

    const checkPageBreak = (requiredSpace: number) => {
      if (yPos + requiredSpace > pageHeight - 30) {
        doc.addPage();
        yPos = 30;
      }
    };

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('CONTRATO DE PRESTACAO DE SERVICOS', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Company name centered
    doc.setFontSize(14);
    doc.text(contractData.companyName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

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

    const writeSection = (title: string) => {
      checkPageBreak(15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(title, marginLeft, yPos);
      yPos += 8;
    };

    // DAS PARTES
    writeSection('DAS PARTES');
    
    const customerDocLabel = contractData.customerDocumentType === 'juridica' ? 'CNPJ' : 'CPF';
    const customerPersonType = contractData.customerDocumentType === 'juridica' ? 'juridica' : 'fisica';

    const partesText = `${contractData.companyName}, pessoa juridica de direito privado, com sede na ${contractData.companyAddress}, inscrita no CNPJ ${contractData.companyCnpj}, doravante denominada CONTRATADA e por outro lado ${contractData.customerName}, pessoa ${customerPersonType} de direito privado, situada em ${contractData.customerAddress}, inscrita no ${customerDocLabel} ${contractData.customerDocument}, ${contractData.customerProfession} e estado civil ${contractData.customerMaritalStatus}, doravante denominada CONTRATANTE.`;
    writeParagraph(partesText);

    writeParagraph('Decidem as partes, na melhor forma de direito, celebrar o presente contrato, que reger-se-a mediante as clausulas e condicoes adiante estipuladas.');

    // DA APROVACAO
    writeSection('DA APROVACAO');
    
    writeParagraph(`1.1 O presente contrato, cuja lavratura decorre da autorizacao de ${contractData.customerName}, e celebrado com a empresa ${contractData.companyName}.`);
    
    writeParagraph(`1.2 A prestacao dos servicos e produtos que geram este contrato foi concedida atraves da proposta de numero ${contractData.quoteNumber}.`);

    // DO OBJETO
    writeSection('DO OBJETO');

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

    writeParagraph(`2.1 A contratada por forca deste instrumento e em submissao as condicoes estabelecidas, obriga-se e compromete-se a fornecer e instalar os produtos descritos acima no seguinte endereco: ${contractData.customerAddress}.`);
    
    writeParagraph('2.2 Caso haja qualquer alteracao no modelo, quantidade ou medida das esquadrias havera um adendo ao presente contrato.');

    // DOS PRAZOS
    writeSection('DOS PRAZOS');
    
    writeParagraph(`3.1 O prazo para inicio do objeto de contrato e de ${contractData.prazoInicio}`);
    
    writeParagraph(`3.2 ${contractData.prazoMedicao}`);
    
    writeParagraph(`3.3 ${contractData.prazoVaos}`);
    
    writeParagraph(`3.4 ${contractData.prazoResponsabilidade}`);

    // DO PRECO E DAS CONDICOES DE PAGAMENTO
    writeSection('DO PRECO E DAS CONDICOES DE PAGAMENTO');
    
    writeParagraph(`4.1 Os servicos presentes no OBJETO deste contrato serao remunerados pelo valor de ${contractData.finalAmount}, certos, fixos e irreajustaveis em moeda corrente do pais.`);
    
    writeParagraph(`4.2 O pagamento devera ser efetuado da seguinte forma: ${contractData.paymentTerms}`);
    
    writeParagraph('4.3 A contratada pode tomar as medidas legais cabiveis, inclusive protestos e inscricao dos nomes do contratante e garantidores nos cadastros de servicos de protecao ao credito, caso os titulos nao sejam pagos. A falta de pagamento tambem motivara cobranca judicial ou extrajudicial com atualizacao monetaria aplicada sobre os valores nao pagos.');
    
    writeParagraph('4.4 Fica eleito o foro de domicilio da contratada para discussao dos termos do presente contrato e cobranca dos valores dele derivados.');

    // Closing
    checkPageBreak(30);
    yPos += 5;
    writeParagraph('E, por estarem de acordo, justas e contratadas, as partes assinam o presente contrato em 2 (duas) vias de igual teor e forma.');

    yPos += 10;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`${contractData.contractCity}, ${contractData.contractDate}.`, marginLeft, yPos);

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
    doc.text(contractData.companyName, marginLeft + signatureWidth / 2, yPos, { align: 'center' });

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
    doc.text(contractData.customerName, contratanteX + signatureWidth / 2, yPos, { align: 'center' });

    // Save PDF
    const fileName = `Contrato_${contractData.quoteNumber}_${contractData.customerName.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
    
    toast({ title: 'Contrato gerado com sucesso!' });
    onOpenChange(false);
  };

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            Editar Contrato - Orcamento #{quote.quote_number.toString().padStart(4, '0')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Dados da Empresa */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="w-5 h-5" />
                Dados da Contratada (Empresa)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome da Empresa</Label>
                  <Input 
                    value={contractData.companyName}
                    onChange={(e) => handleChange('companyName', e.target.value)}
                  />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input 
                    value={contractData.companyCnpj}
                    onChange={(e) => handleChange('companyCnpj', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Endereco da Empresa</Label>
                  <Input 
                    value={contractData.companyAddress}
                    onChange={(e) => handleChange('companyAddress', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Dados do Cliente */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <User className="w-5 h-5" />
                Dados do Contratante (Cliente)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome do Cliente</Label>
                  <Input 
                    value={contractData.customerName}
                    onChange={(e) => handleChange('customerName', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Documento (CPF/CNPJ)</Label>
                  <Input 
                    value={contractData.customerDocument}
                    onChange={(e) => handleChange('customerDocument', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Endereco do Cliente</Label>
                  <Input 
                    value={contractData.customerAddress}
                    onChange={(e) => handleChange('customerAddress', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Profissao</Label>
                  <Input 
                    value={contractData.customerProfession}
                    onChange={(e) => handleChange('customerProfession', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Estado Civil</Label>
                  <Input 
                    value={contractData.customerMaritalStatus}
                    onChange={(e) => handleChange('customerMaritalStatus', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Dados do Contrato */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <FileSignature className="w-5 h-5" />
                Dados do Contrato
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Valor Final</Label>
                  <Input 
                    value={contractData.finalAmount}
                    onChange={(e) => handleChange('finalAmount', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Input 
                    value={contractData.paymentTerms}
                    onChange={(e) => handleChange('paymentTerms', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input 
                    value={contractData.contractCity}
                    onChange={(e) => handleChange('contractCity', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Data do Contrato</Label>
                  <Input 
                    value={contractData.contractDate}
                    onChange={(e) => handleChange('contractDate', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Clausulas de Prazo */}
            <div className="space-y-4">
              <div className="text-lg font-semibold">Clausulas de Prazo</div>
              
              <div>
                <Label>3.1 - Prazo para Inicio</Label>
                <Textarea 
                  value={contractData.prazoInicio}
                  onChange={(e) => handleChange('prazoInicio', e.target.value)}
                  rows={4}
                />
              </div>
              
              <div>
                <Label>3.2 - Medicao Definitiva</Label>
                <Textarea 
                  value={contractData.prazoMedicao}
                  onChange={(e) => handleChange('prazoMedicao', e.target.value)}
                  rows={3}
                />
              </div>
              
              <div>
                <Label>3.3 - Vaos Liberados</Label>
                <Textarea 
                  value={contractData.prazoVaos}
                  onChange={(e) => handleChange('prazoVaos', e.target.value)}
                  rows={4}
                />
              </div>
              
              <div>
                <Label>3.4 - Responsabilidade</Label>
                <Textarea 
                  value={contractData.prazoResponsabilidade}
                  onChange={(e) => handleChange('prazoResponsabilidade', e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {/* Produtos (somente leitura) */}
            <Separator />
            <div className="space-y-2">
              <div className="text-lg font-semibold">Produtos/Servicos</div>
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                {items.map((item, index) => (
                  <div key={index} className="py-1">
                    {index + 1}. {item.description} 
                    {item.width && item.height && ` - ${item.width}mm x ${item.height}mm`}
                    {` - Qtd: ${item.quantity}`}
                    {` - ${formatCurrency(item.total_price)}`}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={generatePdf} className="gap-2">
            <Download className="w-4 h-4" />
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
