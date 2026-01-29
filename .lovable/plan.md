
# Plano: Sistema de Tutorial em Duas Camadas

## Objetivo

Criar um sistema de tutorial inteligente com duas camadas:
1. **Tutorial Global** - Apresentação rápida do sistema após primeiro login (visão geral dos módulos)
2. **Tutorial por Módulo** - Explicação detalhada ao abrir cada módulo pela primeira vez

Esta abordagem evita sobrecarregar o usuário com muita informação de uma vez.

---

## Arquitetura do Sistema

```text
+--------------------------------------------------+
|           PRIMEIRO LOGIN DO USUARIO              |
+--------------------------------------------------+
                       |
                       v
+--------------------------------------------------+
|         TUTORIAL GLOBAL (5-6 passos)             |
|  - Bem-vindo ao sistema                          |
|  - Visão geral rápida dos módulos                |
|  - Onde encontrar ajuda                          |
|  - Checklist de configuração                     |
+--------------------------------------------------+
                       |
                       v
+--------------------------------------------------+
|           USUARIO USA O SISTEMA                  |
+--------------------------------------------------+
          |              |              |
          v              v              v
+----------------+ +----------------+ +----------------+
| ABRE CLIENTES  | | ABRE ESTOQUE   | | ABRE ORCAM.   |
| pela 1ª vez    | | pela 1ª vez    | | pela 1ª vez   |
+----------------+ +----------------+ +----------------+
          |              |              |
          v              v              v
+----------------+ +----------------+ +----------------+
| Tutorial       | | Tutorial       | | Tutorial      |
| Clientes       | | Estoque        | | Orcamentos    |
| (3-4 passos)   | | (3-4 passos)   | | (3-4 passos)  |
+----------------+ +----------------+ +----------------+
```

---

## Estrutura de Arquivos

### Novos Arquivos

