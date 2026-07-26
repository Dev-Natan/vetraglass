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
    name: 'Start',
    price: 'R$ 149,90',
    period: '/mês',
    description: 'Gestão completa para sua vidraçaria',
    features: [
      'Até 5 usuários',
      'Orçamentos ilimitados',
      'Ordens de serviço',
      'Controle de estoque',
      'Plano de corte otimizado',
      'Financeiro completo (contas a pagar/receber)',
      'Caixa diário e caixa empresa',
      'Gestão de clientes',
      'Relatórios gerenciais',
      'Suporte por email e chat',
    ],
    highlighted: false,
  },
  {
    name: 'Fiscal',
    price: 'R$ 249,90',
    period: '/mês',
    description: 'Tudo do Start + funcionalidades fiscais',
    features: [
      'Tudo do plano Start +',
      'Emissão de NF-e e NFS-e',
      'Certificado digital integrado',
      'Configuração de regime tributário',
      'NCM, CFOP e CEST automáticos',
      'Ambiente de homologação e produção',
      'Relatórios fiscais detalhados',
      'Suporte prioritário',
    ],
    highlighted: true,
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
    "offers": [
      {
        "@type": "Offer",
        "price": "149.90",
        "priceCurrency": "BRL",
        "description": "Plano Start - Gestão completa"
      },
      {
        "@type": "Offer",
        "price": "249.90",
        "priceCurrency": "BRL",
        "description": "Plano Fiscal - Gestão + NF-e/NFS-e"
      }
    ],
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
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl transition-all duration-300">
        <div className="container flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <span className="text-primary-foreground font-bold text-2xl font-display">V</span>
            </div>
            <span className="font-display text-2xl font-bold text-foreground tracking-tight">Vetra</span>
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
                Criar Conta
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main>
      <section className="relative overflow-hidden py-24 md:py-40" aria-label="Apresentação">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-primary/5" />
        <div className="container relative px-6">
          <div className="mx-auto max-w-4xl text-center animate-fade-in">
            <Badge variant="outline" className="mb-6 py-1.5 px-4 bg-primary/5 text-primary border-primary/20 rounded-full font-semibold uppercase tracking-wider text-[10px]">
              <Zap className="w-3.5 h-3.5 mr-2 animate-pulse" />
              Gestão inteligente para vidraceiros
            </Badge>
            <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-8 leading-[1.1]">
              Gerencie sua vidraçaria com{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">tecnologia</span>
            </h1>
            <p className="text-lg md:text-2xl text-muted-foreground/90 mb-12 max-w-2xl mx-auto leading-relaxed">
              Orçamentos automáticos, plano de corte otimizado e controle financeiro total. 
              A plataforma definitiva para escalar sua produtividade.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link to="/auth?tab=signup">
                  Criar Conta
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <a href="#features">
                  Ver funcionalidades
                </a>
              </Button>
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
                className="group hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 animate-fade-in border-none bg-card/50 backdrop-blur-sm"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader className="p-8">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-inner">
                    <feature.icon className="w-7 h-7" />
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
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={plan.name}
                className={`relative animate-fade-in ${
                  plan.highlighted 
                    ? 'border-primary shadow-lg shadow-primary/10 scale-[1.02]' 
                    : ''
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Mais Completo
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="pt-4">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-success flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    size="lg"
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
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              variant="secondary" 
              asChild
              className="w-full sm:w-auto"
            >
              <Link to="/auth?tab=signup">
                Criar conta
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
