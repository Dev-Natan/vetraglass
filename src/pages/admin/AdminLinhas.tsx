import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Package, Search, Trash2, Download, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { LinhaCard } from '@/components/produtos/LinhaCard';
import { AddLinhaCard } from '@/components/produtos/AddLinhaCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AdminLinhas() {
  const { isSaasAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLinhaName, setNewLinhaName] = useState('');

  // Fetch unique linhas with product count
  const { data: linhas, isLoading } = useQuery({
    queryKey: ['admin-product-linhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('linha');
      
      if (error) throw error;
      
      // Group by linha and count
      const linhaMap = new Map<string, number>();
      data?.forEach((item) => {
        const linha = item.linha || 'Sem Linha';
        linhaMap.set(linha, (linhaMap.get(linha) || 0) + 1);
      });
      
      return Array.from(linhaMap.entries())
        .map(([linha, count]) => ({ linha, count }))
        .sort((a, b) => a.linha.localeCompare(b.linha));
    },
  });

  // Create a placeholder product to create a new linha
  const createLinhaMutation = useMutation({
    mutationFn: async (linhaName: string) => {
      // Check if linha already exists
      const exists = linhas?.some(l => l.linha.toLowerCase() === linhaName.toLowerCase());
      if (exists) {
        throw new Error('Esta linha já existe');
      }
      
      // Create a placeholder product template with this linha
      const { error } = await supabase
        .from('product_templates')
        .insert({
          name: `Novo Produto - ${linhaName}`,
          category: 'other',
          linha: linhaName,
          is_active: false,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-linhas'] });
      toast.success('Linha criada com sucesso!');
      setIsDialogOpen(false);
      setNewLinhaName('');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAddLinha = () => {
    setIsDialogOpen(true);
  };

  const handleCreateLinha = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinhaName.trim()) {
      toast.error('Digite o nome da linha');
      return;
    }
    createLinhaMutation.mutate(newLinhaName.trim());
  };

  const handleViewProducts = (linha: string) => {
    navigate(`/admin/linhas/${encodeURIComponent(linha)}`);
  };

  const handleDeleteLinha = (linha: string) => {
    // TODO: Implement delete confirmation and logic
    toast.info(`Funcionalidade de exclusão será implementada em breve`);
  };

  const filteredLinhas = linhas?.filter(
    (item) => item.linha.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isSaasAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-8 h-8 text-primary" />
              Linhas de Produtos
            </h1>
            <p className="text-muted-foreground">
              Gerencie as linhas de produtos do sistema
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar linhas..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-52 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <AddLinhaCard onClick={handleAddLinha} />
            {filteredLinhas?.map((item) => (
              <LinhaCard
                key={item.linha}
                linha={item.linha}
                productCount={item.count}
                onViewProducts={() => handleViewProducts(item.linha)}
                onDelete={() => handleDeleteLinha(item.linha)}
                isAdmin
              />
            ))}
          </div>
        )}

        {/* Bottom actions bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4">
          <div className="container mx-auto flex justify-center gap-12">
            <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Trash2 className="w-5 h-5" />
              <span className="text-xs">Lixeira</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Search className="w-5 h-5" />
              <span className="text-xs">Buscar</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
              <Download className="w-5 h-5" />
              <span className="text-xs">Baixar tipologias</span>
            </button>
          </div>
        </div>

        {/* Add Linha Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Linha de Produtos</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateLinha} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="linha-name">Nome da Linha</Label>
                <Input
                  id="linha-name"
                  placeholder="Ex: Linha Suprema"
                  value={newLinhaName}
                  onChange={(e) => setNewLinhaName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createLinhaMutation.isPending}>
                  {createLinhaMutation.isPending ? 'Criando...' : 'Criar Linha'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
