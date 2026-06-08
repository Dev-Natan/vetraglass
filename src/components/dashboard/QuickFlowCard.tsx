import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  FileText, 
  ShoppingCart, 
  ClipboardList, 
  Scissors,
  ChevronRight,
  Workflow
} from 'lucide-react';

const flowSteps = [
  { icon: Users, label: 'Cliente' },
  { icon: FileText, label: 'Orçamento' },
  { icon: ShoppingCart, label: 'Venda' },
  { icon: ClipboardList, label: 'OS' },
  { icon: Scissors, label: 'Produção' },
];

const quickFlowActions = [
  { label: 'Criar Venda', path: '/caixa-vendas?novo=true', variant: 'default' as const },
  { label: 'Acompanhar OS', path: '/ordens-servico', variant: 'outline' as const },
  { label: 'Plano de Corte', path: '/ordens-servico?tab=plano-corte', variant: 'outline' as const },
];

export const QuickFlowCard = memo(function QuickFlowCard() {
  return (
    <Card className="bg-gradient-to-r from-muted/30 to-muted/10 border-border/50">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Flow Visualization */}
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 mr-2">
              <Workflow className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Fluxo:</span>
            </div>
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 border border-border/50">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground hidden sm:inline">
                      {step.label}
                    </span>
                  </div>
                  {index < flowSteps.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-muted-foreground/50 mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {quickFlowActions.map((action) => (
              <Button
                key={action.label}
                variant={action.variant}
                size="sm"
                asChild
                className="text-xs"
              >
                <Link to={action.path}>{action.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
