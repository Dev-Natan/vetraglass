import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateStock } from '@/hooks/useInvalidateStock';
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, ChevronDown, Info } from 'lucide-react';
import { FiscalFieldsCard, type FiscalFieldsData } from '@/components/produtos/FiscalFieldsCard';
import { createUuid } from '@/utils/createUuid';
import { useItemTypes } from '@/hooks/useItemTypes';
import { ImageUploadField } from '@/components/common/ImageUploadField';
import { useCompanyLinhas } from '@/hooks/useCompanyLinhas';
import { ItemPricingFields, defaultPricingData, type ItemPricingData } from './ItemPricingFields';

interface CreateCustomItemContentProps {
  onClose: () => void;
}

const UNITS = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kit', label: 'Kit' },
  { value: 'ml', label: 'Metro Linear (ml)' },
  { value: 'm²', label: 'Metro² (m²)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'l', label: 'Litro (l)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'pç', label: 'Peça (pç)' },
  { value: 'par', label: 'Par' },
  { value: 'jg', label: 'Jogo (jg)' },
];

export function CreateCustomItemContent({ onClose }: CreateCustomItemContentProps) {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const invalidateStock = useInvalidateStock();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [linha, setLinha] = useState('');
  const [unit, setUnit] = useState('un');
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tempItemId] = useState(createUuid);
  const [pricingData, setPricingData] = useState<ItemPricingData>(defaultPricingData);
  const [fiscalExpanded, setFiscalExpanded] = useState(false);
  const [fiscalData, setFiscalData] = useState<FiscalFieldsData>({
    ncm: '', cfop_venda: '', cfop_venda_interestadual: '', cest: '', origem: '', codigo_servico: '', aliquota_iss: '',
  });

  const { data: itemTypes } = useItemTypes();
  const { data: productLinhas } = useCompanyLinhas();

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);
    const selectedType = itemTypes?.find(t => t.slug === newCategory);
    if (selectedType?.unit_default) setUnit(selectedType.unit_default);
  };

  const costNum = parseFloat(cost) || 0;
  const salePriceNum = parseFloat(salePrice) || 0;

  const createItemMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      const quantityNum = parseFloat(quantity);
      const costValue = parseFloat(pricingData.costPerBar) || parseFloat(cost) || 0;
      const salePriceValue = parseFloat(pricingData.salePricePerBar) || parseFloat(salePrice) || 0;
      const minQty = parseFloat(minQuantity) || 0;

      if (!name.trim()) throw new Error('Nome do item é obrigatório');
      if (!category) throw new Error('Categoria é obrigatória');
      if (!linha) throw new Error('Linha é obrigatória');
      if (!quantityNum || quantityNum <= 0) throw new Error('Quantidade é obrigatória e deve ser maior que zero');

      const pNum = (v: string) => parseFloat(v) || null;

      const { data: companyItem, error: itemError } = await supabase
        .from('company_items')
        .insert({
          company_id: currentCompany.id, item_template_id: null, name: name.trim(),
          description: description.trim() || null, type: category, unit, linha,
          cost: costValue, sale_price: salePriceValue, image_url: imageUrl,
          is_custom: true, is_active: true,
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
          altura_mm: pNum(pricingData.alturaMm),
          largura_mm: pNum(pricingData.larguraMm),
          comprimento_linear_mm: pNum(pricingData.comprimentoLinearMm) ?? pNum(pricingData.barLengthMm),
          preco_unitario: pNum(pricingData.precoUnitario) ?? pNum(pricingData.costPerUnit),
          thickness_mm: pNum(pricingData.thicknessMm),
          glass_color: pricingData.color?.trim() || null,

          ncm: fiscalData.ncm || null, cfop_venda: fiscalData.cfop_venda || null,
          cfop_venda_interestadual: fiscalData.cfop_venda_interestadual || null,
          cest: fiscalData.cest || null, origem: fiscalData.origem || null,
          codigo_servico: fiscalData.codigo_servico || null,
          aliquota_iss: fiscalData.aliquota_iss ? parseFloat(fiscalData.aliquota_iss) : null,
        } as any)
        .select().single();
      if (itemError) throw new Error(`Erro ao criar item: ${itemError.message}`);

      const { error: stockError } = await supabase.from('company_stock').insert({
        company_id: currentCompany.id, item_template_id: null, company_item_id: companyItem.id,
        quantity: quantityNum, min_quantity: minQty, is_active: true,
        allow_fractional: unit === 'm' || unit === 'm²' || unit === 'kg' || unit === 'l' || category === 'profile',
      });
      if (stockError) throw new Error(`Erro ao criar estoque: ${stockError.message}`);

      await supabase.from('stock_movements').insert({
        company_id: currentCompany.id, company_item_id: companyItem.id, item_template_id: null,
        type: 'entrada', category: 'compra_fornecedor', quantity: quantityNum, unit_cost: costValue,
        valor_financeiro: quantityNum * costValue, description: `Compra inicial: ${name.trim()}`,
        reference_type: 'manual', created_by: user?.id,
      });

      return companyItem;
    },
    onSuccess: () => {
      toast({ title: 'Item criado com sucesso!', description: 'O item personalizado foi adicionado ao seu estoque.' });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      invalidateStock();
      queryClient.invalidateQueries({ queryKey: ['company-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['precificacao-products'] });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar item', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createItemMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            Itens personalizados são exclusivos da sua empresa e não aparecem no catálogo global.
          </AlertDescription>
        </Alert>

        <ImageUploadField
          label="Imagem do Item"
          imageUrl={imageUrl}
          onImageChange={setImageUrl}
          bucket="company-item-images"
          path={`${currentCompany?.id}/${tempItemId}`}
          size="md"
        />

        <div className="space-y-2">
          <Label htmlFor="custom-name">Nome do Item *</Label>
          <Input id="custom-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Parafuso Especial 5mm" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom-description">Descrição</Label>
          <Textarea id="custom-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição opcional do item..." rows={2} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{itemTypes?.map((type) => <SelectItem key={type.slug} value={type.slug}>{type.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Linha *</Label>
            <Select value={linha} onValueChange={setLinha}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{productLinhas?.map((l) => <SelectItem key={l.slug} value={l.name}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Unidade *</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-quantity">Quantidade Inicial *</Label>
            <Input id="custom-quantity" type="number" step="any" min="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" required />
          </div>
        </div>


        {/* Pricing Fields */}
        <ItemPricingFields data={pricingData} onChange={setPricingData} itemType={category} unit={unit} />

        <div className="space-y-2">
          <Label htmlFor="custom-minQuantity">Estoque Mínimo (opcional)</Label>
          <Input id="custom-minQuantity" type="number" step="any" min="0" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} placeholder="Alertar quando estoque baixo" />
        </div>

        <Collapsible open={fiscalExpanded} onOpenChange={setFiscalExpanded}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-2">
            <ChevronDown className={`h-4 w-4 transition-transform ${fiscalExpanded ? 'rotate-180' : ''}`} />
            Dados Fiscais (Opcional)
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <FiscalFieldsCard data={fiscalData} onChange={setFiscalData} itemType={category as 'profile' | 'glass' | 'accessory' | 'service' | undefined} />
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex justify-end gap-2 px-6 py-4 border-t bg-muted/30">
        <Button type="button" variant="outline" onClick={onClose} disabled={createItemMutation.isPending}>Cancelar</Button>
        <Button type="submit" disabled={createItemMutation.isPending} className="gap-2">
          {createItemMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Criando...</> : <><Sparkles className="h-4 w-4" />Criar e Registrar Compra</>}
        </Button>
      </div>
    </form>
  );
}
