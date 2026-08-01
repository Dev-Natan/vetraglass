import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Search, Users, LayoutGrid, List, Truck
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { clientService } from '@/services/clientService';
import type { Client } from '@/types/clientes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from 'sonner';
import { Client360Dialog } from '@/components/clientes/Client360Dialog';
import { ClientsCardView } from '@/components/clientes/ClientsCardView';
import { ClientsTableView } from '@/components/clientes/ClientsTableView';
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
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/common/PaginationControls';
import { queryKeys } from '@/lib/queryConfig';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';

// Type moved to @/types/clientes


export default function Clientes() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Module tutorial trigger
  useModuleTutorialTrigger('clientes');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'cliente' | 'fornecedor'>('cliente');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  // Open new dialog if ?novo=true in URL
  useEffect(() => {
    if (searchParams.get('novo') === 'true') {
      setDialogOpen(true);
      setSelectedClient(null);
      searchParams.delete('novo');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Load saved view preference
  useEffect(() => {
    const saved = localStorage.getItem('clientes-view-mode');
    if (saved === 'table' || saved === 'cards') {
      setViewMode(saved);
    }
  }, []);

  const handleViewModeChange = (value: string) => {
    if (value === 'cards' || value === 'table') {
      setViewMode(value);
      localStorage.setItem('clientes-view-mode', value);
    }
  };

  // Optimized query with specific fields and caching
  const { data: clients = [], isLoading } = useQuery({
    queryKey: queryKeys.clients.all(currentCompany?.id || ''),
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      return clientService.fetchClients(currentCompany.id);
    },

    enabled: !!currentCompany?.id,
    // Zero cache - sempre dados frescos
  });

  const createMutation = useMutation({
    mutationFn: async (client: Omit<Client, 'id' | 'company_id' | 'is_active' | 'created_at' | 'latitude' | 'longitude'>) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      return clientService.createClient(currentCompany.id, client);
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
      return clientService.updateClient(id, client);
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
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      return clientService.toggleClientStatus(id, currentCompany.id, false);
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

  const handleView = (client: Client) => {
    setSelectedClient(client);
    setDialogOpen(true);
  };

  const handleDelete = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const filteredClients = clients.filter(client => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = (
      client.name.toLowerCase().includes(search) ||
      client.document?.includes(searchTerm.replace(/\D/g, '')) ||
      client.email?.toLowerCase().includes(search) ||
      client.phone?.includes(searchTerm) ||
      client.city?.toLowerCase().includes(search)
    );
    const matchesTab = client.client_type === activeTab;
    return matchesSearch && matchesTab;
  });

  // Pagination
  const pagination = usePagination(filteredClients, { initialPageSize: 50 });

  return (
    <MainLayout>
      <div className="pb-32 space-y-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="cliente" className="gap-2">
              <Users className="h-4 w-4" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="fornecedor" className="gap-2">
              <Truck className="h-4 w-4" />
              Fornecedores
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Header */}
        <div data-tutorial="clientes-header" className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">
              {activeTab === 'cliente' ? 'Clientes' : 'Fornecedores'}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {clients.filter(c => c.client_type === activeTab).length} {activeTab === 'cliente' ? 'clientes' : 'fornecedores'} cadastrados
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <ToggleGroup 
              type="single" 
              value={viewMode} 
              onValueChange={handleViewModeChange}
              className="bg-muted p-1 rounded-lg"
            >
              <ToggleGroupItem value="cards" aria-label="Cards">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Tabela">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>

            <Button 
              data-tutorial="clientes-btn-novo"
              onClick={() => {
                setSelectedClient(null);
                setDialogOpen(true);
              }}
              className="gap-2 h-10 sm:h-11 px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="inline">Novo {activeTab === 'cliente' ? 'Cliente' : 'Fornecedor'}</span>
            </Button>
          </div>
        </div>

        {/* Search */}
        <div data-tutorial="clientes-search" className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por nome, CPF/CNPJ, cidade..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              {searchTerm ? `Nenhum ${activeTab === 'cliente' ? 'cliente' : 'fornecedor'} encontrado` : `Nenhum ${activeTab === 'cliente' ? 'cliente' : 'fornecedor'} cadastrado`}
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
                Cadastrar Primeiro {activeTab === 'cliente' ? 'Cliente' : 'Fornecedor'}
              </Button>
            )}
          </div>
        ) : (
          <>
            {viewMode === 'cards' ? (
              <ClientsCardView
                clients={pagination.paginatedData}
                onView={handleView}
                onDelete={handleDelete}
              />
            ) : (
              <ClientsTableView
                clients={pagination.paginatedData}
                onView={handleView}
                onDelete={handleDelete}
              />
            )}
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6">
                <PaginationControls
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  pageSize={pagination.pageSize}
                  onPageChange={pagination.setPage}
                  onPageSizeChange={pagination.setPageSize}
                />
              </div>
            )}
          </>
        )}
      </div>

      <Client360Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={selectedClient}
        defaultType={activeTab}
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
