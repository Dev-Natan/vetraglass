import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ClipboardCheck, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  User, 
  Clock,
  ChevronRight 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCashAudits } from '@/hooks/useCashAudits';
import { AuditCashClosingDialog } from './AuditCashClosingDialog';

interface CashAudit {
  id: string;
  cash_register_id: string;
  operator_id: string;
  operator_name: string;
  total_counted: number;
  expected_amount: number;
  difference: number;
  operator_notes: string | null;
  submitted_at: string;
  counts_submitted: Array<{ payment_method: string; amount: number }>;
}

export function PendingAuditsCard() {
  const { pendingAudits, loadingAudits, completeAudit, isCompletingAudit } = useCashAudits();
  const [selectedAudit, setSelectedAudit] = useState<CashAudit | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleOpenAudit = (audit: CashAudit) => {
    setSelectedAudit(audit);
    setDialogOpen(true);
  };

  const handleApprove = async (auditId: string, notes?: string, adjustmentAmount?: number) => {
    await completeAudit({
      auditId,
      action: adjustmentAmount ? 'adjusted' : 'approved',
      notes,
      adjustmentAmount,
    });
  };

  const handleReject = async (auditId: string, notes: string) => {
    await completeAudit({
      auditId,
      action: 'rejected',
      notes,
    });
  };

  if (loadingAudits) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Auditorias Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const audits = pendingAudits?.audits || [];

  if (audits.length === 0) {
    return null; // Não mostrar card se não houver auditorias pendentes
  }

  return (
    <>
      <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Fechamentos Aguardando Auditoria
            </span>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
              {audits.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {audits.map((audit) => (
            <div 
              key={audit.id} 
              className="rounded-lg border bg-background p-3 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate">{audit.operator_name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(audit.submitted_at), "HH:mm", { locale: ptBR })}
                  </span>
                  <span>|</span>
                  <span>Contado: {formatCurrency(audit.total_counted)}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge 
                  variant={audit.difference === 0 ? 'default' : audit.difference > 0 ? 'secondary' : 'destructive'}
                  className="flex items-center gap-1"
                >
                  {audit.difference === 0 ? null : audit.difference > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {audit.difference >= 0 ? '+' : ''}{formatCurrency(audit.difference)}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleOpenAudit(audit)}
                >
                  Revisar
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AuditCashClosingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        audit={selectedAudit}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={isCompletingAudit}
      />
    </>
  );
}
