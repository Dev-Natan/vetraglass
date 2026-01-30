

# Plano: Ajustes Profissionais no Fluxo de Estoque

## Resumo dos Ajustes Solicitados

Você identificou 5 pontos críticos para blindar o sistema de estoque:

| # | Ajuste | Impacto |
|---|--------|---------|
| 1 | Lista de compra não pode reduzir abaixo da demanda | Evita furo no estoque |
| 2 | Recebimento não altera quantity_calculated | Mantém rastreabilidade |
| 3 | Baixa vem de material_consumption, não da compra | Lógica correta |
| 4 | Regras claras de cancelamento por status | Evita inconsistências |
| 5 | Relatório de diferença (Planejado vs Consumido) | Visibilidade de desperdício |

---

## Estado Atual do Sistema

### O que JÁ está correto ✅

| Item | Status | Evidência |
|------|--------|-----------|
| Baixa vem de `material_consumption` | ✅ OK | `consumeOSMaterials()` processa `stock_reservations` vinculados ao `material_consumption` |
| Recebimento não altera `quantity_calculated` | ✅ OK | `useReceivePurchaseOrderItems` só atualiza `status = 'available'`, não toca no cálculo |
| Cancelamento chama `cancelMaterialConsumption()` | ✅ OK | Em `OrdensServico.tsx` linha 158-162 |

### O que PRECISA ser ajustado ⚠️

| Item | Problema | Solução |
|------|----------|---------|
| Validação de quantidade mínima na lista | Não existe | Adicionar validação no componente |
| Cancelamento não verifica status `consumed` | Permite cancelar qualquer OS | Bloquear ou exigir estorno |
| Reservas não são liberadas ao cancelar | Função RPC cancela mas não libera | Cancelar + liberar reservas |
| Relatório de diferença | Não existe | Criar componente novo |

---

## Implementação Detalhada

### 1️⃣ Lista de Compra: Validação de Quantidade Mínima

**Regra:** `quantityToPurchase ≥ (quantityNeeded - quantityAvailable)`

**Onde implementar:** Novo componente `EditPurchaseListDialog.tsx` (a ser criado)

```typescript
// Lógica de validação
interface PurchaseListItem {
  itemId: string;
  itemName: string;
  quantityNeeded: number;      // Do material_consumption
  quantityAvailable: number;   // Estoque atual - reservas
  quantityToPurchase: number;  // Editável pelo usuário
}

// Mínimo obrigatório
const minimumRequired = Math.max(0, item.quantityNeeded - item.quantityAvailable);

// Validação ao editar
const validateQuantity = (newValue: number) => {
  if (newValue < minimumRequired) {
    toast.error(`Mínimo necessário: ${minimumRequired} ${item.unit}`);
    return minimumRequired; // Força o mínimo
  }
  return newValue; // Permite comprar A MAIS
};
```

**UI:** Campo numérico com `min={minimumRequired}` e mensagem de ajuda mostrando o mínimo.

### 2️⃣ Cancelamento de OS: Regras por Status

**Arquivo:** `src/pages/OrdensServico.tsx` - função `updateStatusMutation`

**Regras a implementar:**

| Status Consumo | Ação ao Cancelar OS | Implementação |
|----------------|---------------------|---------------|
| `pending` | Cancelar consumo + liberar reservas | ✅ Já funciona |
| `available` | Cancelar consumo, não mexe no estoque | ✅ Já funciona |
| `consumed` | **BLOQUEAR** ou exigir estorno manual | ⚠️ A implementar |

**Código a adicionar em `OrdensServico.tsx`:**

```typescript
// Antes de permitir cancelar
const checkCanCancel = async (osId: string): Promise<{ canCancel: boolean; reason?: string }> => {
  const { data: consumption } = await supabase
    .from('material_consumption')
    .select('status')
    .eq('ordem_servico_id', osId);
  
  const hasConsumed = consumption?.some(c => c.status === 'consumed');
  
  if (hasConsumed) {
    return {
      canCancel: false,
      reason: 'Esta OS já teve materiais consumidos do estoque. Para cancelar, é necessário fazer estorno manual dos materiais.'
    };
  }
  
  return { canCancel: true };
};
```

**UI:** Dialog de confirmação mostrando aviso quando há materiais consumidos.

### 3️⃣ Melhorar Função de Cancelamento de Reservas

**Arquivo:** `src/utils/checkGlassStock.ts` - função `cancelStockReservation`

Atualmente só marca como `cancelled`. Precisa também:
- Invalidar caches de estoque
- Logar auditoria

**Arquivo:** `src/utils/generateMaterialConsumption.ts` - função RPC `cancel_os_materials`

A função RPC atual já faz o correto (cancela `material_consumption` com status `pending` ou `available`), mas precisamos garantir que as `stock_reservations` também sejam canceladas.

**Ajuste na RPC (via migration):**

