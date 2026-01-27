
# Plano de Implementação: Material Consumption com Separação APROVADO vs PRODUÇÃO

## Contexto do Ajuste

Você sugeriu uma melhoria crítica no fluxo proposto:

```text
                ANTES (Plano Original)              DEPOIS (Seu Ajuste)
                ─────────────────────               ───────────────────────
                
  APROVADO ───► Gera OS                  APROVADO ───► Gera OS
                    │                                      │
                    └── Gera material_consumption          └── Gera material_consumption
                    └── Reserva estoque                    └── Reserva estoque (TRAVA)
                    └── Cria PO para faltantes             └── Cria PO para faltantes
                                                           
                                                     STATUS = 'pending' (aguardando)
                                                           │
                                                           ▼
  (não existe)                           PRODUÇÃO ───► Libera para consumo real
                                                           │
                                                           └── Muda status para 'available'
                                                           
  CONCLUÍDO ───► consumeOSMaterials()    CONCLUÍDO ───► consumeOSMaterials()
                    │                                      │
                    └── Baixa estoque                      └── Baixa estoque
                    └── stock_movement                     └── stock_movement
```

**Benefícios do ajuste:**
- Material não é baixado de algo que pode ser cancelado
- Separação clara entre "demanda calculada" e "consumo executado"
- Permite visualizar materiais necessários antes de iniciar produção
- Fluxo profissional usado em sistemas ERP

---

## Arquitetura Proposta

### Nova Tabela: `material_consumption`

```sql
CREATE TABLE material_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id),
  quote_item_id UUID REFERENCES quote_items(id),
  company_item_id UUID REFERENCES company_items(id),
  item_template_id UUID REFERENCES item_templates(id),
  
  -- Dados do item
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  
  -- Quantidades calculadas
  quantity_calculated NUMERIC NOT NULL DEFAULT 0,
  
  -- Contexto do cálculo (rastreabilidade)
  formula_used TEXT,
  input_width NUMERIC,
  input_height NUMERIC,
  input_quantity INTEGER DEFAULT 1,
  
  -- Status do fluxo
  status TEXT NOT NULL DEFAULT 'pending',
  -- 'pending'   = calculado, aguardando início da produção
  -- 'available' = produção iniciada, material liberado para uso
  -- 'consumed'  = baixado do estoque
  -- 'cancelled' = OS cancelada
  
  -- Rastreabilidade
  released_at TIMESTAMPTZ,        -- quando entrou em produção
  consumed_at TIMESTAMPTZ,        -- quando foi baixado
  stock_movement_id UUID,         -- link com stock_movements
  stock_reservation_id UUID,      -- link com reserva existente
  purchase_order_item_id UUID,    -- se veio de compra
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Fluxo de Status Detalhado

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CICLO DE VIDA DO CONSUMO                           │
└─────────────────────────────────────────────────────────────────────────────┘

1. ORÇAMENTO APROVADO (status='approved')
   │
   ├── Sistema lê composição de cada produto (company_product_items)
   ├── Avalia fórmulas com largura/altura
   ├── Cria registros em material_consumption com status='pending'
   ├── Cria stock_reservations (trava estoque disponível)
   └── Cria purchase_orders para materiais faltantes

2. OS INICIADA (status='in_progress')
   │
   ├── Sistema atualiza material_consumption SET status='available'
   ├── Atualiza released_at = now()
   └── Produção pode visualizar materiais liberados

3. OS CONCLUÍDA (status='completed')
   │
   ├── Sistema executa consumeOSMaterials()
   ├── Para cada material_consumption:
   │     ├── Baixa company_stock
   │     ├── Cria stock_movements (saida)
   │     └── SET status='consumed', consumed_at=now()
   └── stock_reservations → status='consumed'

4. OS CANCELADA (status='cancelled')
   │
   ├── material_consumption SET status='cancelled'
   └── stock_reservations SET status='cancelled' (libera estoque)
```

---

## Implementação

### Fase 1: Criar Tabela e Função de Geração

**1.1. Migration SQL**
```sql
-- Tabela de consumo de materiais calculado
CREATE TABLE material_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  quote_item_id UUID REFERENCES quote_items(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES company_items(id),
  item_template_id UUID REFERENCES item_templates(id),
  
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  
  quantity_calculated NUMERIC NOT NULL DEFAULT 0,
  
  formula_used TEXT,
  input_width NUMERIC,
  input_height NUMERIC,
  input_quantity INTEGER DEFAULT 1,
  
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'available', 'consumed', 'cancelled')),
  
  released_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  stock_movement_id UUID,
  stock_reservation_id UUID REFERENCES stock_reservations(id),
  purchase_order_item_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_mc_ordem_servico ON material_consumption(ordem_servico_id);
CREATE INDEX idx_mc_company ON material_consumption(company_id);
CREATE INDEX idx_mc_status ON material_consumption(status);
CREATE INDEX idx_mc_company_item ON material_consumption(company_item_id);

-- RLS
ALTER TABLE material_consumption ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view own material consumption"
  ON material_consumption FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Company users can insert material consumption"
  ON material_consumption FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Company users can update own material consumption"
  ON material_consumption FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));
```

