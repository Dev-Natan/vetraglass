import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateStock } from '@/hooks/useInvalidateStock';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Package, Trash2, FileText, ChevronDown, ChevronUp, Tags, ShoppingCart } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageUploadField } from '@/components/common/ImageUploadField';
import { ItemPricingFields, defaultPricingData, type ItemPricingData } from './ItemPricingFields';
import { recalculatePricesForProductsWithItem } from '@/utils/productPriceUpdater';

interface TaxCategory {
  id: string;
  name: string;
  ncm_code: string | null;
  aliquota_ibs: number | null;
  aliquota_cbs: number | null;
  aliquota_is: number | null;
}

interface EditItemPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTemplateId: string | null;
  companyItemId?: string | null;
  itemName: string;
  itemImageUrl?: string | null;
  itemUnit?: string;
  stockId?: string;
  isCustomItem?: boolean;
}

export function EditItemPriceDialog({
  open,
  onOpenChange,
  itemTemplateId,
  companyItemId,
  itemName,
  itemImageUrl,
  itemUnit = 'un',
  stockId,
  isCustomItem = false,
}: EditItemPriceDialogProps) {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidateStock = useInvalidateStock();

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(itemImageUrl || null);

  const [quantity, setQuantity] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [allowFractional, setAllowFractional] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [pricingData, setPricingData] = useState<ItemPricingData>(defaultPricingData);
  const [fiscalOpen, setFiscalOpen] = useState(false);
  const [selectedTaxCategory, setSelectedTaxCategory] = useState<string>('');
  const [itemTypeLocal, setItemTypeLocal] = useState<string>('profile');
  const [linhaLocal, setLinhaLocal] = useState<string>('');
  
  // Fiscal fields state
  const [ncm, setNcm] = useState('');
  const [cest, setCest] = useState('');
  const [cfopVenda, setCfopVenda] = useState('');
  const [cfopVendaInterestadual, setCfopVendaInterestadual] = useState('');
  const [origem, setOrigem] = useState('');
  const [codigoServico, setCodigoServico] = useState('');
  const [aliquotaIss, setAliquotaIss] = useState('');
  const [aliquotaIbs, setAliquotaIbs] = useState('');
  const [aliquotaCbs, setAliquotaCbs] = useState('');
  const [aliquotaIs, setAliquotaIs] = useState('');

  // Canonical price lives on company_items; no legacy price-table read.
  const { data: existingPrice, isLoading: loadingPrice } = useQuery({
    queryKey: ['company-item-price', currentCompany?.id, itemTemplateId],
    queryFn: async () => {
      if (!currentCompany?.id || !itemTemplateId) return null;
      const { data, error } = await supabase
        .from('company_items')
        .select('id,cost,sale_price')
        .eq('company_id', currentCompany.id)
        .eq('item_template_id', itemTemplateId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id && !!itemTemplateId && open,
  });

  // Fetch existing stock
  const { data: existingStock, isLoading: loadingStock } = useQuery({
    queryKey: ['company-stock-item', currentCompany?.id, itemTemplateId, stockId],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      
      // Use stockId directly if available
      if (stockId) {
        const { data, error } = await supabase
          .from('company_stock')
          .select('*')
          .eq('id', stockId)
          .maybeSingle();
        if (!error && data) return data;
      }
      
      // Fallback by item_template_id
      if (itemTemplateId) {
        const { data, error } = await supabase
          .from('company_stock')
          .select('*')
          .eq('company_id', currentCompany.id)
          .eq('item_template_id', itemTemplateId)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      
      return null;
    },
    enabled: !!currentCompany?.id && (!!itemTemplateId || !!stockId) && open,
  });

  // Fetch company_item for pricing fields
  const { data: companyItem, isLoading: loadingCompanyItem } = useQuery({
    queryKey: ['company-item-details', currentCompany?.id, itemTemplateId, companyItemId],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      
      // Try by companyItemId first (works for custom items)
      if (companyItemId) {
        const { data, error } = await supabase
          .from('company_items')
          .select('*')
          .eq('id', companyItemId)
          .maybeSingle();
        if (!error && data) return data;
      }
      
      // Fallback: query by item_template_id
      if (itemTemplateId) {
        const { data, error } = await supabase
          .from('company_items')
          .select('*')
          .eq('company_id', currentCompany.id)
          .eq('item_template_id', itemTemplateId)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      
      return null;
    },
    enabled: !!currentCompany?.id && (!!itemTemplateId || !!companyItemId) && open,
  });

  // Fetch item template for fiscal fields
  const { data: itemTemplate, isLoading: loadingTemplate } = useQuery({
    queryKey: ['item-template-fiscal', itemTemplateId],
    queryFn: async () => {
      if (!itemTemplateId) return null;
      const { data, error } = await supabase
        .from('item_templates')
        .select('ncm, cest, cfop_venda, cfop_venda_interestadual, origem, codigo_servico, aliquota_iss, aliquota_ibs, aliquota_cbs, aliquota_is, bar_length_mm, weight_per_bar, weight_per_meter')
        .eq('id', itemTemplateId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!itemTemplateId && open,
  });

  // Fetch tax categories
  const { data: taxCategories } = useQuery({
    queryKey: ['tax-categories-all', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('tax_categories')
        .select('id, name, ncm_code, aliquota_ibs, aliquota_cbs, aliquota_is')
        .eq('company_id', currentCompany.id)
        .order('name');
      if (error) throw error;
      return data as TaxCategory[];
    },
    enabled: !!currentCompany?.id && open,
  });

  const handleTaxCategoryChange = (categoryId: string) => {
    setSelectedTaxCategory(categoryId);
    if (categoryId && taxCategories) {
      const category = taxCategories.find(c => c.id === categoryId);
      if (category) {
        if (category.ncm_code) setNcm(category.ncm_code);
        if (category.aliquota_ibs !== null) setAliquotaIbs(category.aliquota_ibs.toString());
        if (category.aliquota_cbs !== null) setAliquotaCbs(category.aliquota_cbs.toString());
        if (category.aliquota_is !== null) setAliquotaIs(category.aliquota_is.toString());
        setFiscalOpen(true);
        toast({ title: 'Categoria aplicada', description: `Dados fiscais de "${category.name}" foram preenchidos.` });
      }
    }
  };

  // Load pricing data from company_item - only when data has finished loading
  useEffect(() => {
    if (loadingCompanyItem || loadingPrice || loadingTemplate) return;
    
    if (companyItem) {
      // Use company_item data, but fallback to template for missing weight/length/prices
      const tpl = itemTemplate as any;
      const isProfile = companyItem.type === 'profile';
      const isGlass = companyItem.type === 'glass';
      const isUnit = !isProfile && !isGlass;

      setPricingData({
        barLengthMm: companyItem.bar_length_mm?.toString() ?? tpl?.bar_length_mm?.toString() ?? '',
        weightKg: companyItem.weight_kg?.toString() ?? tpl?.weight_per_bar?.toString() ?? '',
        weightPerMeter: companyItem.weight_per_meter?.toString() ?? tpl?.weight_per_meter?.toString() ?? '',
        costPerBar: '',
        costPerKg: companyItem.cost_per_kg?.toString() ?? '',
        costPerMeter: isProfile ? (companyItem.cost?.toString() ?? '') : '',
        salePricePerBar: '',
        salePricePerKg: companyItem.sale_price_per_kg?.toString() ?? '',
        salePricePerMeter: isProfile ? (companyItem.sale_price?.toString() ?? '') : '',
        saleMarginPercent: companyItem.markup_percent?.toString() ?? '',
        costPerUnit: isUnit ? (companyItem.cost?.toString() ?? '') : '',
        salePricePerUnit: isUnit ? (companyItem.sale_price?.toString() ?? '') : '',
        costPerSqm: isGlass ? (companyItem.cost?.toString() ?? '') : '',
        salePricePerSqm: isGlass ? (companyItem.sale_price?.toString() ?? '') : '',
        alturaMm: (companyItem as any).altura_mm?.toString() ?? '',
        larguraMm: (companyItem as any).largura_mm?.toString() ?? '',
        comprimentoLinearMm: (companyItem as any).comprimento_linear_mm?.toString() ?? companyItem.bar_length_mm?.toString() ?? '',
        precoUnitario: (companyItem as any).preco_unitario?.toString() ?? companyItem.cost?.toString() ?? '',
        thicknessMm: (companyItem as any).thickness_mm?.toString() ?? '',
        color: (companyItem as any).glass_color?.toString() ?? '',
      });

      setItemTypeLocal(companyItem.type || 'profile');
      setLinhaLocal(companyItem.linha || '');
    } else if (existingPrice) {
      setPricingData(prev => ({
        ...prev,
        costPerBar: existingPrice.cost?.toString() ?? '',
        salePricePerBar: existingPrice.sale_price?.toString() ?? '',
      }));
    } else if (itemTemplate) {
      // Fallback to template defaults if no company-specific data exists
      const tpl = itemTemplate as any;
      const isProfile = tpl.type === 'profile';
      const isGlass = tpl.type === 'glass';
      const isUnit = !isProfile && !isGlass;

      setPricingData(prev => ({
        ...prev,
        barLengthMm: tpl.bar_length_mm?.toString() ?? '',
        weightKg: tpl.weight_per_bar?.toString() ?? '',
        weightPerMeter: tpl.weight_per_meter?.toString() ?? '',
        costPerBar: isProfile ? (tpl.default_cost?.toString() ?? '') : '',
        salePricePerBar: isProfile ? (tpl.default_price?.toString() ?? '') : '',
        costPerUnit: isUnit ? (tpl.default_cost?.toString() ?? '') : '',
        salePricePerUnit: isUnit ? (tpl.default_price?.toString() ?? '') : '',
        costPerSqm: isGlass ? (tpl.default_cost?.toString() ?? '') : '',
        salePricePerSqm: isGlass ? (tpl.default_price?.toString() ?? '') : '',
      }));
    }
  }, [companyItem, existingPrice, loadingCompanyItem, loadingPrice, itemTemplate, loadingTemplate]);
  // Reset pricing data when dialog opens with a new item
  useEffect(() => {
    if (!open) {
      setPricingData(defaultPricingData);
    }
  }, [open]);

  useEffect(() => {
    if (existingStock) {
      setQuantity(existingStock.quantity?.toString() ?? '');
      setMinQuantity(existingStock.min_quantity?.toString() ?? '');
      setLocation(existingStock.location ?? '');
      setAllowFractional((existingStock as any).allow_fractional ?? false);
      setIsActive(existingStock.is_active !== false);
    } else {
      setQuantity('');
      setMinQuantity('');
      setLocation('');
      setAllowFractional(false);
      setIsActive(true);
    }
  }, [existingStock]);

  useEffect(() => {
    if (itemTemplate) {
      setNcm(itemTemplate.ncm ?? '');
      setCest(itemTemplate.cest ?? '');
      setCfopVenda(itemTemplate.cfop_venda ?? '');
      setCfopVendaInterestadual(itemTemplate.cfop_venda_interestadual ?? '');
      setOrigem(itemTemplate.origem ?? '');
      setCodigoServico(itemTemplate.codigo_servico ?? '');
      setAliquotaIss(itemTemplate.aliquota_iss?.toString() ?? '');
      setAliquotaIbs((itemTemplate as any).aliquota_ibs?.toString() ?? '');
      setAliquotaCbs((itemTemplate as any).aliquota_cbs?.toString() ?? '');
      setAliquotaIs((itemTemplate as any).aliquota_is?.toString() ?? '');
    } else {
      setNcm(''); setCest(''); setCfopVenda(''); setCfopVendaInterestadual('');
      setOrigem(''); setCodigoServico(''); setAliquotaIss('');
      setAliquotaIbs(''); setAliquotaCbs(''); setAliquotaIs('');
    }
    setSelectedTaxCategory('');
    setCurrentImageUrl(itemImageUrl || null);
  }, [itemTemplate, itemImageUrl]);

  const pNum = (v: string) => {
    const n = parseFloat(v);
    return isNaN(n) || n === 0 ? null : n;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Dados incompletos');
      if (!itemTemplateId && !companyItemId) throw new Error('Dados incompletos');

      const isProfile = itemTypeLocal.toLowerCase() === 'profile';
      const isGlass = itemTypeLocal.toLowerCase() === 'glass';
      const costNum = isProfile
        ? pNum(pricingData.costPerMeter) ?? pNum(pricingData.costPerBar)
        : isGlass
          ? pNum(pricingData.costPerSqm) ?? pNum(pricingData.costPerMeter) ?? pNum(pricingData.costPerUnit)
          : pNum(pricingData.costPerUnit);
      const salePriceNum = isProfile
        ? pNum(pricingData.salePricePerMeter) ?? pNum(pricingData.salePricePerBar)
        : isGlass
          ? pNum(pricingData.salePricePerSqm) ?? pNum(pricingData.salePricePerMeter) ?? pNum(pricingData.salePricePerUnit)
          : pNum(pricingData.salePricePerUnit);
      if (!costNum) throw new Error('MISSING_COST');
      if (!salePriceNum) throw new Error('MISSING_PRICE');

      const metadata = {
        linha: linhaLocal || null,
        image_url: currentImageUrl || null,
        bar_length_mm: pNum(pricingData.barLengthMm),
        weight_kg: pNum(pricingData.weightKg),
        weight_per_meter: pNum(pricingData.weightPerMeter),
        altura_mm: pNum(pricingData.alturaMm),
        largura_mm: pNum(pricingData.larguraMm),
        comprimento_linear_mm: pNum(pricingData.comprimentoLinearMm) ?? pNum(pricingData.barLengthMm),
        thickness_mm: pNum(pricingData.thicknessMm),
        glass_color: pricingData.color?.trim() || null,
        ncm: ncm || null,
        cest: cest || null,
        cfop_venda: cfopVenda || null,
        cfop_venda_interestadual: cfopVendaInterestadual || null,
        origem: origem || null,
        codigo_servico: codigoServico || null,
        aliquota_iss: pNum(aliquotaIss),
      };
      const resolvedCompanyItemId = companyItem?.id ?? companyItemId ?? null;
      const { error } = await supabase.rpc('save_company_item_configuration', {
        _company_id: currentCompany.id,
        _company_item_id: resolvedCompanyItemId as unknown as string,
        _item_template_id: itemTemplateId as unknown as string,
        _name: itemName,
        _item_type: itemTypeLocal,
        _stock_unit: itemUnit,
        _pricing_unit: isProfile ? 'm' : isGlass ? 'm²' : itemUnit,
        _cost: costNum,
        _basis: 'SALE_PRICE',
        _value: salePriceNum,
        _target_stock: parseFloat(quantity) || 0,
        _min_stock: parseFloat(minQuantity) || 0,
        _location: location || undefined,
        _allow_fractional: allowFractional,
        _is_active: isActive,
        _metadata: metadata,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // Recalcula preços de produtos que usam este item
      recalculatePricesForProductsWithItem(itemTemplateId, companyItemId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['company-products'] });
        queryClient.invalidateQueries({ queryKey: ['company-product'] });
      });

      toast({ title: 'Dados salvos', description: 'As informações foram atualizadas com sucesso.' });
      queryClient.invalidateQueries({ queryKey: ['company-item-prices'] });
      queryClient.invalidateQueries({ queryKey: ['company-item-price'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      invalidateStock();
      queryClient.invalidateQueries({ queryKey: ['company-stock-item'] });
      queryClient.invalidateQueries({ queryKey: ['item-template-fiscal'] });
      queryClient.invalidateQueries({ queryKey: ['company-items'] });
      queryClient.invalidateQueries({ queryKey: ['company-item-details'] });
      queryClient.invalidateQueries({ queryKey: ['precificacao-products'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existingStock?.id) throw new Error('Item não encontrado');
      const { error: stockError } = await supabase.from('company_stock').delete().eq('id', existingStock.id);
      if (stockError) throw stockError;
    },
    onSuccess: () => {
      toast({ title: 'Item removido', description: 'O item foi removido do estoque.' });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      invalidateStock();
      queryClient.invalidateQueries({ queryKey: ['company-stock-item-ids'] });
      queryClient.invalidateQueries({ queryKey: ['company-item-prices'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const isLoading = loadingPrice || loadingStock || loadingTemplate || loadingCompanyItem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Item</DialogTitle>
          <DialogDescription>
            Gerencie quantidade, localização e preços deste item.
          </DialogDescription>
        </DialogHeader>

        {/* Item Info */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
          <div className="flex flex-col items-center gap-2">
            {isCustomItem && companyItemId ? (
              <ImageUploadField
                imageUrl={currentImageUrl}
                onImageChange={setCurrentImageUrl}
                bucket="company-item-images"
                path={`${currentCompany?.id}/${companyItemId}`}
                size="sm"
              />
            ) : currentImageUrl ? (
              <div className="h-14 w-14 rounded-md border bg-white p-1 flex items-center justify-center shrink-0">
                <img src={currentImageUrl} alt={itemName} loading="lazy" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="h-14 w-14 rounded-md border bg-background flex items-center justify-center shrink-0">
                <Package className="h-7 w-7 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-lg">{itemName}</p>
            <p className="text-xs text-muted-foreground">Unidade: {itemUnit}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor="isActive" className="text-sm">{isActive ? 'Ativo' : 'Inativo'}</Label>
            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Stock Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Estoque</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="quantity" className="text-xs">Quantidade Atual</Label>
                  <Input id="quantity" type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="minQuantity" className="text-xs">Quantidade Mínima</Label>
                  <Input id="minQuantity" type="number" min="0" step="0.01" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} placeholder="0" className="h-9" />
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border h-9">
                <Label htmlFor="allowFractional" className="text-xs cursor-pointer">Venda Fracionada</Label>
                <Switch id="allowFractional" checked={allowFractional} onCheckedChange={setAllowFractional} className="scale-75" />
              </div>
            </div>

            {/* Separator */}
            <div className="border-t" />

            {/* Pricing Section - same as AddStockDialogContent */}
            {/* Classification Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Classificação</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo do Item</Label>
                  <Select value={itemTypeLocal} onValueChange={setItemTypeLocal}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="profile">🔩 Perfil</SelectItem>
                      <SelectItem value="glass">🪟 Vidro</SelectItem>
                      <SelectItem value="accessory">⚙️ Acessório</SelectItem>
                      <SelectItem value="component">🧩 Componente</SelectItem>
                      <SelectItem value="service">🔧 Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Linha</Label>
                  <Input value={linhaLocal} onChange={e => setLinhaLocal(e.target.value)} placeholder="Ex: Suprema, Gold..." className="h-9" />
                </div>
              </div>
            </div>

            <div className="border-t" />

            {/* Pricing Section */}
            <ItemPricingFields data={pricingData} onChange={setPricingData} itemType={itemTypeLocal} unit={itemUnit} />

            {/* Separator */}
            <div className="border-t" />

            {/* Fiscal Fields Section */}
            <Collapsible open={fiscalOpen} onOpenChange={setFiscalOpen}>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 border hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Dados Fiscais</span>
                  </div>
                  {fiscalOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                {taxCategories && taxCategories.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="taxCategory" className="text-xs flex items-center gap-1">
                      <Tags className="w-3 h-3" />
                      Categoria Fiscal (auto-preencher)
                    </Label>
                    <Select value={selectedTaxCategory} onValueChange={handleTaxCategoryChange}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione uma categoria..." /></SelectTrigger>
                      <SelectContent>
                        {taxCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name} {category.ncm_code && `(${category.ncm_code})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Ao selecionar, os campos NCM e alíquotas serão preenchidos automaticamente</p>
                  </div>
                )}

                <div className="border-t pt-3" />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ncm" className="text-xs">NCM</Label>
                    <Input id="ncm" value={ncm} onChange={(e) => setNcm(e.target.value)} placeholder="00000000" maxLength={8} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cest" className="text-xs">CEST</Label>
                    <Input id="cest" value={cest} onChange={(e) => setCest(e.target.value)} placeholder="0000000" maxLength={7} className="h-9" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cfopVenda" className="text-xs">CFOP Venda</Label>
                    <Input id="cfopVenda" value={cfopVenda} onChange={(e) => setCfopVenda(e.target.value)} placeholder="5102" maxLength={4} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cfopVendaInterestadual" className="text-xs">CFOP Interestadual</Label>
                    <Input id="cfopVendaInterestadual" value={cfopVendaInterestadual} onChange={(e) => setCfopVendaInterestadual(e.target.value)} placeholder="6102" maxLength={4} className="h-9" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="origem" className="text-xs">Origem</Label>
                    <Input id="origem" value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="0" maxLength={1} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="aliquotaIss" className="text-xs">Alíquota ISS (%)</Label>
                    <Input id="aliquotaIss" type="number" min="0" max="100" step="0.01" value={aliquotaIss} onChange={(e) => setAliquotaIss(e.target.value)} placeholder="0,00" className="h-9" />
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Reforma Tributária (IBS/CBS/IS)</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="aliquotaIbs" className="text-xs">Alíquota IBS (%)</Label>
                      <Input id="aliquotaIbs" type="number" min="0" max="100" step="0.01" value={aliquotaIbs} onChange={(e) => setAliquotaIbs(e.target.value)} placeholder="17,7" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="aliquotaCbs" className="text-xs">Alíquota CBS (%)</Label>
                      <Input id="aliquotaCbs" type="number" min="0" max="100" step="0.01" value={aliquotaCbs} onChange={(e) => setAliquotaCbs(e.target.value)} placeholder="8,8" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="aliquotaIs" className="text-xs">Alíquota IS (%)</Label>
                      <Input id="aliquotaIs" type="number" min="0" max="100" step="0.01" value={aliquotaIs} onChange={(e) => setAliquotaIs(e.target.value)} placeholder="0" className="h-9" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="codigoServico" className="text-xs">Código de Serviço</Label>
                  <Input id="codigoServico" value={codigoServico} onChange={(e) => setCodigoServico(e.target.value)} placeholder="Ex: 14.01" className="h-9" />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex justify-between gap-2 pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" size="sm" className="gap-1">
                    <Trash2 className="w-4 h-4" />
                    Remover
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover item do estoque?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá remover "{itemName}" do seu estoque. Os preços configurados também serão removidos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
