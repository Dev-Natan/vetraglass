import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  FileText, 
  DollarSign, 
  Eye, 
  Phone, 
  Calendar,
  X,
  AlertTriangle
} from 'lucide-react';
import { useCompanyNotifications } from '@/hooks/useCompanyNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function SystemReminders() {
  const navigate = useNavigate();
  const { 
    notifications, 
    markAsRead, 
    markActionTaken,
    isLoading 
  } = useCompanyNotifications();
  
  const [dismissing, setDismissing] = useState<string | null>(null);

  // Filtrar lembretes por tipo
  const quoteReminders = notifications.filter(n => n.type === 'quote_expiring');
  const overdueReminders = notifications.filter(n => n.type === 'overdue_receivable');
  const totalReminders = quoteReminders.length + overdueReminders.length;

  if (isLoading || totalReminders === 0) {
    return null;
  }

  const handleViewQuote = async (notification: typeof notifications[0]) => {
    await markAsRead(notification.id);
    const quoteId = notification.metadata?.quote_id as string;
    if (quoteId) {
      navigate(`/orcamentos?view=${quoteId}`);
    } else {
      navigate('/orcamentos');
    }
  };

  const handleViewReceivable = async (notification: typeof notifications[0]) => {
    await markAsRead(notification.id);
    navigate('/financeiro?tab=receber');
  };

  const handleContact = async (notification: typeof notifications[0]) => {
    await markAsRead(notification.id);
    // Ação manual - apenas marca como lida
  };

  const handleDismiss = async (notificationId: string) => {
    setDismissing(notificationId);
    try {
      await markActionTaken(notificationId);
    } finally {
      setDismissing(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-warning" />
          Lembretes do Sistema
          <Badge variant="secondary" className="bg-warning/20 text-warning-foreground">
            {totalReminders}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={quoteReminders.length > 0 ? 'quotes' : 'overdue'} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="quotes" className="gap-2">
              <FileText className="h-4 w-4" />
              Orçamentos
              {quoteReminders.length > 0 && (
                <Badge variant="outline" className="ml-1 h-5 px-1.5">
                  {quoteReminders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="overdue" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Cobranças
              {overdueReminders.length > 0 && (
                <Badge variant="outline" className="ml-1 h-5 px-1.5">
                  {overdueReminders.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="space-y-3 mt-0">
            {quoteReminders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum orçamento próximo ao vencimento
              </p>
            ) : (
              quoteReminders.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start justify-between gap-3 p-3 bg-background rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                      <span className="font-medium text-sm truncate">
                        {notification.title}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vence em {formatDate(notification.metadata?.valid_until as string)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleViewQuote(notification)}
                      title="Ver Orçamento"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleContact(notification)}
                      title="Contatar Cliente"
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDismiss(notification.id)}
                      disabled={dismissing === notification.id}
                      title="Descartar"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {quoteReminders.length > 5 && (
              <Button 
                variant="link" 
                className="w-full text-sm"
                onClick={() => navigate('/orcamentos')}
              >
                Ver todos os {quoteReminders.length} orçamentos
              </Button>
            )}
          </TabsContent>

          <TabsContent value="overdue" className="space-y-3 mt-0">
            {overdueReminders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma cobrança atrasada há mais de 15 dias
              </p>
            ) : (
              overdueReminders.slice(0, 5).map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start justify-between gap-3 p-3 bg-background rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="h-4 w-4 text-destructive flex-shrink-0" />
                      <span className="font-medium text-sm truncate">
                        {notification.title}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Vencimento: {formatDate(notification.metadata?.due_date as string)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleViewReceivable(notification)}
                      title="Ver Detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleContact(notification)}
                      title="Contatar Cliente"
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDismiss(notification.id)}
                      disabled={dismissing === notification.id}
                      title="Descartar"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {overdueReminders.length > 5 && (
              <Button 
                variant="link" 
                className="w-full text-sm"
                onClick={() => navigate('/financeiro?tab=receber')}
              >
                Ver todas as {overdueReminders.length} cobranças
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
