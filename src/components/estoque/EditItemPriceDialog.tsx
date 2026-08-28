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
import { Loader2, Package, Trash2, FileText, ChevronDown, ChevronUp, Tags, ShoppingCart, Palette } from 'lucide-react';
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
import { estoqueService } from '@/services/estoqueService';

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
  initialProfile?: {
    type?: string | null;
    line?: string | null;
    cost?: number | null;
    salePrice?: number | null;
    barLengthMm?: number | null;
    weightPerMeter?: number | null;
    weightKg?: number | null;
  };
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
  initialProfile,
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
  const [selectedColorToActivate, setSelectedColorToActivate] = useState('');
  
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
        .limit(1)
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
  const lookupCompanyItemId = companyItemId ?? existingStock?.company_item_id ?? null;
  const { data: companyItem, isLoading: loadingCompanyItem } = useQuery({
    queryKey: ['company-item-details', currentCompany?.id, itemTemplateId, lookupCompanyItemId],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      
      // Prefer the exact company item and always keep the tenant predicate.
      if (lookupCompanyItemId) {
        const { data, error } = await supabase
          .from('company_items')
          .select('*')
          .eq('company_id', currentCompany.id)
          .eq('id', lookupCompanyItemId)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      
      // Fallback: query by item_template_id
      if (itemTemplateId) {
        const { data, error } = await supabase
          .from('company_items')
          .select('*')
          .eq('company_id', currentCompany.id)
          .eq('item_template_id', itemTemplateId)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      
      return null;
    },
    enabled: !!currentCompany?.id && (!!itemTemplateId || !!lookupCompanyItemId) && open,
  });

  const resolvedCompanyItemId = companyItem?.id ?? lookupCompanyItemId ?? existingPrice?.id ?? null;
  const normalizedItemType = itemTypeLocal.toLowerCase();
  const isProfileItem = normalizedItemType === 'profile' || normalizedItemType === 'perfil';

  const { data: profileUnits } = useQuery({
    queryKey: ['profile-inventory-units', currentCompany?.id, resolvedCompanyItemId],
    queryFn: async () => {
      if (!currentCompany?.id || !resolvedCompanyItemId) return null;
      const { data, error } = await supabase
        .from('inventory_item_units')
        .select('cost_unit,sale_unit')
        .eq('company_id', currentCompany.id)
        .eq('company_item_id', resolvedCompanyItemId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && isProfileItem && !!currentCompany?.id && !!resolvedCompanyItemId,
  });

  const { data: aluminumColors = [] } = useQuery({
    queryKey: ['inventory-aluminum-colors'],
    queryFn: () => estoqueService.fetchAluminumColors(),
    enabled: open && isProfileItem,
  });

  const { data: profileVariants = [] } = useQuery({
    queryKey: ['company-profile-variants', currentCompany?.id, resolvedCompanyItemId],
    queryFn: async () => {
      if (!currentCompany?.id || !resolvedCompanyItemId) return [];
      const { data, error } = await supabase
        .from('company_item_variants')
        .select('id,aluminum_color_id,is_active')
        .eq('company_id', currentCompany.id)
        .eq('company_item_id', resolvedCompanyItemId)
        .not('aluminum_color_id', 'is', null);
      if (error) throw error;
      return data || [];
    },
    enabled: open && isProfileItem && !!currentCompany?.id && !!resolvedCompanyItemId,
  });

  const { data: variantBalances = [] } = useQuery({
    queryKey: ['company-profile-variant-balances', currentCompany?.id, resolvedCompanyItemId],
    queryFn: async () => {
      if (!currentCompany?.id || !resolvedCompanyItemId) return [];
      const { data, error } = await supabase
        .from('inventory_variant_summary')
        .select('variant_id,on_hand_meters,on_hand_bars,on_hand_kg')
        .eq('company_id', currentCompany.id)
        .eq('company_item_id', resolvedCompanyItemId);
      if (error) throw error;
      return data || [];
    },
    enabled: open && isProfileItem && !!currentCompany?.id && !!resolvedCompanyItemId,
  });

  // Fetch item template for fiscal fields
  const { data: itemTemplate, isLoading: loadingTemplate } = useQuery({
    queryKey: ['item-template-fiscal', itemTemplateId],
    queryFn: async () => {
      if (!itemTemplateId) return null;
      const { data, error } = await supabase
        .from('item_templates')
        .select('type,ncm,cest,cfop_venda,cfop_venda_interestadual,origem,codigo_servico,aliquota_iss,aliquota_ibs,aliquota_cbs,aliquota_is,bar_length_mm,weight_per_bar,weight_per_meter,default_cost,default_price,default_sale_price')
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
      const tpl = itemTemplate;
      const normalizedType = String(companyItem.type || initialProfile?.type || '').toLowerCase();
      const isProfile = normalizedType === 'profile' || normalizedType === 'perfil';
      const isGlass = companyItem.type === 'glass';
      const isUnit = !isProfile && !isGlass;
      const barLengthMm = companyItem.bar_length_mm ?? initialProfile?.barLengthMm ?? tpl?.bar_length_mm;
      const weightPerMeterValue = companyItem.weight_per_meter ?? initialProfile?.weightPerMeter ?? tpl?.weight_per_meter;
      const weightPerBar = companyItem.weight_kg ?? initialProfile?.weightKg ?? tpl?.weight_per_bar;
      const barLengthM = Number(barLengthMm ?? 0) / 1000;
      const weightPerMeter = Number(weightPerMeterValue ?? 0);
      const costUnit = (profileUnits?.cost_unit || 'M') as 'M' | 'BAR' | 'KG';
      const saleUnit = (profileUnits?.sale_unit || 'M') as 'M' | 'BAR' | 'KG';
      const fromPerMeter = (value: number, basis: 'M' | 'BAR' | 'KG') => {
        if (basis === 'BAR') return barLengthM > 0 ? value * barLengthM : 0;
        if (basis === 'KG') return weightPerMeter > 0 ? value / weightPerMeter : 0;
        return value;
      };
      const canonicalCost = Number(companyItem.cost ?? initialProfile?.cost ?? 0);
      const canonicalSale = Number(companyItem.sale_price ?? initialProfile?.salePrice ?? 0);

      setPricingData({
        barLengthMm: barLengthMm?.toString() ?? '',
        weightKg: weightPerBar?.toString() ?? '',
        weightPerMeter: weightPerMeterValue?.toString() ?? '',
        costPerBar: '',
        costPerKg: companyItem.cost_per_kg?.toString() ?? '',
        costPerMeter: isProfile && canonicalCost > 0 ? canonicalCost.toString() : '',
        salePricePerBar: '',
        salePricePerKg: companyItem.sale_price_per_kg?.toString() ?? '',
        salePricePerMeter: isProfile && canonicalSale > 0 ? canonicalSale.toString() : '',
        saleMarginPercent: companyItem.markup_percent?.toString() ?? '',
        costUnit,
        saleUnit,
        costValue: isProfile && canonicalCost > 0 ? fromPerMeter(canonicalCost, costUnit).toFixed(2) : '',
        saleValue: isProfile && canonicalSale > 0 ? fromPerMeter(canonicalSale, saleUnit).toFixed(2) : '',
        costPerUnit: isUnit ? (companyItem.cost?.toString() ?? '') : '',
        salePricePerUnit: isUnit ? (companyItem.sale_price?.toString() ?? '') : '',
        costPerSqm: isGlass ? (companyItem.cost?.toString() ?? '') : '',
        salePricePerSqm: isGlass ? (companyItem.sale_price?.toString() ?? '') : '',
        alturaMm: companyItem.altura_mm?.toString() ?? '',
        larguraMm: companyItem.largura_mm?.toString() ?? '',
        comprimentoLinearMm: companyItem.comprimento_linear_mm?.toString() ?? companyItem.bar_length_mm?.toString() ?? '',
        precoUnitario: companyItem.preco_unitario?.toString() ?? companyItem.cost?.toString() ?? '',
        thicknessMm: companyItem.thickness_mm?.toString() ?? '',
        color: companyItem.glass_color?.toString() ?? '',
      });

      setItemTypeLocal(companyItem.type || 'profile');
      setLinhaLocal(companyItem.linha || '');
    } else if (existingPrice) {
      const fallbackCost = Number(existingPrice.cost || 0);
      const fallbackSale = Number(existingPrice.sale_price || 0);
      const costUnit = (profileUnits?.cost_unit || 'M') as 'M' | 'BAR' | 'KG';
      const saleUnit = (profileUnits?.sale_unit || 'M') as 'M' | 'BAR' | 'KG';
      const fallbackBarLengthM = Number(itemTemplate?.bar_length_mm || 0) / 1000;
      const fallbackWeightPerMeter = Number(itemTemplate?.weight_per_meter || 0);
      const fromCanonicalMeter = (value: number, basis: 'M' | 'BAR' | 'KG') => {
        if (basis === 'BAR') return fallbackBarLengthM > 0 ? value * fallbackBarLengthM : 0;
        if (basis === 'KG') return fallbackWeightPerMeter > 0 ? value / fallbackWeightPerMeter : 0;
        return value;
      };
      setPricingData(prev => ({
        ...prev,
        costUnit,
        saleUnit,
        costValue: fallbackCost > 0 ? fromCanonicalMeter(fallbackCost, costUnit).toFixed(2) : '',
        saleValue: fallbackSale > 0 ? fromCanonicalMeter(fallbackSale, saleUnit).toFixed(2) : '',
        costPerMeter: fallbackCost > 0 ? fallbackCost.toString() : '',
        salePricePerMeter: fallbackSale > 0 ? fallbackSale.toString() : '',
        saleMarginPercent: fallbackCost > 0 && fallbackSale > 0
          ? (((fallbackSale / fallbackCost) - 1) * 100).toFixed(2)
          : '',
      }));
    } else if (itemTemplate) {
      // Fallback to template defaults if no company-specific data exists
      const tpl = itemTemplate;
      const normalizedType = String(tpl.type || '').toLowerCase();
      const isProfile = normalizedType === 'profile' || normalizedType === 'perfil';
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
  }, [companyItem, existingPrice, loadingCompanyItem, loadingPrice, itemTemplate, loadingTemplate, profileUnits]);
  // Reset pricing data when dialog opens with a new item
  useEffect(() => {
    if (!open) {
      setPricingData(defaultPricingData);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !initialProfile) return;
    const cost = Number(initialProfile.cost || 0);
    const sale = Number(initialProfile.salePrice || 0);
    const barLengthM = Number(initialProfile.barLengthMm || 0) / 1000;
    const weightPerMeter = Number(initialProfile.weightPerMeter || 0);
    const costUnit = (profileUnits?.cost_unit || 'M') as 'M' | 'BAR' | 'KG';
    const saleUnit = (profileUnits?.sale_unit || 'M') as 'M' | 'BAR' | 'KG';
    const fromCanonicalMeter = (value: number, basis: 'M' | 'BAR' | 'KG') => {
      if (basis === 'BAR') return barLengthM > 0 ? value * barLengthM : 0;
      if (basis === 'KG') return weightPerMeter > 0 ? value / weightPerMeter : 0;
      return value;
    };
    const displayedCost = fromCanonicalMeter(cost, costUnit);
    const displayedSale = fromCanonicalMeter(sale, saleUnit);
    setItemTypeLocal(initialProfile.type || 'profile');
    setLinhaLocal(initialProfile.line || '');
    setPricingData(prev => ({
      ...prev,
      barLengthMm: initialProfile.barLengthMm?.toString() || '',
      comprimentoLinearMm: initialProfile.barLengthMm?.toString() || '',
      weightPerMeter: initialProfile.weightPerMeter?.toString() || '',
      weightKg: initialProfile.weightKg?.toString() || '',
      costUnit,
      saleUnit,
      costValue: displayedCost > 0 ? displayedCost.toString() : '',
      saleValue: displayedSale > 0 ? displayedSale.toString() : '',
      costPerMeter: cost > 0 ? cost.toString() : '',
      salePricePerMeter: sale > 0 ? sale.toString() : '',
      saleMarginPercent: cost > 0 && sale > 0 ? (((sale / cost) - 1) * 100).toFixed(2) : '',
    }));
  }, [open, initialProfile, profileUnits]);

  useEffect(() => {
    if (existingStock) {
      setQuantity(existingStock.quantity?.toString() ?? '');
      setMinQuantity(existingStock.min_quantity?.toString() ?? '');
      setLocation(existingStock.location ?? '');
      setAllowFractional(existingStock.allow_fractional ?? false);
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
      setAliquotaIbs(itemTemplate.aliquota_ibs?.toString() ?? '');
      setAliquotaCbs(itemTemplate.aliquota_cbs?.toString() ?? '');
      setAliquotaIs(itemTemplate.aliquota_is?.toString() ?? '');
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

  const variantMutation = useMutation({
    mutationFn: async ({ colorId, active }: { colorId: string; active: boolean }) => {
      if (!currentCompany?.id || !resolvedCompanyItemId) throw new Error('MISSING_COMPANY_ITEM');
      return estoqueService.setProfileVariantActive({
        companyId: currentCompany.id,
        companyItemId: resolvedCompanyItemId,
        colorId,
        active,
      });
    },
    onSuccess: () => {
      setSelectedColorToActivate('');
      queryClient.invalidateQueries({ queryKey: ['company-profile-variants'] });
      queryClient.invalidateQueries({ queryKey: ['company-profile-variant-balances'] });
      invalidateStock();
      toast({ title: 'Variante atualizada', description: 'A disponibilidade comercial da cor foi salva.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar variante', description: error.message, variant: 'destructive' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Dados incompletos');
      if (!itemTemplateId && !companyItemId) throw new Error('Dados incompletos');

      const normalizedType = itemTypeLocal.toLowerCase();
      const isProfile = normalizedType === 'profile' || normalizedType === 'perfil';
      const isGlass = itemTypeLocal.toLowerCase() === 'glass';
      const barLengthM = Number(pricingData.barLengthMm || 0) / 1000;
      const weightPerMeter = Number(pricingData.weightPerMeter || 0);
      const toPerMeter = (value: number, basis: 'M' | 'BAR' | 'KG') => {
        if (basis === 'BAR') return barLengthM > 0 ? value / barLengthM : 0;
        if (basis === 'KG') return weightPerMeter > 0 ? value * weightPerMeter : 0;
        return value;
      };
      const costNum = isProfile
        ? toPerMeter(Number(pricingData.costValue || 0), pricingData.costUnit)
        : isGlass
          ? pNum(pricingData.costPerSqm) ?? pNum(pricingData.costPerMeter) ?? pNum(pricingData.costPerUnit)
          : pNum(pricingData.costPerUnit);
      const salePriceNum = isProfile
        ? toPerMeter(Number(pricingData.saleValue || 0), pricingData.saleUnit)
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
      if (isProfile) {
        if (!resolvedCompanyItemId) throw new Error('MISSING_COMPANY_ITEM');
        const { error } = await supabase.rpc('save_company_profile_configuration', {
          _company_id: currentCompany.id,
          _company_item_id: resolvedCompanyItemId,
          _canonical_cost_per_meter: costNum,
          _canonical_sale_per_meter: salePriceNum,
          _cost_unit: pricingData.costUnit,
          _sale_unit: pricingData.saleUnit,
          _min_stock: parseFloat(minQuantity) || 0,
          _allow_fractional: allowFractional,
          _is_active: isActive,
          _metadata: metadata,
        });
        if (error) throw error;
        return;
      }
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
  const configuredColorIds = new Set(profileVariants.map((variant) => variant.aluminum_color_id).filter(Boolean));
  const availableColors = aluminumColors.filter((color) => !configuredColorIds.has(color.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Item</DialogTitle>
          <DialogDescription>
            Configure classificação, variantes e preços. O saldo físico é alterado somente por movimentos de estoque.
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
                  <Input id="quantity" type="number" readOnly value={quantity} placeholder="0" className="h-9 bg-muted/50" />
                  <p className="text-[11px] text-muted-foreground">Use Registrar Entrada, Saída ou Ajuste para alterar o saldo.</p>
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

              {isProfileItem && resolvedCompanyItemId && (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Cores / variantes do perfil</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ativar uma cor cria a identidade operacional. O saldo começa em zero e só muda por movimentação física.
                  </p>
                  {profileVariants.length > 0 && (
                    <div className="space-y-2">
                      {profileVariants.map((variant) => {
                        const color = aluminumColors.find((entry) => entry.id === variant.aluminum_color_id);
                        const balance = variantBalances.find((entry) => entry.variant_id === variant.id);
                        return (
                          <div key={variant.id} className="flex flex-col gap-2 rounded-md bg-muted/40 p-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                              <span className="h-4 w-4 rounded-full border" style={{ backgroundColor: color?.hex_color || '#d1d5db' }} />
                              <span className="text-sm">{color?.name || 'Cor cadastrada'}</span>
                              <span className="text-xs text-muted-foreground">
                                {Number(balance?.on_hand_meters || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m
                                {' · ≈ '}{Number(balance?.on_hand_bars || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} barras
                                {' · '}{Number(balance?.on_hand_kg || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`variant-${variant.id}`} className="text-xs">
                                {variant.is_active ? 'Ativa' : 'Inativa'}
                              </Label>
                              <Switch
                                id={`variant-${variant.id}`}
                                checked={variant.is_active}
                                disabled={variantMutation.isPending}
                                onCheckedChange={(active) => variantMutation.mutate({ colorId: variant.aluminum_color_id!, active })}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {availableColors.length > 0 && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select value={selectedColorToActivate} onValueChange={setSelectedColorToActivate}>
                        <SelectTrigger aria-label="Adicionar cor ao perfil"><SelectValue placeholder="Selecione uma cor" /></SelectTrigger>
                        <SelectContent>
                          {availableColors.map((color) => <SelectItem key={color.id} value={color.id}>{color.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!selectedColorToActivate || variantMutation.isPending}
                        onClick={() => variantMutation.mutate({ colorId: selectedColorToActivate, active: true })}
                      >
                        Ativar cor
                      </Button>
                    </div>
                  )}
                </div>
              )}
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
              {!isProfileItem && <AlertDialog>
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
              </AlertDialog>}

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
