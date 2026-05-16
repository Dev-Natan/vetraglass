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
      id: 'products',
      label: 'Importe produtos para sua empresa',
      description: 'Adicione produtos ao seu catálogo',
      completed: hasProducts,
      path: '/produtos',
      icon: Package,
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
      className="border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background animate-slide-up rounded-[2.5rem] shadow-xl overflow-hidden relative group"
      data-tutorial="onboarding-checklist"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
      
      <CardHeader className="pb-6 px-8 pt-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-[1.5rem] bg-primary/10 flex items-center justify-center border-2 border-primary/20 shadow-lg shadow-primary/5 transition-transform group-hover:rotate-6 duration-500">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black tracking-tight">Primeiros Passos 👋</CardTitle>
              <p className="text-muted-foreground text-sm mt-1 font-medium">
                Siga o roteiro para configurar seu <span className="text-primary font-black uppercase tracking-widest text-[10px]">Vetra Console</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-10 rounded-xl px-4 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/10 gap-2 border border-transparent hover:border-primary/20 transition-all"
              onClick={restartTutorial}
            >
              <PlayCircle className="w-4 h-4" />
              Tutorial
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
              onClick={dismissOnboarding}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        <div className="mt-8 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">
            <span>Progresso da Jornada</span>
            <span className="text-primary">{completedCount} / {items.length} ETAPAS</span>
          </div>
          <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden border border-border/40 p-0.5">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_hsl(var(--primary))]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                to={item.completed ? '#' : item.path}
                className={cn(
                  "flex items-center gap-5 p-6 rounded-[2rem] border-2 transition-all duration-500 relative overflow-hidden group/item",
                  item.completed 
                    ? 'bg-muted/40 border-transparent opacity-50 cursor-default scale-95' 
                    : 'bg-card border-border hover:border-primary/40 hover:shadow-xl hover:-translate-y-1'
                )}
                onClick={item.completed ? (e) => e.preventDefault() : undefined}
              >
                {!item.completed && (
                  <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover/item:scale-150 transition-transform duration-700" />
                )}
                
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all duration-500 group-hover/item:rotate-12",
                  item.completed 
                    ? 'bg-green-500 text-white' 
                    : 'bg-primary/5 text-primary group-hover/item:bg-primary group-hover/item:text-white group-hover/item:shadow-lg group-hover/item:shadow-primary/20'
                )}>
                  {item.completed ? (
                    <CheckCircle2 className="w-7 h-7" />
                  ) : (
                    <Icon className="w-7 h-7" />
                  )}
                </div>
                <div className="min-w-0 relative z-10">
                  <p className={cn(
                    "text-base font-black tracking-tight truncate transition-all duration-300",
                    item.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                  )}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1 font-bold uppercase tracking-widest truncate">
                    {item.description}
                  </p>
                </div>
                {!item.completed && (
                  <ArrowRight className="w-5 h-5 text-primary ml-auto opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all duration-300" />
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
