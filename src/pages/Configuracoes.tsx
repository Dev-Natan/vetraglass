import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Building2, Users, Palette, Bell, Shield, Database } from 'lucide-react';

const settingsGroups = [
  {
    icon: Building2,
    title: 'Dados da Empresa',
    description: 'Gerencie informações como nome, CNPJ, endereço e logo da empresa.',
  },
  {
    icon: Users,
    title: 'Usuários e Permissões',
    description: 'Controle o acesso dos funcionários ao sistema.',
  },
  {
    icon: Palette,
    title: 'Personalização',
    description: 'Customize cores, logotipo e aparência do sistema.',
  },
  {
    icon: Bell,
    title: 'Notificações',
    description: 'Configure alertas por email e notificações do sistema.',
  },
  {
    icon: Shield,
    title: 'Segurança',
    description: 'Configurações de senha, autenticação e backups.',
  },
  {
    icon: Database,
    title: 'Dados e Exportação',
    description: 'Exporte dados e gerencie backups do sistema.',
  },
];

export default function Configuracoes() {
  return (
    <MainLayout>
      <div className="space-y-8 pt-12 lg:pt-0">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-3xl font-display font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Personalize o sistema de acordo com suas necessidades.</p>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 animate-slide-up">
          {settingsGroups.map((group, index) => (
            <button
              key={group.title}
              className="glass-card rounded-2xl p-6 text-left hover-lift group"
              style={{ animationDelay: `${(index + 1) * 50}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <group.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2">{group.title}</h3>
              <p className="text-sm text-muted-foreground">{group.description}</p>
            </button>
          ))}
        </div>

        {/* Company Info Preview */}
        <div className="glass-card rounded-2xl p-6 animate-slide-up [animation-delay:300ms]">
          <h2 className="text-xl font-display font-semibold text-foreground mb-6">Informações Atuais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nome da Empresa</label>
              <p className="text-foreground mt-1">Vidraçaria Central</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">CNPJ</label>
              <p className="text-foreground mt-1">12.345.678/0001-90</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-foreground mt-1">contato@vidracariacentral.com.br</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Telefone</label>
              <p className="text-foreground mt-1">(11) 3456-7890</p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border">
            <Button variant="default">Editar Informações</Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
