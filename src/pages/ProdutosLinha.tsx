import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Search, Trash2, Download, Percent, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [showActive, setShowActive] = useState(true);

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

  // Toggle active mutation
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

  const filteredProducts = products?.filter(
    (p) => p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/30 transition-colors"
                >
                  {/* Product info */}
                  <div className="col-span-6 sm:col-span-5 flex items-center gap-3">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center text-2xl shrink-0 p-1">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        getCategoryIcon(product.category)
                      )}
                    </div>
                    <span className="font-medium text-foreground uppercase text-sm truncate">
                      {product.name}
                    </span>
                  </div>

                  {/* Hours */}
                  <div className="col-span-2 hidden sm:block text-muted-foreground text-sm">
                    04:00
                  </div>

                  {/* Actions */}
                  <div className="col-span-6 sm:col-span-5 flex items-center justify-end gap-2 flex-wrap">
                    <Button
                      variant={product.is_active ? 'outline' : 'default'}
                      size="sm"
                      className={product.is_active ? 'text-yellow-600 border-yellow-600 hover:bg-yellow-50' : 'bg-green-600 hover:bg-green-700'}
                      onClick={() => toggleActiveMutation.mutate({ 
                        id: product.id, 
                        is_active: !product.is_active 
                      })}
                    >
                      {product.is_active ? 'Desabilitar' : 'Habilitar'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => navigate(`/produtos/editar/${product.id}`)}
                    >
                      Editar produto
                    </Button>
                  </div>
                </div>
              ))}
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
            <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
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
      </div>
    </MainLayout>
  );
}
