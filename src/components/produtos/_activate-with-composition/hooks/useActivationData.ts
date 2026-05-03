import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ComponentItem, ItemTemplate, ItemTypeTab } from '../types';
import { itemTypeTabs } from '../constants';

interface UseActivationDataParams {
  open: boolean;
  productTemplateId: string;
  activeTab: string;
  isAddingItem: boolean;
}

/**
 * Centraliza as 3 queries do dialog de ativação:
 * - itens da composição global do template
 * - fórmulas de vidro (auto-injeção)
 * - template genérico de vidro (para itens auto-injetados)
 * - itens disponíveis para adicionar (por tipo)
 *
 * Também gerencia a inicialização de localItems com auto-add de vidros.
 */
export function useActivationData({
  open,
  productTemplateId,
  activeTab,
  isAddingItem,
}: UseActivationDataParams) {
  const [localItems, setLocalItems] = useState<ComponentItem[]>([]);
  const [autoLoadedGlassCount, setAutoLoadedGlassCount] = useState(0);

  const { data: globalItems, isLoading: loadingItems } = useQuery({
    queryKey: ['product-template-items-global', productTemplateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_template_items')
        .select(`
          id,
          item_template_id,
          quantity_formula,
          pieces_quantity,
          cut_angle,
          width_formula,
          height_formula,
          is_optional,
          notes,
          item_template:item_templates (
            id,
            name,
            type,
            unit,
            image_url
          )
        `)
        .eq('product_template_id', productTemplateId)
        .is('company_id', null)
        .order('item_template_id');

      if (error) throw error;
      return (data as unknown) as ComponentItem[];
    },
    enabled: open && !!productTemplateId,
  });

  const { data: glassFormulas } = useQuery({
    queryKey: ['glass-formulas-for-product', productTemplateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glass_line_formulas')
        .select('*')
        .eq('product_template_id', productTemplateId)
        .eq('is_active', true)
        .order('panel_index')
        .order('formula_name');

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!productTemplateId,
  });

  const { data: genericGlassTemplate } = useQuery({
    queryKey: ['generic-glass-template'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .eq('type', 'glass')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: open,
  });

  // Itens disponíveis para adicionar (por tab/tipo)
  const { data: availableItems } = useQuery({
    queryKey: ['item-templates-for-composition', activeTab],
    queryFn: async () => {
      const currentTab = itemTypeTabs.find(t => t.value === activeTab);
      const dbType = currentTab?.dbType || 'accessory';

      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .eq('type', dbType as 'accessory' | 'glass' | 'profile' | 'service')
        .eq('is_active', true)
        .order('linha')
        .order('name');

      if (error) throw error;
      return data as ItemTemplate[];
    },
    enabled: open && isAddingItem,
  });

  // Inicializa localItems com auto-injeção de vidros a partir de glass_line_formulas
  useEffect(() => {
    if (!globalItems) return;

    let items = globalItems.map(item => ({ ...item }));
    let autoAddedCount = 0;

    if (glassFormulas && glassFormulas.length > 0 && genericGlassTemplate) {
      const existingGlassCount = items.filter(i => i.item_template?.type === 'glass').length;

      if (existingGlassCount === 0) {
        const autoGlassItems: ComponentItem[] = glassFormulas.map((formula, idx) => ({
          id: `auto-glass-${idx}-${Date.now()}`,
          item_template_id: genericGlassTemplate.id,
          quantity_formula: '1',
          pieces_quantity: 1,
          cut_angle: 90,
          width_formula: formula.width_formula,
          height_formula: formula.height_formula,
          is_optional: false,
          notes: formula.formula_name,
          isNew: true,
          item_template: {
            id: genericGlassTemplate.id,
            name: genericGlassTemplate.name,
            type: 'glass',
            unit: genericGlassTemplate.unit,
            image_url: genericGlassTemplate.image_url,
          },
        }));

        items = [...items, ...autoGlassItems];
        autoAddedCount = autoGlassItems.length;
      }
    }

    setLocalItems(items);
    setAutoLoadedGlassCount(autoAddedCount);
  }, [globalItems, glassFormulas, genericGlassTemplate]);

  return {
    localItems,
    setLocalItems,
    autoLoadedGlassCount,
    loadingItems,
    availableItems,
  };
}
