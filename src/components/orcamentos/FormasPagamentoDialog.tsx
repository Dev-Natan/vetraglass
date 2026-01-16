import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Banknote, 
  QrCode, 
  Building2, 
  Wallet,
  Plus,
  X,
  Save,
  Percent,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface InstallmentFee {
  installment: number;
  fee: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  maxInstallments?: number;
  discountPercent?: number;
  feePercent?: number;
  installmentFees?: InstallmentFee[];
  noFeeInstallments?: number;
}

export interface PaymentSettings {
  methods: PaymentMethod[];
  customConditions: string;
  showFeesToCustomer: boolean;
  displayMode: 'simple' | 'detailed';
}

interface FormasPagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultInstallmentFees: InstallmentFee[] = [
  { installment: 1, fee: 0 },
  { installment: 2, fee: 2.99 },
  { installment: 3, fee: 4.49 },
  { installment: 4, fee: 5.99 },
  { installment: 5, fee: 7.49 },
  { installment: 6, fee: 8.99 },
  { installment: 7, fee: 10.49 },
  { installment: 8, fee: 11.99 },
  { installment: 9, fee: 13.49 },
  { installment: 10, fee: 14.99 },
  { installment: 11, fee: 16.49 },
  { installment: 12, fee: 17.99 },
];

const defaultPaymentMethods: PaymentMethod[] = [
  { id: 'pix', name: 'PIX', icon: 'qrcode', enabled: true, discountPercent: 5 },
  { id: 'dinheiro', name: 'Dinheiro', icon: 'banknote', enabled: true, discountPercent: 5 },
  { 
    id: 'credito', 
    name: 'Cartão de Crédito', 
    icon: 'creditcard', 
    enabled: true, 
    maxInstallments: 12, 
    installmentFees: defaultInstallmentFees,
    noFeeInstallments: 3
  },
  { id: 'debito', name: 'Cartão de Débito', icon: 'creditcard', enabled: true, feePercent: 1.99 },
  { id: 'boleto', name: 'Boleto Bancário', icon: 'building', enabled: true },
  { id: 'transferencia', name: 'Transferência Bancária', icon: 'building', enabled: true },
];

const getIcon = (iconType: string) => {
  switch (iconType) {
    case 'qrcode': return QrCode;
    case 'banknote': return Banknote;
    case 'creditcard': return CreditCard;
    case 'building': return Building2;
    default: return Wallet;
  }
};

