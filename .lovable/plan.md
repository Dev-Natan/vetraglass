

# Plano: Entrada de Estoque Mediante Compra + Dados Obrigatórios

## Contexto da Regra de Negócio

Você definiu uma regra fundamental:

> "Toda entrada de itens ao estoque deve ser mediante uma compra, pois itens não surgem do nada."

Isso significa que o fluxo atual de "Adicionar Item" livremente deve ser substituído por um fluxo de **Compra de Material**.

---

## Estado Atual vs. Novo Estado

| Aspecto | Atual (Errado) | Novo (Correto) |
|---------|----------------|----------------|
| Adicionar item | Seleção livre + qty opcional | Requer compra |
| Custo | Opcional | **Obrigatório** |
| Preço venda | Opcional | **Obrigatório** |
| Quantidade | Opcional (padrão 0) | **Obrigatório** |
| Linha | Herdada do template | **Obrigatório** |
| Categoria (tipo) | Herdada do template | **Obrigatório** |
| Dados fiscais | Não existe | Opcional (obrigatório para NFe) |

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENTRADA DE ESTOQUE = COMPRA                         │
└─────────────────────────────────────────────────────────────────────────────┘

ANTES (errado):                          DEPOIS (correto):
───────────────                          ─────────────────

  "Adicionar Item"                         "Registrar Compra"
        │                                        │
        ▼                                        ▼
  Seleciona template                     Seleciona template
        │                                        │
        ▼                                        ▼
  Qty = 0 (opcional)                     Qty = ??? (OBRIGATÓRIO)
  Custo = vazio                          Custo = R$ XX (OBRIGATÓRIO)
  Preço = vazio                          Preço = R$ XX (OBRIGATÓRIO)
        │                                Linha = ??? (OBRIGATÓRIO)
        │                                Categoria = ??? (OBRIGATÓRIO)
        │                                        │
        ▼                                        ▼
  Cria company_stock                     Cria/atualiza company_items
  (item do nada)                         Cria/atualiza company_stock
                                         Registra stock_movement (entrada)
                                                 │
                                                 ▼
                                         Item tem ORIGEM rastreável ✓
```

---

## Implementação Detalhada

### 1. Modificar Conceito do Dialog

**De:** `AddStockDialog` (adicionar item)
**Para:** `RegisterPurchaseDialog` (registrar compra)

O dialog atual será reformulado para representar uma **compra de material**.

### 2. Campos Obrigatórios

| Campo | Tipo | Validação | Origem |
|-------|------|-----------|--------|
| Item | Select | Obrigatório | `item_templates` |
| Quantidade | Number | > 0, obrigatório | Input |
| Preço de Custo | Number | >= 0, obrigatório | Input |
| Preço de Venda | Number | >= 0, obrigatório | Input |
| Linha | Select | Obrigatório | `item_templates.linha` ou customizado |
| Categoria | Select | Obrigatório | `item_templates.type` (glass/profile/accessory/service) |

### 3. Campos Fiscais (Opcionais)

Seção expansível "Dados Fiscais" que aparece:
- Sempre visível se `company.modo_fiscal_ativo = true`
- Expandível se modo fiscal inativo

| Campo | Descrição | Obrigatório para NFe |
|-------|-----------|---------------------|
| NCM | Código 8 dígitos | Sim |
| CFOP Venda (UF) | Operação estadual | Sim |
| CFOP Interestadual | Operação interestadual | Sim |
| CEST | Substituição tributária | Não |
| Origem | Procedência (nacional/importado) | Sim |

### 4. Lógica de Salvamento

Ao confirmar a compra:

```text
1. Criar/atualizar company_items
   - Se não existe: INSERT com todos os campos
   - Se existe: UPDATE custo, preço, linha, categoria, fiscal

2. Criar/atualizar company_stock
   - Se não existe: INSERT com quantidade
   - Se existe: quantity += quantidade_comprada

3. Registrar stock_movement (entrada)
   - type = 'entrada'
   - category = 'compra_fornecedor'
   - quantity = quantidade_comprada
   - unit_cost = preço de custo
   - valor_financeiro = qty × custo

4. Invalidar queries de estoque
```

### 5. Validação de Campos Fiscais para NFe

Se a empresa tiver `modo_fiscal_ativo = true`, exibir indicador de "pronto para NFe":

```text
┌────────────────────────────────────────┐
│ ✓ NCM: 70071900                       │
│ ✓ CFOP: 5101                          │
│ ✓ Origem: 0 - Nacional                 │
│ ────────────────────────────────       │
│ ✓ Item pronto para emissão de NFe     │
└────────────────────────────────────────┘
```

---

## Estrutura do Novo Dialog

### Layout Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│ 📦 Registrar Compra de Material                                │
│ Adicione itens ao estoque registrando a compra                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [Buscar item...] [Filtrar por linha ▼] [Categoria ▼]           │
│                                                                 │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                               │
│ │ img │ │ img │ │ img │ │ img │  ← Galeria de itens           │
│ │     │ │     │ │     │ │     │                               │
│ │ SU-1│ │ SU-2│ │ SU-3│ │ SU-4│                               │
│ └──✓──┘ └─────┘ └─────┘ └─────┘                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Item selecionado: SU-007 • Perfil • Suprema                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ DADOS DA COMPRA                                                │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│ │ Quantidade * │ │ Custo (R$) * │ │ Venda (R$) * │             │
│ │    [10]      │ │   [25.00]    │ │   [45.00]    │             │
│ └──────────────┘ └──────────────┘ └──────────────┘             │
│                                                                 │
│ ┌──────────────┐ ┌──────────────┐                              │
│ │ Linha *      │ │ Categoria *  │                              │
│ │ [Suprema ▼]  │ │ [Perfil ▼]   │                              │
│ └──────────────┘ └──────────────┘                              │
│                                                                 │
│ Margem: 80% • Lucro: R$ 20.00/un                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ ▶ Dados Fiscais (opcional)                                     │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ NCM: [70071900] ✓   CEST: [_______]                       │   │
│ │ CFOP UF: [5101 ▼]   CFOP Inter: [6101 ▼]                  │   │
│ │ Origem: [0 - Nacional ▼]                                   │   │
│ │                                                            │   │
│ │ ✓ Item pronto para emissão de NFe                          │   │
│ └───────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                                    [Cancelar]  [Registrar Compra]│
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/estoque/AddStockDialog.tsx` | Renomear e reformular para compra |
| `src/pages/Estoque.tsx` | Atualizar botão e nomenclatura |
| `src/utils/stockMovements.ts` | Garantir entrada com custo |

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| (nenhum novo) | Reutilizaremos `FiscalFieldsCard.tsx` existente |

