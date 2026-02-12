export interface TutorialStep {
  id: string;
  target: string; // data-tutorial attribute value
  title: string;
  description: string;
  tip?: string;
  position: 'right' | 'bottom' | 'left' | 'top';
  emoji?: string;
}

// Tutorial global — visão geral das áreas principais para novas empresas
// Tutoriais detalhados de cada módulo estão em moduleTutorialSteps.ts
export const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    target: 'logo',
    title: 'Bem-vindo ao Vetra! 👋',
    description: 'Este é seu sistema completo de gestão para vidraçarias. Em poucos minutos você vai conhecer os módulos essenciais para começar a operar.',
    tip: 'Você pode reiniciar este tutorial a qualquer momento pelo checklist no Dashboard.',
    position: 'right',
    emoji: '🚀',
  },
  {
    id: 'clientes',
    target: 'menu-clientes',
    title: 'Cadastro de Clientes',
    description: 'Comece cadastrando seus clientes com nome, contato e endereço. A partir daqui, todo o fluxo de vendas fica vinculado ao cliente.',
    tip: 'Dica: Importe clientes existentes ou cadastre manualmente. CPF/CNPJ é validado automaticamente.',
    position: 'right',
    emoji: '👥',
  },
  {
    id: 'produtos',
    target: 'menu-produtos',
    title: 'Catálogo de Produtos',
    description: 'Ative as linhas de esquadrias que sua empresa trabalha (Suprema, Gold, etc). Cada produto já vem com composição de materiais e fórmulas de corte.',
    tip: 'Dica: Você também pode criar produtos personalizados com composições próprias.',
    position: 'right',
    emoji: '📦',
  },
  {
    id: 'orcamentos',
    target: 'menu-orcamentos',
    title: 'Orçamentos Profissionais',
    description: 'Crie propostas comerciais com cálculo automático de preço por m². Adicione produtos com dimensões, escolha vidro e acabamento — o sistema calcula tudo.',
    tip: 'Dica: Orçamentos aprovados podem ser convertidos automaticamente em Ordens de Serviço.',
    position: 'right',
    emoji: '📋',
  },
  {
    id: 'ordens-servico',
    target: 'menu-ordens-servico',
    title: 'Produção & Ordens de Serviço',
    description: 'Acompanhe cada pedido da aprovação até a entrega. Visualize materiais necessários, plano de corte e status da produção em tempo real.',
    tip: 'Dica: O plano de corte otimiza o aproveitamento de barras e reduz desperdício.',
    position: 'right',
    emoji: '🔧',
  },
  {
    id: 'estoque',
    target: 'menu-estoque',
    title: 'Controle de Estoque',
    description: 'Gerencie perfis de alumínio, vidros, acessórios e outros materiais. Receba alertas quando o estoque estiver baixo.',
    tip: 'Dica: O consumo de materiais das OS é descontado automaticamente do estoque.',
    position: 'right',
    emoji: '📊',
  },
  {
    id: 'caixa',
    target: 'menu-caixa',
    title: 'Caixa & Vendas Rápidas',
    description: 'Abra o caixa diário, registre vendas avulsas, receba pagamentos e faça o fechamento com conferência de valores.',
    tip: 'Dica: O caixa integra com o financeiro — todas as vendas são refletidas automaticamente.',
    position: 'right',
    emoji: '💰',
  },
  {
    id: 'financeiro',
    target: 'menu-financeiro',
    title: 'Gestão Financeira',
    description: 'Contas a receber, despesas recorrentes, fluxo de caixa da empresa e comissões de vendedores — tudo em um só lugar.',
    tip: 'Dica: Configure alertas para não perder vencimentos de contas a receber e despesas.',
    position: 'right',
    emoji: '💳',
  },
  {
    id: 'configuracoes',
    target: 'menu-configuracoes',
    title: 'Configurações da Empresa',
    description: 'Defina logo, dados fiscais, formas de pagamento e permissões de acesso para sua equipe.',
    tip: 'Dica: Adicione funcionários e defina o que cada perfil pode acessar no sistema.',
    position: 'right',
    emoji: '⚙️',
  },
  {
    id: 'checklist',
    target: 'onboarding-checklist',
    title: 'Seus Próximos Passos',
    description: 'Complete o checklist para configurar o básico: cadastrar cliente, importar produtos, criar orçamento e realizar uma venda. Cada módulo tem seu próprio tutorial ao abrir pela primeira vez!',
    tip: 'Dica: Siga a ordem sugerida para a melhor experiência de configuração.',
    position: 'bottom',
    emoji: '✅',
  },
];
