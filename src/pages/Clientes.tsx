import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Search, Users, Phone, MapPin, User, Trash2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClientDialog } from '@/components/clientes/ClientDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Client {
  id: string;
  company_id: string;
  name: string;
  document: string | null;
  document_type: 'CPF' | 'CNPJ' | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
}

export default function Clientes() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!currentCompany?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (client: Omit<Client, 'id' | 'company_id' | 'is_active' | 'created_at'>) => {
      const { error } = await supabase
        .from('clients')
        .insert({
          ...client,
          company_id: currentCompany!.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente cadastrado com sucesso!');
      setDialogOpen(false);
      setSelectedClient(null);
    },
    onError: () => {
      toast.error('Erro ao cadastrar cliente');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...client }: Partial<Client> & { id: string }) => {
      const { error } = await supabase
        .from('clients')
        .update(client)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente atualizado com sucesso!');
      setDialogOpen(false);
      setSelectedClient(null);
    },
    onError: () => {
      toast.error('Erro ao atualizar cliente');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente removido com sucesso!');
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    },
    onError: () => {
      toast.error('Erro ao remover cliente');
    },
  });

  const handleSave = async (clientData: any) => {
    if (selectedClient?.id) {
      await updateMutation.mutateAsync({ id: selectedClient.id, ...clientData });
    } else {
      await createMutation.mutateAsync(clientData);
    }
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setDialogOpen(true);
  };

  const handleDelete = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };


  const filteredClients = clients.filter(client => {
    const search = searchTerm.toLowerCase();
    return (
      client.name.toLowerCase().includes(search) ||
      client.document?.includes(searchTerm.replace(/\D/g, '')) ||
      client.email?.toLowerCase().includes(search) ||
      client.phone?.includes(searchTerm)
    );
  });

  const formatPhone = (phone: string | null) => {
    if (!phone) return '(00) 00000-0000';
    return phone;
  };

  const formatAddress = (client: Client) => {
    const parts = [client.address, client.city, client.state].filter(Boolean);
    if (parts.length === 0) return 'Endereço não cadastrado';
    const fullAddress = parts.join(', ');
    return fullAddress.length > 35 ? fullAddress.substring(0, 35) + '...' : fullAddress;
  };

  return (
    <MainLayout>
      <div className="pb-32">
        {/* Search bar when active */}
        {showSearch && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-background p-4 shadow-lg lg:left-64 animate-fade-in">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nome, CPF/CNPJ, email ou telefone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
                autoFocus
              />
              <Button 
                variant="ghost" 
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => {
                  setShowSearch(false);
                  setSearchTerm('');
                }}
              >
                Fechar
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 animate-pulse">
                <div className="h-5 bg-muted rounded w-3/4 mb-3" />
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-2/3 mb-4" />
                <div className="h-10 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-slide-up">
            <Users className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground text-lg mb-1">
              {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm 
                ? 'Tente buscar por outros termos.' 
                : 'Comece cadastrando seus clientes para gerenciar sua base.'}
            </p>
            {!searchTerm && (
              <Button 
                className="gap-2"
                onClick={() => {
                  setSelectedClient(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Cadastrar Primeiro Cliente
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-4 animate-slide-up">
            {filteredClients.map(client => (
              <div 
                key={client.id} 
                className="bg-card rounded-xl border border-border p-5 relative hover:shadow-lg transition-all duration-200"
              >
                {/* Delete button */}
                <button
                  onClick={() => handleDelete(client)}
                  className="absolute top-3 right-3 flex items-center gap-1 text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded-md transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>

                {/* Client info */}
                <div className="space-y-2 mb-4 pr-16">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="font-semibold text-foreground text-sm leading-tight">
                      {client.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      {formatPhone(client.phone)}
                    </span>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground leading-tight">
                      {formatAddress(client)}
                    </span>
                  </div>
                </div>

                {/* Edit button */}
                <Button
                  onClick={() => handleEdit(client)}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  Editar
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-card border-t border-border py-4 px-6 z-40">
        <div className="flex items-center justify-center gap-8 max-w-2xl mx-auto">
          {/* Search button */}
          <button
            onClick={() => setShowSearch(true)}
            className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Buscar</span>
          </button>

          {/* New client button */}
          <button
            onClick={() => {
              setSelectedClient(null);
              setDialogOpen(true);
            }}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg transition-colors">
              <Plus className="w-7 h-7 text-white" />
            </div>
            <span className="text-xs font-medium text-foreground">Cadastrar</span>
          </button>

        </div>
      </div>

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={selectedClient}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente "{clientToDelete?.name}" será removido da sua lista.
              Esta ação pode ser desfeita posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clientToDelete && deleteMutation.mutate(clientToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
