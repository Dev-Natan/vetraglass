import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyLinhas } from '@/hooks/useCompanyLinhas';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUploadField } from '@/components/common/ImageUploadField';
import { Loader2, DollarSign, Calculator, Settings2, FileCode2, ExternalLink, Lock, Info } from 'lucide-react';
import { toast } from 'sonner';

interface ProductEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyProductId: string | null;
}

export function ProductEditSheet({ open, onOpenChange, companyProductId }: ProductEditSheetProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: linhas = [] } = useCompanyLinhas();

  const [tab, setTab] = useState('geral');

  // Geral
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [linha, setLinha] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  // Preços
  const [costPerSqm, setCostPerSqm] = useState('');
  const [pricePerSqm, setPricePerSqm] = useState('');
  const [pricingType, setPricingType] = useState<'COMPOSITION' | 'FIXED_PER_SQM'>('COMPOSITION');
  const [marginPct, setMarginPct] = useState('50');

  const { data: product, isLoading } = useQuery({
    queryKey: ['company-product-edit', companyProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_products')
        .select('*')
        .eq('id', companyProductId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!companyProductId,
  });

  useEffect(() => {
    if (product && open) {
      setName((product as any).commercial_name || '');
      setImageUrl((product as any).image_url || null);
      setLinha((product as any).linha || '');
      setIsActive(!!(product as any).is_active);
      setCostPerSqm(String((product as any).cost_per_sqm || ''));
      setPricePerSqm(String((product as any).price_per_sqm || ''));
      setPricingType(product.pricing_type === 'FIXED_PER_SQM' ? 'FIXED_PER_SQM' : 'COMPOSITION');
      const m = (product as any).margin_percent ?? (product as any).default_margin ?? 50;
      setMarginPct(String(m));
      setTab('geral');
    }
  }, [product, open]);

  const canonicalSimulation = useQuery({
    queryKey: ['phase3e-product-simulation', currentCompany?.id, companyProductId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('resolve_company_product_pricing', {
        _company_id: currentCompany!.id,
        _company_product_id: companyProductId!,
        _width_mm: 1200,
        _height_mm: 1900,
        _quantity: 1,
        _variants: {},
      });
      if (error) throw error;
      return data as unknown as {
        materials: Array<{ item_name: string; unit: string; quantity: number; cost: number }>;
        totals: { cost: number; sale_price: number };
      };
    },
    enabled: open && !!currentCompany?.id && !!companyProductId,
    retry: false,
  });
  const simulationArea = 1.2 * 1.9;
  const composition = {
    isReady: !canonicalSimulation.isLoading,
    hasComposition: !!canonicalSimulation.data,
    compositionCostSimpleTotal: canonicalSimulation.data?.totals.cost ?? 0,
    compositionCostSimplePerSqm: (canonicalSimulation.data?.totals.cost ?? 0) / simulationArea,
    compositionCostPerSqm: (canonicalSimulation.data?.totals.cost ?? 0) / simulationArea,
    simpleBreakdown: (canonicalSimulation.data?.materials ?? []).map(material => ({
      nome: material.item_name, unidade: material.unit,
      detalhe: `${material.quantity} ${material.unit}`, subtotal: material.cost,
    })),
  };

  // Quando composição estiver pronta, atualiza custo e sugere preço pela margem
  useEffect(() => {
    if (pricingType !== 'COMPOSITION' || !composition.isReady || !composition.hasComposition) return;
    // Prefere a soma simples (Σ qtd × custo do estoque) — auditável e previsível
    const autoCost = composition.compositionCostSimplePerSqm || composition.compositionCostPerSqm || 0;
    setCostPerSqm(autoCost.toFixed(2));
    const canonicalSalePerSqm = (canonicalSimulation.data?.totals.sale_price ?? 0) / simulationArea;
    setPricePerSqm(canonicalSalePerSqm.toFixed(2));
  }, [pricingType, composition.isReady, composition.hasComposition, composition.compositionCostSimplePerSqm, composition.compositionCostPerSqm, canonicalSimulation.data]);


  const saveGeral = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('company_products')
        .update({
          commercial_name: name,
          image_url: imageUrl,
          linha: linha || null,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', companyProductId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['company-product-edit', companyProductId] });
      toast.success('Dados atualizados');
    },
    onError: (e: any) => toast.error('Erro ao salvar', { description: e.message }),
  });

  const savePricing = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_company_product_pricing', {
        _company_id: currentCompany!.id,
        _company_product_id: companyProductId!,
        _pricing_type: pricingType,
        _fixed_price_per_sqm: pricingType === 'FIXED_PER_SQM' ? parseFloat(pricePerSqm) : undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['company-product-edit', companyProductId] });
      toast.success('Preços atualizados');
    },
    onError: (e: any) => toast.error('Erro ao salvar', { description: e.message }),
  });

  const isCompositionMode = pricingType === 'COMPOSITION';
  const compositionReady = composition.isReady && composition.hasComposition;

  const margin = (() => {
    const p = parseFloat(pricePerSqm) || 0;
    const c = parseFloat(costPerSqm) || 0;
    if (c <= 0) return 0;
    return ((p - c) / c) * 100;
  })();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar Produto</SheetTitle>
          <SheetDescription>{name || 'Carregando...'}</SheetDescription>
        </SheetHeader>

        {isLoading || !product ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="geral"><Settings2 className="w-4 h-4 mr-1.5" />Dados Gerais</TabsTrigger>
              <TabsTrigger value="precos"><DollarSign className="w-4 h-4 mr-1.5" />Preços e Custos</TabsTrigger>
              <TabsTrigger value="formulas"><FileCode2 className="w-4 h-4 mr-1.5" />Fórmulas</TabsTrigger>
            </TabsList>

            {/* TAB 1 — Dados Gerais */}
            <TabsContent value="geral" className="space-y-5 mt-6">
              <ImageUploadField
                label="Imagem do produto"
                imageUrl={imageUrl}
                onImageChange={setImageUrl}
                bucket="company-product-images"
                path={`${currentCompany?.id}/${companyProductId}`}
                size="lg"
              />

              <div className="space-y-2">
                <Label>Nome comercial</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Linha</Label>
                <Select value={linha || 'none'} onValueChange={(v) => setLinha(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma linha" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem linha</SelectItem>
                    {linhas.map((l) => (
                      <SelectItem key={l.id} value={l.slug}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Status do produto</Label>
                  <p className="text-xs text-muted-foreground">
                    {isActive ? 'Ativo — disponível para venda' : 'Inativo — oculto da listagem'}
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button onClick={() => saveGeral.mutate()} disabled={saveGeral.isPending}>
                  {saveGeral.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar alterações'}
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2 — Preços e Custos */}
            <TabsContent value="precos" className="space-y-5 mt-6">
              <div className="space-y-3">
                <Label>Forma de Precificação</Label>
                <RadioGroup value={pricingType} onValueChange={(v) => setPricingType(v as typeof pricingType)} className="grid grid-cols-2 gap-3">
                  <label className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    pricingType === 'FIXED_PER_SQM' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}>
                    <RadioGroupItem value="FIXED_PER_SQM" className="sr-only" />
                    <DollarSign className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xs font-medium">Preço fixo por m²</span>
                  </label>
                  <label className={`flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    pricingType === 'COMPOSITION' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}>
                    <RadioGroupItem value="COMPOSITION" className="sr-only" />
                    <Calculator className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xs font-medium">Por Composição</span>
                  </label>
                </RadioGroup>
              </div>

              <Separator />

              {isCompositionMode && (
                <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="w-3.5 h-3.5" />
                    Custo calculado automaticamente a partir do estoque da empresa (custo unitário atual × quantidade da composição), normalizado por m².
                  </div>
                  {!composition.isReady && (
                    <div className="flex items-center gap-2 text-xs"><Loader2 className="w-3 h-3 animate-spin" />Calculando custo...</div>
                  )}
                  {composition.isReady && !composition.hasComposition && (
                    <div className="text-xs text-destructive">Este produto ainda não possui composição cadastrada. Configure os itens em "Fórmulas" para usar este modo.</div>
                  )}
                  {compositionReady && composition.simpleBreakdown?.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[10px] text-muted-foreground pb-1">Simulação: box 1,20 × 1,90 m</div>
                      {composition.simpleBreakdown.slice(0, 10).map((it: any, i: number) => (
                        <div key={i} className="flex justify-between gap-2 text-xs">
                          <span className="truncate text-muted-foreground">
                            {it.nome} <span className="opacity-60">[{it.unidade}]</span>
                            <span className="block text-[10px] opacity-60">{it.detalhe}</span>
                          </span>
                          <span className="font-mono shrink-0">R$ {(it.subtotal || 0).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs pt-1 border-t font-medium">
                        <span>Custo total (simulação)</span>
                        <span className="font-mono">R$ {(composition.compositionCostSimpleTotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium">
                        <span>Custo / m²</span>
                        <span className="font-mono">R$ {(composition.compositionCostSimplePerSqm || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Custo/m² (R$) {isCompositionMode && <Lock className="w-3 h-3" />}
                  </Label>
                  <Input type="number" step="0.01" min="0" placeholder="0,00"
                    value={costPerSqm} readOnly
                    className="bg-muted cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label>Markup de simulação (%)</Label>
                  <Input type="number" step="0.1" min="0" placeholder="50"
                    value={marginPct} onChange={(e) => setMarginPct(e.target.value)} disabled={!isCompositionMode} />
                </div>
                <div className="space-y-2">
                  <Label>Preço/m² (R$)</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0,00"
                    value={pricePerSqm} readOnly={isCompositionMode}
                    className={isCompositionMode ? 'bg-muted cursor-not-allowed' : ''}
                    onChange={(e) => setPricePerSqm(e.target.value)} />
                </div>
              </div>

              {(parseFloat(pricePerSqm) > 0 || parseFloat(costPerSqm) > 0) && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">Margem efetiva:</span>
                  <Badge variant={margin >= 30 ? 'default' : margin >= 15 ? 'secondary' : 'destructive'}>
                    {margin.toFixed(1)}%
                  </Badge>
                </div>
              )}


              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button onClick={() => savePricing.mutate()} disabled={savePricing.isPending}>
                  {savePricing.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar preços'}
                </Button>
              </div>
            </TabsContent>

            {/* TAB 3 — Fórmulas */}
            <TabsContent value="formulas" className="space-y-4 mt-6">
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start gap-3">
                  <FileCode2 className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Editor de Fórmulas</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure as fórmulas de corte, composição de materiais e dimensões dinâmicas
                      (L, A, FL, FA) deste produto no editor avançado.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/produtos/empresa/editar/${companyProductId}`);
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir editor de fórmulas
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
