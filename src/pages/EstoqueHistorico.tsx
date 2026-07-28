import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, History } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useStockData } from '@/hooks/useStockData';
import { HistoricoMovimentosTab } from '@/components/estoque/HistoricoMovimentosTab';

export default function EstoqueHistorico() {
  const { currentCompany } = useAuth();
  const { itemTemplates } = useStockData({ companyId: currentCompany?.id });

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/estoque"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <History className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Histórico de Movimentações</h1>
            <p className="text-sm text-muted-foreground">
              Registro completo de entradas e saídas de estoque — quem, quando, quanto e por quê.
            </p>
          </div>
        </div>

        <HistoricoMovimentosTab itemTemplates={itemTemplates || []} />
      </div>
    </MainLayout>
  );
}
