

# Plano: Tutorial Interativo para Novos Usuarios

## Objetivo

Criar um sistema de tutorial guiado (product tour) que apresenta as principais funcionalidades do sistema para novos usuarios atraves de passos interativos com destaque visual e tooltips explicativos.

---

## Arquitetura da Solucao

O tutorial sera composto por:

1. **Hook de estado** - Gerencia o progresso e visibilidade do tutorial
2. **Componente de Overlay** - Cria destaque visual nos elementos
3. **Componente de Tooltip** - Exibe instrucoes em cada passo
4. **Integracao com Dashboard** - Inicia o tutorial para novos usuarios
5. **Botao para reiniciar** - Permite usuario acessar o tutorial novamente

```text
+------------------+     +-------------------+     +------------------+
|  useTutorial     |---->|  TutorialProvider |---->|  TutorialOverlay |
|  (hook estado)   |     |  (contexto React) |     |  (spotlight UI)  |
+------------------+     +-------------------+     +------------------+
                                  |
                                  v
                         +------------------+
                         |  TutorialTooltip |
                         |  (passos guia)   |
                         +------------------+
```

---

## Passos do Tutorial

O tutorial tera 6 passos principais:

| Passo | Elemento Target | Titulo | Descricao |
|-------|-----------------|--------|-----------|
| 1 | Logo Vetra | Bem-vindo ao Vetra! | Este e seu sistema de gestao para vidracarias |
| 2 | Menu Clientes | Cadastro de Clientes | Comece cadastrando seus clientes aqui |
| 3 | Menu Produtos | Catalogo de Produtos | Importe e gerencie seus produtos |
| 4 | Menu Orcamentos | Orcamentos | Crie orcamentos profissionais |
| 5 | Menu Caixa & Vendas | Vendas e Caixa | Registre vendas e controle o caixa |
| 6 | Onboarding Checklist | Proximos Passos | Siga este checklist para configurar |

---

## Arquivos a Criar

### 1. Hook de Tutorial
**Arquivo:** `src/hooks/useTutorial.ts`

Responsabilidades:
- Controlar passo atual (0-5)
- Verificar se tutorial ja foi completado (localStorage)
- Funcoes: nextStep, prevStep, skipTutorial, restartTutorial
- Verificar se e primeiro acesso do usuario

### 2. Contexto do Tutorial
**Arquivo:** `src/contexts/TutorialContext.tsx`

Responsabilidades:
- Prover estado global do tutorial
- Permitir acesso de qualquer componente
- Gerenciar visibilidade do overlay

### 3. Componente TutorialOverlay
**Arquivo:** `src/components/tutorial/TutorialOverlay.tsx`

Responsabilidades:
- Renderizar overlay escuro com "spotlight" no elemento atual
- Posicionar tooltip proximo ao elemento destacado
- Mostrar progresso (passo X de Y)
- Botoes: Anterior, Proximo, Pular

Visual:
```text
+------------------------------------------------+
|  [Fundo escuro com blur]                       |
|                                                |
|     +------------------+                       |
|     | [Elemento dest.] |  <-- Recorte claro    |
|     +------------------+                       |
|              |                                 |
|              v                                 |
|     +------------------------+                 |
|     | Titulo do Passo       |                 |
|     | Descricao explicativa |                 |
|     | [Anterior] [Proximo]  |                 |
|     | Passo 2 de 6          |                 |
|     +------------------------+                 |
+------------------------------------------------+
```

### 4. Componente TutorialTooltip
**Arquivo:** `src/components/tutorial/TutorialTooltip.tsx`

Responsabilidades:
- Card com seta apontando para elemento
- Animacao de entrada suave
- Estilo consistente com design system

### 5. Definicao dos Passos
**Arquivo:** `src/components/tutorial/tutorialSteps.ts`

Conteudo:
- Array com configuracao de cada passo
- Seletores CSS para elementos target
- Textos e posicionamento

---

## Arquivos a Modificar

### 1. MainLayout.tsx
- Adicionar TutorialProvider envolvendo children
- Renderizar TutorialOverlay

### 2. Sidebar.tsx
- Adicionar data-attributes nos itens de menu para facilitar selecao
- Exemplo: `data-tutorial="menu-clientes"`

### 3. OnboardingChecklist.tsx
- Adicionar data-attribute para tutorial
- Mostrar botao "Ver Tutorial Novamente" quando checklist estiver visivel

### 4. Index.tsx (Dashboard)
- Iniciar tutorial automaticamente no primeiro acesso

---

## Logica de Exibicao

1. **Primeiro acesso**: Tutorial inicia automaticamente
2. **Apos completar/pular**: Estado salvo em localStorage
3. **Reiniciar**: Botao no OnboardingChecklist ou menu de configuracoes
4. **Responsividade**: Tutorial oculto em mobile (tela pequena demais)

---

## Detalhes Tecnicos

### Estado Persistente
```typescript
const TUTORIAL_COMPLETED_KEY = 'vetraglass_tutorial_completed';
// Armazena: userId_companyId -> 'true'
```

### Selecao de Elementos
```typescript
// Usar data-attributes para selecionar elementos
document.querySelector('[data-tutorial="menu-clientes"]')
```

### Posicionamento do Tooltip
- Calcular posicao do elemento target
- Posicionar tooltip ao lado (direita para sidebar)
- Ajustar se sair da viewport

### Animacoes
- Fade-in do overlay
- Scale-in do tooltip
- Transicao suave entre passos

---

## Estrutura de Pastas Final

```text
src/
  components/
    tutorial/
      TutorialOverlay.tsx
      TutorialTooltip.tsx
      TutorialProgress.tsx
      tutorialSteps.ts
  contexts/
    TutorialContext.tsx
  hooks/
    useTutorial.ts
```

---

## Resultado Esperado

- Novos usuarios verao um tour guiado na primeira visita
- Tutorial destaca elementos importantes com spotlight
- Navegacao intuitiva entre passos
- Possibilidade de pular e reiniciar
- Integracao visual com o design existente
- Nao interfere com usuarios que ja completaram