| Arquivo | Proposito |
|---------|-----------|
| `src/components/tutorial/moduleTutorialSteps.ts` | Definição dos passos de tutorial por módulo |
| `src/contexts/ModuleTutorialContext.tsx` | Contexto para controle de tutoriais por módulo |
| `src/components/tutorial/ModuleTutorialOverlay.tsx` | Overlay específico para tutoriais de módulo |
| `src/hooks/useModuleTutorial.ts` | Hook reutilizável para cada página |

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/tutorial/tutorialSteps.ts` | Simplificar para 5-6 passos globais |
| `src/components/layout/Sidebar.tsx` | Adicionar tutorialId em todos os itens |
| `src/pages/*.tsx` | Adicionar data-tutorial nos elementos-chave |
| `src/components/layout/MainLayout.tsx` | Adicionar ModuleTutorialOverlay |

---

## Etapa 1: Tutorial Global Simplificado

### tutorialSteps.ts (Atualizado)

Reduzir para 5-6 passos que apresentam o sistema de forma geral:

```typescript
export const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    target: 'logo',
    title: 'Bem-vindo ao Vetra!',
    description: 'Este é seu sistema completo de gestão para vidraçarias. Vamos conhecer as principais áreas.',
    position: 'right',
  },
  {
    id: 'comercial',
    target: 'menu-clientes',
    title: 'Área Comercial',
    description: 'Clientes, Produtos, Orçamentos e Vendas. Gerencie todo seu processo comercial.',
    position: 'right',
  },
  {
    id: 'producao',
    target: 'menu-ordens-servico',
    title: 'Produção e Operacional',
    description: 'Ordens de Serviço, Plano de Corte, Medições e Agenda. Controle sua produção.',
    position: 'right',
  },
  {
    id: 'financeiro',
    target: 'menu-financeiro',
    title: 'Financeiro',
    description: 'Contas a receber, despesas, fluxo de caixa e notas fiscais.',
    position: 'right',
  },
  {
    id: 'configuracoes',
    target: 'menu-configuracoes',
    title: 'Configurações',
    description: 'Personalize o sistema, gerencie funcionários e defina permissões.',
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
```

---

## Etapa 2: Definição de Tutoriais por Módulo

### moduleTutorialSteps.ts (Novo)

```typescript
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
        description: 'Aqui você gerencia todos os seus clientes. Cadastre, edite e acompanhe o histórico.',
        position: 'bottom',
      },
      {
        id: 'clientes-novo',
        target: 'clientes-btn-novo',
        title: 'Cadastrar Cliente',
        description: 'Clique aqui para adicionar um novo cliente. Informe dados de contato e endereço.',
        position: 'bottom',
      },
      {
        id: 'clientes-busca',
        target: 'clientes-search',
        title: 'Buscar Clientes',
        description: 'Use a busca para encontrar clientes por nome, documento ou telefone.',
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
        description: 'Gerencie seu inventário de materiais. Acompanhe entradas, saídas e alertas de estoque baixo.',
        position: 'bottom',
      },
      {
        id: 'estoque-entrada',
        target: 'estoque-btn-entrada',
        title: 'Registrar Entrada',
        description: 'Registre a entrada de materiais quando receber mercadorias.',
        position: 'bottom',
      },
      {
        id: 'estoque-saida',
        target: 'estoque-btn-saida',
        title: 'Registrar Saída',
        description: 'Registre saídas manuais de materiais (perdas, ajustes, etc).',
        position: 'bottom',
      },
      {
        id: 'estoque-alertas',
        target: 'estoque-alertas',
        title: 'Alertas de Estoque',
        description: 'Itens com estoque baixo aparecem aqui. Configure o mínimo de cada item.',
        position: 'right',
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
        description: 'Crie propostas comerciais detalhadas com cálculo automático de materiais.',
        position: 'bottom',
      },
      {
        id: 'orcamentos-novo',
        target: 'orcamentos-btn-novo',
        title: 'Novo Orçamento',
        description: 'Clique para criar um novo orçamento. Selecione cliente e adicione produtos.',
        position: 'bottom',
      },
      {
        id: 'orcamentos-lista',
        target: 'orcamentos-lista',
        title: 'Lista de Orçamentos',
        description: 'Visualize, edite e acompanhe o status de cada orçamento.',
        position: 'top',
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
        description: 'Controle suas vendas diárias, caixa e recebimentos em um só lugar.',
        position: 'bottom',
      },
      {
        id: 'caixa-abrir',
        target: 'caixa-btn-abrir',
        title: 'Abrir/Fechar Caixa',
        description: 'Inicie o dia abrindo o caixa com o valor inicial. Feche ao final do expediente.',
        position: 'bottom',
      },
      {
        id: 'caixa-nova-venda',
        target: 'caixa-btn-venda',
        title: 'Nova Venda',
        description: 'Registre vendas rápidas diretamente no caixa.',
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
        description: 'Acompanhe a produção de cada pedido desde a aprovação até a entrega.',
        position: 'bottom',
      },
      {
        id: 'os-kanban',
        target: 'os-kanban',
        title: 'Quadro de Produção',
        description: 'Visualize o status de cada OS no quadro Kanban. Arraste para mudar o status.',
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
        description: 'Controle contas a receber, despesas, fluxo de caixa e comissões.',
        position: 'bottom',
      },
      {
        id: 'fin-tabs',
        target: 'fin-tabs',
        title: 'Seções Financeiras',
        description: 'Navegue entre as abas para acessar cada área do financeiro.',
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
        description: 'Organize visitas, instalações e compromissos em um calendário visual.',
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
        description: 'Personalize dados da empresa, formas de pagamento, impostos e preferências.',
        position: 'bottom',
      },
      {
        id: 'config-tabs',
        target: 'config-tabs',
        title: 'Áreas de Configuração',
        description: 'Navegue entre as abas para configurar cada aspecto do sistema.',
        position: 'bottom',
      },
    ],
  },
};
```

---

## Etapa 3: Contexto de Tutorial por Módulo

### ModuleTutorialContext.tsx (Novo)

```typescript
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { moduleTutorials, ModuleTutorialStep } from '@/components/tutorial/moduleTutorialSteps';

const MODULE_TUTORIAL_KEY = 'vetraglass_module_tutorial';

interface ModuleTutorialContextType {
  isActive: boolean;
  currentModuleId: string | null;
  currentStep: number;
  totalSteps: number;
  currentStepData: ModuleTutorialStep | null;
  checkAndStartTutorial: (moduleId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
}

// Implementação do contexto que:
// - Verifica localStorage para cada módulo
// - Ativa tutorial ao detectar primeiro acesso
// - Marca como completo ao finalizar/pular
```

---

## Etapa 4: Hook Reutilizável

### useModuleTutorial.ts (Novo)

```typescript
import { useEffect } from 'react';
import { useModuleTutorialContext } from '@/contexts/ModuleTutorialContext';

export function useModuleTutorial(moduleId: string) {
  const { checkAndStartTutorial } = useModuleTutorialContext();

  useEffect(() => {
    // Pequeno delay para garantir que o DOM está pronto
    const timer = setTimeout(() => {
      checkAndStartTutorial(moduleId);
    }, 500);

    return () => clearTimeout(timer);
  }, [moduleId, checkAndStartTutorial]);
}
```

---

## Etapa 5: Integração nas Páginas

### Exemplo: Estoque.tsx

```typescript
import { useModuleTutorial } from '@/hooks/useModuleTutorial';

export default function Estoque() {
  // Ativa tutorial do módulo se for primeiro acesso
  useModuleTutorial('estoque');

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header com data-tutorial */}
        <div data-tutorial="estoque-header" className="flex justify-between">
          <h1>Estoque</h1>
          <div className="flex gap-2">
            <Button data-tutorial="estoque-btn-saida">Registrar Saída</Button>
            <Button data-tutorial="estoque-btn-entrada">Registrar Entrada</Button>
          </div>
        </div>

        {/* Alertas com data-tutorial */}
        <div data-tutorial="estoque-alertas">
          {/* Componente de alertas */}
        </div>
      </div>
    </MainLayout>
  );
}
```

---

## Etapa 6: Atualizar Sidebar

### Sidebar.tsx

Adicionar `tutorialId` em todos os itens do menu para o tutorial global:

```typescript
const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', module: 'dashboard', tutorialId: 'menu-dashboard' },
  { icon: Users, label: 'Clientes', path: '/clientes', module: 'clientes', tutorialId: 'menu-clientes' },
  { icon: Package, label: 'Produtos', path: '/produtos', module: 'produtos', tutorialId: 'menu-produtos' },
  { icon: Boxes, label: 'Estoque', path: '/estoque', module: 'estoque', tutorialId: 'menu-estoque' },
  // ... todos os outros itens
];
```

---

## Armazenamento no localStorage

### Estrutura de Chaves

```text
Tutorial Global:
  vetraglass_tutorial_completed_{userId}_{companyId} = "true"

