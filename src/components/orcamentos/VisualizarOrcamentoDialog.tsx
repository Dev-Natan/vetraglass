import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateQuotePdf } from '@/utils/generateQuotePdf';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  CheckCircle, 
  XCircle,
  Clock,
  FileText,
  Printer,
  Download,
  FileSignature
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AprovarOrcamentoDialog } from './AprovarOrcamentoDialog';
import { EditarContratoDialog } from './EditarContratoDialog';

type QuoteStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'converted';

interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address?: string | null;
  customer_document?: string | null;
  customer_document_type?: string | null;
  customer_profession?: string | null;
  customer_marital_status?: string | null;
  payment_terms?: string | null;
  status: QuoteStatus;
  total_amount: number;
  discount_percent?: number;
  discount_amount?: number;
  final_amount: number;
  notes?: string | null;
  valid_until: string | null;
  created_at: string;
}

interface QuoteItem {
  id: string;
  description: string;
  width: number | null;
  height: number | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  has_glass?: boolean;
  glass_color?: string | null;
  glass_thickness?: string | null;
  product_template_id?: string | null;
  product_templates?: {
    image_url: string | null;
    linha: string | null;
    category: string | null;
  } | null;
}

const statusConfig: Record<QuoteStatus, { label: string; icon: typeof Clock; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', icon: Clock, variant: 'secondary' },
  approved: { label: 'Aprovado', icon: CheckCircle, variant: 'default' },
  converted: { label: 'Convertido', icon: CheckCircle, variant: 'default' },
  rejected: { label: 'Rejeitado', icon: XCircle, variant: 'destructive' },
  expired: { label: 'Expirado', icon: Clock, variant: 'outline' },
};

interface VisualizarOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
}

export function VisualizarOrcamentoDialog({ open, onOpenChange, quote }: VisualizarOrcamentoDialogProps) {
  const { toast } = useToast();
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [aprovarDialogOpen, setAprovarDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);

  // Fetch quote items with product template info for images
  const { data: items } = useQuery({
    queryKey: ['quote-items', quote?.id],
    queryFn: async () => {
      if (!quote?.id) return [];
      const { data, error } = await supabase
        .from('quote_items')
        .select(`
          *,
          product_templates (
            image_url,
            linha,
            category
          )
        `)
        .eq('quote_id', quote.id);
      
      if (error) throw error;
      return data as QuoteItem[];
    },
    enabled: !!quote?.id && open
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: QuoteStatus) => {
      if (!quote?.id) throw new Error('Orçamento não encontrado');
      const { error } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', quote.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Status atualizado!' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!quote || !items) return;
    
    const company = currentCompany ? {
      name: currentCompany.name,
      cnpj: currentCompany.cnpj,
      phone: currentCompany.phone,
      email: currentCompany.email,
      address: currentCompany.address,
    } : null;
    
    // Transform items to include image_url, linha, and category from product_templates
    const itemsForPdf = items.map(item => ({
      description: item.description,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      has_glass: item.has_glass,
      glass_color: item.glass_color,
      glass_thickness: item.glass_thickness,
      image_url: item.product_templates?.image_url || null,
      linha: item.product_templates?.linha || null,
      category: item.product_templates?.category || null,
    }));
    
    toast({ title: 'Gerando PDF...' });
    await generateQuotePdf(quote, itemsForPdf, company);
    toast({ title: 'PDF gerado com sucesso!' });
  };

  const handleDownloadContract = () => {
    if (!quote || !items) return;
    setContractDialogOpen(true);
  };

  const getContractItems = () => {
    if (!items) return [];
    return items.map(item => ({
      description: item.description,
      width: item.width,
      height: item.height,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      has_glass: item.has_glass,
      glass_color: item.glass_color,
      glass_thickness: item.glass_thickness,
    }));
  };

  const getCompanyData = () => {
    if (!currentCompany) return null;
    return {
      name: currentCompany.name,
      cnpj: currentCompany.cnpj,
      phone: currentCompany.phone,
      email: currentCompany.email,
      address: currentCompany.address,
    };
  };

  if (!quote) return null;

  const status = statusConfig[quote.status];
  const StatusIcon = status.icon;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Orçamento #{quote.quote_number.toString().padStart(4, '0')}
            </DialogTitle>
            <Badge variant={status.variant} className="gap-1">
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{quote.customer_name}</span>
            </div>
            {quote.customer_phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{quote.customer_phone}</span>
              </div>
            )}
            {quote.customer_email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{quote.customer_email}</span>
              </div>
            )}
            {quote.customer_address && (
              <div className="flex items-center gap-2 sm:col-span-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{quote.customer_address}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Criado em {format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
            {quote.valid_until && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Válido até {format(new Date(quote.valid_until), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <h3 className="font-medium mb-3">Itens</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Descrição</th>
                    <th className="text-center p-3">Medidas</th>
                    <th className="text-center p-3">Qtd</th>
                    <th className="text-right p-3">Unitário</th>
                    <th className="text-right p-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items?.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">
                        <div>{item.description}</div>
                        {item.has_glass !== undefined && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.has_glass ? (
                              <>
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  Com Vidro
                                </Badge>
                                {item.glass_color && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                    {item.glass_color === 'incolor' ? 'Incolor' : 
                                     item.glass_color === 'verde' ? 'Verde' : 
                                     item.glass_color === 'fume' ? 'Fumê' : item.glass_color}
                                  </Badge>
                                )}
                                {item.glass_thickness && (
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                    {item.glass_thickness}
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                Sem Vidro
                              </Badge>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center text-muted-foreground">
                        {item.width && item.height ? `${item.width} x ${item.height} mm` : '-'}
                      </td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(quote.total_amount)}</span>
            </div>
            {quote.discount_amount && quote.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Desconto ({quote.discount_percent}%)</span>
                <span>-{formatCurrency(quote.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatCurrency(quote.final_amount)}</span>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium mb-1">Observações</h4>
              <p className="text-sm text-muted-foreground">{quote.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Select
                value={quote.status}
                onValueChange={(value) => updateStatusMutation.mutate(value as QuoteStatus)}
                disabled={quote.status === 'approved'}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <config.icon className="w-4 h-4" />
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownloadPdf} className="gap-2">
                <Download className="w-4 h-4" />
                Baixar PDF
              </Button>
              <Button variant="outline" onClick={handleDownloadContract} className="gap-2">
                <FileSignature className="w-4 h-4" />
                Gerar Contrato
              </Button>
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="w-4 h-4" />
                Imprimir
              </Button>
              {quote.status === 'pending' && (
                <Button 
                  onClick={() => setAprovarDialogOpen(true)} 
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  Aprovar
                </Button>
              )}
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Aprovar Dialog - Outside parent Dialog */}
    <AprovarOrcamentoDialog
      open={aprovarDialogOpen}
      onOpenChange={setAprovarDialogOpen}
      quote={quote}
      items={items || []}
      onSuccess={() => {
        setAprovarDialogOpen(false);
        onOpenChange(false);
      }}
    />

    {/* Editar Contrato Dialog - Outside parent Dialog */}
    <EditarContratoDialog
      open={contractDialogOpen}
      onOpenChange={setContractDialogOpen}
      quote={quote}
      items={getContractItems()}
      company={getCompanyData()}
    />
  </>
  );
}
