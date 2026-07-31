import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Sparkles, LogOut, RefreshCw, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';


interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

const plans: Plan[] = [
  {
    id: 'basico',
    name: 'Start',
    price: 'R$ 149,90',
    period: '/mês',
    description: 'Para vidraçarias começando a digitalizar.',
    features: [
      'Orçamentos e Ordens de Serviço',
      'Cadastro de clientes e estoque',
      'Plano de corte automático',
      'Até 3 usuários',
      'Suporte por e-mail',
    ],
  },
  {
    id: 'fiscal',
    name: 'Fiscal',
    price: 'R$ 249,90',
    period: '/mês',
    description: 'Para vidraçarias que precisam de gestão fiscal completa.',
    features: [
      'Tudo do plano Start',
      'Emissão de NF-e e NFC-e',
      'Financeiro completo + Caixa',
      'Relatórios avançados',
      'Usuários ilimitados',
      'Suporte prioritário',
    ],
    highlighted: true,
  },
];

export default function Planos() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentCompany, signOut, isSaasAdmin } = useAuth();
  const { allowed, isFetching, refetch } = useSubscriptionAccess(currentCompany?.id);

  // Só redireciona automaticamente quem chegou aqui pelo bloqueio por assinatura.
  const fromBlock = (location.state as { fromBlock?: boolean } | null)?.fromBlock === true;

  useEffect(() => {
    if (fromBlock && allowed && !isSaasAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [fromBlock, allowed, isSaasAdmin, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const hasActiveAccess = allowed || isSaasAdmin;

  return (
    <div className="relative min-h-screen bg-muted/30 p-4 sm:p-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/5 to-transparent" />
      <div className="relative max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-8">
          <div className="flex flex-wrap items-center gap-2">
            {hasActiveAccess && (
              <Button onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Painel
              </Button>
            )}
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Verificar assinatura
            </Button>
          </div>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair do sistema
          </Button>
        </div>

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Sparkles className="h-3 w-3" />
            Escolha seu plano
          </div>
          <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight text-foreground">
            Planos Vetra
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            {hasActiveAccess
              ? 'Você já possui uma assinatura ativa. Compare os planos quando quiser.'
              : 'Continue usando o Vetra sem interrupções após o teste grátis.'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 items-start">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative rounded-2xl transition-all duration-300 hover:-translate-y-1 ${
                plan.highlighted
                  ? 'border-primary/60 shadow-2xl shadow-primary/10 md:scale-[1.03] bg-card'
                  : 'border-border/60 shadow-lg shadow-foreground/5 bg-card/80'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold uppercase tracking-wide shadow-md">
                  <Sparkles className="h-3 w-3" />
                  Mais popular
                </div>
              )}
              <CardHeader className="p-8 pb-4 text-left">
                <CardTitle className="text-2xl tracking-tight">{plan.name}</CardTitle>
                <CardDescription className="min-h-[40px]">{plan.description}</CardDescription>
                <div className="flex items-baseline gap-1.5 pt-4">
                  <span className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-2 space-y-6">
                <div className="h-px bg-border/70" />
                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          plan.highlighted ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className="text-foreground/90 leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full h-11 rounded-xl"
                  variant={plan.highlighted ? 'default' : 'outline'}
                  disabled
                >
                  Em breve via Stripe
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          Os links de checkout serão integrados ao Stripe em breve.
        </p>
      </div>
    </div>
  );
}
