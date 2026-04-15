import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Package, Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useProductLinhas, useProductLinhaMutations } from '@/hooks/useProductLinhas';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function AdminLinhas() {
  const { isSaasAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLinhaName, setNewLinhaName] = useState('');
  
  // Use centralized hook for linhas
  const { data: linhas, isLoading } = useProductLinhas(true);
  const { createMutation } = useProductLinhaMutations();
  
  // Fetch product counts per linha
  const { data: productCounts } = useQuery({
    queryKey: ['admin-product-counts-per-linha'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('linha');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach((item) => {
        const linha = item.linha || '';
        counts[linha] = (counts[linha] || 0) + 1;
      });
      
      return counts;
    },
  });

  const handleAddLinha = () => {
    setIsDialogOpen(true);
  };

  const handleCreateLinha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinhaName.trim()) {
      toast.error('Digite o nome da linha');
      return;
    }
    
    // Generate slug from name
    const slug = newLinhaName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    
    try {
      await createMutation.mutateAsync({
        slug,
        name: newLinhaName.trim(),
        description: null,
        image_url: null,
        color: '#6B7280',
        sort_order: (linhas?.length ?? 0) + 1,
        is_active: true,
      });
      toast.success('Linha criada com sucesso!');
      setIsDialogOpen(false);
      setNewLinhaName('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar linha');
    }
  };

  const handleLinhaClick = (linha: string) => {
    navigate(`/admin/product-templates/${encodeURIComponent(linha)}`);
  };

  const filteredLinhas = linhas?.filter(
    (linha) => linha.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isSaasAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>Você não tem permissão para acessar esta página.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-6 w-6" />
              Linhas de Produtos
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie as linhas de produtos do sistema
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar linhas..."
                className="pl-9 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={handleAddLinha}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Linha
            </Button>
          </div>
        </div>

        {/* Linhas Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredLinhas?.map((linha) => (
              <LinhaCard
                key={linha.id}
                linha={linha.name}
                productCount={productCounts?.[linha.name] || 0}
                onViewProducts={() => handleLinhaClick(linha.name)}
              />
            ))}
            <AddLinhaCard onClick={handleAddLinha} />
          </div>
        )}
      </div>

      {/* Create Linha Dialog */}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Criando...' : 'Criar Linha'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
