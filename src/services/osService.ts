import { supabase } from '@/integrations/supabase/client';
import { regenerateOSDocuments } from '@/utils/generateOSDocuments';

export interface OSItem {
  id: string;
  os_id: string;
  quote_item_id: string | null;
  product_name: string;
  largura_venda: number;
  altura_venda: number;
  largura_venda_b: number | null;
  altura_venda_b: number | null;
  largura_venda_c: number | null;
  altura_venda_c: number | null;
  largura_producao: number;
  altura_producao: number;
  largura_producao_b: number | null;
  altura_producao_b: number | null;
  largura_producao_c: number | null;
  altura_producao_c: number | null;
  quantity: number;
  technical_notes: string | null;
  recalculation_required: boolean;
  last_recalculated_at: string | null;
  created_at: string;
}

export interface DimensionHistory {
  id: string;
  os_item_id: string;
  field: string;
  previous_value: number | null;
  new_value: number;
  user_id: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
  };
}

export const osService = {
  async getOSItems(osId: string): Promise<OSItem[]> {
    const { data, error } = await supabase
      .from('os_items')
      .select('*')
      .eq('os_id', osId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data as any[];
  },

  async getOSItemById(osItemId: string): Promise<OSItem> {
    const { data, error } = await supabase
      .from('os_items')
      .select('*')
      .eq('id', osItemId)
      .single();
    
    if (error) throw error;
    return data as any;
  },

  async updateProductionDimensions(
    osItemId: string,
    payload: { 
      largura_producao: number; 
      altura_producao: number; 
      largura_producao_b?: number | null; 
      altura_producao_b?: number | null; 
      largura_producao_c?: number | null; 
      altura_producao_c?: number | null; 
      technical_notes?: string 
    },
    userId: string
  ) {
    const currentItem = await this.getOSItemById(osItemId);
    const historyEntries = [];

    const fieldsToCompare = [
      'largura_producao', 'altura_producao', 
      'largura_producao_b', 'altura_producao_b',
      'largura_producao_c', 'altura_producao_c'
    ] as const;

    fieldsToCompare.forEach(field => {
      const oldValue = currentItem[field];
      const newValue = payload[field];
      
      if (newValue !== undefined && Number(oldValue) !== Number(newValue)) {
        historyEntries.push({
          os_item_id: osItemId,
          field: field,
          previous_value: oldValue,
          new_value: newValue,
          user_id: userId
        });
      }
    });

    const { error: updateError } = await supabase
      .from('os_items')
      .update({
        largura_producao: payload.largura_producao,
        altura_producao: payload.altura_producao,
        largura_producao_b: payload.largura_producao_b,
        altura_producao_b: payload.altura_producao_b,
        largura_producao_c: payload.largura_producao_c,
        altura_producao_c: payload.altura_producao_c,
        technical_notes: payload.technical_notes,
        recalculation_required: historyEntries.length > 0
      })
      .eq('id', osItemId);

    if (updateError) throw updateError;

    // Automaticamente dispara o recálculo se houver mudanças nas medidas
    if (historyEntries.length > 0) {
      try {
        await regenerateOSDocuments(currentItem.os_id, osItemId);
      } catch (calcError) {
        console.error('Erro ao recalcular automaticamente:', calcError);
        // Não lançamos o erro aqui para não travar o salvamento do ajuste, 
        // mas o log acima ajudará no debug
      }
    }


    if (historyEntries.length > 0) {
      const { error: historyError } = await supabase
        .from('os_dimension_history')
        .insert(historyEntries);
      if (historyError) throw historyError;
    }

    return { success: true };
  },

  async getDimensionHistory(osItemId: string): Promise<DimensionHistory[]> {
    const { data, error } = await supabase
      .from('os_dimension_history')
      .select('*, profiles(full_name)')
      .eq('os_item_id', osItemId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as any[];
  },

  async recalculateOSItem(osItemId: string, osId: string) {
    return regenerateOSDocuments(osId, osItemId);
  },

  async recalculateAllOSItems(osId: string) {
    return regenerateOSDocuments(osId);
  }
};
