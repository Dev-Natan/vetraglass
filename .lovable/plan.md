
# Plano: Correção do Retorno do Fundo Fixo no Fechamento de Caixa

## Problema Identificado

O sistema atual só retorna o **excedente** (valor acima do fundo fixo) para o caixa da empresa, mas **não retorna o próprio fundo fixo**. Isso causa uma perda contábil progressiva a cada ciclo de abertura/fechamento.

### Exemplo do Bug:
```text
┌─────────────────────────────────────────────────────────────┐
│ ABERTURA                                                    │
├─────────────────────────────────────────────────────────────┤
│ Caixa Empresa: R$ 2.000                                     │
│ Transfere fundo fixo: -R$ 500                               │
│ Caixa Empresa após: R$ 1.500                                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ OPERAÇÃO DO DIA                                             │
├─────────────────────────────────────────────────────────────┤
│ Vendas em dinheiro: +R$ 300                                 │
│ Total no caixa: R$ 800                                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ FECHAMENTO (ATUAL - INCORRETO)                              │
├─────────────────────────────────────────────────────────────┤
│ Excedente = R$ 800 - R$ 500 = R$ 300                        │
│ Retorna apenas R$ 300 para empresa                          │
│ Caixa Empresa final: R$ 1.800                               │
│ ❌ PERDA DE R$ 200!                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Solução Proposta

Alterar a lógica de fechamento para **retornar TODO o valor contado** para o caixa da empresa, incluindo o fundo fixo.

### Fluxo Corrigido:
```text
┌─────────────────────────────────────────────────────────────┐
│ FECHAMENTO (CORRIGIDO)                                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Registrar entrada: fundo fixo + lucro do dia             │
│    → R$ 500 (fundo) + R$ 300 (lucro) = R$ 800               │
│                                                             │
│ 2. Compensar adiantamentos pendentes (se houver)            │
│                                                             │
│ 3. Caixa Empresa: R$ 1.500 + R$ 800 = R$ 2.300              │
│ ✅ Saldo correto!                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementação Técnica

### 1. Atualizar função `close_daily_cash_multiuser`

**Mudanças na lógica:**

```sql
-- ANTES (incorreto):
v_gross_excess := GREATEST(0, v_actual_amount - v_fixed_fund);
-- Só retorna o excedente

-- DEPOIS (correto):
-- Retorna TODO o valor contado (fundo + excedente)
-- Primeiro: retorna o fundo fixo
-- Depois: calcula e retorna o lucro (após compensações)
```

**Nova lógica de fechamento:**

1. **Retornar o fundo fixo** para a empresa (R$ 500)
2. **Calcular o lucro do dia**: `actual_amount - fixed_fund`
3. **Compensar adiantamentos** do lucro (se houver)
4. **Retornar lucro líquido** após compensações

### 2. Criar duas movimentações separadas

Para maior clareza contábil:

| Movimento | Categoria | Valor | Descrição |
|-----------|-----------|-------|-----------|
| 1 | `retorno_fundo_fixo` | R$ 500 | "Retorno do fundo fixo do caixa" |
| 2 | `lucro_caixa` | R$ 300 | "Recolhimento do caixa - lucro do dia" |

### 3. Atualizar campos de retorno

Adicionar novos campos ao retorno da função:
- `fixed_fund_returned`: Valor do fundo fixo retornado
- `profit_collected`: Lucro do dia recolhido

---

## Arquivos a Modificar

### Banco de Dados

| Arquivo | Alteração |
|---------|-----------|
| Nova migração SQL | Recriar função `close_daily_cash_multiuser` com lógica corrigida |

### Frontend (Ajustes visuais)

| Arquivo | Alteração |
|---------|-----------|
| `src/components/caixa/FecharCaixaDialog.tsx` | Exibir separadamente: fundo fixo + lucro no resumo |

---

## Detalhes da Migração SQL

```sql
-- Lógica principal corrigida:

-- 1. Calcular valores
v_profit := v_actual_amount - v_fixed_fund; -- Pode ser negativo (prejuízo)
v_total_to_return := v_actual_amount; -- Todo o dinheiro contado

-- 2. Se há adiantamentos pendentes, compensar do lucro (não do fundo)
IF v_profit > 0 THEN
  v_compensation_result := compensate_advances_on_closing(..., v_profit);
  v_net_profit := (v_compensation_result->>'net_excess')::NUMERIC;
ELSE
  v_net_profit := v_profit; -- Prejuízo integral
END IF;

-- 3. SEMPRE retornar o fundo fixo (se foi contado)
v_fund_to_return := LEAST(v_actual_amount, v_fixed_fund);

-- 4. Registrar movimentação de retorno do fundo fixo
INSERT INTO company_cash_movements (
  type, category, amount, description
) VALUES (
  'entrada', 'retorno_fundo_fixo', v_fund_to_return,
  'Retorno do fundo fixo do caixa do dia'
);

-- 5. Registrar movimentação de lucro (se houver)
IF v_net_profit > 0 THEN
  INSERT INTO company_cash_movements (
    type, category, amount, description
  ) VALUES (
    'entrada', 'lucro_caixa', v_net_profit,
    'Recolhimento - lucro do caixa do dia'
  );
END IF;

-- 6. Atualizar saldo da empresa
UPDATE company_cash
SET current_balance = current_balance + v_fund_to_return + GREATEST(0, v_net_profit);
```

---

## Casos de Uso Testados

### Caso 1: Fechamento Normal (com lucro)
- Abertura: R$ 500
- Vendas: R$ 300
- Contado: R$ 800
- **Retorno**: R$ 500 (fundo) + R$ 300 (lucro) = R$ 800 ✅

### Caso 2: Fechamento Exato (sem lucro)
- Abertura: R$ 500
- Vendas: R$ 0
- Contado: R$ 500
- **Retorno**: R$ 500 (fundo) + R$ 0 (lucro) = R$ 500 ✅

### Caso 3: Fechamento com Falta
- Abertura: R$ 500
- Contado: R$ 450
- **Retorno**: R$ 450 (todo o contado)
- Registra falta de R$ 50 para compensação futura ✅

### Caso 4: Com Adiantamentos Pendentes
- Abertura: R$ 500
- Vendas: R$ 400
- Contado: R$ 900
- Adiantamentos: R$ 200
- **Retorno**: R$ 500 (fundo) + R$ 400 (lucro) - R$ 200 (compensação) = R$ 700 ✅

---

## Resumo das Alterações

1. **Migração SQL**: Recriar `close_daily_cash_multiuser` para retornar o fundo fixo + lucro
2. **Frontend**: Atualizar `FecharCaixaDialog.tsx` para exibir breakdown claro
3. **Testes**: Validar os 4 casos de uso acima
