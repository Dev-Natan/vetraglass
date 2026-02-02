
# Plano: Clarificar Saldo Real vs Fundo Fixo

## Entendimento do Problema

Você está certo! Existem dois conceitos distintos que precisam estar claros:

| Conceito | Descrição | Quem define |
|----------|-----------|-------------|
| **Saldo da Empresa (current_balance)** | Valor REAL que a empresa tem em caixa/banco | Admin/Gerente (atualizado manualmente) |
| **Fundo Fixo (fixed_fund)** | Valor DISPONIBILIZADO para abertura dos caixas do dia (troco, operações) | Admin/Gerente |

### Situação Atual
A interface já separa esses dois valores, mas pode não estar claro para o usuário:
- O **Saldo da Empresa** pode ser atualizado via Depósito/Retirada
- O **Fundo Fixo** é configurado separadamente

### O que vou melhorar

1. **Melhorar labels e descrições** para deixar claro o que cada valor representa
2. **Separar a configuração do saldo real** da configuração do fundo fixo
3. **Adicionar explicações contextuais** em cada tela

## Mudanças na Interface

### 1. Card do Caixa da Empresa (CaixaEmpresaCard.tsx)

**Antes:**
```
Saldo Disponível: R$ 450,00
Fundo fixo: R$ 1.000,00
```

**Depois:**
```
📊 Saldo Real da Empresa: R$ 450,00
   (Valor real que a empresa possui em caixa físico/banco)

💵 Fundo Fixo para Abertura: R$ 1.000,00
   (Valor disponibilizado para abertura dos caixas do dia)
```

### 2. Dialog de Abertura do Caixa (AbrirCaixaDialog.tsx)

Melhorar a explicação:
```
┌────────────────────────────────────────────────────┐
│ 🔓 Abrir Caixa do Dia                              │
│                                                    │
│ O caixa será aberto com o fundo fixo:              │
│                                                    │
│     ┌──────────────────────┐                       │
│     │      R$ 1.000,00     │                       │
│     └──────────────────────┘                       │
│                                                    │
│ ℹ️ Este valor será retirado do saldo da empresa    │
│    e disponibilizado para operações do dia        │
│    (troco, saídas, etc.)                          │
│                                                    │
│ Saldo atual da empresa: R$ 2.500,00                │
│ Saldo após abertura: R$ 1.500,00                   │
│                                                    │
│                    [Cancelar] [Confirmar]          │
└────────────────────────────────────────────────────┘
```

### 3. Dialog de Configuração (MovimentoCaixaEmpresaDialog.tsx)

Melhorar as descrições:

**Para Saldo Inicial:**
```
💰 Saldo Real da Empresa (R$)
"Informe quanto a empresa possui REALMENTE em caixa 
físico ou conta bancária no momento."
```

**Para Fundo Fixo:**
```
💵 Fundo Fixo para Abertura de Caixa (R$)
"Valor que será disponibilizado para abertura dos 
caixas do dia. Este valor é usado como troco inicial 
e para cobrir pequenas despesas durante as operações."
```

### 4. Aba Financeiro (CaixaEmpresaTab.tsx)

Melhorar cards de resumo:

```
┌─────────────────────────┐  ┌─────────────────────────┐
│ 💰 Saldo Real           │  │ 💵 Fundo Fixo           │
│                         │  │                         │
│ R$ 450,00               │  │ R$ 1.000,00             │
│                         │  │                         │
│ Valor que a empresa     │  │ Valor para abertura     │
│ possui em caixa/banco   │  │ dos caixas do dia       │
└─────────────────────────┘  └─────────────────────────┘

⚠️ Atenção: O saldo está abaixo do fundo fixo. 
   Não será possível abrir caixas do dia.
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/caixa/CaixaEmpresaCard.tsx` | Melhorar labels e adicionar descrições |
| `src/components/caixa/AbrirCaixaDialog.tsx` | Adicionar explicação sobre a transferência |
| `src/components/caixa/MovimentoCaixaEmpresaDialog.tsx` | Melhorar descrições dos campos |
| `src/components/financeiro/CaixaEmpresaTab.tsx` | Adicionar descrições nos cards |

## Lógica Preservada

A lógica de negócio permanece a mesma:
1. Admin define o **Saldo Real** (depósitos/retiradas)
2. Admin define o **Fundo Fixo** (configuração)
3. Ao abrir caixa: `Saldo Real -= Fundo Fixo` (transfere para caixa do dia)
4. Ao fechar caixa: `Saldo Real += Valor Contado` (retorna para empresa)

## Resumo das Melhorias

1. **Labels mais claros**: "Saldo Real da Empresa" vs "Fundo Fixo para Abertura"
2. **Descrições contextuais**: Explicando o que cada valor significa
3. **Fluxo explicado**: Mostrando que o fundo fixo sai do saldo real ao abrir
4. **Alertas inteligentes**: Quando saldo < fundo fixo, alerta fica mais claro
