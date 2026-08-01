import { supabase } from '@/integrations/supabase/client';
import type { Client } from '@/types/clientes';

export const clientService = {
  async fetchClients(companyId: string): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('id, company_id, name, client_type, document, document_type, email, phone, address, city, state, zip_code, notes, is_active, created_at, latitude, longitude')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []) as Client[];

  },

  async deleteClient(clientId: string, companyId: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)
      .eq('company_id', companyId);

    if (error) throw error;
  },

  async toggleClientStatus(clientId: string, companyId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .update({ is_active: isActive })
      .eq('id', clientId)
      .eq('company_id', companyId);

    if (error) throw error;
  },

  async createClient(companyId: string, client: Omit<Client, 'id' | 'company_id' | 'is_active' | 'created_at' | 'latitude' | 'longitude'>): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .insert({
        ...client,
        company_id: companyId,
      });

    if (error) throw error;
  },

  async updateClient(clientId: string, client: Partial<Client>): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .update(client)
      .eq('id', clientId);

    if (error) throw error;
  }
};

