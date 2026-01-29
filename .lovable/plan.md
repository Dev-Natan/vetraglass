

# Página de Feedbacks - Sugestões e Melhorias

## Visão Geral

Criar uma página dedicada onde os usuários podem enviar sugestões de melhorias, reportar ideias e ver o roadmap público de funcionalidades planejadas. Isso cria um canal direto de comunicação entre os usuários e a equipe de desenvolvimento.

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────┐
│                    PÁGINA DE FEEDBACKS                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │   Enviar Nova   │  │       Lista de Sugestões        │   │
│  │    Sugestão     │  │  (pode votar nas de outros)     │   │
│  └─────────────────┘  └─────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Roadmap Público                        ││
│  │   Em Análise  →  Planejado  →  Em Desenvolvimento       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| **Enviar sugestão** | Usuário pode criar nova sugestão com título, descrição e categoria |
| **Votar** | Usuários podem votar (upvote) em sugestões existentes |
| **Status público** | Ver status das sugestões (análise, planejado, em desenvolvimento, concluído) |
| **Minhas sugestões** | Filtrar para ver apenas sugestões próprias |
| **Categorias** | Organizar por: Nova Funcionalidade, Melhoria, Usabilidade, Integração |

## Categorias de Sugestão

| Categoria | Ícone | Descrição |
|-----------|-------|-----------|
| `feature` | Lightbulb | Nova funcionalidade |
| `improvement` | TrendingUp | Melhoria em algo existente |
| `usability` | Sparkles | Usabilidade e interface |
| `integration` | Link | Integrações com outros sistemas |

## Status das Sugestões

| Status | Cor | Descrição |
|--------|-----|-----------|
| `pending` | Cinza | Aguardando análise |
| `under_review` | Amarelo | Em análise pela equipe |
| `planned` | Azul | Planejado para desenvolvimento |
| `in_progress` | Roxo | Em desenvolvimento |
| `completed` | Verde | Implementado |
| `declined` | Vermelho | Não será implementado |

---

## Estrutura do Banco de Dados

### Tabela: `feedbacks`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | Identificador único |
| `user_id` | uuid | Quem criou |
| `company_id` | uuid | Empresa do usuário |
| `title` | text | Título da sugestão |
| `description` | text | Descrição detalhada |
| `category` | text | Categoria (feature, improvement, etc) |
| `status` | text | Status atual (pending, planned, etc) |
| `admin_response` | text | Resposta do admin (opcional) |
| `votes_count` | integer | Contador de votos |
| `is_public` | boolean | Se aparece no roadmap público |
| `created_at` | timestamp | Data de criação |

### Tabela: `feedback_votes`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | Identificador único |
| `feedback_id` | uuid | Referência ao feedback |
| `user_id` | uuid | Quem votou |
| `created_at` | timestamp | Quando votou |

---

## Arquivos a Criar

### 1. Migração SQL
`supabase/migrations/xxx_create_feedbacks.sql`
- Criar tabelas `feedbacks` e `feedback_votes`
- RLS policies para segurança
- Trigger para contar votos automaticamente

### 2. Página Principal
`src/pages/Feedbacks.tsx`
- Lista de sugestões com filtros
- Botão para criar nova sugestão
- Sistema de votação
- Tabs: Todas / Minhas / Roadmap

### 3. Dialog de Nova Sugestão
`src/components/feedbacks/NewFeedbackDialog.tsx`
- Formulário para criar sugestão

### 4. Card de Feedback
`src/components/feedbacks/FeedbackCard.tsx`
- Exibição individual com votos

### 5. Hook de Dados
`src/hooks/useFeedbacks.ts`
- Queries e mutations
- Lógica de votação

### 6. Página Admin (opcional)
`src/pages/admin/AdminFeedbacks.tsx`
- Gerenciar status das sugestões
- Responder aos usuários

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Adicionar rota `/feedbacks` |
| `src/components/layout/Sidebar.tsx` | Adicionar item de menu |
| `src/components/layout/AdminLayout.tsx` | Adicionar link para admin |

---

## Interface do Usuário

### Página Principal

```text
┌──────────────────────────────────────────────────────────────┐
│  💡 Sugestões e Melhorias                                    │
│  Ajude-nos a melhorar o sistema!                             │
│                                           [+ Nova Sugestão]  │
├──────────────────────────────────────────────────────────────┤
│  [Todas] [Minhas] [Roadmap] [Concluídas]                     │
│                                                              │
│  Categoria: [Todas ▼]    Ordenar: [Mais votadas ▼]           │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 🔺 45  │ Integração com WhatsApp Business              │  │
│  │        │ Enviar mensagens automáticas para clientes    │  │
│  │        │ 📦 Nova Funcionalidade  ⏳ Planejado           │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 🔺 32  │ Relatório de comissões por vendedor           │  │
│  │        │ Calcular automaticamente comissões            │  │
│  │        │ 📈 Melhoria  🔍 Em Análise                     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Segurança (RLS)

| Operação | Regra |
|----------|-------|
| **SELECT** | Usuários autenticados podem ver todos os feedbacks públicos |
| **INSERT** | Usuários podem criar feedbacks para sua empresa |
| **UPDATE** | Apenas o criador pode editar (ou admin) |
| **DELETE** | Apenas o criador pode deletar (ou admin) |
| **Votos** | Cada usuário pode votar apenas uma vez por feedback |

---

## Fluxo de Votação

```text
Usuário clica em votar
        ↓
    Já votou?
   /         \
 Sim          Não
  ↓            ↓
Remover     Adicionar
 voto         voto
  ↓            ↓
Atualizar contador via trigger
```

---

## Resumo de Implementação

1. **Banco de dados**: Criar tabelas com RLS
2. **Hook**: `useFeedbacks.ts` com queries e mutations
3. **Página**: Interface com filtros e votação
4. **Menu**: Adicionar ao sidebar
5. **Admin**: Painel para gerenciar sugestões

A página será acessível por todos os usuários logados e permitirá uma comunicação direta sobre melhorias desejadas no sistema.

