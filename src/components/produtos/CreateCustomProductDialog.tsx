import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Sparkles, Package, Plus, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useProductCategories } from '@/hooks/useProductCategories';
import { useCompanyLinhas } from '@/hooks/useCompanyLinhas';
import { useProductLinhaLabels } from '@/hooks/useProductLinhas';
import { ImageUploadField } from '@/components/common/ImageUploadField';
import { createUuid } from '@/utils/createUuid';

interface CreateCustomProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLinha?: string;
}

export function CreateCustomProductDialog({ open, onOpenChange, defaultLinha }: CreateCustomProductDialogProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // Use dynamic categories and linhas from database
  const { data: productCategories } = useProductCategories();
  const { data: productLinhas } = useCompanyLinhas();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  const [linha, setLinha] = useState('');
  const [customLinha, setCustomLinha] = useState('');
  const [showCustomLinha, setShowCustomLinha] = useState(false);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tempProductId] = useState(createUuid);

  // No longer fetching existing linhas as we want to use the pre-defined ones
  const { labels: productLinhaLabels } = useProductLinhaLabels();

  // Fetch existing categories from company products
  const { data: existingCategories = [] } = useQuery({
    queryKey: ['existing-categories', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data } = await supabase
        .from('company_products')
        .select('category')
        .eq('company_id', currentCompany.id)
        .not('category', 'is', null);
      
      const customCats = new Set<string>();
      const defaultCatSlugs = new Set(productCategories?.map(c => c.slug) || []);
      data?.forEach(p => {
        if (p.category && !defaultCatSlugs.has(p.category)) {
          customCats.add(p.category);
        }
      });
      
      return Array.from(customCats).sort();
    },
    enabled: !!currentCompany?.id && open,
  });

  // Combined categories (from database + custom)
  const allCategories = [
    ...(productCategories?.map(c => ({ value: c.slug, label: c.name })) || []),
    ...existingCategories.map(c => ({ value: c, label: c })),
  ];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const finalCategory = category;

      const finalLinha = showCustomLinha ? customLinha.trim() : (linha || 'Personalizado');
      
      const { data, error } = await supabase.rpc('create_custom_product', {
        _company_id: currentCompany.id,
        _name: name.trim(),
        _category: finalCategory,
        _base_price: basePrice,
        _linha: finalLinha,
        _description: description.trim() || null,
        _image_url: imageUrl,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['custom-products'] });
      toast.success('Produto criado! Configure a composição.');
      resetForm();
      onOpenChange(false);
      if (newId) navigate(`/produtos/empresa/editar/${newId}`);
    },
    onError: (error) => {
      toast.error('Erro ao criar produto: ' + error.message);
    },
  });

  const resetForm = () => {
    setStep(1);
    setName('');
    setCategory('');

    setLinha(defaultLinha || '');
    setCustomLinha('');
    setShowCustomLinha(false);
    setBasePrice(0);
    setDescription('');
    setImageUrl(null);
  };

  // Set default linha when dialog opens
  useEffect(() => {
    if (open && defaultLinha) {
      setLinha(defaultLinha);
    }
  }, [open, defaultLinha]);

  const finalCategory = category;
  const finalLinha = showCustomLinha ? customLinha.trim() : (linha || 'Personalizado');
  const canCreate = name.trim().length > 0 && finalCategory.length > 0;

  const steps = [
    { title: 'Identificação', description: 'Informações básicas e imagem' },
    { title: 'Classificação', description: 'Categoria e linha' },
    { title: 'Valores', description: 'Preço e descrição' }
  ];

  const nextStep = () => {
    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">Novo Produto</DialogTitle>
                <DialogDescription className="text-xs">
                  Passo {step} de 3: {steps[step - 1].title}
                </DialogDescription>
              </div>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((s) => (
                <div 
                  key={s} 
                  className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                    s === step ? 'bg-primary w-12' : s < step ? 'bg-primary/40' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-2 min-h-[380px]">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-start gap-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-amber-700">Composição Manual</p>
                  <p className="text-amber-600/80 mt-0.5">
                    Produtos personalizados não possuem fórmulas automáticas de materiais.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <ImageUploadField
                  label="Imagem do Produto"
                  imageUrl={imageUrl}
                  onImageChange={setImageUrl}
                  bucket="company-product-images"
                  path={`${currentCompany?.id}/${tempProductId}`}
                  size="lg"
                />

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold">Nome do Produto *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Porta de Correr Especial"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11"
                  />
                  <p className="text-[10px] text-muted-foreground">Escolha um nome claro para facilitar a identificação nos orçamentos.</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione uma categoria..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(productCategories || []).map((cat) => (
                        <SelectItem key={cat.slug} value={cat.slug}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Categorias são gerenciadas pelo administrador do sistema para evitar duplicidades.
                  </p>
                </div>


                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Linha de Produto</Label>
                  {showCustomLinha ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome da linha"
                        value={customLinha}
                        onChange={(e) => setCustomLinha(e.target.value)}
                        className="h-11 flex-1"
                        autoFocus
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={() => {
                          setShowCustomLinha(false);
                          setCustomLinha('');
                        }}
                        className="h-11"
                      >
                        Voltar
                      </Button>
                    </div>
                  ) : (
                    <Select value={linha} onValueChange={(val) => {
                      if (val === '__new__') setShowCustomLinha(true);
                      else setLinha(val);
                    }}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecione a linha..." />
                      </SelectTrigger>
                      <SelectContent>
                        {productLinhas?.map((l) => (
                          <SelectItem key={l.id} value={l.slug}>
                            {l.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__" className="text-primary font-medium">
                          <span className="flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Criar nova linha
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="basePrice" className="text-sm font-semibold">Preço Base (R$/m²)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                    <Input
                      id="basePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={basePrice || ''}
                      onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                      className="h-11 pl-9"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Preço referencial para orçamentos rápidos.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-semibold">Descrição Adicional</Label>
                  <Textarea
                    id="description"
                    placeholder="Detalhes, especificações técnicas ou observações importantes..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>

              {/* Summary Preview */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-background border flex items-center justify-center overflow-hidden shrink-0">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-7 h-7 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm truncate">{name || 'Produto sem nome'}</h4>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] h-5 bg-background">
                      {finalCategory || 'Sem Categoria'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-5 bg-background">
                      {finalLinha || 'Sem Linha'}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Valor m²</p>
                  <p className="font-bold text-primary">R$ {basePrice.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 pt-2 bg-muted/30 border-t flex flex-row items-center justify-between gap-3 sm:gap-0">
          <Button 
            variant="ghost" 
            onClick={step === 1 ? () => onOpenChange(false) : prevStep}
            className="px-4"
          >
            {step === 1 ? 'Cancelar' : <><ChevronLeft className="w-4 h-4 mr-2" /> Voltar</>}
          </Button>

          {step < 3 ? (
            <Button 
              onClick={nextStep} 
              disabled={step === 1 && !name.trim()}
              className="px-6"
            >
              Continuar <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={() => createMutation.mutate()} 
              disabled={!canCreate || createMutation.isPending}
              className="px-8 bg-primary hover:bg-primary/90"
            >
              {createMutation.isPending ? (
                'Criando...'
              ) : (
                <><Check className="w-4 h-4 mr-2" /> Finalizar Produto</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
