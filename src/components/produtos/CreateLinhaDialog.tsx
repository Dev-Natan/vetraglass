import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CreateLinhaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLinhaDialog({ open, onOpenChange }: CreateLinhaDialogProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [linhaName, setLinhaName] = useState('');
  const [description, setDescription] = useState('');

  const createLinhaMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      if (!linhaName.trim()) throw new Error('Nome da linha é obrigatório');

      // Apenas criar a linha, sem criar produtos automaticamente
      const { error } = await supabase
        .from('company_linhas')
        .insert({
          company_id: currentCompany.id,
          name: linhaName.trim().toUpperCase(),
          description: description.trim() || null,
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe uma linha com este nome');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-linhas'] });
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success(`Linha "${linhaName.toUpperCase()}" criada com sucesso!`);
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro ao criar linha: ' + error.message);
    },
  });

  const resetForm = () => {
    setLinhaName('');
    setDescription('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLinhaMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="create-linha-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Criar Nova Linha de Produtos
          </DialogTitle>
          <p id="create-linha-description" className="text-sm text-muted-foreground">
            Defina o nome e descrição da nova linha de produtos.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linhaName">Nome da Linha *</Label>
            <Input
              id="linhaName"
              placeholder="Ex: SUPREMA PLUS"
              value={linhaName}
              onChange={(e) => setLinhaName(e.target.value)}
              className="uppercase"
              required
            />
            <p className="text-xs text-muted-foreground">
              O nome será convertido para maiúsculas
            </p>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createLinhaMutation.isPending || !linhaName.trim()}
            >
              {createLinhaMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Linha
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
