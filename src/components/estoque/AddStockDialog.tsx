import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { useProductCategories } from '@/hooks/useProductCategories';
import { useProductLinhas } from '@/hooks/useProductLinhas';

interface AddStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const itemTypeLabels: Record<string, string> = {
  glass: 'Vidro',
  profile: 'Perfil',
  accessory: 'Acessório',
  service: 'Serviço',
};

export function AddStockDialog({ open, onOpenChange }: AddStockDialogProps) {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Filter states
  const [selectedLinhaFilter, setSelectedLinhaFilter] = useState<string | null>(null);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  
  // Form states
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [linha, setLinha] = useState('');
  const [category, setCategory] = useState('');
  const [allowFractional, setAllowFractional] = useState(false);
  const [fiscalExpanded, setFiscalExpanded] = useState(false);
  const [fiscalData, setFiscalData] = useState<FiscalFieldsData>({
    ncm: '',
    cfop_venda: '',
    cfop_venda_interestadual: '',
    cest: '',
    origem: '',
    codigo_servico: '',
    aliquota_iss: '',
  });

  // Fetch categories and linhas
  const { data: categories } = useProductCategories();
  const { data: linhas } = useProductLinhas();

  // Check if company has fiscal mode active
  const { data: companyData } = useQuery({
    queryKey: ['company-fiscal-mode', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data } = await supabase
        .from('companies')
        .select('modo_fiscal_ativo')
        .eq('id', currentCompany.id)
        .single();
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const isFiscalModeActive = companyData?.modo_fiscal_ativo ?? false;

  // Fetch item templates
  const { data: itemTemplates, isLoading: loadingItems } = useQuery({
    queryKey: ['item-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .eq('is_active', true)
        .order('linha')
        .order('type')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing stock to avoid duplicates
  const { data: existingStock } = useQuery({
    queryKey: ['company-stock-item-ids', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_stock')
        .select('item_template_id')
        .eq('company_id', currentCompany.id);
      
      if (error) throw error;
      return data.map(s => s.item_template_id);
    },
    enabled: !!currentCompany?.id,
  });

  // Get selected item details
  const selectedItem = itemTemplates?.find((item) => item.id === selectedItemId);

  // Pre-fill linha and category when item is selected
  useEffect(() => {
    if (selectedItem) {
      setLinha(selectedItem.linha || '');
      setCategory(selectedItem.type || '');
      setAllowFractional(selectedItem.type === 'profile');
      
      // Pre-fill fiscal data from template if available
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
      if (!currentCompany?.id || !selectedItem) {
        throw new Error('Dados incompletos');
      }

      const quantityNum = parseFloat(quantity);
      const costNum = parseFloat(cost);
      const salePriceNum = parseFloat(salePrice);

      // Validation
      if (!quantityNum || quantityNum <= 0) {
        throw new Error('Quantidade é obrigatória e deve ser maior que zero');
      }
      if (costNum < 0) {
        throw new Error('Preço de custo não pode ser negativo');
      }
      if (salePriceNum < 0) {
        throw new Error('Preço de venda não pode ser negativo');
      }
      if (!linha) {
        throw new Error('Linha é obrigatória');
      }
      if (!category) {
        throw new Error('Categoria é obrigatória');
      }

      // 1. Upsert company_items with all data including fiscal
      const { data: companyItem, error: itemError } = await supabase
        .from('company_items')
        .upsert({
          company_id: currentCompany.id,
          item_template_id: selectedItemId,
          name: selectedItem.name,
          description: selectedItem.description,
          type: category,
          unit: selectedItem.unit || 'un',
          linha,
          cost: costNum,
          sale_price: salePriceNum,
          image_url: selectedItem.image_url,
          is_custom: false,
          is_active: true,
          // Fiscal fields
          ncm: fiscalData.ncm || null,
          cfop_venda: fiscalData.cfop_venda || null,
          cfop_venda_interestadual: fiscalData.cfop_venda_interestadual || null,
          cest: fiscalData.cest || null,
          origem: fiscalData.origem || null,
          codigo_servico: fiscalData.codigo_servico || null,
          aliquota_iss: fiscalData.aliquota_iss ? parseFloat(fiscalData.aliquota_iss) : null,
        }, {
          onConflict: 'company_id,item_template_id'
        })
        .select()
        .single();

      if (itemError) throw new Error(`Erro ao salvar item: ${itemError.message}`);

      // 2. Upsert company_stock
      const { data: existingStockRecord } = await supabase
        .from('company_stock')
        .select('id, quantity')
        .eq('company_id', currentCompany.id)
        .eq('item_template_id', selectedItemId)
        .maybeSingle();

      if (existingStockRecord) {
        // Update existing stock
        const { error: updateError } = await supabase
          .from('company_stock')
          .update({ 
            quantity: existingStockRecord.quantity + quantityNum,
            company_item_id: companyItem.id,
            min_quantity: parseFloat(minQuantity) || 0,
            allow_fractional: allowFractional,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingStockRecord.id);

        if (updateError) throw new Error(`Erro ao atualizar estoque: ${updateError.message}`);
      } else {
        // Create new stock record
        const { error: insertError } = await supabase
          .from('company_stock')
          .insert({
            company_id: currentCompany.id,
            item_template_id: selectedItemId,
            company_item_id: companyItem.id,
            quantity: quantityNum,
            min_quantity: parseFloat(minQuantity) || 0,
            allow_fractional: allowFractional,
            is_active: true,
          });

        if (insertError) throw new Error(`Erro ao criar estoque: ${insertError.message}`);
      }

      // 3. Register stock movement (entrada) with cost
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          company_id: currentCompany.id,
          company_item_id: companyItem.id,
          item_template_id: selectedItemId,
          type: 'entrada',
          category: 'compra_fornecedor',
          quantity: quantityNum,
          unit_cost: costNum,
          valor_financeiro: quantityNum * costNum,
          description: `Compra: ${selectedItem.name}`,
          reference_type: 'manual',
          created_by: user?.id,
        });

      if (movementError) {
        console.error('Erro ao registrar movimento:', movementError);
        // Don't fail the operation, just log
      }

      // Also update company_item_prices for compatibility
      await supabase
        .from('company_item_prices')
        .upsert({
          company_id: currentCompany.id,
          item_template_id: selectedItemId,
          cost: costNum,
          price: salePriceNum,
        }, {
          onConflict: 'company_id,item_template_id'
        });
    },
    onSuccess: () => {
      toast({
        title: 'Compra registrada',
        description: 'O item foi adicionado ao estoque com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock-item-ids'] });
      queryClient.invalidateQueries({ queryKey: ['company-item-prices'] });
      queryClient.invalidateQueries({ queryKey: ['company-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao registrar compra',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setSelectedLinhaFilter(null);
    setSelectedTypeFilter(null);
    setNameFilter('');
    setSelectedItemId('');
    setQuantity('');
    setMinQuantity('');
    setCost('');
    setSalePrice('');
    setLinha('');
    setCategory('');
    setAllowFractional(false);
    setFiscalExpanded(false);
    setFiscalData({
      ncm: '',
      cfop_venda: '',
      cfop_venda_interestadual: '',
      cest: '',
      origem: '',
      codigo_servico: '',
      aliquota_iss: '',
    });
  };

  const handleItemSelect = (itemId: string, itemType: string) => {
    if (selectedItemId === itemId) {
      setSelectedItemId('');
      setAllowFractional(false);
    } else {
      setSelectedItemId(itemId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedItemId) {
      toast({
        title: 'Selecione um item',
        description: 'Você precisa selecionar um item para registrar a compra.',
        variant: 'destructive',
      });
      return;
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      toast({
        title: 'Quantidade obrigatória',
        description: 'Informe a quantidade comprada.',
        variant: 'destructive',
      });
      return;
    }

    if (!cost) {
      toast({
        title: 'Custo obrigatório',
        description: 'Informe o preço de custo do item.',
        variant: 'destructive',
      });
      return;
    }

    if (!salePrice) {
      toast({
        title: 'Preço de venda obrigatório',
        description: 'Informe o preço de venda do item.',
        variant: 'destructive',
      });
      return;
    }

    if (!linha) {
      toast({
        title: 'Linha obrigatória',
        description: 'Selecione a linha do produto.',
        variant: 'destructive',
      });
      return;
    }

    if (!category) {
      toast({
        title: 'Categoria obrigatória',
        description: 'Selecione a categoria do produto.',
        variant: 'destructive',
      });
      return;
    }

    registerPurchaseMutation.mutate();
  };

  // Filter items (allow already in stock for price update, but show them differently)
  const availableItems = useMemo(() => {
    return itemTemplates || [];
  }, [itemTemplates]);

  // Get unique linhas and types for filter chips
  const uniqueLinhas = useMemo(() => {
    const linhasSet = new Set<string>();
    availableItems.forEach(item => linhasSet.add(item.linha || 'Sem Linha'));
    return Array.from(linhasSet).sort((a, b) => {
      if (a === 'Sem Linha') return -1;
      if (b === 'Sem Linha') return 1;
      return a.localeCompare(b);
    });
  }, [availableItems]);

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    availableItems.forEach(item => types.add(item.type));
    return Array.from(types).sort();
  }, [availableItems]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return availableItems.filter(item => {
      const itemLinha = item.linha || 'Sem Linha';
      const matchesLinha = !selectedLinhaFilter || itemLinha === selectedLinhaFilter;
      const matchesType = !selectedTypeFilter || item.type === selectedTypeFilter;
      const matchesName = !nameFilter || 
        item.name.toLowerCase().includes(nameFilter.toLowerCase());
      return matchesLinha && matchesType && matchesName;
    });
  }, [availableItems, selectedLinhaFilter, selectedTypeFilter, nameFilter]);

  // Group items by linha
  const itemsByLinha = useMemo(() => {
    const grouped: Record<string, typeof filteredItems> = {};
    
    filteredItems.forEach(item => {
      const linhaKey = item.linha || 'Sem Linha';
      if (!grouped[linhaKey]) {
        grouped[linhaKey] = [];
      }
      grouped[linhaKey].push(item);
    });

    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Sem Linha') return -1;
      if (b === 'Sem Linha') return 1;
      return a.localeCompare(b);
    });

    return { grouped, sortedKeys };
  }, [filteredItems]);

  // Get weight from specifications if available
  const getItemWeight = (item: typeof selectedItem) => {
    if (!item?.specifications) return null;
    const specs = item.specifications as Record<string, unknown>;
    return specs.peso_kg_ml || specs.weight_kg_ml || specs.peso;
  };

  // Calculate margin
  const costNum = parseFloat(cost) || 0;
  const salePriceNum = parseFloat(salePrice) || 0;
  const margin = costNum > 0 ? ((salePriceNum - costNum) / costNum) * 100 : 0;
  const profit = salePriceNum - costNum;

  // Check fiscal readiness
  const isFiscalReady = fiscalData.ncm && fiscalData.cfop_venda && fiscalData.origem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <DialogTitle>Registrar Compra de Material</DialogTitle>
          </div>
          <DialogDescription>
            Adicione itens ao estoque registrando a compra com preços e quantidade.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Filters */}
          <div className="px-6 py-4 border-b bg-muted/30 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Buscar por Nome</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    placeholder="Digite para buscar..."
                    className="pl-9 pr-8 h-9"
                  />
                  {nameFilter && (
                    <button
                      type="button"
                      onClick={() => setNameFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Linha</Label>
                <Select
                  value={selectedLinhaFilter || 'all'}
                  onValueChange={(value) => setSelectedLinhaFilter(value === 'all' ? null : value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas as linhas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as linhas</SelectItem>
                    {uniqueLinhas.map((linhaOption) => (
                      <SelectItem key={linhaOption} value={linhaOption}>
                        {linhaOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Select
                  value={selectedTypeFilter || 'all'}
                  onValueChange={(value) => setSelectedTypeFilter(value === 'all' ? null : value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {uniqueTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {itemTypeLabels[type] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Items Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: '250px' }}>
            <div className="px-6 py-4 space-y-6">
              {loadingItems ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum item encontrado com os filtros aplicados.
                  </p>
                </div>
              ) : (
                itemsByLinha.sortedKeys.map((linhaKey) => (
                  <div key={linhaKey}>
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <span className="h-px flex-1 bg-border" />
                      <span className="px-2">{linhaKey}</span>
                      <span className="h-px flex-1 bg-border" />
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {itemsByLinha.grouped[linhaKey].map((item) => {
                        const isSelected = selectedItemId === item.id;
                        const isInStock = existingStock?.includes(item.id);
                        const weight = getItemWeight(item);
                        
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleItemSelect(item.id, item.type)}
                            className={cn(
                              "relative flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-200",
                              "hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                              isSelected 
                                ? "border-primary bg-primary/5 shadow-md" 
                                : isInStock
                                ? "border-green-300 bg-green-50/50"
                                : "border-border bg-card"
                            )}
                          >
                            {/* Selection indicator */}
                            {isSelected && (
                              <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            )}
                            
                            {/* In stock badge */}
                            {isInStock && !isSelected && (
                              <Badge variant="outline" className="absolute top-2 left-2 text-[9px] bg-green-100 text-green-700 border-green-300">
                                Em estoque
                              </Badge>
                            )}
                            
                            {/* Image */}
                            <div className="w-16 h-16 rounded-lg border bg-background flex items-center justify-center mb-2 overflow-hidden">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  loading="lazy"
                                  className="max-h-full max-w-full object-contain"
                                />
                              ) : (
                                <Package className="h-6 w-6 text-muted-foreground/50" />
                              )}
                            </div>
                            
                            {/* Name */}
                            <p className="text-xs font-medium text-center line-clamp-2 leading-tight mb-1">
                              {item.name}
                            </p>
                            
                            {/* Weight */}
                            {weight && (
                              <p className="text-[10px] text-muted-foreground">
                                {String(weight)} Kg/ML
                              </p>
                            )}
                            
                            {/* Type badge */}
                            <span className="mt-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {itemTypeLabels[item.type] || item.type}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Selected Item Preview */}
          {selectedItem && (
            <div className="px-6 py-2 border-t bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded border bg-background flex items-center justify-center overflow-hidden shrink-0">
                  {selectedItem.image_url ? (
                    <img
                      src={selectedItem.image_url}
                      alt={selectedItem.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{selectedItem.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {itemTypeLabels[selectedItem.type] || selectedItem.type}
                    {selectedItem.linha && ` • ${selectedItem.linha}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedItemId('')}
                  className="h-8 w-8 p-0 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Form Fields - Purchase Data */}
          <div className="px-6 py-4 border-t space-y-4 bg-muted/20">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Dados da Compra</span>
              <span className="text-xs text-muted-foreground">(Campos obrigatórios *)</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quantity" className="text-xs">
                  Quantidade <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cost" className="text-xs">
                  Custo (R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0,00"
                  className="h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="salePrice" className="text-xs">
                  Venda (R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="salePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  placeholder="0,00"
                  className="h-9"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="linha" className="text-xs">
                  Linha <span className="text-destructive">*</span>
                </Label>
                <Select value={linha} onValueChange={setLinha}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {linhas?.map((l) => (
                      <SelectItem key={l.id} value={l.name}>
                        {l.name}
                      </SelectItem>
                    ))}
                    {/* Allow custom linha from template */}
                    {selectedItem?.linha && !linhas?.find(l => l.name === selectedItem.linha) && (
                      <SelectItem value={selectedItem.linha}>
                        {selectedItem.linha}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs">
                  Categoria <span className="text-destructive">*</span>
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.slug}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="minQuantity" className="text-xs">Qtd. Mínima</Label>
                <Input
                  id="minQuantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                  placeholder="0"
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border h-9">
              <Label htmlFor="allowFractionalAdd" className="text-xs cursor-pointer">
                Venda Fracionada
              </Label>
              <Switch
                id="allowFractionalAdd"
                checked={allowFractional}
                onCheckedChange={setAllowFractional}
                className="scale-75"
              />
            </div>

            {/* Margin indicator */}
            {costNum > 0 && salePriceNum > 0 && (
              <div className={cn(
                "p-2 rounded border text-xs flex items-center justify-between",
                profit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
              )}>
                <span className="text-muted-foreground flex items-center gap-1">
                  {profit < 0 && <AlertCircle className="h-3 w-3 text-destructive" />}
                  Margem:
                </span>
                <span className={cn(
                  "font-medium",
                  profit >= 0 ? 'text-green-700' : 'text-destructive'
                )}>
                  {margin.toFixed(1)}%
                  {' • '}R$ {profit.toFixed(2)} {profit >= 0 ? 'lucro' : 'prejuízo'}
                </span>
              </div>
            )}
          </div>

          {/* Fiscal Fields - Collapsible */}
          <div className="px-6 py-3 border-t bg-background">
            <Collapsible open={fiscalExpanded || isFiscalModeActive} onOpenChange={setFiscalExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" type="button" className="w-full justify-between p-2 h-auto">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Dados Fiscais</span>
                    {isFiscalModeActive && (
                      <Badge variant="outline" className="text-xs">Modo Fiscal</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isFiscalReady ? (
                      <Badge variant="outline" className="text-xs gap-1 bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Pronto para NFe
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Opcional
                      </Badge>
                    )}
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform",
                      (fiscalExpanded || isFiscalModeActive) && "rotate-180"
                    )} />
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <FiscalFieldsCard 
                  data={fiscalData} 
                  onChange={setFiscalData}
                  type="item"
                  itemType={category as 'glass' | 'profile' | 'accessory' | 'service'}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t flex justify-end gap-2 bg-background">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={registerPurchaseMutation.isPending || !selectedItemId}
              className="gap-2"
            >
              {registerPurchaseMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              <ShoppingCart className="w-4 h-4" />
              Registrar Compra
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
