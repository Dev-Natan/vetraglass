export interface ModuleTutorialStep {
  id: string;
  target: string;
  title: string;
  description: string;
  position: 'right' | 'bottom' | 'left' | 'top';
}

export interface ModuleTutorial {
  moduleId: string;
  moduleName: string;
  steps: ModuleTutorialStep[];
}

export const moduleTutorials: Record<string, ModuleTutorial> = {
  // Clientes
  clientes: {
    moduleId: 'clientes',
    moduleName: 'Clientes',
    steps: [
      {
        id: 'clientes-intro',
        target: 'clientes-header',
        title: 'Gestão de Clientes',
        description: 'Aqui você gerencia todos os seus clientes. Cadastre, edite e acompanhe o histórico de cada um.',
        position: 'bottom',
      },
      {
        id: 'clientes-novo',
        target: 'clientes-btn-novo',
        title: 'Cadastrar Cliente',
        description: 'Clique aqui para adicionar um novo cliente. Informe dados de contato, endereço e documentos.',
        position: 'bottom',
      },
      {
        id: 'clientes-busca',
        target: 'clientes-search',
        title: 'Buscar Clientes',
        description: 'Use a busca para encontrar clientes por nome, CPF/CNPJ, telefone ou cidade.',
        position: 'bottom',
      },
    ],
  },

  // Estoque
  estoque: {
    moduleId: 'estoque',
    moduleName: 'Estoque',
    steps: [
      {
        id: 'estoque-intro',
        target: 'estoque-header',
        title: 'Controle de Estoque',
        description: 'Gerencie seu inventário de materiais. Acompanhe entradas, saídas e receba alertas de estoque baixo.',
        position: 'bottom',
      },
      {
        id: 'estoque-acoes',
        target: 'estoque-acoes',
        title: 'Movimentações',
        description: 'Registre entradas quando receber mercadorias e saídas para ajustes ou perdas.',
        position: 'bottom',
      },
    ],
  },

  // Produtos
  produtos: {
    moduleId: 'produtos',
    moduleName: 'Produtos',
    steps: [
      {
        id: 'produtos-intro',
        target: 'produtos-header',
        title: 'Catálogo de Produtos',
        description: 'Gerencie suas linhas de produtos, esquadrias e vidros com preços configurados.',
        position: 'bottom',
      },
      {
        id: 'produtos-linhas',
        target: 'produtos-linhas',
        title: 'Linhas de Produtos',
        description: 'Cada linha contém produtos específicos. Ative as linhas que sua empresa trabalha.',
        position: 'bottom',
      },
    ],
  },

  // Orçamentos
  orcamentos: {
    moduleId: 'orcamentos',
    moduleName: 'Orçamentos',
    steps: [
      {
        id: 'orcamentos-intro',
        target: 'orcamentos-header',
        title: 'Orçamentos Profissionais',
        description: 'Crie propostas comerciais detalhadas com cálculo automático de materiais e preços.',
        position: 'bottom',
      },
      {
        id: 'orcamentos-tabs',
        target: 'orcamentos-tabs',
        title: 'Filtrar por Status',
        description: 'Navegue entre as abas para ver orçamentos pendentes, aprovados, convertidos ou rejeitados.',
        position: 'bottom',
      },
    ],
  },

  // Caixa & Vendas
  'caixa-vendas': {
    moduleId: 'caixa-vendas',
    moduleName: 'Caixa & Vendas',
    steps: [
      {
        id: 'caixa-intro',
        target: 'caixa-header',
        title: 'Caixa & Vendas',
        description: 'Controle suas vendas diárias, abertura/fechamento de caixa e recebimentos.',
        position: 'bottom',
      },
      {
        id: 'caixa-resumo',
        target: 'caixa-resumo',
        title: 'Resumo do Caixa',
        description: 'Visualize o saldo atual, entradas e saídas do caixa aberto.',
        position: 'bottom',
      },
    ],
  },

  // Ordens de Serviço
  'ordens-servico': {
    moduleId: 'ordens-servico',
    moduleName: 'Ordens de Serviço',
    steps: [
      {
        id: 'os-intro',
        target: 'os-header',
        title: 'Ordens de Serviço',
        description: 'Acompanhe a produção de cada pedido desde a aprovação do orçamento até a entrega.',
        position: 'bottom',
      },
      {
        id: 'os-tabs',
        target: 'os-tabs',
        title: 'Status da Produção',
        description: 'Filtre as OS por status: pendentes, em andamento, concluídas ou atrasadas.',
        position: 'bottom',
      },
    ],
  },

  // Financeiro
  financeiro: {
    moduleId: 'financeiro',
    moduleName: 'Financeiro',
    steps: [
      {
        id: 'fin-intro',
        target: 'fin-header',
        title: 'Gestão Financeira',
        description: 'Controle contas a receber, despesas, fluxo de caixa e comissões de vendedores.',
        position: 'bottom',
      },
      {
        id: 'fin-tabs',
        target: 'fin-tabs',
        title: 'Áreas Financeiras',
        description: 'Navegue entre as abas para acessar cada seção: recebíveis, despesas, caixa da empresa e relatórios.',
        position: 'bottom',
      },
    ],
  },

  // Agenda
  agenda: {
    moduleId: 'agenda',
    moduleName: 'Agenda',
    steps: [
      {
        id: 'agenda-intro',
        target: 'agenda-header',
        title: 'Agenda de Compromissos',
        description: 'Organize visitas técnicas, instalações e compromissos em um calendário visual.',
        position: 'bottom',
      },
      {
        id: 'agenda-calendar',
        target: 'agenda-calendar',
        title: 'Calendário',
        description: 'Clique em uma data para adicionar um novo compromisso ou visualize os eventos marcados.',
        position: 'bottom',
      },
    ],
  },

  // Configurações
  configuracoes: {
    moduleId: 'configuracoes',
    moduleName: 'Configurações',
    steps: [
      {
        id: 'config-intro',
        target: 'config-header',
        title: 'Configurações do Sistema',
        description: 'Personalize dados da empresa, logotipo, formas de pagamento e preferências gerais.',
        position: 'bottom',
      },
      {
        id: 'config-areas',
        target: 'config-areas',
        title: 'Áreas de Configuração',
        description: 'Acesse usuários, permissões, notificações, segurança e exportação de dados.',
        position: 'top',
      },
    ],
  },

  // Fiscal
  'notas-fiscais': {
    moduleId: 'notas-fiscais',
    moduleName: 'Fiscal',
    steps: [
      {
        id: 'nf-intro',
        target: 'nf-header',
        title: 'Notas Fiscais',
        description: 'Emita NF-e e NFS-e integradas com a Receita. Gerencie certificados digitais.',
        position: 'bottom',
      },
    ],
  },

  // Funcionários
  funcionarios: {
    moduleId: 'funcionarios',
    moduleName: 'Funcionários',
    steps: [
      {
        id: 'func-intro',
        target: 'func-header',
        title: 'Gestão de Funcionários',
        description: 'Cadastre sua equipe, defina permissões de acesso e gerencie credenciais de login.',
        position: 'bottom',
      },
    ],
  },
};