export function FormasPagamentoDialog({ open, onOpenChange }: FormasPagamentoDialogProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(defaultPaymentMethods);
  const [customConditions, setCustomConditions] = useState('');
  const [showFeesToCustomer, setShowFeesToCustomer] = useState(false);
  const [displayMode, setDisplayMode] = useState<'simple' | 'detailed'>('simple');
  const [newMethodName, setNewMethodName] = useState('');
  const [showInstallmentDetails, setShowInstallmentDetails] = useState(false);

  // Fetch saved settings from database
  const { data: savedSettings, isLoading } = useQuery({
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

  // Load saved settings when available
  useEffect(() => {
    if (savedSettings) {
      const methods = savedSettings.payment_methods as unknown as PaymentMethod[] | null;
      if (methods && Array.isArray(methods)) {
        setPaymentMethods(methods);
      }
      setCustomConditions(savedSettings.custom_conditions || '');
      setShowFeesToCustomer(savedSettings.show_fees_to_customer || false);
      setDisplayMode((savedSettings.display_mode as 'simple' | 'detailed') || 'simple');
    } else if (!savedSettings && !isLoading) {
      // Reset to defaults if no saved settings
      setPaymentMethods(defaultPaymentMethods);
      setCustomConditions('');
      setShowFeesToCustomer(false);
      setDisplayMode('simple');
    }
  }, [savedSettings, isLoading]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      
      const payload = {
        company_id: currentCompany.id,
        payment_methods: paymentMethods as unknown as Record<string, unknown>,
        custom_conditions: customConditions,
        show_fees_to_customer: showFeesToCustomer,
        display_mode: displayMode,
      };

      const { error } = await supabase
        .from('company_payment_settings')
        .upsert(payload, { onConflict: 'company_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
      toast.success('Formas de pagamento salvas!');
      onOpenChange(false);
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    }
  });

  const toggleMethod = (id: string) => {
    setPaymentMethods(prev => 
      prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m)
    );
  };

  const updateInstallments = (id: string, value: number) => {
    setPaymentMethods(prev => 
      prev.map(m => m.id === id ? { ...m, maxInstallments: value } : m)
    );
  };

  const updateNoFeeInstallments = (id: string, value: number) => {
    setPaymentMethods(prev => 
      prev.map(m => m.id === id ? { ...m, noFeeInstallments: value } : m)
    );
  };

  const updateInstallmentFee = (methodId: string, installment: number, fee: number) => {
    setPaymentMethods(prev => 
      prev.map(m => {
        if (m.id !== methodId) return m;
        const fees = m.installmentFees?.map(f => 
          f.installment === installment ? { ...f, fee } : f
        ) || [];
        return { ...m, installmentFees: fees };
      })
    );
  };

  const updateDiscount = (id: string, value: number) => {
    setPaymentMethods(prev => 
      prev.map(m => m.id === id ? { ...m, discountPercent: value } : m)
    );
  };

  const updateFee = (id: string, value: number) => {
    setPaymentMethods(prev => 
      prev.map(m => m.id === id ? { ...m, feePercent: value } : m)
    );
  };

  const addCustomMethod = () => {
    if (!newMethodName.trim()) return;
    
    const newMethod: PaymentMethod = {
      id: `custom_${Date.now()}`,
      name: newMethodName.trim(),
      icon: 'wallet',
      enabled: true,
    };
    
    setPaymentMethods(prev => [...prev, newMethod]);
    setNewMethodName('');
  };

  const removeMethod = (id: string) => {
    if (!id.startsWith('custom_')) return;
    setPaymentMethods(prev => prev.filter(m => m.id !== id));
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  const generatePaymentTermsText = () => {
    const enabledMethods = paymentMethods.filter(m => m.enabled);
    let text = 'FORMAS DE PAGAMENTO ACEITAS:\n\n';
    
    enabledMethods.forEach(method => {
      text += `• ${method.name}`;
      if (method.discountPercent) {
        text += ` (${method.discountPercent}% de desconto)`;
      }
      if (method.id === 'credito' && method.maxInstallments && method.maxInstallments > 1) {
        const noFee = method.noFeeInstallments || 0;
        if (noFee > 0) {
          text += ` (até ${noFee}x sem juros`;
          if (method.maxInstallments > noFee) {
            text += `, até ${method.maxInstallments}x com juros`;
          }
          text += ')';
        } else {
          text += ` (em até ${method.maxInstallments}x com juros)`;
        }
      } else if (method.feePercent && method.feePercent > 0) {
        text += ` (+ ${method.feePercent}% de taxa)`;
      }
      text += '\n';
    });

    if (customConditions.trim()) {
      text += `\nCONDIÇÕES ESPECIAIS:\n${customConditions}`;
    }

    return text;
  };

  const creditMethod = paymentMethods.find(m => m.id === 'credito');

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Formas de Pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Display Settings Card */}
          <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Configurações de Exibição no PDF
            </h3>
            
            {/* Toggle Show Fees */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-2">
                  {showFeesToCustomer ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                  Exibir taxas para o cliente
                </Label>
                <p className="text-xs text-muted-foreground">
                  {showFeesToCustomer 
                    ? 'Mostra valor da parcela + taxa percentual + valor total' 
                    : 'Mostra apenas o valor da parcela (modo comercial)'}
                </p>
              </div>
              <Switch
                checked={showFeesToCustomer}
                onCheckedChange={setShowFeesToCustomer}
              />
            </div>

            {/* Display Mode */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Modo de exibição</Label>
                <p className="text-xs text-muted-foreground">
                  {displayMode === 'simple' 
                    ? 'Mostra parcelas principais (1x, 3x, 6x, 10x, 12x)' 
                    : 'Mostra todas as parcelas habilitadas'}
                </p>
              </div>
              <Select value={displayMode} onValueChange={(v) => setDisplayMode(v as 'simple' | 'detailed')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simples</SelectItem>
                  <SelectItem value="detailed">Detalhado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payment Methods List */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Métodos Aceitos</Label>
            
            {paymentMethods.map((method) => {
              const Icon = getIcon(method.icon);
              const isCustom = method.id.startsWith('custom_');
              
              return (
                <div key={method.id} className="space-y-2">
                  <div 
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                      method.enabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'
                    }`}
                  >
                    <Switch
                      checked={method.enabled}
                      onCheckedChange={() => toggleMethod(method.id)}
                    />
                    
                    <div className="flex items-center gap-2 flex-1">
                      <Icon className={`w-5 h-5 ${method.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`font-medium ${method.enabled ? '' : 'text-muted-foreground'}`}>
                        {method.name}
                      </span>
                      {isCustom && (
                        <Badge variant="outline" className="text-xs">Personalizado</Badge>
                      )}
                    </div>

                    {method.enabled && (
                      <div className="flex items-center gap-3">
                        {(method.id === 'credito') && (
                          <>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                                Máx. Parcelas:
                              </Label>
                              <Input
                                type="number"
                                min="1"
                                max="12"
                                value={method.maxInstallments || 1}
                                onChange={(e) => updateInstallments(method.id, parseInt(e.target.value) || 1)}
                                className="w-14 h-8 text-center"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                                S/ juros até:
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                max={method.maxInstallments || 12}
                                value={method.noFeeInstallments || 0}
                                onChange={(e) => updateNoFeeInstallments(method.id, parseInt(e.target.value) || 0)}
                                className="w-14 h-8 text-center"
                              />
                              <span className="text-xs text-muted-foreground">x</span>
                            </div>
                          </>
                        )}

                        {(method.id === 'debito') && (
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">
                              Taxa %:
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={method.feePercent || 0}
                              onChange={(e) => updateFee(method.id, parseFloat(e.target.value) || 0)}
                              className="w-16 h-8 text-center"
                            />
                          </div>
                        )}
                        
                        {(method.id === 'pix' || method.id === 'dinheiro') && (
                          <div className="flex items-center gap-2">
                            <Percent className="w-4 h-4 text-muted-foreground" />
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">
                              Desconto:
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={method.discountPercent || 0}
                              onChange={(e) => updateDiscount(method.id, parseInt(e.target.value) || 0)}
                              className="w-16 h-8 text-center"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {isCustom && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMethod(method.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Credit Card Installment Fees Detail */}
          {creditMethod?.enabled && (
            <Collapsible open={showInstallmentDetails} onOpenChange={setShowInstallmentDetails}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Taxas por Parcela (Cartão de Crédito)
                  </span>
                  {showInstallmentDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="p-4 bg-muted/30 rounded-lg border space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                      Sem juros até {creditMethod.noFeeInstallments || 0}x
                    </Badge>
                    <span>- A empresa assume a taxa nessas parcelas</span>
                  </div>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {creditMethod.installmentFees?.slice(0, creditMethod.maxInstallments || 12).map((fee) => {
                      const isNoFee = fee.installment <= (creditMethod.noFeeInstallments || 0);
                      return (
                        <div 
                          key={fee.installment} 
                          className={`flex flex-col gap-1 p-2 rounded-lg border ${
                            isNoFee ? 'bg-green-500/10 border-green-500/30' : 'bg-background'
                          }`}
                        >
                          <Label className="text-xs text-center font-medium">
                            {fee.installment}x {isNoFee && <span className="text-green-600">(s/ juros)</span>}
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={fee.fee}
                            onChange={(e) => updateInstallmentFee('credito', fee.installment, parseFloat(e.target.value) || 0)}
                            className="h-8 text-center text-sm"
                          />
                          <span className="text-[10px] text-center text-muted-foreground">%</span>
                        </div>
                      );
                    })}
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    💡 As taxas configuradas acima são usadas para calcular o custo real. 
                    Parcelas "sem juros" significam que a empresa absorve essas taxas, não o cliente.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Add Custom Method */}
          <div className="flex gap-2">
            <Input
              placeholder="Adicionar forma de pagamento personalizada..."
              value={newMethodName}
              onChange={(e) => setNewMethodName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomMethod()}
            />
            <Button variant="outline" onClick={addCustomMethod} disabled={!newMethodName.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Custom Conditions */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Condições Especiais</Label>
            <Textarea
              placeholder="Ex: Entrada de 50% + saldo na entrega&#10;Parcelamento sem juros até 6x&#10;Desconto especial para pagamento antecipado"
              value={customConditions}
              onChange={(e) => setCustomConditions(e.target.value)}
              rows={4}
            />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Pré-visualização</Label>
            <div className="p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-line font-mono">
              {generatePaymentTermsText()}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar Configurações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}