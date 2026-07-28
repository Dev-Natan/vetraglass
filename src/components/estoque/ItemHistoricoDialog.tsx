import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  Factory,
  Wrench,
  FileText,
  History,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const motivoLabels: Record<string, string> = {
  compra: 'Compra',
  compra_fornecedor: 'Compra (NF)',
  venda: 'Venda',
  uso_interno: 'Uso Interno',
  perda: 'Perda/Quebra',
  devolucao_cliente: 'Dev. Cliente',
  devolucao_fornecedor: 'Dev. Fornecedor',
  ajuste_inventario: 'Ajuste',
  consumo_producao: 'Consumo em Produção',
  transferencia: 'Transferência',
  producao_sobra: 'Sobra de Produção',
  outro: 'Outro',
};

const refConfig: Record<string, { label: string; icon: React.ComponentType<any>; className: string }> = {
  purchase_order: { label: 'Compra', icon: ShoppingCart, className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  sale: { label: 'Venda', icon: FileText, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  ordem_servico: { label: 'OS', icon: Factory, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  manual: { label: 'Manual', icon: Wrench, className: 'bg-muted text-muted-foreground' },
};

interface ItemHistoricoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTemplateId: string | null;
  itemName: string;
  itemUnit?: string;
  itemImageUrl?: string | null;
}

export function ItemHistoricoDialog({
  open,
  onOpenChange,
  itemTemplateId,
  itemName,
  itemUnit = 'un',
  itemImageUrl,
}: ItemHistoricoDialogProps) {
  const { currentCompany } = useAuth();

  const { data: movimentos, isLoading } = useQuery({
    queryKey: ['stock-movements-item', currentCompany?.id, itemTemplateId],
    queryFn: async () => {
      if (!currentCompany?.id || !itemTemplateId) return [];
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          id, type, category, description, quantity, unit_cost, valor_financeiro,
          reference_id, reference_type, created_at,
          profiles:created_by (full_name)
        `)
        .eq('company_id', currentCompany.id)
        .eq('item_template_id', itemTemplateId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!currentCompany?.id && !!itemTemplateId,
  });

  const totalEntradas = (movimentos || []).filter(m => m.type === 'entrada').reduce((s, m) => s + Number(m.quantity || 0), 0);
  const totalSaidas = (movimentos || []).filter(m => m.type === 'saida').reduce((s, m) => s + Number(m.quantity || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {itemImageUrl ? (
              <img src={itemImageUrl} alt="" className="w-10 h-10 object-contain rounded border bg-white p-1" />
            ) : (
              <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center">
                <Package className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Histórico de Movimentações
              </div>
              <p className="text-sm font-normal text-muted-foreground">{itemName}</p>
            </div>
          </DialogTitle>
          <DialogDescription>
            Todas as entradas (compras, devoluções) e saídas (vendas, perdas, produção) registradas para este item.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-3">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-sm">
              <TrendingUp className="w-4 h-4" /> Total de Entradas
            </div>
            <p className="text-xl font-bold text-green-700 dark:text-green-300 mt-1">
              +{totalEntradas.toFixed(2)} {itemUnit}
            </p>
          </div>
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
              <TrendingDown className="w-4 h-4" /> Total de Saídas
            </div>
            <p className="text-xl font-bold text-red-700 dark:text-red-300 mt-1">
              -{totalSaidas.toFixed(2)} {itemUnit}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !movimentos || movimentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="w-12 h-12 text-muted-foreground/50 mb-3" />
            <h3 className="font-medium">Nenhuma movimentação</h3>
            <p className="text-sm text-muted-foreground">Este item ainda não possui histórico registrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead>Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentos.map((m) => {
                  const cfg = refConfig[m.reference_type || 'manual'] || refConfig.manual;
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        <div className="font-medium">{format(new Date(m.created_at), 'dd/MM/yyyy', { locale: ptBR })}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(m.created_at), 'HH:mm', { locale: ptBR })}</div>
                      </TableCell>
                      <TableCell>
                        {m.type === 'entrada' ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 gap-1">
                            <TrendingUp className="w-3 h-3" /> Entrada
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 gap-1">
                            <TrendingDown className="w-3 h-3" /> Saída
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${cfg.className} gap-1`}>
                          <Icon className="w-3 h-3" /> {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{motivoLabels[m.category] || m.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={m.type === 'entrada' ? 'text-green-600' : 'text-red-600'}>
                          {m.type === 'entrada' ? '+' : '-'}{Number(m.quantity).toFixed(2)} {itemUnit}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground text-sm">
                        {m.description || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {(m.profiles as any)?.full_name || 'Sistema'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
