import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useGlassPriceMatrixMutations } from '@/hooks/useGlassPricing';
import type { ComponentItem } from '../types';
import type { ProductPricingData } from '../../ProductPricingStep';

interface UseActivationSubmitParams {
  companyId: string | undefined;
  productTemplateId: string;
  localItems: ComponentItem[];
  pricingData: ProductPricingData;
  onDone: () => void;
  onSuccess?: () => void;
}

/**
 * Mutation que ativa o produto para a empresa, salva preços
 * (incluindo matriz de vidros), insere a composição e invalida
 * as queries dependentes (cross-module sync).
 *
 * REGRA DE OURO: NÃO criar estoque automaticamente. Estoque é
 * sempre cadastrado manualmente pelo usuário. Componentes do
 * produto são apenas referências técnicas, não estoque físico.
 */
export function useActivationSubmit({
  companyId,
  productTemplateId,
  localItems,
  pricingData,
  onDone,
  onSuccess,
}: UseActivationSubmitParams) {
  const queryClient = useQueryClient();
  const { bulkUpsertMutation } = useGlassPriceMatrixMutations();

  return useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Empresa não selecionada');

      // 1. Ativa template para a empresa via RPC
      const { data: activatedProduct, error: activateError } = await supabase.rpc(
        'activate_product_template_for_company',
        {
          _company_id: companyId,
          _product_template_id: productTemplateId,
        }
      );
      if (activateError) throw activateError;

      // Garante is_active = true em company_products
      await supabase
        .from('company_products')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
        .eq('product_template_id', productTemplateId);

      // 2. Atualiza preços da empresa
      if (activatedProduct) {
        const { error: priceError } = await supabase
          .from('company_products')
          .update({
            cost_per_sqm: pricingData.costPerSqm,
            price_per_sqm: pricingData.pricePerSqm,
            updated_at: new Date().toISOString(),
          })
          .eq('id', activatedProduct);
        if (priceError) {
          console.error('Error updating prices:', priceError);
        }
      }

      // 3. Salva matriz de preços de vidro (se aplicável)
      if (pricingData.hasGlass && pricingData.glassPrices.length > 0) {
        const { data: glassTypes } = await supabase
          .from('glass_types')
          .select('id')
          .eq('slug', 'comum')
          .single();

        const glassTypeId = glassTypes?.id;
        if (glassTypeId) {
          const priceEntries = pricingData.glassPrices
            .filter(p => p.price > 0 || p.cost > 0)
            .map(p => ({
              glass_type_id: glassTypeId,
              glass_color_id: p.colorId,
              glass_thickness_id: p.thicknessId,
              cost_per_sqm: p.cost,
              price_per_sqm: p.price,
            }));
          if (priceEntries.length > 0) {
            await bulkUpsertMutation.mutateAsync(priceEntries);
          }
        }
      }

      // 4. Insere componentes com company_id
      const itemInserts = localItems.map(item => ({
        company_id: companyId,
        product_template_id: productTemplateId,
        item_template_id: item.item_template_id,
        quantity_formula: item.quantity_formula,
        pieces_quantity: item.pieces_quantity,
        pieces_formula: item.pieces_formula,
        cut_angle: item.cut_angle,
        width_formula: item.width_formula,
        height_formula: item.height_formula,
        is_optional: item.is_optional,
        side: item.side,
        notes: item.notes,
      }));

      if (itemInserts.length > 0) {
        const { error: insertError } = await supabase
          .from('product_template_items')
          .insert(itemInserts);
        if (insertError) {
          console.error('Error inserting components:', insertError);
        }
      }

      return activatedProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['linha-products'] });
      queryClient.invalidateQueries({ queryKey: ['glass-price-matrix'] });
      toast.success('Produto ativado com sucesso!', {
        description: `${localItems.length} componentes e preços configurados`,
      });
      onDone();
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error('Activation error:', error);
      toast.error('Erro ao ativar produto', {
        description: error.message,
      });
    },
  });
}
