import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Package, Search, Filter, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LinhaCard } from '@/components/produtos/LinhaCard';
import { supabase } from '@/integrations/supabase/client';

export default function Produtos() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch unique linhas with product count
  const { data: linhas, isLoading } = useQuery({
    queryKey: ['product-linhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('linha')
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Group by linha and count
      const linhaMap = new Map<string, number>();
      data?.forEach((item) => {
        const linha = item.linha || 'Sem Linha';
        linhaMap.set(linha, (linhaMap.get(linha) || 0) + 1);
      });
      
      return Array.from(linhaMap.entries())
        .map(([linha, count]) => ({ linha, count }))
        .sort((a, b) => a.linha.localeCompare(b.linha));
    },
  });

  const filteredLinhas = linhas?.filter(
    (item) => item.linha.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewProducts = (linha: string) => {
    navigate(`/produtos/linha/${encodeURIComponent(linha)}`);
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <Package className="w-7 h-7 text-primary" />
              Produtos
            </h1>
            <p className="text-muted-foreground">Selecione uma linha para ver os produtos disponíveis</p>
          </div>
        </div>

        <div className="section-card">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar linhas..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-52 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredLinhas && filteredLinhas.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredLinhas.map((item) => (
                <LinhaCard
                  key={item.linha}
                  linha={item.linha}
                  productCount={item.count}
                  onViewProducts={() => handleViewProducts(item.linha)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-1">
                {searchTerm ? 'Nenhuma linha encontrada' : 'Nenhuma linha cadastrada'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm 
                  ? 'Tente buscar por outro termo.'
                  : 'As linhas de produtos serão exibidas aqui.'}
              </p>
            </div>
          )}
        </div>

        {/* Bottom actions bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4">
          <div className="container mx-auto flex justify-center gap-8">
            <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Trash2 className="w-5 h-5" />
              <span className="text-xs">Lixeira</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Search className="w-5 h-5" />
              <span className="text-xs">Buscar</span>
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
