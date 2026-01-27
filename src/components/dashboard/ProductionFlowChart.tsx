import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Factory } from 'lucide-react';
import { CACHE_TIMES } from '@/lib/queryConfig';

export function ProductionFlowChart() {
  const { currentCompany } = useAuth();
  const today = new Date();

  const { data: chartData, isLoading } = useQuery({
    queryKey: ['production-flow-chart', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const days: { date: string; label: string; abertas: number; finalizadas: number }[] = [];
      
      for (let i = 6; i >= 0; i--) {
        const day = subDays(today, i);
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);

        // OS abertas nesse dia
        const { data: opened } = await supabase
          .from('ordens_servico')
          .select('id')
          .eq('company_id', currentCompany.id)
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString());

        // OS finalizadas nesse dia
        const { data: completed } = await supabase
          .from('ordens_servico')
          .select('id')
          .eq('company_id', currentCompany.id)
          .eq('status', 'completed')
          .gte('updated_at', dayStart.toISOString())
          .lte('updated_at', dayEnd.toISOString());

        days.push({
          date: format(day, 'yyyy-MM-dd'),
          label: format(day, 'EEE', { locale: ptBR }),
          abertas: opened?.length || 0,
          finalizadas: completed?.length || 0,
        });
      }

      return days;
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });

  const totalOpened = chartData?.reduce((sum, d) => sum + d.abertas, 0) || 0;
  const totalCompleted = chartData?.reduce((sum, d) => sum + d.finalizadas, 0) || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Factory className="h-4 w-4 text-primary" />
            Fluxo de Produção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Factory className="h-4 w-4 text-primary" />
            Fluxo de Produção - 7 dias
          </CardTitle>
          <div className="flex gap-3 text-xs">
            <span className="text-muted-foreground">
              Abertas: <span className="font-semibold text-blue-600">{totalOpened}</span>
            </span>
            <span className="text-muted-foreground">
              Finalizadas: <span className="font-semibold text-emerald-600">{totalCompleted}</span>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="label" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar 
                dataKey="abertas" 
                name="Abertas" 
                fill="hsl(217, 91%, 60%)" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="finalizadas" 
                name="Finalizadas" 
                fill="hsl(142, 71%, 45%)" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
