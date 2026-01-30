
# Plano: Automatizar Movimentações de Estoque

## Contexto e Situação Atual

Analisando o módulo de estoque, identifiquei que o sistema já possui uma **infraestrutura sólida** mas com **gaps de automação** em pontos críticos do fluxo:

### O que já funciona automaticamente

| Fluxo | Status | Detalhes |
|-------|--------|----------|
| Consumo de materiais (OS finalizada) | ✅ Automático | `consumeOSMaterials()` baixa estoque e cria `stock_movements` |
| Cancelamento de OS | ✅ Automático | `cancelMaterialConsumption()` cancela reservas |
| Reserva de materiais (aprovação orçamento) | ✅ Automático | `createStockReservation()` reserva materiais |
| Venda no caixa com produtos | ✅ Automático | Deduz estoque dos componentes via fórmulas |
| Cancelamento de venda | ✅ Automático | Restaura estoque dos componentes |

### O que está FALTANDO automação

| Fluxo | Status | Problema |
|-------|--------|----------|
| Recebimento de Pedido de Compra | ❌ Manual | Não cria entrada no estoque nem `stock_movements` |
| Venda de item avulso (não-produto) | ❌ Manual | Não registra `stock_movements` |
| Ativação de produto com composição | ⚠️ Parcial | Cria estoque mas não registra movimento |
| Histórico de saída por produção | ⚠️ Parcial | Usa `company_item_id` mas alguns fluxos usam `item_template_id` |

---

## Solução Proposta

### 1. Automatizar Entrada de Estoque ao Receber Pedido de Compra

**Arquivo:** `src/hooks/usePurchaseOrders.ts` → `useReceivePurchaseOrderItems`

Quando um item de pedido de compra é marcado como "recebido":
1. Criar/atualizar registro em `company_stock` (entrada)
2. Registrar `stock_movements` com categoria `compra_fornecedor`
3. Vincular ao `purchase_order_item_id` para rastreabilidade
4. Invalidar queries de estoque

```text
Fluxo:
Receber PO Item → Buscar company_stock pelo item_template_id
                → Se não existe: criar com quantidade recebida
                → Se existe: somar quantidade
                → Inserir stock_movements (type: entrada, category: compra_fornecedor)
                → Atualizar material_consumption (se vinculado a OS)
```

### 2. Registrar Movimentos ao Vender Itens Avulsos

**Arquivo:** `src/pages/CaixaVendas.tsx` → `newSaleMutation`

Quando uma venda inclui itens avulsos (não são produtos compostos):
1. Já baixa o estoque ✅
2. **FALTA:** Registrar `stock_movements` com categoria `venda`
3. Vincular ao `sale_id` para rastreabilidade

### 3. Normalizar Referências de Item

**Problema:** O sistema tem dois identificadores:
- `item_template_id` (referência global do catálogo)
- `company_item_id` (item específico da empresa)

Alguns fluxos usam um, outros usam outro, causando inconsistências no histórico.

**Solução:**
- Padronizar `stock_movements` para sempre incluir `item_template_id`
- Adicionar coluna `company_item_id` à tabela `stock_movements` (opcional, para rastreabilidade extra)

### 4. Criar Utility Centralizado para Movimentações

**Novo arquivo:** `src/utils/stockMovements.ts`

Centralizar toda lógica de movimentação para evitar duplicação e garantir consistência:

```typescript
// Funções do utility:
export async function registerStockEntry(params: {
  companyId: string;
  itemTemplateId: string;
  quantity: number;
  category: 'compra_fornecedor' | 'devolucao_cliente' | 'ajuste_inventario' | 'transferencia';
  description?: string;
  referenceId?: string;
  referenceType?: 'purchase_order' | 'sale' | 'ordem_servico';
  unitCost?: number;
}): Promise<{ success: boolean; newQuantity: number }>;

export async function registerStockExit(params: {
  companyId: string;
  itemTemplateId: string;
  quantity: number;
  category: 'venda' | 'uso_interno' | 'perda' | 'devolucao_fornecedor' | 'consumo_producao';
  description?: string;
  referenceId?: string;
  referenceType?: 'sale' | 'ordem_servico' | 'expense';
  unitCost?: number;
}): Promise<{ success: boolean; newQuantity: number }>;

export async function ensureStockExists(
  companyId: string,
  itemTemplateId: string,
  initialQuantity?: number
): Promise<string>; // Returns stock ID
```

