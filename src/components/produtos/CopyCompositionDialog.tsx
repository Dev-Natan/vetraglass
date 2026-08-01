import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layers, Search, Loader2 } from 'lucide-react';

export interface CopyCompositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Product template currently being edited (destination). */
  productTemplateId: string;
  /** Scope: null for global (SaaS admin) items, or the company id. */
  companyId: string | null;
}

interface SourceOption {
  id: string;
  name: string;
  linha: string | null;
  itemCount: number;
}

/**
 * Copies every composition item (profiles, glass, accessories, components)
 * from another product template into the one being edited.
 * The copy is additive: existing items are preserved so the user can merge.
 */
export function CopyCompositionDialog({
  open,
  onOpenChange,
  productTemplateId,
  companyId,
}: CopyCompositionDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const { data: sources, isLoading } = useQuery({
    queryKey: ['copy-composition-sources', productTemplateId, companyId],
    enabled: open && !!productTemplateId,
    queryFn: async (): Promise<SourceOption[]> => {
      let query = supabase
        .from('product_template_items')
        .select('product_template_id, product_template:product_templates(id, name, linha)')
        .neq('product_template_id', productTemplateId);

      query = companyId ? query.eq('company_id', companyId) : query.is('company_id', null);

      const { data, error } = await query;
      if (error) throw error;

      const map = new Map<string, SourceOption>();
      for (const row of (data as any[]) || []) {
        const tpl = row.product_template;
        if (!tpl?.id) continue;
        const existing = map.get(tpl.id);
        if (existing) {
          existing.itemCount += 1;
        } else {
          map.set(tpl.id, {
            id: tpl.id,
            name: tpl.name ?? 'Sem nome',
            linha: tpl.linha ?? null,
            itemCount: 1,
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sources ?? [];
    return (sources ?? []).filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.linha ?? '').toLowerCase().includes(term),
    );
  }, [sources, search]);

  const copyMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      let srcQuery = supabase
        .from('product_template_items')
        .select('*')
        .eq('product_template_id', sourceId);
      srcQuery = companyId ? srcQuery.eq('company_id', companyId) : srcQuery.is('company_id', null);

      const { data: sourceItems, error } = await srcQuery;
      if (error) throw error;
      if (!sourceItems || sourceItems.length === 0) {
        throw new Error('O produto de origem não possui itens de composição.');
      }

      const rows = (sourceItems as any[]).map((item) => {
        const {
          id: _id,
          created_at: _createdAt,
          updated_at: _updatedAt,
          parent_item_id: _parentItemId,
          ...rest
        } = item;
        return {
          ...rest,
          product_template_id: productTemplateId,
          company_id: companyId,
        };
      });

      const { error: insertError } = await supabase
        .from('product_template_items')
        .insert(rows as never);
      if (insertError) throw insertError;

      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['product-template-items', productTemplateId] });
      queryClient.invalidateQueries({ queryKey: ['product-template-items-cutting', productTemplateId] });
      toast.success(`${count} itens copiados para a composição!`);
      handleOpenChange(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao copiar composição: ' + (error?.message || 'desconhecido'));
    },
  });

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setSelectedId('');
      setSearch('');
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Copiar composição de outro produto
          </DialogTitle>
          <DialogDescription>
            Todos os itens da composição do produto escolhido (perfis, vidros, acessórios e
            componentes) serão clonados para este produto, mantendo fórmulas, quantidades e ângulos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Buscar produto de origem</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome ou linha..."
                className="pl-8 h-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando produtos...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum outro produto com composição configurada foi encontrado.
            </p>
          ) : (
            <div className="max-h-[320px] overflow-y-auto rounded-md border bg-muted/20 p-1.5 space-y-0.5">
              {filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedId(option.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between gap-2',
                    selectedId === option.id
                      ? 'bg-primary/10 border border-primary/40'
                      : 'hover:bg-muted',
                  )}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{option.name}</div>
                    {option.linha && (
                      <div className="text-xs text-muted-foreground truncate">{option.linha}</div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {option.itemCount} itens
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!selectedId || copyMutation.isPending}
            onClick={() => selectedId && copyMutation.mutate(selectedId)}
            className="gap-2"
          >
            {copyMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Copiando...
              </>
            ) : (
              <>
                <Layers className="w-4 h-4" /> Copiar composição
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
