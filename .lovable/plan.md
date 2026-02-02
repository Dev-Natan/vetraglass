
# Plano: Abertura do Caixa Diretamente no Módulo Caixa e Vendas

## Contexto da Mudança

Você quer alterar o fluxo de abertura do caixa:

| Atual | Novo |
|-------|------|
| Administrador/Gerente abre o caixa no módulo Financeiro | Funcionário abre o caixa diretamente no módulo Caixa e Vendas |
| Valor de abertura é digitado na hora | Valor de abertura é **fixo** (definido pelo admin no `fixed_fund`) |
| Funcionário precisa solicitar abertura por notificação | Funcionário abre sozinho com valor pré-definido |

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NOVO FLUXO DE ABERTURA                              │
└─────────────────────────────────────────────────────────────────────────────┘

ANTES:                                   DEPOIS:
───────                                  ──────

  Funcionário → Módulo Caixa             Funcionário → Módulo Caixa
        │                                        │
        ▼                                        ▼
  "Caixa Fechado"                        "Caixa Fechado"
  "Solicitar Abertura" (notificação)     [Abrir Caixa] (botão habilitado)
        │                                        │
        ▼                                        ▼
  Admin recebe notificação               Dialog simplificado:
  Admin vai ao Financeiro                "Abrir caixa com R$ XXX?"
  Admin digita valor de abertura         (valor fixo do fixed_fund)
        │                                        │
        ▼                                        ▼
  Caixa aberto                           Caixa aberto
```

## O que muda

### 1. Onde o admin define o valor
O valor de abertura do caixa continua sendo o **`fixed_fund`** (fundo fixo) configurado na tabela `company_cash`. Esse valor já existe e é definido pelo admin em:
- **Financeiro → Caixa → Configurações** (ícone de engrenagem)

### 2. Dialog de Abertura Simplificado
O funcionário verá um dialog **sem campo de entrada**, apenas confirmando:
- "O caixa será aberto com R$ 500,00 (fundo fixo)"
- Botões: [Cancelar] [Confirmar Abertura]

### 3. Quem pode abrir
**Todos os usuários** da empresa poderão abrir o caixa (não apenas admin/manager), desde que:
- Haja saldo suficiente no caixa da empresa
- O fundo fixo esteja configurado
- Não exista outro caixa aberto

## Mudanças Técnicas

### Arquivo 1: `src/pages/CaixaVendas.tsx`

Adicionar:
1. Estado para controlar o dialog de abertura
2. Mutation para abrir caixa (mesma lógica que estava no Financeiro)
3. Substituir a seção "Caixa Fechado" para mostrar botão de abertura para todos
4. Importar e usar o novo `AbrirCaixaSimplificadoDialog`

### Arquivo 2: `src/components/caixa/AbrirCaixaDialog.tsx`

Modificar para modo simplificado:
- Remover campo de input do valor
- Mostrar valor fixo (read-only) baseado no `fixed_fund`
- Mensagem clara: "O caixa será aberto com o fundo fixo de R$ XXX"
- Validação de saldo continua funcionando

### Arquivo 3: `src/components/financeiro/CaixaEmpresaTab.tsx`

Remover:
- Botão "Abrir Caixa" (a abertura agora é feita no Caixa e Vendas)
- Manter apenas o botão "Fechar Caixa" para auditoria/correções

## Novo Fluxo do Funcionário

```text
1. Funcionário acessa Caixa e Vendas
         │
         ▼
2. Vê card "Caixa Fechado" com botão [Abrir Caixa]
         │
         ▼
3. Clica no botão
         │
         ▼
4. Dialog aparece:
   ┌────────────────────────────────────────┐
   │ 🔓 Abrir Caixa do Dia                  │
   │                                        │
   │ O caixa será aberto com o fundo fixo:  │
   │                                        │
   │     ┌────────────────────┐             │
   │     │    R$ 500,00       │             │
   │     └────────────────────┘             │
   │                                        │
   │ Saldo da empresa: R$ 2.500,00          │
   │ Após abertura: R$ 2.000,00             │
   │                                        │
   │            [Cancelar] [Confirmar]      │
   └────────────────────────────────────────┘
         │
         ▼
5. Sistema executa `open_daily_cash` com o fixed_fund
         │
         ▼
6. Caixa aberto, funcionário pode vender
```

## Validações Mantidas

- Verifica se já existe caixa aberto → bloqueia
- Verifica se empresa tem caixa configurado → bloqueia
- Verifica se há saldo suficiente no caixa da empresa → bloqueia

## Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `src/pages/CaixaVendas.tsx` | Adicionar lógica de abertura + botão para todos |
| `src/components/caixa/AbrirCaixaDialog.tsx` | Simplificar para valor fixo (read-only) |
| `src/components/financeiro/CaixaEmpresaTab.tsx` | Remover abertura, manter apenas fechamento |

## Critérios de Aceite

1. Funcionário pode abrir o caixa diretamente no módulo Caixa e Vendas
2. Valor de abertura é fixo (vem do `fixed_fund` do `company_cash`)
3. Funcionário não pode alterar o valor de abertura
4. Admin define o fundo fixo em Financeiro → Caixa → Configurações
5. Validações de saldo continuam funcionando
6. Após abertura, funcionário pode registrar vendas normalmente
