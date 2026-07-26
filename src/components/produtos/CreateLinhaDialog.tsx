import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, Check, Search, ArrowLeft, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useProductLinhas } from '@/hooks/useProductLinhas';

interface CreateLinhaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'select' | 'custom';

export function CreateLinhaDialog({ open, onOpenChange }: CreateLinhaDialogProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('select');
  const [search, setSearch] = useState('');
  const [linhaName, setLinhaName] = useState('');
  const [description, setDescription] = useState('');

  const { data: globalLinhas, isLoading: loadingGlobal } = useProductLinhas();

  const { data: existingCompanyLinhas } = useQuery({
    queryKey: ['company-linhas', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_linhas')
        .select('name')
        .eq('company_id', currentCompany.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id && open,
  });

  const existingNames = useMemo(
    () => new Set((existingCompanyLinhas ?? []).map((l) => l.name.toUpperCase())),
    [existingCompanyLinhas]
  );

  const availableGlobal = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (globalLinhas ?? []).filter((l) => {
      if (existingNames.has(l.name.toUpperCase())) return false;
      if (!s) return true;
      return l.name.toLowerCase().includes(s) || (l.description ?? '').toLowerCase().includes(s);
    });
  }, [globalLinhas, existingNames, search]);

  const insertLinha = async (name: string, desc: string | null) => {
    if (!currentCompany?.id) throw new Error('Empresa não selecionada');
    const { error } = await supabase.from('company_linhas').insert({
      company_id: currentCompany.id,
      name: name.trim().toUpperCase(),
      description: desc?.trim() || null,
    });
    if (error) {
      if (error.code === '23505') throw new Error('Já existe uma linha com este nome');
      throw error;
    }
  };

  const activateGlobalMutation = useMutation({
    mutationFn: async (linha: { name: string; description: string | null }) => {
      await insertLinha(linha.name, linha.description);
      return linha.name;
    },
    onSuccess: (name) => {
      queryClient.invalidateQueries({ queryKey: ['company-linhas'] });
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success(`Linha "${name.toUpperCase()}" ativada para sua empresa!`);
      handleClose();
    },
    onError: (e: Error) => toast.error('Erro ao ativar linha: ' + e.message),
  });

  const createCustomMutation = useMutation({
    mutationFn: async () => {
      if (!linhaName.trim()) throw new Error('Nome da linha é obrigatório');
      await insertLinha(linhaName, description);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-linhas'] });
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success(`Linha "${linhaName.toUpperCase()}" criada com sucesso!`);
      handleClose();
    },
    onError: (e: Error) => toast.error('Erro ao criar linha: ' + e.message),
  });

  const handleClose = () => {
    setStep('select');
    setSearch('');
    setLinhaName('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col" aria-describedby="create-linha-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'custom' && (
              <Button variant="ghost" size="icon" className="h-7 w-7 -ml-1" onClick={() => setStep('select')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <Plus className="w-5 h-5" />
            {step === 'select' ? 'Adicionar Linha de Produtos' : 'Criar Linha Personalizada'}
          </DialogTitle>
          <p id="create-linha-description" className="text-sm text-muted-foreground">
            {step === 'select'
              ? 'Escolha uma linha já disponível no sistema ou crie uma personalizada.'
              : 'Use esta opção apenas se a linha desejada não estiver na lista.'}
          </p>
        </DialogHeader>

        {step === 'select' ? (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar linhas do sistema..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2 min-h-[200px]">
              {loadingGlobal ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
                </div>
              ) : availableGlobal.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {search
                    ? 'Nenhuma linha encontrada com esse nome.'
                    : 'Todas as linhas do sistema já estão ativadas.'}
                </div>
              ) : (
                availableGlobal.map((linha) => (
                  <button
                    key={linha.id}
                    type="button"
                    disabled={activateGlobalMutation.isPending}
                    onClick={() =>
                      activateGlobalMutation.mutate({ name: linha.name, description: linha.description })
                    }
                    className="w-full text-left border rounded-lg p-3 hover:border-primary hover:bg-accent/40 transition-colors flex items-center gap-3 disabled:opacity-50"
                  >
                    <div
                      className="w-2 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: linha.color || '#3b82f6' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm uppercase truncate">{linha.name}</div>
                      {linha.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{linha.description}</div>
                      )}
                    </div>
                    <Check className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100" />
                  </button>
                ))
              )}
            </div>

            <div className="border-t pt-3">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => setStep('custom')}
              >
                <Sparkles className="w-4 h-4" />
                Criar uma linha personalizada diferente destas
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createCustomMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="linhaName">Nome da Linha *</Label>
              <Input
                id="linhaName"
                placeholder="Ex: SUPREMA PLUS"
                value={linhaName}
                onChange={(e) => setLinhaName(e.target.value)}
                className="uppercase"
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">O nome será convertido para maiúsculas</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Descrição da linha de produtos..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('select')}>
                Voltar
              </Button>
              <Button type="submit" disabled={createCustomMutation.isPending || !linhaName.trim()}>
                {createCustomMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" /> Criar Linha
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
