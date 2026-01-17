import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package, Check, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

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
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all available linhas
  const { data: allLinhas = [], isLoading } = useQuery({
    queryKey: ['all-linhas-for-download'],
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
    enabled: open,
  });

  const filteredLinhas = allLinhas.filter((item) =>
    item.linha.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar linha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
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
                    <p className="text-xs text-muted-foreground">
                      {item.count} {item.count === 1 ? 'produto' : 'produtos'} disponíveis
                    </p>
                  </div>

                  {/* Status/Action */}
                  {isActivated ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 shrink-0">
                      <Check className="w-3 h-3 mr-1" />
                      Baixada
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="shrink-0">
                      <Download className="w-4 h-4 mr-1" />
                      Baixar
                    </Button>
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
