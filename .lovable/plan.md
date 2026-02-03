# Plano: Linha Chaparia com Categorias, Espessuras e Cores

## Status: ✅ CONCLUÍDO

## O Que Foi Implementado

### 1. ✅ Migração SQL
- Criada linha "Chaparia" em `product_linhas`
- Adicionadas categorias em `glass_types`: Espelho, Vidro Comum, Acrílico, Policarbonato, Espelho Orgânico
- Adicionado tipo de item "sheet" (Chaparia) com unidade padrão m²

### 2. ✅ Atualizações de UI
- `GlassTypesTab.tsx`: Título atualizado para "Tipos de Vidro e Chaparia"
- `GlassPricingTab.tsx`: Título atualizado para "Preços de Vidros e Chaparias"
- `AddStockDialog.tsx`: Adicionado tipo "Chaparia" no seletor

### 3. ✅ Lógica de Vendas (CaixaVendas.tsx)
- Atualizado `stockDeductions` para calcular área em m² para itens com unidade m²
- Atualizado `stockRestorations` para restaurar área corretamente ao cancelar vendas
- Fórmula: `areaM2 = (largura_mm / 1000) * (altura_mm / 1000) * quantidade`

## Fluxo Final

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VENDA DE CHAPARIA                                        │
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
│     • Cria registro em sales                                                │
│     • Cria registro em sale_items com width/height                          │
│     • Deduz 0,8 m² do company_stock                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Próximos Passos (Opcionais)

- [ ] Registrar `stock_movements` para rastreabilidade completa
- [ ] Adicionar relatórios específicos de chaparia
- [ ] Configurar espessuras e cores padrão para chaparia

