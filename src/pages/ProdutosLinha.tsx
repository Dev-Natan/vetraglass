import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Search, Trash2, Download, Percent, Plus, Filter, Check, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ActivateProductDialog } from '@/components/produtos/ActivateProductDialog';
import { TipologiasSheet } from '@/components/produtos/TipologiasSheet';

type ProductTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  linha: string | null;
  image_url: string | null;
  is_active: boolean;
};

export default function ProdutosLinha() {
  const { linha: linhaParam } = useParams<{ linha: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showActive, setShowActive] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [selectedProductForActivation, setSelectedProductForActivation] = useState<{ id: string; name: string } | null>(null);
  const [tipologiasSheetOpen, setTipologiasSheetOpen] = useState(false);

  // Category labels
  const categoryLabels: Record<string, string> = {
    window: 'Janela',
    door: 'Porta',
    facade: 'Fachada',
    shower: 'Box de Banheiro',
    mirror: 'Espelho',
    partition: 'Divisória',
    guarda_corpo: 'Guarda Corpo',
    other: 'Outros',
  };

  const currentLinha = linhaParam ? decodeURIComponent(linhaParam) : '';

  // Fetch products for this linha
  const { data: products, isLoading } = useQuery({
    queryKey: ['linha-products', currentLinha, showActive],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('*')
        .eq('linha', currentLinha)
        .eq('is_active', showActive)
        .order('name');
      
      if (error) throw error;
      return data as ProductTemplate[];
    },
    enabled: !!currentLinha,
  });

  // Fetch company products to know which ones are activated
  const { data: companyProducts = [] } = useQuery({
    queryKey: ['company-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_products')
        .select('id, product_template_id, is_active')
        .eq('company_id', currentCompany.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Check if product is activated for this company
  const isProductActivated = (productTemplateId: string) => {
    return companyProducts.some(
      cp => cp.product_template_id === productTemplateId && cp.is_active
    );
  };

  // Activate product for company
  const activateProductMutation = useMutation({
    mutationFn: async (productTemplateId: string) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { data, error } = await supabase.rpc('activate_product_template_for_company', {
        _company_id: currentCompany.id,
        _product_template_id: productTemplateId,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success('Produto ativado para venda!');
    },
    onError: (error) => {
      toast.error('Erro ao ativar: ' + error.message);
    },
  });

  // Deactivate product for company
  const deactivateProductMutation = useMutation({
    mutationFn: async (productTemplateId: string) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { error } = await supabase
        .from('company_products')
        .update({ is_active: false })
        .eq('company_id', currentCompany.id)
        .eq('product_template_id', productTemplateId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success('Produto desativado para venda');
    },
    onError: (error) => {
      toast.error('Erro ao desativar: ' + error.message);
    },
  });

  // Toggle active mutation (for templates - admin only)
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('product_templates')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linha-products'] });
      queryClient.invalidateQueries({ queryKey: ['product-linhas'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  // Get unique categories from products
  const availableCategories = useMemo(() => {
    if (!products) return [];
    const categories = new Set<string>();
    products.forEach(p => {
      if (p.category) categories.add(p.category);
    });
    return Array.from(categories).sort();
  }, [products]);

  const filteredProducts = products?.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const isActivated = companyProducts.some(cp => cp.product_template_id === p.id && cp.is_active);
    return matchesSearch && matchesCategory && isActivated;
  });

  const getCategoryIcon = (category: string) => {
    // Simple placeholder icons based on category
    const icons: Record<string, string> = {
      window: '🪟',
      door: '🚪',
      shower: '🚿',
      mirror: '🪞',
      partition: '📐',
      facade: '🏢',
      other: '📦',
    };
    return icons[category] || '📦';
  };

  return (
    <MainLayout>
      <div className="space-y-4 animate-fade-in pb-24">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/produtos')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground">
              {currentLinha}
            </h1>
            <p className="text-muted-foreground text-sm">
              {filteredProducts?.length || 0} produtos
            </p>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Input
              placeholder="Nome"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Category filter */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {availableCategories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {categoryLabels[cat] || cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="default" size="sm" className="gap-2">
            <Search className="w-4 h-4" />
            Buscar
          </Button>
        </div>

        {/* Toggle tabs */}
        <div className="flex gap-2">
          <Button
            variant={showActive ? 'default' : 'outline'}
            onClick={() => setShowActive(true)}
            className="flex-1 sm:flex-none"
          >
            Habilitados
          </Button>
          <Button
            variant={!showActive ? 'secondary' : 'outline'}
            onClick={() => setShowActive(false)}
            className="flex-1 sm:flex-none"
          >
            Desabilitados
          </Button>
        </div>

        {/* Products list */}
        <div className="section-card p-0 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 p-4 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
            <div className="col-span-6 sm:col-span-5">Produto</div>
            <div className="col-span-2 hidden sm:block">Horas</div>
            <div className="col-span-6 sm:col-span-5 text-right">Ações</div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : filteredProducts && filteredProducts.length > 0 ? (
            <div className="divide-y">
              {filteredProducts.map((product) => {
                const isActivated = isProductActivated(product.id);
                return (
                <div
                  key={product.id}
                  className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors ${
                    isActivated 
                      ? 'hover:bg-muted/30' 
                      : 'opacity-60 hover:opacity-80 bg-muted/20'
                  }`}
                >
                  {/* Product info */}
                  <div className="col-span-6 sm:col-span-5 flex items-center gap-3">
                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-2xl shrink-0 p-1 relative ${
                      isActivated ? 'bg-muted' : 'bg-muted/50 grayscale'
                    }`}>
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className={`w-full h-full object-contain ${!isActivated ? 'grayscale' : ''}`}
                        />
                      ) : (
                        getCategoryIcon(product.category)
                      )}
                      {isActivated ? (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      ) : (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-muted-foreground/50 rounded-full flex items-center justify-center">
                          <Download className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className={`font-medium uppercase text-sm truncate block ${
                        isActivated ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {product.name}
                      </span>
                      {isActivated ? (
                        <Badge variant="secondary" className="text-xs mt-1 bg-green-100 text-green-700">
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          Ativado para venda
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs mt-1 text-muted-foreground">
                          <Download className="w-3 h-3 mr-1" />
                          Não ativado
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="col-span-2 hidden sm:block text-muted-foreground text-sm">
                    04:00
                  </div>

                  {/* Actions */}
                  <div className="col-span-6 sm:col-span-5 flex items-center justify-end gap-2 flex-wrap">
                    {/* Activate/Deactivate for sale */}
                    {isProductActivated(product.id) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => deactivateProductMutation.mutate(product.id)}
                        disabled={deactivateProductMutation.isPending}
                      >
                        <ShoppingCart className="w-4 h-4 mr-1" />
                        Desativar Venda
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setSelectedProductForActivation({ id: product.id, name: product.name });
                          setActivateDialogOpen(true);
                        }}
                      >
                        <ShoppingCart className="w-4 h-4 mr-1" />
                        Ativar para Venda
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/produtos/editar/${product.id}`)}
                    >
                      Editar
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm 
                ? 'Nenhum produto encontrado com esse nome.'
                : showActive 
                  ? 'Nenhum produto habilitado nesta linha.'
                  : 'Nenhum produto desabilitado nesta linha.'}
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4">
          <div className="container mx-auto flex justify-center gap-8 sm:gap-12">
            <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Trash2 className="w-5 h-5" />
              <span className="text-xs">Lixeira</span>
            </button>
            <button 
              onClick={() => setTipologiasSheetOpen(true)}
              className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="w-5 h-5" />
              <span className="text-xs">Baixar tipologias</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Percent className="w-5 h-5" />
              <span className="text-xs">Margem de lucro</span>
            </button>
            <button 
              onClick={() => toast.info('Funcionalidade em desenvolvimento')}
              className="flex flex-col items-center gap-1 text-primary hover:text-primary/80 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Plus className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xs">Cadastrar produto</span>
            </button>
          </div>
        </div>

        {/* Tipologias Sheet */}
        <TipologiasSheet
          open={tipologiasSheetOpen}
          onOpenChange={setTipologiasSheetOpen}
          linha={currentLinha}
        />

        {/* Activate Product Dialog */}
        {selectedProductForActivation && (
          <ActivateProductDialog
            open={activateDialogOpen}
            onOpenChange={setActivateDialogOpen}
            productTemplateId={selectedProductForActivation.id}
            productName={selectedProductForActivation.name}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['company-products'] });
            }}
          />
        )}
      </div>
    </MainLayout>
  );
}