```sql
-- Adicionar cancelamento de reservas
CREATE OR REPLACE FUNCTION public.cancel_os_materials(_ordem_servico_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER;
BEGIN
  -- 1. Verificar se há materiais já consumidos
  IF EXISTS (
    SELECT 1 FROM material_consumption 
    WHERE ordem_servico_id = _ordem_servico_id 
    AND status = 'consumed'
  ) THEN
    RAISE EXCEPTION 'Não é possível cancelar: há materiais já consumidos';
  END IF;

  -- 2. Cancelar material_consumption
  UPDATE public.material_consumption
  SET 
    status = 'cancelled',
    updated_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND status IN ('pending', 'available');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- 3. Cancelar stock_reservations vinculadas
  UPDATE public.stock_reservations
  SET 
    status = 'cancelled',
    cancelled_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND status = 'reserved';
  
  RETURN updated_count;
END;
$function$;
```

### 4️⃣ Garantir Baixa Apenas de Material Consumption

**Status atual:** ✅ Já implementado corretamente

A função `consumeOSMaterials()` em `checkGlassStock.ts`:
1. Busca `stock_reservations` da OS (linha 311-316)
2. Para cada reserva, baixa do `company_stock` (linha 337-349)
3. Cria `stock_movements` (linha 353-367)
4. Atualiza `material_consumption` (linha 379-388)

Não precisa de alteração, apenas documentar.

### 5️⃣ Relatório de Diferença (Planejado vs Consumido)

**Novo componente:** `src/components/ordens-servico/OSMaterialDifferenceReport.tsx`

**Dados a exibir:**

| Material | Planejado | Consumido | Diferença | Status |
|----------|-----------|-----------|-----------|--------|
| Vidro 8mm | 5.00 m² | 5.20 m² | +0.20 m² | ⚠️ Sobra |
| Perfil SU-007 | 12.00 m | 11.50 m | -0.50 m | ✅ Economia |
| Parafuso M8 | 24 un | 24 un | 0 | ✅ Exato |

**Query para o relatório:**

```sql
SELECT 
  mc.item_name,
  mc.unit,
  mc.quantity_calculated as planejado,
  COALESCE(sm.quantity, 0) as consumido,
  COALESCE(sm.quantity, 0) - mc.quantity_calculated as diferenca
FROM material_consumption mc
LEFT JOIN stock_movements sm ON sm.id = mc.stock_movement_id
WHERE mc.ordem_servico_id = $1
  AND mc.status = 'consumed';
```

**Onde exibir:**
- Aba "Materiais" nos detalhes da OS (quando status = 'completed')
- Relatório gerencial de produção (futuro)

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/ordens-servico/OSMaterialDifferenceReport.tsx` | Relatório de diferença |
| `src/components/pedidos-compra/EditPurchaseListDialog.tsx` | Editor de lista com validação de mínimo |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/OrdensServico.tsx` | Adicionar verificação antes de cancelar |
| `src/components/ordens-servico/OSConsumptionStatus.tsx` | Integrar relatório de diferença |

## Migration (Schema)

```sql
-- Melhorar função de cancelamento
CREATE OR REPLACE FUNCTION public.cancel_os_materials(_ordem_servico_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER;
  has_consumed BOOLEAN;
BEGIN
  -- Verificar se há materiais já consumidos
  SELECT EXISTS (
    SELECT 1 FROM material_consumption 
    WHERE ordem_servico_id = _ordem_servico_id 
    AND status = 'consumed'
  ) INTO has_consumed;
  
  IF has_consumed THEN
    RAISE EXCEPTION 'Cancelamento bloqueado: materiais já foram consumidos do estoque';
  END IF;

  -- Cancelar material_consumption
  UPDATE public.material_consumption
  SET status = 'cancelled', updated_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND status IN ('pending', 'available');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Cancelar reservas vinculadas
  UPDATE public.stock_reservations
  SET status = 'cancelled', cancelled_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND status = 'reserved';
  
  RETURN updated_count;
END;
$function$;
```

---

## Critérios de Aceite

1. **Lista de compra:** Não permite digitar quantidade menor que `(necessário - disponível)`
2. **Cancelamento bloqueado:** Se OS tem status `consumed`, exibe erro ao tentar cancelar
3. **Reservas liberadas:** Ao cancelar OS com status `pending/available`, reservas são canceladas
4. **Relatório visível:** Na aba Materiais da OS concluída, mostra diferença planejado vs consumido
5. **Consistência:** Baixa de estoque SEMPRE vem de `material_consumption`, nunca direto de compra

---

## Ordem de Implementação

1. **Migration:** Atualizar RPC `cancel_os_materials` com validação e cancelamento de reservas
2. **Cancelamento:** Adicionar verificação em `OrdensServico.tsx` antes de permitir cancelar
3. **Lista de compra:** Criar `EditPurchaseListDialog.tsx` com validação de mínimo
4. **Relatório:** Criar `OSMaterialDifferenceReport.tsx`
5. **Integração:** Adicionar relatório na aba de materiais da OS

