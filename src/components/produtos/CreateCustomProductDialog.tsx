import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Sparkles, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CreateCustomProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  { value: 'window', label: 'Janela' },
  { value: 'door', label: 'Porta' },
  { value: 'shower', label: 'Box de Banheiro' },
  { value: 'mirror', label: 'Espelho' },
  { value: 'partition', label: 'Divisória' },
  { value: 'facade', label: 'Fachada' },
  { value: 'guarda_corpo', label: 'Guarda Corpo' },
  { value: 'other', label: 'Outros' },
];

export function CreateCustomProductDialog({ open, onOpenChange }: CreateCustomProductDialogProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [linha, setLinha] = useState('Personalizado');
  const [basePrice, setBasePrice] = useState<number>(0);
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      const { data, error } = await supabase.rpc('create_custom_product', {
        _company_id: currentCompany.id,
        _name: name.trim(),
        _category: category,
        _base_price: basePrice,
        _linha: linha.trim() || 'Personalizado',
        _description: description.trim() || null,
        _image_url: null,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['custom-products'] });
      toast.success('Produto personalizado criado com sucesso!');
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Erro ao criar produto: ' + error.message);
    },
  });

  const resetForm = () => {
    setName('');
    setCategory('other');
    setLinha('Personalizado');
    setBasePrice(0);
    setDescription('');
  };

  const canCreate = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Criar Produto Personalizado
          </DialogTitle>
          <DialogDescription>
            Crie um produto exclusivo para sua empresa que não está na biblioteca de templates.
          </DialogDescription>
        </DialogHeader>

        {/* Warning Alert */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-700">Atenção</p>
            <p className="text-amber-600/80 text-xs mt-1">
              Produtos personalizados não utilizam fórmulas automáticas de cálculo de materiais. 
              Você precisará gerenciar a composição manualmente.
            </p>
          </div>
        </div>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Produto *</Label>
            <Input
              id="name"
              placeholder="Ex: Porta de Correr Especial"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Category & Linha Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="linha">Linha</Label>
              <Input
                id="linha"
                placeholder="Ex: Personalizado"
                value={linha}
                onChange={(e) => setLinha(e.target.value)}
              />
            </div>
          </div>

          {/* Base Price */}
          <div className="space-y-2">
            <Label htmlFor="basePrice">Preço Base (R$/m²)</Label>
            <Input
              id="basePrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={basePrice || ''}
              onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Este é o preço por metro quadrado que será usado nos orçamentos.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descreva as características do produto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Preview Card */}
        {name && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {categories.find(c => c.value === category)?.label || category}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Personalizado
                </Badge>
              </div>
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              R$ {basePrice.toFixed(2)}/m²
            </span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => createMutation.mutate()} 
            disabled={!canCreate || createMutation.isPending}
          >
            {createMutation.isPending ? 'Criando...' : 'Criar Produto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
