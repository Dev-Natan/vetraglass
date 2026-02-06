import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Search, Package, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CopyTemplateCompositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyProductId: string;
  currentLinha?: string | null;
}

type ProductTemplate = {
  id: string;
  name: string;
  linha: string | null;
  image_url: string | null;
  category: string | null;
};

export function CopyTemplateCompositionDialog({
  open,
  onOpenChange,
  companyProductId,
  currentLinha,
}: CopyTemplateCompositionDialogProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Fetch available templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['product-templates-for-copy', currentLinha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('id, name, linha, image_url, category')
        .eq('is_active', true)
        .order('linha')
        .order('name');
      
      if (error) throw error;
      
      // Sort: same linha first
      const items = data as ProductTemplate[];
      if (currentLinha) {
        return items.sort((a, b) => {
          if (a.linha === currentLinha && b.linha !== currentLinha) return -1;
          if (a.linha !== currentLinha && b.linha === currentLinha) return 1;
          return 0;
        });
      }
      return items;
    },
    enabled: open,
  });

  // Filter templates by search
  const filteredTemplates = templates?.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.linha?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Copy composition mutation
  const copyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplateId || !currentCompany?.id) {
        throw new Error('Template ou empresa não selecionado');
      }

      // 1. Fetch template items
      const { data: templateItems, error: fetchError } = await supabase
        .from('product_template_items')
        .select(`
          item_template_id,
          quantity_formula,
          width_formula,
          height_formula,
          is_optional,
          notes,
          cut_angle,
          pieces_quantity
        `)
        .eq('product_template_id', selectedTemplateId)
        .is('company_id', null);

      if (fetchError) throw fetchError;

      if (!templateItems || templateItems.length === 0) {
        throw new Error('Template não possui itens na composição');
      }

      // 2. Ensure company_items exist for each template item
      for (const templateItem of templateItems) {
        // Check if company_item already exists
        const { data: existingItem } = await supabase
          .from('company_items')
          .select('id')
          .eq('company_id', currentCompany.id)
          .eq('item_template_id', templateItem.item_template_id)
          .maybeSingle();

        if (!existingItem) {
          // Create company_item from template
          const { data: itemTemplate } = await supabase
            .from('item_templates')
            .select('name, description, type, unit, specifications, image_url, linha, default_price')
            .eq('id', templateItem.item_template_id)
            .single();

          if (itemTemplate) {
            await supabase.from('company_items').insert({
              company_id: currentCompany.id,
              item_template_id: templateItem.item_template_id,
              name: itemTemplate.name,
              description: itemTemplate.description,
              type: itemTemplate.type,
              unit: itemTemplate.unit,
              specifications: itemTemplate.specifications,
              image_url: itemTemplate.image_url,
              linha: itemTemplate.linha,
              cost: 0,
              sale_price: itemTemplate.default_price || 0,
              is_custom: false,
              is_active: true,
            });
          }
        }
      }

      // 3. Get the company_item_ids for each item_template
      const { data: companyItems } = await supabase
        .from('company_items')
        .select('id, item_template_id')
        .eq('company_id', currentCompany.id)
        .in('item_template_id', templateItems.map(ti => ti.item_template_id));

      const itemTemplateToCompanyItem = new Map(
        companyItems?.map(ci => [ci.item_template_id, ci.id]) || []
      );

      // 4. Delete existing composition
      await supabase
        .from('company_product_items')
        .delete()
        .eq('company_product_id', companyProductId);

      // 5. Insert new composition with company_item_id
      const insertItems = templateItems.map((ti, index) => ({
        company_product_id: companyProductId,
        item_template_id: ti.item_template_id,
        company_item_id: itemTemplateToCompanyItem.get(ti.item_template_id) || null,
        quantity_formula: ti.quantity_formula,
        width_formula: ti.width_formula,
        height_formula: ti.height_formula,
        is_optional: ti.is_optional,
        notes: ti.notes,
        cut_angle: ti.cut_angle,
        pieces_quantity: ti.pieces_quantity,
        sort_order: index + 1,
      }));

      const { error: insertError } = await supabase
        .from('company_product_items')
        .insert(insertItems);

      if (insertError) throw insertError;

      return templateItems.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['company-product-items', companyProductId] });
      toast.success(`Composição copiada com sucesso! ${count} itens adicionados.`);
      onOpenChange(false);
      setSelectedTemplateId(null);
      setSearch('');
    },
    onError: (error) => {
      toast.error('Erro ao copiar composição: ' + error.message);
    },
  });

  const getStorageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return path;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-templates/${path}`;
  };

  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-primary" />
            Copiar Composição de Template
          </DialogTitle>
          <DialogDescription>
            Selecione um template para copiar sua composição (perfis, vidros, acessórios) para este produto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Templates List */}
          <ScrollArea className="h-[300px] pr-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-20">
                <span className="text-muted-foreground">Carregando...</span>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex items-center justify-center h-20">
                <span className="text-muted-foreground">Nenhum template encontrado</span>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      selectedTemplateId === template.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {template.image_url ? (
                        <img 
                          src={getStorageUrl(template.image_url)!} 
                          alt={template.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Package className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{template.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {template.linha && (
                          <Badge 
                            variant={template.linha === currentLinha ? "default" : "secondary"} 
                            className="text-xs"
                          >
                            {template.linha}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {selectedTemplateId === template.id && (
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected Preview */}
          {selectedTemplate && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium text-primary">
                Template selecionado: {selectedTemplate.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                A composição atual será substituída pelos itens deste template.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => copyMutation.mutate()}
            disabled={!selectedTemplateId || copyMutation.isPending}
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            {copyMutation.isPending ? 'Copiando...' : 'Copiar Composição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
