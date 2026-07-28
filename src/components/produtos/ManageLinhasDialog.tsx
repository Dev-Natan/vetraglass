import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProductLinhas } from '@/hooks/useProductLinhas';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageLinhasDialog({ open, onOpenChange }: Props) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const { data: allLinhas = [], isLoading } = useProductLinhas();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: enabled = [] } = useQuery({
    queryKey: ['company-enabled-linhas', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_enabled_linhas')
        .select('linha_slug')
        .eq('company_id', currentCompany.id);
      if (error) throw error;
      return (data || []).map((r: any) => r.linha_slug as string);
    },
    enabled: !!currentCompany?.id && open,
  });

  useEffect(() => {
    if (open) setSelected(new Set(enabled));
  }, [open, enabled]);

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      const companyId = currentCompany.id;

      const enabledSet = new Set(enabled);
      const toAdd = [...selected].filter((s) => !enabledSet.has(s));
      const toRemove = [...enabledSet].filter((s) => !selected.has(s));

      if (toRemove.length) {
        const { error } = await supabase
          .from('company_enabled_linhas')
          .delete()
          .eq('company_id', companyId)
          .in('linha_slug', toRemove);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase
          .from('company_enabled_linhas')
          .insert(toAdd.map((slug) => ({ company_id: companyId, linha_slug: slug })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-enabled-linhas'] });
      toast.success('Linhas atualizadas');
      onOpenChange(false);
    },
    onError: (e: any) => toast.error('Erro ao salvar: ' + e.message),
  });

  const selectAll = () => setSelected(new Set(allLinhas.map((l) => l.slug)));
  const clearAll = () => setSelected(new Set());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Linhas que sua empresa trabalha</DialogTitle>
          <DialogDescription>
            Selecione apenas as linhas que fazem parte do seu catálogo. As não selecionadas ficarão ocultas na grade de produtos.
            Se nenhuma for selecionada, todas as linhas aparecem.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {selected.size} de {allLinhas.length} selecionadas
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>Todas</Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>Limpar</Button>
          </div>
        </div>

        <ScrollArea className="max-h-[50vh] pr-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <div className="space-y-1">
              {allLinhas.map((l) => (
                <label
                  key={l.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(l.slug)}
                    onCheckedChange={() => toggle(l.slug)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{l.name}</div>
                    {l.description && (
                      <div className="text-xs text-muted-foreground truncate">{l.description}</div>
                    )}
                  </div>
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: l.color }}
                  />
                </label>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
