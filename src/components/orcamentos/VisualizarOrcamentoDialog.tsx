import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissionProfile } from '@/hooks/usePermissionProfile';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateQuotePdf, PaymentSettings } from '@/utils/generateQuotePdf';
import { PaymentMethod } from './FormasPagamentoDialog';
import { QuoteFinancialDashboard } from './QuoteFinancialDashboard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Download,
  FileSignature,
  ClipboardList,
  ExternalLink,
  CalendarDays,
  Wallet,
  Loader2
} from 'lucide-react';
import { ImageIcon, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  show_measures_column?: boolean | null;
  show_m2_column?: boolean | null;
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
  aluminum_color?: string | null;
  notes?: string | null;
  product_template_id?: string | null;
  company_product_id?: string | null;
  company_item_id?: string | null;
  product_templates?: {
    image_url: string | null;
    linha: string | null;
    category: string | null;
  } | null;
  company_products?: {
    image_url: string | null;
    linha: string | null;
  } | null;
  company_items?: {
    image_url: string | null;
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
  const navigate = useNavigate();
  const [aprovarDialogOpen, setAprovarDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Check if user can see financial data
  const { isAdmin, isGerente, isCaixa, isFinanceiro } = usePermissionProfile();
  const canSeeFinancials = isAdmin || isGerente || isCaixa || isFinanceiro;

  // Fetch fresh company data for PDF generation (includes updated logo)
  const { data: companyData } = useQuery({
    queryKey: ['company-for-pdf', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, cnpj, phone, email, address, logo_url, logo_size, enable_presentation_page, default_presentation_text')
        .eq('id', currentCompany.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id && open
  });

  // Fetch payment settings for PDF
  const { data: paymentSettingsData } = useQuery({
    queryKey: ['payment-settings', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from('company_payment_settings')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id && open
  });

  // Fetch quote items with product template, company product and company item info for images
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
          ),
          company_products (
            image_url,
            linha
          ),
          company_items (
            image_url
          )
        `)
        .eq('quote_id', quote.id);
      
      if (error) throw error;
      return data as QuoteItem[];
    },
    enabled: !!quote?.id && open
  });

  // Check if OS exists for this quote
  const { data: existingOS, refetch: refetchOS } = useQuery({
    queryKey: ['ordem-servico-for-quote', quote?.id],
    queryFn: async () => {
      if (!quote?.id) return null;
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('id, os_number')
        .eq('quote_id', quote.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!quote?.id && open && (quote?.status === 'approved' || quote?.status === 'converted')
  });

  // Check for related appointments
  const { data: relatedAppointments } = useQuery({
    queryKey: ['appointments-for-quote', quote?.id],
    queryFn: async () => {
      if (!quote?.id) return [];
      const { data, error } = await supabase
        .from('service_appointments')
        .select('id, title, scheduled_date, appointment_type')
        .eq('quote_id', quote.id)
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      return data || [];
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

  // Create OS mutation
  const createOSMutation = useMutation({
    mutationFn: async () => {
      if (!quote || !currentCompany?.id) throw new Error('Dados inválidos');
      
      const estimatedEnd = new Date();
      estimatedEnd.setDate(estimatedEnd.getDate() + 7);
      
      const { data, error } = await supabase
        .from('ordens_servico')
        .insert({
          company_id: currentCompany.id,
          quote_id: quote.id,
          customer_name: quote.customer_name,
          customer_phone: quote.customer_phone,
          customer_email: quote.customer_email,
          customer_address: quote.customer_address,
          total_amount: quote.final_amount,
          pending_amount: quote.final_amount,
          status: 'pending',
          priority: 'normal',
          current_stage: 'Aguardando início',
          estimated_end: estimatedEnd.toISOString().split('T')[0],
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      refetchOS();
      toast({ title: 'Ordem de serviço criada com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao criar ordem de serviço', variant: 'destructive' });
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Transform payment settings for PDF
  const getPaymentSettings = (): PaymentSettings | null => {
    if (!paymentSettingsData) return null;
    
    const methods = paymentSettingsData.payment_methods as unknown as PaymentMethod[] | null;
    if (!methods || !Array.isArray(methods)) return null;
    
    return {
      methods,
      customConditions: (paymentSettingsData.custom_conditions as string) || '',
      showFeesToCustomer: paymentSettingsData.show_fees_to_customer || false,
      displayMode: (paymentSettingsData.display_mode as 'simple' | 'detailed') || 'simple',
      showOtherMethods: (paymentSettingsData as { show_other_methods?: boolean }).show_other_methods ?? true,
      showInstallments: (paymentSettingsData as { show_installments?: boolean }).show_installments ?? true,
    };
  };

  const handlePrint = async () => {
    if (!quote || !items) return;
    
    const company = companyData ? {
      name: companyData.name,
      cnpj: companyData.cnpj,
      phone: companyData.phone,
      email: companyData.email,
      address: companyData.address,
      logo_url: companyData.logo_url,
      logo_size: companyData.logo_size,
      enable_presentation_page: (companyData as any).enable_presentation_page,
      default_presentation_text: (companyData as any).default_presentation_text,
    } : null;
    
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
      aluminum_color: item.aluminum_color,
      notes: item.notes,
      // Priority: company_products > product_templates > company_items
      image_url: item.company_products?.image_url || item.product_templates?.image_url || item.company_items?.image_url || null,
      linha: item.company_products?.linha || item.product_templates?.linha || null,
      category: item.product_templates?.category || null,
    }));
    
    toast({ title: 'Preparando impressão...' });
    await generateQuotePdf(quote, itemsForPdf, company, 'print', getPaymentSettings(), {
      showMeasuresColumn: quote.show_measures_column ?? true,
      showM2Column: quote.show_m2_column ?? true,
    });
  };

  const handleDownloadPdf = async () => {
    if (!quote || !items) return;
    
    const company = companyData ? {
      name: companyData.name,
      cnpj: companyData.cnpj,
      phone: companyData.phone,
      email: companyData.email,
      address: companyData.address,
      logo_url: companyData.logo_url,
      logo_size: companyData.logo_size,
      enable_presentation_page: (companyData as any).enable_presentation_page,
      default_presentation_text: (companyData as any).default_presentation_text,
    } : null;
    
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
      aluminum_color: item.aluminum_color,
      notes: item.notes,
      // Priority: company_products > product_templates > company_items
      image_url: item.company_products?.image_url || item.product_templates?.image_url || item.company_items?.image_url || null,
      linha: item.company_products?.linha || item.product_templates?.linha || null,
      category: item.product_templates?.category || null,
    }));
    
    setIsGeneratingPdf(true);
    const loadingToast = toast({
      title: 'Gerando PDF, aguarde...',
      description: itemsForPdf.length > 10 ? `Processando ${itemsForPdf.length} itens. Pode levar alguns segundos.` : undefined,
    });
    try {
      await generateQuotePdf(quote, itemsForPdf, company, 'download', getPaymentSettings(), {
        showMeasuresColumn: quote.show_measures_column ?? true,
        showM2Column: quote.show_m2_column ?? true,
      });
      loadingToast.dismiss?.();
      toast({ title: 'PDF gerado com sucesso!' });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      loadingToast.dismiss?.();
      toast({ title: 'Erro ao gerar PDF', description: 'Tente novamente em instantes.', variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
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
      linha: item.company_products?.linha || item.product_templates?.linha || null,
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

          {/* Status Stepper */}
          {(() => {
            const steps: { key: QuoteStatus; label: string }[] = [
              { key: 'pending', label: 'Pendente' },
              { key: 'approved', label: 'Em Aberto' },
              { key: 'converted', label: 'Liquidado' },
            ];
            const currentIdx = steps.findIndex(s => s.key === quote.status);
            const isRejected = quote.status === 'rejected' || quote.status === 'expired';
            const handleStepClick = (key: QuoteStatus) => {
              if (isRejected) return;
              if (key === quote.status) return;
              if (key === 'approved' && quote.status === 'pending') {
                setAprovarDialogOpen(true);
                return;
              }
              if (key === 'converted' && quote.status === 'approved') {
                if (!existingOS) createOSMutation.mutate();
                return;
              }
            };
            return (
              <div className="flex items-center gap-1 p-3 bg-muted/40 rounded-lg border">
                {steps.map((step, idx) => {
                  const done = !isRejected && idx <= currentIdx;
                  const active = !isRejected && idx === currentIdx;
                  const clickable = !isRejected && (
                    (step.key === 'approved' && quote.status === 'pending') ||
                    (step.key === 'converted' && quote.status === 'approved')
                  );
                  return (
                    <div key={step.key} className="flex items-center flex-1">
                      <button
                        type="button"
                        onClick={() => handleStepClick(step.key)}
                        disabled={!clickable}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex-1 justify-center",
                          done && !active && "bg-primary/10 text-primary",
                          active && "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30",
                          !done && "bg-background text-muted-foreground border",
                          clickable && "hover:bg-primary/90 hover:text-primary-foreground cursor-pointer",
                          !clickable && "cursor-default"
                        )}
                      >
                        <span className={cn(
                          "flex items-center justify-center w-5 h-5 rounded-full text-xs border",
                          done ? "bg-background/20 border-current" : "border-current"
                        )}>
                          {done ? <CheckCircle className="w-3.5 h-3.5" /> : idx + 1}
                        </span>
                        {step.label}
                      </button>
                      {idx < steps.length - 1 && (
                        <ChevronRight className={cn(
                          "w-4 h-4 shrink-0 mx-0.5",
                          idx < currentIdx ? "text-primary" : "text-muted-foreground/40"
                        )} />
                      )}
                    </div>
                  );
                })}
                {isRejected && (
                  <Badge variant="destructive" className="ml-2 gap-1">
                    <XCircle className="w-3 h-3" />
                    {status.label}
                  </Badge>
                )}
              </div>
            );
          })()}

          {/* Items */}
          <div>
            <h3 className="font-medium mb-3">Itens</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 w-14"></th>
                    <th className="text-left p-3">Descrição</th>
                    <th className="text-center p-3">Medidas</th>
                    <th className="text-center p-3">Qtd</th>
                    <th className="text-right p-3">Unitário</th>
                    <th className="text-right p-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items?.map((item) => {
                    const thumb = item.company_products?.image_url || item.product_templates?.image_url || item.company_items?.image_url || null;
                    return (
                    <tr key={item.id} className="border-t">
                      <td className="p-2">
                        <div className="w-10 h-10 rounded-md border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                          {thumb ? (
                            <img src={thumb} alt={item.description} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-muted-foreground/60" />
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{item.description}</span>
                          {(item.company_products?.linha || item.product_templates?.linha) && (
                            <Badge variant="secondary" className="text-xs">
                              Linha {item.company_products?.linha || item.product_templates?.linha}
                            </Badge>
                          )}
                        </div>
                        {(() => {
                          const hasGlassFields = !!item.glass_color || !!item.glass_thickness;
                          // Só mostra "Sem Vidro" se o usuário explicitamente marcou has_glass=false
                          // E não há campos de vidro preenchidos. Caso contrário, mostra os badges de vidro.
                          if (item.has_glass) {
                            return (
                              <div className="flex flex-wrap gap-1 mt-1">
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
                              </div>
                            );
                          }
                          if (item.has_glass === false && hasGlassFields) {
                            return (
                              <div className="flex flex-wrap gap-1 mt-1">
                                <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                  Sem Vidro
                                </Badge>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      <td className="p-3 text-center text-muted-foreground">
                        {item.width && item.height ? `${item.width} x ${item.height} mm` : '-'}
                      </td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(item.total_price)}</td>
                    </tr>
                    );
                  })}
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

          {/* Related Links */}
          {(existingOS || (relatedAppointments && relatedAppointments.length > 0)) && (
            <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
              <h4 className="text-sm font-medium">Entidades Relacionadas</h4>
              
              {existingOS && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    <span>OS #{existingOS.os_number?.toString().padStart(4, '0')}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/ordens-servico/${existingOS.id}`);
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver OS
                  </Button>
                </div>
              )}
              
              {relatedAppointments && relatedAppointments.length > 0 && (
                <div className="space-y-2">
                  {relatedAppointments.map((appt) => (
                    <div key={appt.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDays className="w-4 h-4 text-primary" />
                        <span className="truncate max-w-[200px]">{appt.title}</span>
                        <span className="text-muted-foreground text-xs">
                          ({format(new Date(appt.scheduled_date), 'dd/MM', { locale: ptBR })})
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          onOpenChange(false);
                          navigate('/agenda');
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver Agenda
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Financial Dashboard - Only for approved/converted quotes and users with financial permissions */}
          {(quote.status === 'approved' || quote.status === 'converted') && canSeeFinancials && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Informações Financeiras
                </h4>
                <QuoteFinancialDashboard
                  quoteId={quote.id}
                  ordemServicoId={existingOS?.id}
                  totalAmount={quote.final_amount}
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="gap-2">
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isGeneratingPdf ? 'Gerando PDF...' : 'Baixar PDF'}
            </Button>
            <Button variant="outline" onClick={handleDownloadContract} className="gap-2">
              <FileSignature className="w-4 h-4" />
              Gerar Contrato
            </Button>
            {(quote.status === 'approved' || quote.status === 'converted') && existingOS && (
              <Button 
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/ordens-servico/${existingOS.id}`);
                }}
                className="gap-2"
              >
                <ClipboardList className="w-4 h-4" />
                Ver OS
              </Button>
            )}
            {(quote.status === 'approved' || quote.status === 'converted') && !existingOS && (
              <Button 
                onClick={() => createOSMutation.mutate()} 
                disabled={createOSMutation.isPending}
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <ClipboardList className="w-4 h-4" />
                {createOSMutation.isPending ? 'Criando...' : 'Gerar OS'}
              </Button>
            )}
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
      </DialogContent>
    </Dialog>

    {/* Aprovar Dialog - Outside parent Dialog */}
    <AprovarOrcamentoDialog
      open={aprovarDialogOpen}
      onOpenChange={setAprovarDialogOpen}
      quote={quote}
      items={items || []}
      onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        queryClient.invalidateQueries({ queryKey: ['ordem-servico-for-quote', quote.id] });
        setAprovarDialogOpen(false);
        // Shortcut: after approval, immediately trigger OS creation if none exists
        setTimeout(async () => {
          const { data: existing } = await supabase
            .from('ordens_servico')
            .select('id')
            .eq('quote_id', quote.id)
            .maybeSingle();
          if (!existing) {
            createOSMutation.mutate();
          } else {
            refetchOS();
          }
        }, 300);
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