---

## Regras de Validação

### Antes de Salvar

```typescript
// Campos obrigatórios
if (!selectedItemId) error("Selecione um item");
if (!quantity || quantity <= 0) error("Quantidade obrigatória");
if (!cost || cost < 0) error("Preço de custo obrigatório");
if (!salePrice || salePrice < 0) error("Preço de venda obrigatório");
if (!linha) error("Linha obrigatória");
if (!category) error("Categoria obrigatória");

// Validação de margem (aviso, não bloqueio)
if (salePrice < cost) {
  warn("Preço de venda menor que custo - margem negativa!");
}
```

### Para NFe (modo fiscal ativo)

```typescript
// Indicadores visuais de completude fiscal
const fiscalReady = ncm && cfop_venda && cfop_interestadual && origem;

// Não bloqueia cadastro, apenas mostra status
```

---

## Fluxo de Dados Final

```text
1. Usuário clica "Registrar Compra"
         │
         ▼
2. Seleciona item do catálogo (item_templates)
         │
         ▼
3. Preenche dados obrigatórios:
   - Quantidade
   - Custo
   - Preço de venda
   - Linha (pré-preenchida do template, editável)
   - Categoria (pré-preenchida do template, editável)
         │
         ▼
4. (Opcional) Preenche dados fiscais
         │
         ▼
5. Confirma compra
         │
         ▼
6. Sistema:
   a) Cria/atualiza company_items (custo, venda, linha, cat, fiscal)
   b) Cria/atualiza company_stock (quantidade)
   c) Registra stock_movement (entrada) com custo
         │
         ▼
7. Item disponível no estoque com rastreabilidade total
```

---

## Critérios de Aceite

1. **Botão renomeado:** "Registrar Compra" em vez de "Adicionar Item"
2. **Campos obrigatórios:** Quantidade, Custo, Venda, Linha, Categoria
3. **Validação:** Não permite salvar sem preencher campos obrigatórios
4. **Movimento registrado:** Toda entrada cria `stock_movements` com `unit_cost`
5. **Dados fiscais:** Seção visível quando modo fiscal ativo
6. **Indicador NFe:** Mostra se item está pronto para emissão quando fiscal preenchido
7. **company_items atualizado:** Custo, preço e dados fiscais salvos no item da empresa

---

## Seção Técnica

### Mutation de Compra

```typescript
const registerPurchaseMutation = useMutation({
  mutationFn: async ({
    itemTemplateId,
    quantity,
    cost,
    salePrice,
    linha,
    category,
    fiscalData
  }) => {
    // 1. Upsert company_items
    const { data: companyItem, error: itemError } = await supabase
      .from('company_items')
      .upsert({
        company_id: companyId,
        item_template_id: itemTemplateId,
        name: itemTemplate.name,
        type: category,
        unit: itemTemplate.unit,
        linha,
        cost,
        sale_price: salePrice,
        // Fiscal fields (if provided)
        ...fiscalData
      }, {
        onConflict: 'company_id,item_template_id'
      })
      .select()
      .single();

    if (itemError) throw itemError;

    // 2. Upsert company_stock
    const { data: existingStock } = await supabase
      .from('company_stock')
      .select('id, quantity')
      .eq('company_id', companyId)
      .eq('item_template_id', itemTemplateId)
      .maybeSingle();

    if (existingStock) {
      // Update quantity
      await supabase
        .from('company_stock')
        .update({ 
          quantity: existingStock.quantity + quantity,
          company_item_id: companyItem.id
        })
        .eq('id', existingStock.id);
    } else {
      // Create new stock record
      await supabase
        .from('company_stock')
        .insert({
          company_id: companyId,
          item_template_id: itemTemplateId,
          company_item_id: companyItem.id,
          quantity,
          min_quantity: 0,
          is_active: true
        });
    }

    // 3. Register stock movement (entrada)
    await supabase
      .from('stock_movements')
      .insert({
        company_id: companyId,
        company_item_id: companyItem.id,
        item_template_id: itemTemplateId,
        type: 'entrada',
        category: 'compra_fornecedor',
        quantity,
        unit_cost: cost,
        valor_financeiro: quantity * cost,
        created_by: userId
      });
  }
});
```

### Campos Fiscais no company_items

A tabela `company_items` precisará dos campos fiscais. Vou verificar se já existem ou se precisa de migration:

- NCM, CFOP, CEST, Origem → Verificar se existem na tabela
- Se não existirem, criar migration para adicionar

Nota: Os `item_templates` já têm campos fiscais (NCM, CFOP, etc.). Para empresas, os valores serão armazenados em `company_items` para permitir customização.

