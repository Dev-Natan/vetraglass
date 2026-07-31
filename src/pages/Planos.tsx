import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Sparkles, LogOut, RefreshCw } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-sidebar via-background to-background p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-2 mb-4">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Verificar assinatura
          </Button>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair do sistema
          </Button>
        </div>


        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
            <Sparkles className="h-3 w-3" />
            Escolha seu plano
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-foreground">
            Planos Vetra
          </h1>
          <p className="text-muted-foreground mt-2">
            {currentCompany?.subscription_status === 'active'
              ? 'Você já possui uma assinatura ativa.'
              : 'Continue usando o Vetra sem interrupções após o teste grátis.'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${
                plan.highlighted ? 'border-primary shadow-xl ring-1 ring-primary/30' : 'border-border/50'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  Mais popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="flex items-baseline gap-1 pt-2">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlighted ? 'default' : 'outline'}
                  disabled
                >
                  Em breve via Stripe
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Os links de checkout serão integrados ao Stripe em breve.
        </p>
      </div>
    </div>
  );
}
