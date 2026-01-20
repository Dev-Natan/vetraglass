import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, Receipt, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ReceberEntradaDialog } from './ReceberEntradaDialog';

interface QuoteDeposit {
  id: string;
  quote_id: string;
  ordem_servico_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  amount: number;
  status: string;
  created_at: string;
  quotes?: {
    quote_number: number;
  };
  ordens_servico?: {
    os_number: number;
  };
}

interface PendingDepositsAlertProps {
  cashRegisterId: string;
}

export function PendingDepositsAlert({ cashRegisterId }: PendingDepositsAlertProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(true);
  const [selectedDeposit, setSelectedDeposit] = useState<QuoteDeposit | null>(null);
  const [receberDialogOpen, setReceberDialogOpen] = useState(false);

  const { data: pendingDeposits = [], isLoading } = useQuery({
    queryKey: ['pending-deposits', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('quote_deposits')
        .select(`
          id,
          quote_id,
          ordem_servico_id,
          customer_name,
          customer_phone,
          amount,
          status,
          created_at,
          quotes(quote_number),
          ordens_servico(os_number)
        `)
        .eq('company_id', currentCompany.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as QuoteDeposit[];
    },
    enabled: !!currentCompany?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleReceberClick = (deposit: QuoteDeposit) => {
    setSelectedDeposit(deposit);
    setReceberDialogOpen(true);
  };

  const handleReceberSuccess = () => {
    setReceberDialogOpen(false);
    setSelectedDeposit(null);
    queryClient.invalidateQueries({ queryKey: ['pending-deposits'] });
    queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
    queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
  };

  if (isLoading || pendingDeposits.length === 0) {
    return null;
  }

  const totalPending = pendingDeposits.reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <>
      <Card className="border-amber-500/50 bg-amber-500/10">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-base text-amber-800">
                    Entradas de Orçamento Pendentes
                  </CardTitle>
                  <Badge variant="secondary" className="bg-amber-600 text-white">
                    {pendingDeposits.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-amber-800">
                    Total: {formatCurrency(totalPending)}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-amber-600" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-amber-600" />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              <p className="text-sm text-amber-700 mb-4">
                Estes valores precisam ser recebidos antes de fechar o caixa.
              </p>
              
              <div className="space-y-3">
                {pendingDeposits.map((deposit) => (
                  <div
                    key={deposit.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200"
                  >
                    <div className="flex items-center gap-3">
                      <Receipt className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">
                          {deposit.customer_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {deposit.ordens_servico?.os_number 
                            ? `OS #${String(deposit.ordens_servico.os_number).padStart(4, '0')}`
                            : deposit.quotes?.quote_number 
                              ? `Orçamento #${String(deposit.quotes.quote_number).padStart(4, '0')}`
                              : 'Orçamento'
                          }
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-amber-800">
                        {formatCurrency(Number(deposit.amount))}
                      </span>
                      <Button 
                        size="sm" 
                        onClick={() => handleReceberClick(deposit)}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        Receber Entrada
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {selectedDeposit && (
        <ReceberEntradaDialog
          open={receberDialogOpen}
          onOpenChange={setReceberDialogOpen}
          deposit={selectedDeposit}
          cashRegisterId={cashRegisterId}
          onSuccess={handleReceberSuccess}
        />
      )}
    </>
  );
}
