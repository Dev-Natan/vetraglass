import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Package, Check, Download, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useProductCategoryLabels } from '@/hooks/useProductCategories';

interface AddLinhaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectLinha: (linha: string) => void;
  activatedLinhas: string[];
}

export function AddLinhaSheet({
  open,
  onOpenChange,
  onSelectLinha,
  activatedLinhas,
}: AddLinhaSheetProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { labels: categoryLabels, categories } = useProductCategoryLabels();

  // Fetch all available product templates to group by linha and filter by category
  const { data: allTemplates = [], isLoading } = useQuery({
    queryKey: ['all-product-templates-for-download'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('linha, category')
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Group by linha and collect categories
  const allLinhas = useMemo(() => {
    const linhaMap = new Map<string, { linha: string; count: number; categories: Set<string> }>();
    
    allTemplates.forEach((item) => {
      const linha = item.linha || 'Sem Linha';
      const existing = linhaMap.get(linha);
      if (existing) {
        existing.count += 1;
        existing.categories.add(item.category);
      } else {
        linhaMap.set(linha, {
          linha,
          count: 1,
          categories: new Set([item.category]),
        });
      }
    });

    return Array.from(linhaMap.values()).sort((a, b) => a.linha.localeCompare(b.linha));
  }, [allTemplates]);

  const filteredLinhas = useMemo(() => {
    return allLinhas.filter((item) => {
      const matchesSearch = item.linha.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !selectedCategory || item.categories.has(selectedCategory);
      return matchesSearch && matchesCategory;
    });
  }, [allLinhas, searchTerm, selectedCategory]);

  const getGradientClass = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradients = [
      'from-primary/20 to-primary/5',
      'from-blue-500/20 to-blue-500/5',
      'from-emerald-500/20 to-emerald-500/5',
      'from-purple-500/20 to-purple-500/5',
      'from-orange-500/20 to-orange-500/5',
      'from-rose-500/20 to-rose-500/5',
    ];
    return gradients[hash % gradients.length];
  };

  const getIconColor = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      'text-primary',
      'text-blue-500',
      'text-emerald-500',
      'text-purple-500',
      'text-orange-500',
      'text-rose-500',
    ];
    return colors[hash % colors.length];
  };

  const handleSelectLinha = (linha: string) => {
    onSelectLinha(linha);
  };

  const handleDownloadAll = async (linha: string) => {
    if (!currentCompany?.id) return;

    // Get all products for this linha
    const { data: products, error } = await supabase
      .from('product_templates')
      .select('id')
      .eq('linha', linha)
      .eq('is_active', true);

    if (error) {
      toast.error('Erro ao buscar produtos da linha');
      return;
    }

    if (!products || products.length === 0) {
      toast.error('Nenhum produto encontrado nesta linha');
      return;
    }

    toast.promise(
      Promise.all(products.map(async (product) => {
        return supabase.rpc('activate_product_template_for_company', {
          _company_id: currentCompany.id,
          _product_template_id: product.id,
        });
      })),
      {
        loading: `Baixando todos os produtos da linha ${linha}...`,
        success: `Linha ${linha} baixada com sucesso!`,
        error: `Erro ao baixar produtos da linha ${linha}`,
      }
    );
    
    // Create company_linha if it doesn't exist
    await supabase.from('company_linhas').upsert({
      company_id: currentCompany.id,
      name: linha,
      is_active: true
    }, { onConflict: 'company_id,name' });

    queryClient.invalidateQueries({ queryKey: ['company-products'] });
    queryClient.invalidateQueries({ queryKey: ['company-linhas'] });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Baixar Nova Linha
          </SheetTitle>
        </SheetHeader>

        {/* Search & Category Filter */}
        <div className="space-y-4 mb-6 sticky top-0 bg-background z-10 pt-2 pb-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar linha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
              <Filter className="w-3 h-3" />
              Categorias
            </div>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 pb-2">
                <Button
                  variant={selectedCategory === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className="rounded-full h-8 text-xs"
                >
                  Todas
                </Button>
                {categories?.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.slug ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(selectedCategory === cat.slug ? null : cat.slug)}
                    className="rounded-full h-8 text-xs whitespace-nowrap"
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Linhas List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Carregando linhas...
            </div>
          ) : filteredLinhas.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma linha encontrada
            </div>
          ) : (
            filteredLinhas.map((item) => {
              const isActivated = activatedLinhas.includes(item.linha);
              return (
                <div
                  key={item.linha}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer',
                    isActivated
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                      : 'hover:bg-muted/50 hover:border-primary/30'
                  )}
                  onClick={() => !isActivated && handleSelectLinha(item.linha)}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0',
                      getGradientClass(item.linha)
                    )}
                  >
                    <span className={cn('text-xl font-bold', getIconColor(item.linha))}>
                      {item.linha.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground uppercase text-sm truncate">
                      {item.linha}
                    </h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Array.from(item.categories).slice(0, 3).map(catSlug => (
                        <span key={catSlug} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm">
                          {categoryLabels[catSlug] || catSlug}
                        </span>
                      ))}
                      {item.categories.size > 3 && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm">
                          +{item.categories.size - 3}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                      {item.count} {item.count === 1 ? 'produto' : 'produtos'}
                    </p>
                  </div>

                  {/* Status/Action */}
                  {isActivated ? (
                    <div className="flex flex-col gap-2 shrink-0">
                      <Badge variant="secondary" className="bg-green-100 text-green-700 w-full justify-center">
                        <Check className="w-3 h-3 mr-1" />
                        Baixada
                      </Badge>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-[10px] h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectLinha(item.linha);
                        }}
                      >
                        Ver produtos
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button 
                        size="sm" 
                        variant="default" 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadAll(item.linha);
                        }}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Baixar Tudo
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-[10px] h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectLinha(item.linha);
                        }}
                      >
                        Ver e Escolher
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
