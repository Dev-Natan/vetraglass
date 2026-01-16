import { useState, useEffect } from 'react';
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
  Percent
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
  maxInstallments?: number;
  discountPercent?: number;
  feePercent?: number;
}

interface FormasPagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultPaymentMethods: PaymentMethod[] = [
  { id: 'pix', name: 'PIX', icon: 'qrcode', enabled: true, discountPercent: 5 },
  { id: 'dinheiro', name: 'Dinheiro', icon: 'banknote', enabled: true, discountPercent: 5 },
  { id: 'credito', name: 'Cartão de Crédito', icon: 'creditcard', enabled: true, maxInstallments: 12, feePercent: 0 },
  { id: 'debito', name: 'Cartão de Débito', icon: 'creditcard', enabled: true, feePercent: 0 },
  { id: 'boleto', name: 'Boleto Bancário', icon: 'building', enabled: true },
  { id: 'transferencia', name: 'Transferência Bancária', icon: 'building', enabled: true },
];

const STORAGE_KEY = 'payment_methods_config';

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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(defaultPaymentMethods);
  const [customConditions, setCustomConditions] = useState('');
  const [newMethodName, setNewMethodName] = useState('');

  // Load saved config
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setPaymentMethods(config.methods || defaultPaymentMethods);
        setCustomConditions(config.customConditions || '');
      } catch {
        // Use defaults
      }
    }
  }, [open]);

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
    const config = {
      methods: paymentMethods,
      customConditions,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    toast.success('Formas de pagamento salvas!');
    onOpenChange(false);
  };

  const generatePaymentTermsText = () => {
    const enabledMethods = paymentMethods.filter(m => m.enabled);
    let text = 'FORMAS DE PAGAMENTO ACEITAS:\n\n';
    
    enabledMethods.forEach(method => {
      text += `• ${method.name}`;
      if (method.discountPercent) {
        text += ` (${method.discountPercent}% de desconto)`;
      }
      if (method.maxInstallments && method.maxInstallments > 1) {
        text += ` (em até ${method.maxInstallments}x`;
        if (method.feePercent && method.feePercent > 0) {
          text += ` + ${method.feePercent}% de taxa`;
        }
        text += ')';
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
          {/* Payment Methods List */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Métodos Aceitos</Label>
            
            {paymentMethods.map((method) => {
              const Icon = getIcon(method.icon);
              const isCustom = method.id.startsWith('custom_');
              
              return (
                <div 
                  key={method.id} 
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
                              Parcelas:
                            </Label>
                            <Input
                              type="number"
                              min="1"
                              max="24"
                              value={method.maxInstallments || 1}
                              onChange={(e) => updateInstallments(method.id, parseInt(e.target.value) || 1)}
                              className="w-16 h-8 text-center"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">
                              Taxa %:
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={method.feePercent || 0}
                              onChange={(e) => updateFee(method.id, parseFloat(e.target.value) || 0)}
                              className="w-16 h-8 text-center"
                            />
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
                            step="0.1"
                            value={method.feePercent || 0}
                            onChange={(e) => updateFee(method.id, parseFloat(e.target.value) || 0)}
                            className="w-16 h-8 text-center"
                          />
                        </div>
                      )}
                      
                      {(method.id === 'pix' || method.id === 'dinheiro') && (
                        <div className="flex items-center gap-2">
                          <Percent className="w-4 h-4 text-muted-foreground" />
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
              );
            })}
          </div>

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
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              Salvar Configurações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
