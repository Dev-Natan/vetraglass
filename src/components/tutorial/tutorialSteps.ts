export interface TutorialStep {
  id: string;
  target: string; // data-tutorial attribute value
  title: string;
  description: string;
  position: 'right' | 'bottom' | 'left' | 'top';
}

// Tutorial global simplificado - apenas visão geral das áreas principais
// Tutoriais detalhados de cada módulo estão em moduleTutorialSteps.ts
export const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    target: 'logo',
    title: 'Bem-vindo ao Vetra! 👋',
    description: 'Este é seu sistema completo de gestão para vidraçarias. Vamos conhecer as principais áreas rapidamente.',
    position: 'right',
  },
  {
    id: 'comercial',
    target: 'menu-clientes',
    title: 'Área Comercial',
    description: 'Clientes, Produtos, Orçamentos e Vendas. Gerencie todo seu processo comercial de forma integrada.',
    position: 'right',
  },
  {
    id: 'producao',
    target: 'menu-ordens-servico',
    title: 'Produção e Operacional',
    description: 'Ordens de Serviço, Plano de Corte, Medições e Agenda. Controle toda sua produção.',
    position: 'right',
  },
  {
    id: 'financeiro',
    target: 'menu-financeiro',
    title: 'Financeiro',
    description: 'Contas a receber, despesas, fluxo de caixa e notas fiscais. Tudo organizado.',
    position: 'right',
  },
  {
    id: 'configuracoes',
    target: 'menu-configuracoes',
    title: 'Configurações',
    description: 'Personalize o sistema, gerencie funcionários e defina permissões de acesso.',
    position: 'right',
  },
  {
    id: 'checklist',
    target: 'onboarding-checklist',
    title: 'Próximos Passos',
    description: 'Ao abrir cada módulo pela primeira vez, você receberá um tutorial específico. Complete o checklist para configurar seu sistema!',
    position: 'bottom',
  },
];