Tutorial por Módulo:
  vetraglass_module_tutorial_{userId}_{companyId}_{moduleId} = "true"

Exemplos:
  vetraglass_module_tutorial_abc123_xyz789_estoque = "true"
  vetraglass_module_tutorial_abc123_xyz789_clientes = "true"
```

---

## Fluxo Completo do Usuário

```text
1. Usuário faz login pela primeira vez
   |
   v
2. Tutorial Global inicia automaticamente (5-6 passos)
   - Apresenta as áreas principais
   - Mostra onde encontrar configurações
   - Indica o checklist de onboarding
   |
   v
3. Usuário navega para "Clientes"
   |
   v
4. Sistema verifica: já viu tutorial de Clientes?
   - NÃO: Inicia tutorial de Clientes (3 passos)
   - SIM: Mostra a página normalmente
   |
   v
5. Usuário navega para "Estoque"
   |
   v
6. Sistema verifica: já viu tutorial de Estoque?
   - NÃO: Inicia tutorial de Estoque (4 passos)
   - SIM: Mostra a página normalmente
```

---

## Benefícios desta Abordagem

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Tutorial inicial | 17+ passos longos | 5-6 passos rápidos |
| Aprendizado | Tudo de uma vez | Gradual, conforme uso |
| Retenção | Baixa (muita informação) | Alta (contexto relevante) |
| Experiência | Cansativo | Fluido e não invasivo |

---

## Resumo de Arquivos

### Novos Arquivos (4)
1. `src/components/tutorial/moduleTutorialSteps.ts`
2. `src/contexts/ModuleTutorialContext.tsx`
3. `src/components/tutorial/ModuleTutorialOverlay.tsx`
4. `src/hooks/useModuleTutorial.ts`

### Arquivos Modificados (14)
1. `src/components/tutorial/tutorialSteps.ts` - Simplificar para 5-6 passos
2. `src/components/layout/Sidebar.tsx` - Adicionar tutorialId em todos
3. `src/components/layout/MainLayout.tsx` - Adicionar ModuleTutorialProvider
4. `src/pages/Clientes.tsx` - Adicionar data-tutorial + hook
5. `src/pages/Estoque.tsx` - Adicionar data-tutorial + hook
6. `src/pages/Produtos.tsx` - Adicionar data-tutorial + hook
7. `src/pages/Orcamentos.tsx` - Adicionar data-tutorial + hook
8. `src/pages/CaixaVendas.tsx` - Adicionar data-tutorial + hook
9. `src/pages/OrdensServico.tsx` - Adicionar data-tutorial + hook
10. `src/pages/Financeiro.tsx` - Adicionar data-tutorial + hook
11. `src/pages/Agenda.tsx` - Adicionar data-tutorial + hook
12. `src/pages/Configuracoes.tsx` - Adicionar data-tutorial + hook
13. `src/pages/NotasFiscais.tsx` - Adicionar data-tutorial + hook
14. `src/pages/Funcionarios.tsx` - Adicionar data-tutorial + hook
