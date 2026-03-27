import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Settings2, Save, Percent, Truck, Hammer, Package, Receipt, Calculator } from 'lucide-react';
import { usePricingPolicy } from '@/hooks/usePricingPolicy';
import { type PricingPolicy, type MarginType, type RoundingMode } from '@/utils/pricingEngine';

export function PricingPolicySettings() {
  const { policy, isLoading, savePolicy, isSaving } = usePricingPolicy();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PricingPolicy>(policy);

  useEffect(() => {
    setForm(policy);
  }, [policy]);

  const update = <K extends keyof PricingPolicy>(key: K, value: PricingPolicy[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    savePolicy(form);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-1.5" />
          Política de Preços
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Política de Precificação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Margin Type */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                Tipo de Margem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={form.marginType} onValueChange={v => update('marginType', v as MarginType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">
                    <div>
                      <p className="font-medium">Margem Simples</p>
                      <p className="text-xs text-muted-foreground">Preço = Custo × (1 + margem%)</p>
                    </div>
                  </SelectItem>
                  <SelectItem value="markup">
                    <div>
                      <p className="font-medium">Markup</p>
                      <p className="text-xs text-muted-foreground">Preço = Custo ÷ (1 - margem%)</p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Margem padrão (%)</Label>
                  <Input
                    type="number" min={0} step={1}
                    value={form.defaultMargin}
                    onChange={e => update('defaultMargin', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Perda padrão (%)</Label>
                  <Input
                    type="number" min={0} step={0.5}
                    value={form.defaultLossPercent}
                    onChange={e => update('defaultLossPercent', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Indirect Costs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Custos Adicionais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Labor */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hammer className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs">Mão de obra</Label>
                </div>
                <Switch checked={form.includeLabor} onCheckedChange={v => update('includeLabor', v)} />
              </div>
              {form.includeLabor && (
                <div className="pl-6">
                  <Label className="text-xs text-muted-foreground">Custo por m² (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={form.laborCostPerSqm} onChange={e => update('laborCostPerSqm', parseFloat(e.target.value) || 0)} />
                </div>
              )}

              {/* Packaging */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs">Embalagem</Label>
                </div>
                <Switch checked={form.includePackaging} onCheckedChange={v => update('includePackaging', v)} />
              </div>
              {form.includePackaging && (
                <div className="pl-6">
                  <Label className="text-xs text-muted-foreground">Custo por unidade (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={form.packagingCostPerUnit} onChange={e => update('packagingCostPerUnit', parseFloat(e.target.value) || 0)} />
                </div>
              )}

              {/* Installation */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hammer className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs">Instalação</Label>
                </div>
                <Switch checked={form.includeInstallation} onCheckedChange={v => update('includeInstallation', v)} />
              </div>
              {form.includeInstallation && (
                <div className="pl-6">
                  <Label className="text-xs text-muted-foreground">Custo por m² (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={form.installationCostPerSqm} onChange={e => update('installationCostPerSqm', parseFloat(e.target.value) || 0)} />
                </div>
              )}

              {/* Transport */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs">Transporte</Label>
                </div>
                <Switch checked={form.includeTransport} onCheckedChange={v => update('includeTransport', v)} />
              </div>
              {form.includeTransport && (
                <div className="pl-6">
                  <Label className="text-xs text-muted-foreground">Custo por unidade (R$)</Label>
                  <Input type="number" min={0} step={0.01} value={form.transportCostPerUnit} onChange={e => update('transportCostPerUnit', parseFloat(e.target.value) || 0)} />
                </div>
              )}

              {/* Commission */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs">Comissão</Label>
                </div>
                <Switch checked={form.includeCommission} onCheckedChange={v => update('includeCommission', v)} />
              </div>
              {form.includeCommission && (
                <div className="pl-6">
                  <Label className="text-xs text-muted-foreground">Percentual (%)</Label>
                  <Input type="number" min={0} step={0.5} value={form.commissionPercent} onChange={e => update('commissionPercent', parseFloat(e.target.value) || 0)} />
                </div>
              )}

              {/* Tax */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs">Impostos</Label>
                </div>
                <Switch checked={form.includeTax} onCheckedChange={v => update('includeTax', v)} />
              </div>
              {form.includeTax && (
                <div className="pl-6">
                  <Label className="text-xs text-muted-foreground">Percentual (%)</Label>
                  <Input type="number" min={0} step={0.5} value={form.taxPercent} onChange={e => update('taxPercent', parseFloat(e.target.value) || 0)} />
                </div>
              )}

              {/* Admin Fee */}
              <div className="space-y-1">
                <Label className="text-xs">Taxa administrativa por unidade (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.adminFee} onChange={e => update('adminFee', parseFloat(e.target.value) || 0)} />
              </div>
            </CardContent>
          </Card>

          {/* Rounding */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Arredondamento</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Modo</Label>
                <Select value={form.roundingMode} onValueChange={v => update('roundingMode', v as RoundingMode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round">Padrão</SelectItem>
                    <SelectItem value="ceil">Para cima</SelectItem>
                    <SelectItem value="floor">Para baixo</SelectItem>
                    <SelectItem value="none">Sem arredondamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Casas decimais</Label>
                <Input type="number" min={0} max={4} value={form.priceDecimals} onChange={e => update('priceDecimals', parseInt(e.target.value) || 2)} />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            <Save className="h-4 w-4 mr-1.5" />
            {isSaving ? 'Salvando...' : 'Salvar Política'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
