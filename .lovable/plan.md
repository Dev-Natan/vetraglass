

# Plano: Corrigir Violações do Controle Rigoroso de Estoque

## Problema Identificado

Após sua explicação sobre a **regra de ouro** ("Estoque só sabe o que entrou e o que saiu"), identifiquei 2 pontos no código que **violam esse princípio**:

| Local | Problema | Violação |
|-------|----------|----------|
| `stockMovements.ts` linha 171 | `ensureStockExists()` cria estoque ao registrar entrada | Cria item do nada |
| `ActivateWithCompositionDialog.tsx` linhas 521-541 | Cria estoque com qty=0 ao ativar produto | Cria item do nada |

---

## Solução: Controle Manual Obrigatório

### Princípio

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    REGRA DE OURO DO ESTOQUE                         │
└─────────────────────────────────────────────────────────────────────┘

  ❌ ERRADO                              ✅ CERTO
  ─────────                              ────────
  
  Sistema cria estoque                   Usuário cadastra item
  automaticamente                        manualmente
       │                                      │
       ▼                                      ▼
  Item aparece                           Item existe no
  "do nada"                              sistema
       │                                      │
       ▼                                      ▼
  Sem controle                           Compra registrada
  nem rastreabilidade                    como ENTRADA
                                              │
                                              ▼
                                         Produção registrada
                                         como SAÍDA
```

---

## Mudanças Técnicas

### 1. Modificar `stockMovements.ts`

**Antes (linha 171):**
```typescript
const { stockId, currentQuantity } = await ensureStockExists(
  companyId, 
  itemTemplateId,
  ...
);
```

**Depois:**
```typescript
// Buscar estoque existente - NÃO cria automaticamente
const { data: existingStock } = await supabase
  .from('company_stock')
  .select('id, quantity')
  .eq('company_id', companyId)
  .eq('item_template_id', itemTemplateId)
  .maybeSingle();

if (!existingStock) {
  return {
    success: false,
    newQuantity: 0,
    error: 'Item não cadastrado no estoque. Cadastre-o primeiro antes de registrar movimentações.',
  };
}
```

Vou também:
- Renomear `ensureStockExists` para `getExistingStock` (opcional, para clareza)
- Tornar a função não criar automaticamente

### 2. Remover Criação Automática na Ativação de Produto

**Arquivo:** `ActivateWithCompositionDialog.tsx`

**Remover completamente as linhas 521-541:**
```typescript
// REMOVER ESTE BLOCO:
// 5. Add items to company stock with zero quantity
const uniqueItemTemplateIds = [...new Set(localItems.map(i => i.item_template_id))];
for (const itemTemplateId of uniqueItemTemplateIds) {
  // ... cria estoque automaticamente
}
```

**Substituir por:** Nada. O estoque só será criado quando o usuário cadastrar manualmente.

### 3. Ajustar Fluxo de Recebimento de Compra

**Arquivo:** `usePurchaseOrders.ts`

Quando `registerStockEntry()` retornar erro (item não existe no estoque):
- Retornar erro explicativo para o frontend
- Frontend deve mostrar diálogo para cadastrar o item primeiro

```typescript
// Se o item tem item_template_id, registrar entrada no estoque
if (itemDetail?.item_template_id) {
  const result = await registerStockEntry({
    companyId: purchaseOrder.company_id,
    itemTemplateId: itemDetail.item_template_id,
    quantity: item.receivedQuantity,
    category: 'compra_fornecedor',
    ...
  });
  
  // NOVO: Tratar erro se item não cadastrado
  if (!result.success && result.error?.includes('não cadastrado')) {
    throw new Error(`O item "${itemDetail.description}" não está cadastrado no estoque. Cadastre-o primeiro em Estoque > Adicionar Item.`);
  }
}
```

---

## Fluxo Correto Após Correção

```text
Cenário: Receber compra de material novo
───────────────────────────────────────

ANTES (errado):
  Receber compra → ensureStockExists() → Cria item → Registra entrada
                         ↓
                   ❌ Item surge do nada

DEPOIS (correto):
  Receber compra → Buscar estoque → Não existe? → ERRO!
                                         ↓
                   "Cadastre o item primeiro"
                                         ↓
                   Usuário vai em Estoque → Adicionar Item
                                         ↓
                   Item cadastrado manualmente ✅
                                         ↓
                   Tenta receber novamente → Sucesso ✅
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/utils/stockMovements.ts` | `registerStockEntry()` falha se item não existe |
| `src/components/produtos/ActivateWithCompositionDialog.tsx` | Remover criação automática de estoque |
| `src/hooks/usePurchaseOrders.ts` | Tratar erro de item não cadastrado |

---

## Comportamento Esperado

| Ação | Antes | Depois |
|------|-------|--------|
| Ativar produto | Cria estoque qty=0 | Não cria nada |
| Receber compra de item não cadastrado | Cria estoque e registra entrada | Erro + orienta cadastrar |
| Cadastrar item manualmente | Cria estoque | Cria estoque ✅ |
| Receber compra de item cadastrado | Registra entrada | Registra entrada ✅ |
| Produção consome material | Registra saída | Registra saída ✅ |

---

## Resumo da Correção

1. **Estoque nunca é criado automaticamente** - apenas via ação explícita do usuário
2. **Movimentações falham** se o item não existe - com mensagem clara orientando o cadastro
3. **Rastreabilidade total** - todo item no estoque tem origem conhecida (cadastro manual)
4. **Entradas e saídas** funcionam apenas para itens já cadastrados

Esta abordagem garante que o estoque seja **transparente** e **auditável**, como você especificou.

