import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useProductCategories } from '@/hooks/useProductCategories';

interface EditCustomProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    linha: string | null;
    base_price?: number | null;
    image_url: string | null;
  } | null;
}

export function EditCustomProductDialog({ open, onOpenChange, product }: EditCustomProductDialogProps) {
  const queryClient = useQueryClient();
  const { data: productCategories } = useProductCategories();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [linha, setLinha] = useState('');
  const [basePrice, setBasePrice] = useState('');

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description || '');
      setCategory(product.category || 'other');
      setLinha(product.linha || '');
      setBasePrice(product.base_price?.toString() || '');
    }
  }, [product]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error('Produto não selecionado');

      const { error } = await supabase
        .from('company_products')
        .update({
          commercial_name: name.trim(),
          description: description.trim() || null,
          category,
          linha: linha.trim() || null,
          base_price: basePrice ? parseFloat(basePrice) : null,
        })
        .eq('id', product.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-products'] });
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success('Produto atualizado com sucesso!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="edit-product-description">
        <DialogHeader>
          <DialogTitle>Editar Produto Personalizado</DialogTitle>
          <p id="edit-product-description" className="text-sm text-muted-foreground">
            Atualize as informações do produto personalizado.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Produto *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Janela 2 Folhas Custom"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {productCategories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="linha">Linha</Label>
            <Input
              id="linha"
              value={linha}
              onChange={(e) => setLinha(e.target.value)}
              placeholder="Ex: Suprema"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="basePrice">Preço Base (R$)</Label>
            <Input
              id="basePrice"
              type="number"
              step="0.01"
              min="0"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do produto..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
