import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Search, 
  Package,
  Filter,
  ArrowUpDown,
  ShoppingCart,
  Factory,
  Wrench,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MonthSelector } from '@/components/common/MonthSelector';
import { startOfMonth, endOfMonth } from 'date-fns';

const motivoLabels: Record<string, string> = {
  compra: 'Compra',
  compra_fornecedor: 'Compra',
  venda: 'Venda',
  uso_interno: 'Uso Interno',
  perda: 'Perda/Quebra',
  devolucao_cliente: 'Dev. Cliente',
  devolucao_fornecedor: 'Dev. Fornecedor',
  ajuste_inventario: 'Ajuste',
  consumo_producao: 'Produção',
  transferencia: 'Transferência',
  outro: 'Outro',
};

// Configuração de badges por tipo de referência
const referenceConfig: Record<string, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>;
  className: string;
}> = {
  purchase_order: { 
    label: 'Compra', 
    icon: ShoppingCart, 
    className: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' 
  },
  sale: { 
    label: 'Venda', 
    icon: FileText, 
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' 
  },
  ordem_servico: { 
    label: 'Produção', 
    icon: Factory, 
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400' 
  },
  manual: { 
    label: 'Manual', 
    icon: Wrench, 
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400' 
  },
};

interface HistoricoMovimentosTabProps {
  itemTemplates: Array<{
    id: string;
    name: string;
    unit?: string;
    image_url?: string;
  }>;
}

export function HistoricoMovimentosTab({ itemTemplates }: HistoricoMovimentosTabProps) {
  const { currentCompany } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const dateRange = {
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth),
  };

  // Fetch movimentações usando os campos reais da tabela
  const { data: movimentos, isLoading } = useQuery({
    queryKey: ['stock-movements', currentCompany?.id, selectedMonth],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          id,
          company_id,
          type,
          category,
          description,
          item_template_id,
          company_item_id,
          reference_id,
          reference_type,
          quantity,
          original_quantity,
          original_unit,
          canonical_quantity,
          canonical_unit,
          created_by,
          created_at
        `)
        .eq('company_id', currentCompany.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const creatorIds = Array.from(new Set(
        rows.map(row => row.created_by).filter((id): id is string => !!id),
      ));
      const { data: creators } = creatorIds.length > 0
        ? await supabase.from('profiles').select('id, full_name').in('id', creatorIds)
        : { data: [] };
      const creatorNames = new Map(
        (creators || []).map(profile => [profile.id, profile.full_name]),
      );

      return rows.map(row => ({
        ...row,
        created_by_name: row.created_by ? creatorNames.get(row.created_by) : null,
      }));
    },
    enabled: !!currentCompany?.id,
  });

  // Combinar com templates para ter nome do item
  const movimentosComNome = useMemo(() => {
    return (movimentos || []).map(mov => {
      const template = itemTemplates.find(t => t.id === mov.item_template_id);
      return {
        ...mov,
        item_name: template?.name || 'Item desconhecido',
        item_unit: template?.unit || 'un',
        item_image: template?.image_url,
      };
    });
  }, [movimentos, itemTemplates]);

  // Filtrar
  const filteredMovimentos = useMemo(() => {
    return movimentosComNome.filter(mov => {
      const isEntrada = mov.type === 'entrada';
      const isSaida = mov.type === 'saida';
      const matchesTipo = tipoFilter === 'all' || 
        (tipoFilter === 'in' && isEntrada) || 
        (tipoFilter === 'out' && isSaida);
      const matchesSearch = !searchTerm || 
        mov.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (mov.description && mov.description.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesTipo && matchesSearch;
    });
  }, [movimentosComNome, tipoFilter, searchTerm]);

  // Estatísticas
  const stats = useMemo(() => {
    const entradas = filteredMovimentos.filter(m => m.type === 'entrada');
    const saidas = filteredMovimentos.filter(m => m.type === 'saida');
    
    return {
      totalEntradas: entradas.length,
      totalSaidas: saidas.length,
      qtdEntradas: entradas.reduce((sum, m) => sum + (m.quantity || 0), 0),
      qtdSaidas: saidas.reduce((sum, m) => sum + (m.quantity || 0), 0),
    };
  }, [filteredMovimentos]);

  return (
    <div className="space-y-4">
      {/* Filtros e Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 dark:text-green-400">Entradas</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {stats.totalEntradas}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 dark:text-red-400">Saídas</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {stats.totalSaidas}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <MonthSelector
                selectedDate={selectedMonth}
                onMonthChange={setSelectedMonth}
                className="flex-shrink-0"
              />
              
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar item ou observação..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="in">Entradas</SelectItem>
                  <SelectItem value="out">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Movimentações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Histórico de Movimentações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredMovimentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-1">Nenhuma movimentação</h3>
              <p className="text-sm text-muted-foreground">
                Não há movimentações registradas para este período.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovimentos.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell className="whitespace-nowrap">
                        <div>
                          <p className="font-medium">
                            {format(new Date(mov.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(mov.created_at), 'HH:mm', { locale: ptBR })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {mov.type === 'entrada' ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Entrada
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 gap-1">
                            <TrendingDown className="h-3 w-3" />
                            Saída
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const refType = mov.reference_type || 'manual';
                          const config = referenceConfig[refType] || referenceConfig.manual;
                          const IconComponent = config.icon;
                          return (
                            <Badge className={`${config.className} gap-1`}>
                              <IconComponent className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {mov.item_image ? (
                            <img 
                              src={mov.item_image} 
                              alt="" 
                              className="w-8 h-8 object-contain rounded"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-muted-foreground" />
                          )}
                          <span className="font-medium">{mov.item_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={mov.type === 'entrada' ? 'text-green-600' : 'text-red-600'}>
                          {mov.type === 'entrada' ? '+' : '-'}
                          {mov.original_quantity ?? mov.quantity}{' '}
                          {mov.original_unit || mov.item_unit}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {motivoLabels[mov.category] || mov.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {mov.description || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {mov.created_by_name || 'Sistema'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
