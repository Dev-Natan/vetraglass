

# Plano: Baixa Automática de Estoque ao Faturar/Concluir Serviço

## Problema Identificado

O sistema atual tem uma lacuna no fluxo de baixa de estoque para OS (Ordens de Serviço):

1. **Quando OS é concluída** → `consumeOSMaterials()` é chamado
2. **Se há `stock_reservations`** → Baixa funciona corretamente ✓
3. **Se NÃO há `stock_reservations`** → Apenas marca `material_consumption` como "consumed", mas **NÃO deduz do estoque físico** ✗

Isso ocorre porque a empresa pode não ter reservado materiais previamente (por falta de estoque no momento da aprovação, ou por ser um produto customizado).

## Fluxo Proposto

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE BAIXA DE ESTOQUE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Orçamento Aprovado → OS Criada                                     │
│     ↓                                                                   │
│  2. material_consumption gerado com:                                   │
│     • item_name, item_type, unit                                       │
│     • quantity_calculated (via fórmulas)                               │
│     • company_item_id (se disponível)                                  │
│     • item_template_id (referência global)                             │
│     ↓                                                                   │
│  3. OS Concluída (status = 'completed')                                │
│     ↓                                                                   │
│  4. consumeOSMaterials() MELHORADO:                                    │
│     • Se tem stock_reservations → usa fluxo atual                      │
│     • Se NÃO tem → busca material_consumption                          │
│       e deduz diretamente do company_stock                             │
│       baseado em company_item_id ou item_template_id                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Alterações Técnicas

### 1. Modificar `consumeOSMaterials()` em `src/utils/checkGlassStock.ts`

**Problema atual:** Quando não há reservas, a função apenas marca `material_consumption` como consumed sem deduzir do estoque.

**Solução:** Usar os registros de `material_consumption` para calcular e executar a baixa real:

- Buscar todos os registros de `material_consumption` da OS
- Para cada registro:
  - Buscar o `company_stock` correspondente via `company_item_id` ou `item_template_id`
  - Deduzir `quantity_calculated` do estoque
  - Criar registro em `stock_movements` com categoria `consumo_producao`
  - Atualizar `material_consumption` com `stock_movement_id`

### 2. Garantir que `company_item_id` seja preenchido no `material_consumption`

**Problema:** A função `generateMaterialConsumption()` pode não preencher corretamente o `company_item_id`.

**Verificação necessária:** Garantir que ao gerar consumo:
- Se `company_product_items` existe → usar `company_item_id` diretamente
- Se não existe → buscar via `item_template_id` + `company_id`

### 3. Atualizar `generateMaterialConsumption()` em `src/utils/generateMaterialConsumption.ts`

Garantir que o `company_item_id` seja buscado quando a composição vem do template:

```typescript
// Se veio de template sem company_item_id, buscar o item da empresa
if (!component.company_item_id && component.item_template_id) {
  const { data: companyItem } = await supabase
    .from('company_items')
    .select('id')
    .eq('company_id', companyId)
    .eq('item_template_id', component.item_template_id)
    .maybeSingle();
  
  if (companyItem) {
    component.company_item_id = companyItem.id;
  }
}
```

## Exemplo Prático

**Cenário:** Janela de Correr 2 Folhas - Linha Gold (1000mm x 1000mm)
- Item componente: LG-052 (perfil)
- Fórmula: `Largura` → 1000mm = 1 metro

**O que acontece:**
1. Aprovação gera `material_consumption`:
   - `item_name: "LG-052"`
   - `quantity_calculated: 1` (metro)
   - `company_item_id: "uuid-do-item-empresa"`
   - `status: "pending"`

2. Quando OS é concluída:
   - Busca `company_stock` onde `company_item_id = "uuid-do-item-empresa"`
   - Deduz 1 metro do estoque
   - Cria `stock_movements` com `quantity: 1, type: "saida", category: "consumo_producao"`
   - Atualiza `material_consumption.status = "consumed"`

## Arquivos a Modificar

1. **`src/utils/checkGlassStock.ts`**
   - Expandir `consumeOSMaterials()` para deduzir estoque diretamente de `material_consumption`
   - Adicionar fallback via `item_template_id` quando `company_item_id` não está presente

2. **`src/utils/generateMaterialConsumption.ts`**
   - Garantir que `company_item_id` seja preenchido quando o item da empresa existe

## Considerações de Segurança

- A baixa só ocorre quando a OS é marcada como "completed"
- O cancelamento da OS continua bloqueado se materiais já foram consumidos
- Movimentos são rastreáveis via `stock_movements` com `reference_type = 'ordem_servico'`

## Impacto

- **Produção**: Equipe pode concluir serviços sabendo que o estoque será atualizado automaticamente
- **Financeiro**: Relatórios de custo de materiais refletirão consumo real
- **Estoque**: Quantidades em tempo real, sem necessidade de ajustes manuais

