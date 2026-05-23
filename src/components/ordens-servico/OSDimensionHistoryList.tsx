import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, User, Ruler } from 'lucide-react';

interface OSDimensionHistoryListProps {
  ordemServicoId: string;
}

export function OSDimensionHistoryList({ ordemServicoId }: OSDimensionHistoryListProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['os-dimension-history-all', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('os_dimension_history')
        .select(`
          *,
          os_items!inner(os_id, product_name),
          profiles(full_name)
        `)
        .eq('os_items.os_id', ordemServicoId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div className="p-8 text-center">Carregando histórico...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5" />
            Histórico Completo de Ajustes Técnicos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!logs?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum ajuste técnico registrado para esta OS.
            </div>
          ) : (
            <div className="relative border-l-2 border-muted ml-3 pl-6 space-y-8">
              {logs.map((log: any) => (
                <div key={log.id} className="relative">
                  <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <User className="w-3 h-3" />
                        {log.profiles?.full_name || 'Usuário'}
                      </span>
                      <span>•</span>
                      <span>{format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                    <div className="font-semibold text-sm">
                      {log.os_items?.product_name}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Ruler className="w-3 h-3 text-muted-foreground" />
                      <span>
                        {log.field === 'largura_producao' ? 'Largura A' : 
                         log.field === 'altura_producao' ? 'Altura A' :
                         log.field === 'largura_producao_b' ? 'Largura B' :
                         log.field === 'altura_producao_b' ? 'Altura B' :
                         log.field === 'largura_producao_c' ? 'Largura C' :
                         log.field === 'altura_producao_c' ? 'Altura C' : log.field} alterada: 
                      </span>
                      <span className="text-muted-foreground line-through">{log.previous_value}mm</span>
                      <span className="text-primary font-bold">→ {log.new_value}mm</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