### 5. Dashboard de Movimentações Automáticas

**Melhoria no histórico:** Adicionar badges visuais para identificar origem:

| Origem | Badge | Cor |
|--------|-------|-----|
| Manual | "Manual" | Cinza |
| Venda | "Venda #0001" | Azul |
| Produção/OS | "OS #0023" | Laranja |
| Compra | "PC #0005" | Verde |
| Ajuste | "Ajuste" | Amarelo |

---

## Arquivos a Criar/Modificar

### Novos Arquivos
```text
src/utils/stockMovements.ts          ← Utility centralizado
```

### Arquivos a Modificar
```text
src/hooks/usePurchaseOrders.ts       ← Adicionar entrada de estoque no recebimento
src/pages/CaixaVendas.tsx            ← Registrar movements em vendas avulsas
src/components/estoque/HistoricoMovimentosTab.tsx  ← Melhorar visualização com badges de origem
src/utils/checkGlassStock.ts         ← Usar utility centralizado
```

### Migration (Schema)
```sql
-- Adicionar campos de rastreabilidade
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS company_item_id UUID REFERENCES public.company_items(id),
ADD COLUMN IF NOT EXISTS reference_id UUID,
ADD COLUMN IF NOT EXISTS reference_type TEXT;

-- Índices
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference 
ON public.stock_movements(reference_type, reference_id);
```

---

## Fluxo Completo Após Implementação

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE ESTOQUE AUTOMATIZADO                    │
└─────────────────────────────────────────────────────────────────────┘

   ENTRADAS AUTOMÁTICAS                    SAÍDAS AUTOMÁTICAS
   ───────────────────                     ─────────────────
   
   📦 Receber Pedido Compra ──┐       ┌── 🛒 Venda no Caixa
                              │       │
   ↩️ Devolução de Cliente ───┼──►    ├── 🏭 Produção (OS finalizada)
                              │  │    │
   ✏️ Ajuste Manual ──────────┘  │    ├── 📤 Devolução Fornecedor
                                 │    │
                                 ▼    ├── ❌ Perda/Quebra
                              ┌──────┐│
                              │STOCK ││── ✏️ Ajuste Manual
                              │      ││
                              │  →   │◄──────────────────────┘
                              └──────┘
                                 │
                                 ▼
                           ┌──────────┐
                           │MOVEMENTS │ ← Histórico completo
                           │          │   com rastreabilidade
                           └──────────┘
```

---

## Critérios de Aceite

1. **Recebimento de Compra:** Ao receber itens de um pedido de compra, o estoque é atualizado automaticamente e movimento de entrada é registrado com referência ao pedido
2. **Venda Avulsa:** Ao vender um item do estoque (não produto composto), movimento de saída é registrado com referência à venda
3. **Histórico Completo:** Tab "Histórico" mostra todas as movimentações com badges indicando a origem (Compra, Venda, Produção, Manual)
4. **Rastreabilidade:** É possível clicar em um movimento e ver detalhes do documento de origem (OS, Venda, Pedido de Compra)
5. **Consistência:** Todas as movimentações usam o mesmo padrão de campos e categorias

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Movimentos duplicados | Verificar se já existe movement com mesmo `reference_id` + `reference_type` |
| Estoque negativo | Validar quantidade disponível antes de saídas (já implementado) |
| Performance | Usar transações e batch inserts quando possível |
| Dados históricos | Migração não afeta movimentos já registrados |

---

## Ordem de Implementação

1. **Migration:** Adicionar campos de rastreabilidade ao schema
2. **Utility:** Criar `stockMovements.ts` com funções centralizadas
3. **Recebimento PO:** Integrar entrada de estoque no `usePurchaseOrders`
4. **Vendas:** Registrar movements em `CaixaVendas`
5. **Histórico:** Melhorar visualização com badges e links
6. **Testes:** Verificar fluxo completo end-to-end
