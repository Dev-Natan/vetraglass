import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Check, Search, X, ShoppingCart, ChevronDown, Receipt, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FiscalFieldsCard, type FiscalFieldsData } from '@/components/produtos/FiscalFieldsCard';
import { useItemTypeLabels } from '@/hooks/useItemTypes';
import { ItemPricingFields, defaultPricingData, type ItemPricingData } from './ItemPricingFields';

interface AddStockDialogContentProps {
  onClose: () => void;
}

export function AddStockDialogContent({ onClose }: AddStockDialogContentProps) {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedLinhaFilter, setSelectedLinhaFilter] = useState<string | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [pricingData, setPricingData] = useState<ItemPricingData>(defaultPricingData);
  const [linha, setLinha] = useState('');
  const [category, setCategory] = useState('');
  const [allowFractional, setAllowFractional] = useState(false);
  const [fiscalExpanded, setFiscalExpanded] = useState(false);
  const [fiscalData, setFiscalData] = useState<FiscalFieldsData>({
    ncm: '', cfop_venda: '', cfop_venda_interestadual: '', cest: '', origem: '', codigo_servico: '', aliquota_iss: '',
  });

  const { labels: itemTypeLabels } = useItemTypeLabels();

  const { data: companyData } = useQuery({
    queryKey: ['company-fiscal-mode', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data } = await supabase.from('companies').select('modo_fiscal_ativo').eq('id', currentCompany.id).single();
      return data;
    },
    enabled: !!currentCompany?.id,
  });
  const isFiscalModeActive = companyData?.modo_fiscal_ativo ?? false;

  const { data: itemTemplates, isLoading: loadingItems } = useQuery({
    queryKey: ['item-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('item_templates').select('*').eq('is_active', true).order('linha').order('type').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: existingStock } = useQuery({
    queryKey: ['company-stock-item-ids', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase.from('company_stock').select('item_template_id').eq('company_id', currentCompany.id);
      if (error) throw error;
      return data.map(s => s.item_template_id);
    },
    enabled: !!currentCompany?.id,
  });

  const selectedItem = itemTemplates?.find((item) => item.id === selectedItemId);

  useEffect(() => {
    if (selectedItem) {
      setLinha(selectedItem.linha || '');
      setCategory(selectedItem.type || '');
      setAllowFractional(selectedItem.type === 'profile');
      const templateSpecs = selectedItem.specifications as Record<string, unknown> | null;
      if (templateSpecs) {
        setFiscalData(prev => ({
          ...prev,
          ncm: (templateSpecs.ncm as string) || prev.ncm,
          cfop_venda: (templateSpecs.cfop_venda as string) || prev.cfop_venda,
          cfop_venda_interestadual: (templateSpecs.cfop_venda_interestadual as string) || prev.cfop_venda_interestadual,
          cest: (templateSpecs.cest as string) || prev.cest,
          origem: (templateSpecs.origem as string) || prev.origem,
        }));
      }
    }
  }, [selectedItem]);

  const registerPurchaseMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !selectedItem) throw new Error('Dados incompletos');
      const quantityNum = parseFloat(quantity);
      const costNum = parseFloat(cost);
      const salePriceNum = parseFloat(salePrice);
      if (!quantityNum || quantityNum <= 0) throw new Error('Quantidade é obrigatória e deve ser maior que zero');
      if (costNum < 0) throw new Error('Preço de custo não pode ser negativo');
      if (salePriceNum < 0) throw new Error('Preço de venda não pode ser negativo');
      if (!linha) throw new Error('Linha é obrigatória');
      if (!category) throw new Error('Categoria é obrigatória');

      const pNum = (v: string) => parseFloat(v) || null;

      const { data: companyItem, error: itemError } = await supabase
        .from('company_items')
        .upsert({
          company_id: currentCompany.id, item_template_id: selectedItemId, name: selectedItem.name,
          description: selectedItem.description, type: category, unit: selectedItem.unit || 'un', linha,
          cost: costNum, sale_price: salePriceNum, image_url: selectedItem.image_url,
          is_custom: false, is_active: true,
          bar_length_mm: pNum(pricingData.barLengthMm),
          weight_kg: pNum(pricingData.weightKg),
          weight_per_meter: pNum(pricingData.weightPerMeter),
          cost_per_bar: pNum(pricingData.costPerBar),
          cost_per_kg: pNum(pricingData.costPerKg),
          cost_per_meter: pNum(pricingData.costPerMeter),
          sale_price_per_bar: pNum(pricingData.salePricePerBar),
          sale_price_per_kg: pNum(pricingData.salePricePerKg),
          sale_price_per_meter: pNum(pricingData.salePricePerMeter),
          sale_margin_percent: pNum(pricingData.saleMarginPercent) ?? 0,
          ncm: fiscalData.ncm || null, cfop_venda: fiscalData.cfop_venda || null,
          cfop_venda_interestadual: fiscalData.cfop_venda_interestadual || null,
          cest: fiscalData.cest || null, origem: fiscalData.origem || null,
          codigo_servico: fiscalData.codigo_servico || null,
          aliquota_iss: fiscalData.aliquota_iss ? parseFloat(fiscalData.aliquota_iss) : null,
        }, { onConflict: 'company_id,item_template_id' })
        .select().single();
      if (itemError) throw new Error(`Erro ao salvar item: ${itemError.message}`);

      const { data: existingStockRecord } = await supabase.from('company_stock').select('id, quantity')
        .eq('company_id', currentCompany.id).eq('item_template_id', selectedItemId).maybeSingle();

      if (existingStockRecord) {
        const { error: updateError } = await supabase.from('company_stock').update({
          quantity: existingStockRecord.quantity + quantityNum, company_item_id: companyItem.id,
          min_quantity: parseFloat(minQuantity) || 0, allow_fractional: allowFractional,
          updated_at: new Date().toISOString()
        }).eq('id', existingStockRecord.id);
        if (updateError) throw new Error(`Erro ao atualizar estoque: ${updateError.message}`);
      } else {
        const { error: insertError } = await supabase.from('company_stock').insert({
          company_id: currentCompany.id, item_template_id: selectedItemId, company_item_id: companyItem.id,
          quantity: quantityNum, min_quantity: parseFloat(minQuantity) || 0,
          allow_fractional: allowFractional, is_active: true,
        });
        if (insertError) throw new Error(`Erro ao criar estoque: ${insertError.message}`);
      }

      await supabase.from('stock_movements').insert({
        company_id: currentCompany.id, company_item_id: companyItem.id, item_template_id: selectedItemId,
        type: 'entrada', category: 'compra_fornecedor', quantity: quantityNum, unit_cost: costNum,
        valor_financeiro: quantityNum * costNum, description: `Compra: ${selectedItem.name}`,
        reference_type: 'manual', created_by: user?.id,
      });

      await supabase.from('company_item_prices').upsert({
        company_id: currentCompany.id, item_template_id: selectedItemId, cost: costNum, price: salePriceNum,
      }, { onConflict: 'company_id,item_template_id' });
    },
    onSuccess: () => {
      toast({ title: 'Compra registrada', description: 'O item foi adicionado ao estoque com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock-item-ids'] });
      queryClient.invalidateQueries({ queryKey: ['company-item-prices'] });
      queryClient.invalidateQueries({ queryKey: ['company-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao registrar compra', description: error.message, variant: 'destructive' });
    },
  });

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(selectedItemId === itemId ? '' : itemId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      toast({ title: 'Selecione um item', description: 'Você precisa selecionar um item para registrar a compra.', variant: 'destructive' });
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      toast({ title: 'Quantidade obrigatória', description: 'Informe a quantidade comprada.', variant: 'destructive' });
      return;
    }
    if (!cost) { toast({ title: 'Custo obrigatório', description: 'Informe o preço de custo do item.', variant: 'destructive' }); return; }
    if (!salePrice) { toast({ title: 'Preço de venda obrigatório', description: 'Informe o preço de venda do item.', variant: 'destructive' }); return; }
    registerPurchaseMutation.mutate();
  };

  const availableItems = useMemo(() => itemTemplates || [], [itemTemplates]);

  const uniqueLinhas = useMemo(() => {
    const s = new Set<string>();
    availableItems.forEach(item => s.add(item.linha || 'Sem Linha'));
    return Array.from(s).sort((a, b) => { if (a === 'Sem Linha') return -1; if (b === 'Sem Linha') return 1; return a.localeCompare(b); });
  }, [availableItems]);

  const uniqueTypes = useMemo(() => {
    const s = new Set<string>();
    availableItems.forEach(item => s.add(item.type));
    return Array.from(s).sort();
  }, [availableItems]);

  const filteredItems = useMemo(() => {
    return availableItems.filter(item => {
      const itemLinha = item.linha || 'Sem Linha';
      return (!selectedLinhaFilter || itemLinha === selectedLinhaFilter) &&
        (!selectedTypeFilter || item.type === selectedTypeFilter) &&
        (!nameFilter || item.name.toLowerCase().includes(nameFilter.toLowerCase()));
    });
  }, [availableItems, selectedLinhaFilter, selectedTypeFilter, nameFilter]);

  const itemsByLinhaAndType = useMemo(() => {
    const grouped: Record<string, Record<string, typeof filteredItems>> = {};
    filteredItems.forEach(item => {
      const lk = item.linha || 'Sem Linha';
      const tk = item.type;
      if (!grouped[lk]) grouped[lk] = {};
      if (!grouped[lk][tk]) grouped[lk][tk] = [];
      grouped[lk][tk].push(item);
    });
    const sortedLinhaKeys = Object.keys(grouped).sort((a, b) => { if (a === 'Sem Linha') return -1; if (b === 'Sem Linha') return 1; return a.localeCompare(b); });
    return { grouped, sortedLinhaKeys };
  }, [filteredItems]);

  const getItemWeight = (item: typeof selectedItem) => {
    if (!item?.specifications) return null;
    const specs = item.specifications as Record<string, unknown>;
    return specs.peso_kg_ml || specs.weight_kg_ml || specs.peso;
  };

  const isFiscalReady = fiscalData.ncm && fiscalData.cfop_venda && fiscalData.origem;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Filters */}
      <div className="px-6 py-4 border-b bg-muted/30 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Buscar por Nome</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} placeholder="Digite para buscar..." className="pl-9 pr-8 h-9" />
              {nameFilter && (
                <button type="button" onClick={() => setNameFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Linha</Label>
            <Select value={selectedLinhaFilter || 'all'} onValueChange={(v) => setSelectedLinhaFilter(v === 'all' ? null : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todas as linhas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as linhas</SelectItem>
                {uniqueLinhas.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Select value={selectedTypeFilter || 'all'} onValueChange={(v) => setSelectedTypeFilter(v === 'all' ? null : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {uniqueTypes.map((t) => <SelectItem key={t} value={t}>{itemTypeLabels[t] || t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Items Grid - limited height with scroll */}
      <div className="max-h-[35vh] overflow-y-auto border-b">
        <div className="px-6 py-4 space-y-4">
          {loadingItems ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum item encontrado com os filtros aplicados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {filteredItems.map((item) => {
                const isSelected = selectedItemId === item.id;
                const isInStock = existingStock?.includes(item.id);
                const weight = getItemWeight(item);
                return (
                  <button key={item.id} type="button" onClick={() => handleItemSelect(item.id)}
                    className={cn(
                      "relative flex flex-col items-center p-2.5 rounded-lg border-2 transition-all duration-200",
                      "hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                      isSelected ? "border-primary bg-primary/5 shadow-md" : isInStock ? "border-accent bg-accent/30" : "border-border bg-card"
                    )}>
                    {isSelected && (
                      <div className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                    {isInStock && !isSelected && <Badge variant="secondary" className="absolute top-1.5 left-1.5 text-[9px] px-1 py-0">Em estoque</Badge>}
                    <div className="w-full aspect-square max-w-[80px] rounded-md border bg-background flex items-center justify-center mb-2 overflow-hidden">
                      {item.image_url ? <img src={item.image_url} alt={item.name} loading="lazy" className="max-h-full max-w-full object-contain" /> : <Package className="h-8 w-8 text-muted-foreground/50" />}
                    </div>
                    <p className="text-xs font-medium text-center line-clamp-1 leading-tight mb-0.5 w-full">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground text-center line-clamp-1 w-full">
                      {itemTypeLabels[item.type] || item.type}
                      {item.linha && ` • ${item.linha}`}
                    </p>
                    {weight && <p className="text-[10px] text-muted-foreground">{String(weight)} Kg/ML</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Selected Item Preview */}
      {selectedItem && (
        <div className="px-6 py-2 border-t bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded border bg-background flex items-center justify-center overflow-hidden shrink-0">
              {selectedItem.image_url ? <img src={selectedItem.image_url} alt={selectedItem.name} className="max-h-full max-w-full object-contain" /> : <Package className="h-4 w-4 text-muted-foreground/50" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{selectedItem.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {itemTypeLabels[selectedItem.type] || selectedItem.type}
                {selectedItem.linha && ` • ${selectedItem.linha}`}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedItemId('')} className="h-8 w-8 p-0 shrink-0 hover:bg-destructive/10 hover:text-destructive">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Purchase Data */}
      <div className="px-6 py-4 border-t space-y-4 bg-muted/20">
        <div className="flex items-center gap-2 mb-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Dados da Compra</span>
          <span className="text-xs text-muted-foreground">(Campos obrigatórios *)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sys-quantity" className="text-xs">Quantidade <span className="text-destructive">*</span></Label>
            <Input id="sys-quantity" type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" className="h-9" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sys-cost" className="text-xs">Custo (R$) <span className="text-destructive">*</span></Label>
            <Input id="sys-cost" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0,00" className="h-9" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sys-salePrice" className="text-xs">Venda (R$) <span className="text-destructive">*</span></Label>
            <Input id="sys-salePrice" type="number" min="0" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="0,00" className="h-9" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Qtd. Mínima</Label>
            <Input type="number" min="0" step="0.01" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} placeholder="0" className="h-9" />
          </div>
        </div>

        {/* Pricing Fields */}
        <ItemPricingFields data={pricingData} onChange={setPricingData} itemType={category} />

        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border h-9">
          <Label htmlFor="allowFractionalSys" className="text-xs cursor-pointer">Venda Fracionada</Label>
          <Switch id="allowFractionalSys" checked={allowFractional} onCheckedChange={setAllowFractional} className="scale-75" />
        </div>
      </div>

      {/* Fiscal */}
      <div className="px-6 py-3 border-t bg-background">
        <Collapsible open={fiscalExpanded || isFiscalModeActive} onOpenChange={setFiscalExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" type="button" className="w-full justify-between p-2 h-auto">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Dados Fiscais</span>
                {isFiscalModeActive && <Badge variant="outline" className="text-xs">Modo Fiscal</Badge>}
              </div>
              <div className="flex items-center gap-2">
                {isFiscalReady ? (
                  <Badge variant="outline" className="text-xs gap-1 bg-accent/50 text-accent-foreground border-accent"><CheckCircle2 className="h-3 w-3" />Pronto para NFe</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Opcional</Badge>
                )}
                <ChevronDown className={cn("h-4 w-4 transition-transform", (fiscalExpanded || isFiscalModeActive) && "rotate-180")} />
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <FiscalFieldsCard data={fiscalData} onChange={setFiscalData} type="item" itemType={category as 'glass' | 'profile' | 'accessory' | 'service'} />
          </CollapsibleContent>
        </Collapsible>
      </div>

      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t flex justify-end gap-2 bg-background">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={registerPurchaseMutation.isPending || !selectedItemId} className="gap-2">
          {registerPurchaseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <ShoppingCart className="w-4 h-4" />
          Registrar Compra
        </Button>
      </div>
    </form>
  );
}
