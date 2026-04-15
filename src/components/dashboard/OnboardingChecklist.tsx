import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  Circle, 
  Users, 
  Package, 
  ShoppingCart, 
  FileText,
  Sparkles,
  X,
  PlayCircle
} from 'lucide-react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { useTutorial } from '@/contexts/TutorialContext';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  path: string;
  icon: typeof Users;
}

export function OnboardingChecklist() {
  const { 
    hasClients, 
    hasProducts, 
    hasFirstSale, 
    hasFirstQuote, 
    isComplete,
    isLoading,
    isDismissed,
    dismissOnboarding 
  } = useOnboardingStatus();

  const { restartTutorial } = useTutorial();

  // Don't show if loading, complete, or dismissed
  if (isLoading || isComplete || isDismissed) {
    return null;
  }

  const items: ChecklistItem[] = [
    {
      id: 'clients',
      label: 'Cadastre seu primeiro cliente',
      description: 'Comece criando sua base de clientes',
      completed: hasClients,
      path: '/clientes?novo=true',
      icon: Users,
    },
    {
      id: 'quote',
      label: 'Crie seu primeiro orçamento',
      description: 'Gere um orçamento para um cliente',
      completed: hasFirstQuote,
      path: '/orcamentos?novo=true',
      icon: FileText,
    },
    {
      id: 'sale',
      label: 'Realize sua primeira venda',
      description: 'Finalize uma venda no caixa',
      completed: hasFirstSale,
      path: '/caixa-vendas?novo=true',
      icon: ShoppingCart,
    },
  ];

  const completedCount = items.filter(i => i.completed).length;
  const progressPercent = (completedCount / items.length) * 100;

  return (
    <Card 
      className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background animate-fade-in"
      data-tutorial="onboarding-checklist"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Bem-vindo ao VetraGlass! 👋</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Complete os passos abaixo para começar
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={restartTutorial}
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Ver Tutorial
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={dismissOnboarding}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{completedCount} de {items.length} concluídos</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                to={item.completed ? '#' : item.path}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  item.completed 
                    ? 'bg-muted/30 border-border/50 opacity-60 cursor-default' 
                    : 'bg-card border-border hover:border-primary/30 hover:bg-primary/5'
                }`}
                onClick={item.completed ? (e) => e.preventDefault() : undefined}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  item.completed 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-primary/10 text-primary'
                }`}>
                  {item.completed ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    item.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                  }`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
