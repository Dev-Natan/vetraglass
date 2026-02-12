import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  ArrowRight, 
  BarChart3, 
  Package, 
  FileText, 
  Users, 
  Calculator, 
  Scissors,
  Shield,
  Zap,
  Clock,
  Smartphone,
  Star,
  Check
} from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Orçamentos Profissionais',
    description: 'Crie orçamentos detalhados com cálculo automático de materiais e preços por m².'
  },
  {
    icon: Scissors,
    title: 'Plano de Corte Inteligente',
    description: 'Otimização automática de cortes de perfis e vidros para reduzir desperdício.'
  },
  {
    icon: Package,
    title: 'Controle de Estoque',
    description: 'Gestão completa de perfis, vidros, acessórios com alertas de estoque mínimo.'
  },
  {
    icon: Calculator,
    title: 'Financeiro Integrado',
    description: 'Caixa, contas a receber, despesas e comissões em um só lugar.'
  },
  {
    icon: Users,
    title: 'Gestão de Clientes',
    description: 'Cadastro completo com histórico de compras e geolocalização.'
  },
  {
    icon: BarChart3,
    title: 'Relatórios e Métricas',
    description: 'Dashboards com KPIs, gráficos de vendas e análises de desempenho.'
  },
];

const plans = [
  {
    name: 'Inicial',
    description: 'Para pequenas vidraçarias',
    features: [
      'Até 2 usuários',
      'Orçamentos ilimitados',
      'Controle de estoque básico',
      'Suporte por email',
    ],
    highlighted: false,
  },
  {
    name: 'Profissional',
    description: 'Para vidraçarias em crescimento',
    features: [
      'Até 5 usuários',
      'Tudo do Inicial +',
      'Plano de corte otimizado',
      'Financeiro completo',
      'Relatórios avançados',
      'Suporte prioritário',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    description: 'Para grandes operações',
    features: [
      'Usuários ilimitados',
      'Tudo do Profissional +',
      'Multi-filiais',
      'API de integração',
      'Suporte dedicado',
      'Treinamento incluído',
    ],
    highlighted: false,
  },
];

const testimonials = [
  {
    name: 'Carlos Silva',
    role: 'Proprietário - Vidraçaria São Paulo',
    content: 'Reduzi em 30% o desperdício de material com o plano de corte. O sistema se pagou no primeiro mês!',
    rating: 5,
  },
  {
    name: 'Ana Rodrigues',
    role: 'Gerente - Vidros Premium',
    content: 'A gestão financeira integrada me deu visibilidade total do negócio. Recomendo demais!',
    rating: 5,
  },
  {
    name: 'Roberto Almeida',
    role: 'Diretor - Glass Tech',
    content: 'Orçamentos profissionais em minutos. Meus clientes ficam impressionados com a qualidade.',
    rating: 5,
  },
];

export default function Landing() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Vetra",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description": "Sistema completo de gestão para vidraçarias: orçamentos, ordens de serviço, estoque, financeiro, agenda e muito mais.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "BRL",
      "description": "Teste 14 dias grátis"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "5",
      "reviewCount": "3"
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl font-display">V</span>
            </div>
            <span className="font-display text-2xl font-bold text-foreground">Vetra</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Funcionalidades
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Planos
            </a>
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Depoimentos
            </a>
          </nav>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/auth?tab=signup">
                Começar Grátis
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main>
      <section className="relative overflow-hidden py-20 md:py-32" aria-label="Apresentação">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center animate-fade-in">
            <Badge variant="secondary" className="mb-4">
              <Zap className="w-3 h-3 mr-1" />
              Sistema completo para vidraçarias
            </Badge>
            <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
              Gerencie sua vidraçaria com{' '}
              <span className="text-primary">inteligência</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Orçamentos, plano de corte, estoque, financeiro e muito mais. 
              Tudo que você precisa para crescer seu negócio em uma única plataforma.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link to="/auth?tab=signup">
                  Teste 14 dias grátis
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <a href="#features">
                  Ver funcionalidades
                </a>
              </Button>
            </div>
            
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                <span>Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                <span>Suporte incluso</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                <span>Cancele quando quiser</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y bg-muted/30">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="animate-fade-in">
              <div className="text-3xl md:text-4xl font-bold text-primary font-display">500+</div>
              <div className="text-sm text-muted-foreground mt-1">Vidraçarias ativas</div>
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="text-3xl md:text-4xl font-bold text-primary font-display">50k+</div>
              <div className="text-sm text-muted-foreground mt-1">Orçamentos gerados</div>
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="text-3xl md:text-4xl font-bold text-primary font-display">30%</div>
              <div className="text-sm text-muted-foreground mt-1">Menos desperdício</div>
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="text-3xl md:text-4xl font-bold text-primary font-display">99.9%</div>
              <div className="text-sm text-muted-foreground mt-1">Uptime garantido</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32" aria-label="Funcionalidades">
        <div className="container">
          <div className="text-center mb-16 animate-fade-in">
            <Badge variant="secondary" className="mb-4">Funcionalidades</Badge>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Tudo que sua vidraçaria precisa
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Desenvolvido por quem entende do setor, com funcionalidades específicas 
              para otimizar cada etapa do seu negócio.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={feature.title} 
                className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          
          {/* Additional Benefits */}
          <div className="mt-16 grid md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 animate-fade-in">
              <Shield className="w-8 h-8 text-primary" />
              <div>
                <div className="font-semibold text-sm">Dados Seguros</div>
                <div className="text-xs text-muted-foreground">Criptografia de ponta</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <Clock className="w-8 h-8 text-primary" />
              <div>
                <div className="font-semibold text-sm">Backup Diário</div>
                <div className="text-xs text-muted-foreground">Seus dados protegidos</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <Smartphone className="w-8 h-8 text-primary" />
              <div>
                <div className="font-semibold text-sm">100% Responsivo</div>
                <div className="text-xs text-muted-foreground">Acesse de qualquer lugar</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <Zap className="w-8 h-8 text-primary" />
              <div>
                <div className="font-semibold text-sm">Atualizações</div>
                <div className="text-xs text-muted-foreground">Novidades constantes</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-32 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16 animate-fade-in">
            <Badge variant="secondary" className="mb-4">Planos</Badge>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Escolha o plano ideal
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Planos flexíveis que crescem junto com seu negócio. 
              Comece grátis e faça upgrade quando quiser.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={plan.name}
                className={`relative animate-fade-in ${
                  plan.highlighted 
                    ? 'border-primary shadow-lg scale-105' 
                    : ''
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Mais Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-success flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.highlighted ? 'default' : 'outline'}
                    asChild
                  >
                    <Link to="/auth?tab=signup">
                      Começar agora
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 md:py-32">
        <div className="container">
          <div className="text-center mb-16 animate-fade-in">
            <Badge variant="secondary" className="mb-4">Depoimentos</Badge>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              O que nossos clientes dizem
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Centenas de vidraçarias já transformaram sua gestão com o Vetra.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={testimonial.name}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-foreground mb-4">&ldquo;{testimonial.content}&rdquo;</p>
                  <div className="border-t pt-4">
                    <div className="font-semibold text-sm">{testimonial.name}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      </main>

      {/* CTA Section */}
      <section className="py-20 md:py-32 bg-primary text-primary-foreground" aria-label="Chamada para ação">
        <div className="container text-center animate-fade-in">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Pronto para transformar sua vidraçaria?
          </h2>
          <p className="text-primary-foreground/80 max-w-2xl mx-auto mb-8">
            Junte-se a centenas de vidraçarias que já otimizaram sua gestão. 
            Comece hoje com 14 dias grátis, sem compromisso.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              variant="secondary" 
              asChild
              className="w-full sm:w-auto"
            >
              <Link to="/auth?tab=signup">
                Criar conta gratuita
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              asChild
              className="w-full sm:w-auto border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link to="/auth">
                Já tenho conta
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold font-display">V</span>
                </div>
                <span className="font-display text-xl font-bold text-foreground">Vetra</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Sistema completo de gestão para vidraçarias modernas.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-sm">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Planos</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Atualizações</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-sm">Suporte</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Central de Ajuda</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contato</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Status</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Privacidade</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Cookies</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div>© {new Date().getFullYear()} Vetra. Todos os direitos reservados.</div>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-foreground transition-colors">Instagram</a>
              <a href="#" className="hover:text-foreground transition-colors">LinkedIn</a>
              <a href="#" className="hover:text-foreground transition-colors">YouTube</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
