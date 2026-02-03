# Plano: Linha Chaparia com Categorias, Espessuras e Cores

## Status: ✅ TOTALMENTE CONCLUÍDO

## Resumo de Implementação

### Fase 1: Estrutura Base ✅
- Criada linha "Chaparia" em `product_linhas`
- Adicionadas categorias em `glass_types`: Espelho, Vidro Comum, Acrílico, Policarbonato, Espelho Orgânico
- Adicionado tipo de item "sheet" (Chaparia) com unidade padrão m²

### Fase 2: Atualizações de UI ✅
- `GlassTypesTab.tsx`: Título "Tipos de Vidro e Chaparia"
- `GlassPricingTab.tsx`: Título "Preços de Vidros e Chaparias"
- `AddStockDialog.tsx`: Adicionado tipo "Chaparia"
- `StockFilters.tsx`: Adicionado filtro "Chaparias" no dropdown de categorias

### Fase 3: Lógica de Vendas ✅
- Cálculo automático de área em m² para dedução de estoque
- Restauração correta de área ao cancelar vendas
- Fórmula: `areaM2 = (largura_mm / 1000) * (altura_mm / 1000) * quantidade`

### Fase 4: Rastreabilidade de Estoque ✅
- Registro de `stock_movements` ao deduzir estoque em vendas (categoria: `venda_direta`)
- Registro de `stock_movements` ao restaurar estoque por cancelamento (categoria: `estorno_venda`)
- Campos: `reference_id`, `reference_type` para vincular à venda original

### Fase 5: Configurações Padrão ✅
- Cores padrão adicionadas para todas as empresas:
  - Prata, Incolor, Fumê, Bronze, Verde, Preto, Branco
- Espessuras padrão adicionadas para todas as empresas:
  - 2mm, 3mm, 4mm, 5mm, 6mm, 8mm, 10mm

---

## Fluxo Completo

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VENDA DE CHAPARIA COM RASTREABILIDADE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Operador abre Nova Venda no Caixa                                      │
│     ↓                                                                       │
│  2. Seleciona item "Espelho Orgânico 3mm" (tipo: sheet, unidade: m²)       │
│     ↓                                                                       │
│  3. Informa dimensões: 1000mm x 800mm, Quantidade: 1                       │
│     ↓                                                                       │
│  4. Sistema calcula:                                                        │
│     • Área = (1000 / 1000) × (800 / 1000) × 1 = 0,8 m²                     │
│     • Preço = 0,8 × R$ 150,00/m² = R$ 120,00                               │
│     ↓                                                                       │
│  5. Ao confirmar venda:                                                     │
│     ✓ Cria registro em sales                                                │
│     ✓ Cria registro em sale_items com width/height                          │
│     ✓ Deduz 0,8 m² do company_stock                                         │
│     ✓ Registra stock_movement (saída, venda_direta, ref: sale_id)          │
│     ↓                                                                       │
│  6. Se cancelar a venda:                                                    │
│     ✓ Restaura 0,8 m² ao company_stock                                      │
│     ✓ Registra stock_movement (entrada, estorno_venda)                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Linha Chaparia, categorias, tipo item, cores e espessuras |
| `src/components/admin/categories/GlassTypesTab.tsx` | Labels atualizados |
| `src/components/precos/GlassPricingTab.tsx` | Labels atualizados |
| `src/components/estoque/AddStockDialog.tsx` | Tipo "Chaparia" |
| `src/components/estoque/StockFilters.tsx` | Filtro "Chaparias" |
| `src/pages/CaixaVendas.tsx` | Cálculo m², stock_movements em vendas/cancelamentos |

---

## Benefícios Implementados

1. ✅ **Reutilização**: Usa infraestrutura existente de precificação por m²
2. ✅ **Flexibilidade**: Empresa pode adicionar categorias, cores e espessuras
3. ✅ **Consistência**: Mesmo fluxo de venda para vidros e chaparias
4. ✅ **Rastreabilidade**: Toda movimentação registrada em `stock_movements`
5. ✅ **Organização**: Linha dedicada e filtros específicos para chaparia
6. ✅ **Padrões**: Cores e espessuras comuns pré-configurados