**1.2. Nova Utility: `generateMaterialConsumption.ts`**
- Lê composição do produto (`company_product_items`)
- Avalia fórmulas usando mathjs/expr-eval
- Insere registros em `material_consumption`
- Vincula com `stock_reservations` existentes

**1.3. Integrar em `AprovarOrcamentoDialog.tsx`**
- Após criar OS (linha ~320), chamar `generateMaterialConsumption()`
- Manter fluxo de reservas existente
- Vincular reservas com consumption records

### Fase 2: Ajustar Transição para Produção

**2.1. Modificar `updateStatusMutation` em `OrdensServico.tsx`**
- Quando status muda para `in_progress`:
  - Atualizar `material_consumption` SET status='available', released_at=now()

```typescript
// Em OrdensServico.tsx, no updateStatusMutation
if (status === 'in_progress') {
  // Liberar materiais para consumo
  await supabase
    .from('material_consumption')
    .update({ 
      status: 'available', 
      released_at: new Date().toISOString() 
    })
    .eq('ordem_servico_id', id)
    .eq('status', 'pending');
}
```

### Fase 3: Atualizar Consumo Final

**3.1. Modificar `consumeOSMaterials()` em `checkGlassStock.ts`**
- Além de consumir `stock_reservations`, atualizar `material_consumption`
- Criar vínculo com `stock_movements` gerados

```typescript
// Em consumeOSMaterials()
// Após criar stock_movement, atualizar consumption:
await supabase
  .from('material_consumption')
  .update({
    status: 'consumed',
    consumed_at: new Date().toISOString(),
    stock_movement_id: stockMovement.id,
  })
  .eq('stock_reservation_id', reservation.id);
```

### Fase 4: UI de Visualização

**4.1. Novo Componente: `OSConsumptionStatus.tsx`**
- Card que mostra materiais calculados vs consumidos
- Indicadores visuais por status (pending/available/consumed)
- Exibido na página de detalhes da OS

```text
┌─────────────────────────────────────────────────────┐
│ 📦 Materiais para Produção                          │
├─────────────────────────────────────────────────────┤
│ ┌────────────────────────┐ ┌────────────────────┐   │
│ │ Perfis de Alumínio     │ │ Vidros             │   │
│ │ ────────────────────── │ │ ──────────────────  │   │
│ │ ● SU-007    4.2m       │ │ ● 8mm Incolor      │   │
│ │ ● SU-041    2.8m       │ │   1.2m² (comprar)  │   │
│ │ ● SU-053    1.6m       │ │                    │   │
│ └────────────────────────┘ └────────────────────┘   │
│                                                     │
│ Status: 🟡 Aguardando início da produção            │
└─────────────────────────────────────────────────────┘
```

### Fase 5: Tratamento de Cancelamento

**5.1. Modificar fluxo de cancelamento**
- Quando OS é cancelada, atualizar todos os consumption para 'cancelled'
- Manter comportamento existente de liberar reservas

---

## Arquivos a Criar/Modificar

| Ação | Arquivo |
|------|---------|
| **Criar** | Migration para tabela `material_consumption` |
| **Criar** | `src/utils/generateMaterialConsumption.ts` |
| **Criar** | `src/components/ordens-servico/OSConsumptionStatus.tsx` |
| Modificar | `src/components/orcamentos/AprovarOrcamentoDialog.tsx` |
| Modificar | `src/pages/OrdensServico.tsx` |
| Modificar | `src/utils/checkGlassStock.ts` |
| Modificar | `src/pages/OrdemServicoDetalhes.tsx` |

---

## Benefícios do Fluxo Ajustado

| Situação | Antes | Depois |
|----------|-------|--------|
| OS cancelada | Materiais já reservados, precisa reverter | Só cancela registros pending |
| Visualização | Não sabe o que precisa até produzir | Dashboard mostra demanda calculada |
| Rastreabilidade | Só sabe o que saiu | Sabe o que foi calculado vs consumido |
| Relatórios | Consumo médio por OS | Consumo real vs planejado |

---

## Ordem de Execução

1. ✅ Criar migration da tabela `material_consumption`
2. ✅ Criar função `generateMaterialConsumption()`
3. ✅ Integrar no `AprovarOrcamentoDialog`
4. ✅ Ajustar transição pending → in_progress
5. ✅ Ajustar `consumeOSMaterials()`
6. ✅ Criar componente de visualização
7. ✅ Testar fluxo completo

---

## Migração de Dados Existentes

Para OS já criadas, podemos:
1. Gerar consumption retroativamente baseado em `stock_reservations` existentes
2. Marcar como 'consumed' se OS já está concluída
3. Ou deixar apenas para novas OS (mais seguro)

Recomendo opção 3 (apenas novas OS) para evitar inconsistências.
