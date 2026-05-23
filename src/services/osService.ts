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
      technical_notes?: string 
    },
    userId: string
  ) {
    const currentItem = await this.getOSItemById(osItemId);
    const historyEntries = [];

    if (Number(currentItem.largura_producao) !== Number(payload.largura_producao)) {
      historyEntries.push({
        os_item_id: osItemId,
        field: 'largura_producao',
        previous_value: currentItem.largura_producao,
        new_value: payload.largura_producao,
        user_id: userId
      });
    }

    if (Number(currentItem.altura_producao) !== Number(payload.altura_producao)) {
      historyEntries.push({
        os_item_id: osItemId,
        field: 'altura_producao',
        previous_value: currentItem.altura_producao,
        new_value: payload.altura_producao,
        user_id: userId
      });
    }

    const { error: updateError } = await supabase
      .from('os_items')
      .update({
        largura_producao: payload.largura_producao,
        altura_producao: payload.altura_producao,
        technical_notes: payload.technical_notes,
        recalculation_required: historyEntries.length > 0
      })
      .eq('id', osItemId);

    if (updateError) throw updateError;

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

  async getConsolidatedMaterials(osId: string) {
    const { data, error } = await supabase
      .from('os_materials')
      .select('*')
      .eq('ordem_servico_id', osId);
    
    if (error) throw error;
    
    const consolidated: Record<string, any> = {};
    
    (data || []).forEach(item => {
      const key = `${item.item_name}-${item.item_type}-${item.unit}`;
      if (!consolidated[key]) {
        consolidated[key] = {
          item_name: item.item_name,
          item_type: item.item_type,
          unit: item.unit,
          total_quantity: 0,
          total_length: 0,
          pieces_count: 0,
          bars_needed: 0
        };
      }
      
      if (item.item_type === 'profile') {
        consolidated[key].total_length += Number(item.total_length_mm || 0);
        consolidated[key].pieces_count += Number(item.pieces_count || 0);
        consolidated[key].bars_needed += Number(item.bars_needed || 0);
      } else {
        consolidated[key].total_quantity += Number(item.pieces_count || 0);
      }
    });
    
    return Object.values(consolidated);
  },

  async recalculateOSItem(osItemId: string, osId: string) {
    return regenerateOSDocuments(osId, osItemId);
  },

  async recalculateAllOSItems(osId: string) {
    return regenerateOSDocuments(osId);
  }
};
