export interface TutorialStep {
  id: string;
  target: string; // data-tutorial attribute value
  title: string;
  description: string;
  position: 'right' | 'bottom' | 'left' | 'top';
}

export const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    target: 'logo',
    title: 'Bem-vindo ao Vetra! 👋',
    description: 'Este é seu sistema completo de gestão para vidraçarias. Vamos fazer um tour rápido pelas principais funcionalidades.',
    position: 'right',
  },
  {
    id: 'clientes',
    target: 'menu-clientes',
    title: 'Cadastro de Clientes',
    description: 'Aqui você cadastra e gerencia todos os seus clientes. Mantenha o histórico de compras e contatos organizados.',
    position: 'right',
  },
  {
    id: 'produtos',
    target: 'menu-produtos',
    title: 'Catálogo de Produtos',
    description: 'Importe linhas de produtos, configure preços e gerencie seu catálogo completo de esquadrias e vidros.',
    position: 'right',
  },
  {
    id: 'orcamentos',
    target: 'menu-orcamentos',
    title: 'Orçamentos Profissionais',
    description: 'Crie orçamentos detalhados com cálculo automático de materiais. Envie PDFs profissionais para seus clientes.',
    position: 'right',
  },
  {
    id: 'vendas',
    target: 'menu-caixa',
    title: 'Caixa & Vendas',
    description: 'Registre vendas, controle o caixa diário e acompanhe seus recebimentos em um só lugar.',
    position: 'right',
  },
  {
    id: 'checklist',
    target: 'onboarding-checklist',
    title: 'Próximos Passos',
    description: 'Siga este checklist para configurar seu sistema. Complete cada etapa para começar a usar todas as funcionalidades!',
    position: 'bottom',
  },
];
