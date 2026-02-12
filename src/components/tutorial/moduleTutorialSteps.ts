export interface ModuleTutorialStep {
  id: string;
  target: string;
  title: string;
  description: string;
  tip?: string;
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
        title: '👥 Gestão de Clientes',
        description: 'Aqui você gerencia todos os seus clientes. Cadastre, edite e acompanhe o histórico de compras de cada um.',
        tip: 'O Vetra valida CPF e CNPJ automaticamente para evitar cadastros duplicados.',
        position: 'bottom',
      },
      {
        id: 'clientes-novo',
        target: 'clientes-btn-novo',
        title: 'Cadastrar Novo Cliente',
        description: 'Clique aqui para adicionar um cliente. Preencha nome, telefone, e-mail e endereço completo.',
        tip: 'Clientes com endereço cadastrado aparecem no mapa de localização para planejar visitas.',
        position: 'bottom',
      },
      {
        id: 'clientes-busca',
        target: 'clientes-search',
        title: 'Busca Inteligente',
        description: 'Encontre clientes rapidamente por nome, CPF/CNPJ, telefone ou cidade.',
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
        title: '📊 Controle de Estoque',
        description: 'Gerencie seu inventário de perfis, vidros e acessórios. Acompanhe quantidades, valores e receba alertas de estoque baixo.',
        tip: 'Itens com estoque zerado ficam na aba "Fora de Estoque" para facilitar o reabastecimento.',
        position: 'bottom',
      },
      {
        id: 'estoque-acoes',
        target: 'estoque-acoes',
        title: 'Movimentações de Estoque',
        description: 'Registre entradas ao receber mercadorias e saídas para ajustes, perdas ou devoluções.',
        tip: 'Ao aprovar uma OS, o sistema consome materiais automaticamente se o estoque estiver configurado.',
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
        title: '📦 Catálogo de Produtos',
        description: 'Gerencie suas linhas de esquadrias e vidros. Cada linha contém produtos pré-configurados com composição de materiais.',
        tip: 'Ative apenas as linhas que sua empresa trabalha para manter o catálogo organizado.',
        position: 'bottom',
      },
      {
        id: 'produtos-linhas',
        target: 'produtos-linhas',
        title: 'Linhas de Produtos',
        description: 'Cada card representa uma linha (Suprema, Gold, Temperado, etc). Clique para ver os produtos disponíveis e ativá-los.',
        tip: 'Produtos ativados ficam disponíveis automaticamente para uso em orçamentos.',
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
        title: '📋 Orçamentos Profissionais',
        description: 'Crie propostas com cálculo automático de materiais, vidro e preço por m². Envie ao cliente e acompanhe a aprovação.',
        tip: 'Você pode adicionar tanto produtos manufaturados quanto itens avulsos (perfis, acessórios) no mesmo orçamento.',
        position: 'bottom',
      },
      {
        id: 'orcamentos-tabs',
        target: 'orcamentos-tabs',
        title: 'Acompanhe o Status',
        description: 'Filtre orçamentos por status: Pendentes aguardam resposta, Aprovados podem ser convertidos em OS.',
        tip: 'Orçamentos aprovados geram contas a receber automaticamente quando convertidos.',
        position: 'bottom',
      },
    ],
  },

  // Caixa
  'caixa-vendas': {
    moduleId: 'caixa-vendas',
    moduleName: 'Caixa',
    steps: [
      {
        id: 'caixa-intro',
        target: 'caixa-header',
        title: '💰 Caixa & Vendas',
        description: 'Controle o fluxo diário: abra o caixa com fundo fixo, registre vendas, receba pagamentos e faça o fechamento com conferência.',
        tip: 'O caixa integra com o financeiro da empresa — lucros são transferidos automaticamente ao fechar.',
        position: 'bottom',
      },
      {
        id: 'caixa-resumo',
        target: 'caixa-resumo',
        title: 'Resumo do Caixa',
        description: 'Visualize em tempo real: saldo atual, total de entradas, saídas e quantidade de vendas realizadas.',
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
        title: '🔧 Ordens de Serviço',
        description: 'Acompanhe a produção de cada pedido: materiais necessários, status da fabricação, plano de corte e entrega.',
        tip: 'As OS são criadas automaticamente ao aprovar um orçamento, já com todos os materiais calculados.',
        position: 'bottom',
      },
      {
        id: 'os-tabs',
        target: 'os-tabs',
        title: 'Fluxo de Produção',
        description: 'Cada aba representa uma etapa: Pendentes → Em Andamento → Prontas → Entregues. Arraste para avançar.',
        tip: 'OS atrasadas ficam destacadas em vermelho para ação imediata.',
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
        title: '💳 Gestão Financeira',
        description: 'Controle completo: contas a receber vinculadas às vendas, despesas fixas/variáveis, caixa da empresa e comissões.',
        tip: 'Configure despesas recorrentes (aluguel, energia) para geração automática mensal.',
        position: 'bottom',
      },
      {
        id: 'fin-tabs',
        target: 'fin-tabs',
        title: 'Áreas Financeiras',
        description: 'Navegue entre: Contas a Receber, Despesas, Caixa da Empresa, Comissões e Relatórios Fiscais.',
        tip: 'O Caixa da Empresa centraliza todo o dinheiro — é diferente do caixa diário de vendas.',
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
        title: '📅 Agenda de Compromissos',
        description: 'Organize visitas técnicas, medições, instalações e reuniões em um calendário visual integrado.',
        tip: 'Compromissos do dia aparecem no Dashboard para não esquecer nada.',
        position: 'bottom',
      },
      {
        id: 'agenda-calendar',
        target: 'agenda-calendar',
        title: 'Usando o Calendário',
        description: 'Clique em uma data para criar um novo evento. Arraste para remarcar. Cores indicam o tipo de compromisso.',
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
        title: '⚙️ Configurações do Sistema',
        description: 'Configure dados da empresa (logo, CNPJ, endereço), formas de pagamento, condições comerciais e integrações fiscais.',
        tip: 'Comece preenchendo os dados da empresa — eles aparecem nos orçamentos e documentos gerados.',
        position: 'bottom',
      },
      {
        id: 'config-areas',
        target: 'config-areas',
        title: 'Áreas de Configuração',
        description: 'Gerencie: Usuários e convites, Perfis de permissão, Notificações, Segurança e Exportação de dados.',
        tip: 'Crie perfis de permissão personalizados para controlar o que cada funcionário pode acessar.',
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
        title: '🧾 Notas Fiscais',
        description: 'Emita NF-e e NFS-e integradas com a Receita Federal. Gerencie certificados digitais e configurações fiscais.',
        tip: 'Configure o certificado digital em Configurações Fiscais antes de emitir a primeira nota.',
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
        title: '🏢 Gestão de Funcionários',
        description: 'Cadastre sua equipe, defina especialidades, configure comissões de venda e gere credenciais de acesso ao sistema.',
        tip: 'Cada funcionário pode ter um perfil de permissão diferente — vendedor, produção, gerente, etc.',
        position: 'bottom',
      },
    ],
  },
};
