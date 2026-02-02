

# Plano: Corrigir Cálculo de Preços - Preço POR Vidro em vez de Preço + Vidro

## Problema Identificado

O sistema está **somando** o preço base do produto + preço do vidro, quando na verdade **o preço do vidro SUBSTITUI o preço base** quando o produto usa vidro.

### Exemplo Real do Banco

| Produto | price_per_sqm (base) | Vidro Incolor 6mm | Vidro Verde 8mm |
|---------|---------------------|-------------------|-----------------|
| Janela de Correr 2 Folhas | R$ 700/m² | R$ 900/m² | R$ 750/m² |

**Cálculo ATUAL (errado):**
```
R$ 700 (base) + R$ 900 (vidro incolor) = R$ 1.600/m²
```

**Cálculo CORRETO:**
```
Vidro Incolor → R$ 900/m²
Vidro Verde → R$ 750/m²
(o preço base é ignorado quando há vidro selecionado)
```

### Código Problemático

```text
src/components/orcamentos/AddProductPanel.tsx (linha 206)
┌────────────────────────────────────────────────────────────────────────────┐
│ // Total price per sqm = product price + glass price (ERRADO!)             │
│ const combinedPricePerSqm = productPricePerSqm +                           │
│   (hasGlass && productUsesGlass ? glassPricePerSqm : 0);                   │
└────────────────────────────────────────────────────────────────────────────┘
```

## Lógica Correta

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                      REGRA DE PRECIFICAÇÃO                                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SE produto USA VIDRO e vidro está SELECIONADO:                            │
│     → Preço = preço do vidro selecionado (substitui o base)                │
│                                                                             │
│  SE produto USA VIDRO mas nenhum vidro selecionado:                        │
│     → Preço = preço base do produto (fallback)                             │
│                                                                             │
│  SE produto NÃO USA VIDRO:                                                 │
│     → Preço = preço base do produto                                        │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

## Alterações Necessárias

### 1. `src/components/orcamentos/AddProductPanel.tsx` - Corrigir Cálculo

**De (linha ~202-207):**
```typescript
const productPricePerSqm = Number(companyProduct?.price_per_sqm) || Number(companyProduct?.base_price) || 0;

// Total price per sqm = product price + glass price (if applicable)
const combinedPricePerSqm = productPricePerSqm + (hasGlass && productUsesGlass ? glassPricePerSqm : 0);
```

**Para:**
```typescript
const productBasePricePerSqm = Number(companyProduct?.price_per_sqm) || Number(companyProduct?.base_price) || 0;

// Se produto usa vidro E tem vidro selecionado, usar preço do vidro
// Caso contrário, usar preço base do produto
const finalPricePerSqm = 
  (hasGlass && productUsesGlass && glassPricePerSqm > 0) 
    ? glassPricePerSqm  // Preço definido pelo vidro
    : productBasePricePerSqm; // Preço base (quando não usa vidro ou não tem vidro configurado)

const basePrice = customPrice !== null ? customPrice : finalPricePerSqm;
```

### 2. `src/components/produtos/EditProductPricingDialog.tsx` - Corrigir Tooltips

**De (linhas 219-221):**
```typescript
<TooltipContent>
  <p>Ative para configurar preços de vidro</p>
  <p>que serão somados ao preço base</p>  // ERRADO
</TooltipContent>
```

**Para:**
```typescript
<TooltipContent>
  <p>Ative para configurar preços por tipo de vidro</p>
  <p>O preço do vidro define o preço final do produto</p>
</TooltipContent>
```

### 3. `src/components/orcamentos/AddProductPanel.tsx` - Atualizar UI de Exibição

Quando um produto com vidro é selecionado, mostrar claramente que **o preço é determinado pelo vidro**:

**Atualizar preview do preço (linha ~457):**
```typescript
{/* Preço por m² */}
<div className="text-sm text-muted-foreground">
  {hasGlass && productUsesGlass && selectedGlassPrice ? (
    <span className="text-green-600">
      Preço do vidro {selectedGlassPrice.glass_color} {selectedGlassPrice.thickness_mm}mm: 
      {formatCurrency(glassPricePerSqm)}/m²
    </span>
  ) : (
    <span>Preço base: {formatCurrency(productBasePricePerSqm)}/m²</span>
  )}
</div>
```

### 4. Ajustar Exibição no Seletor de Vidro

Mostrar que o preço muda ao selecionar diferentes vidros, deixando claro que **não é uma soma**:

```typescript
// Na lista de opções de vidro
<SelectItem key={price.id} value={price.id}>
  <div className="flex justify-between w-full">
    <span>{price.glass_color} {price.thickness_mm}mm</span>
    <span className="text-primary font-medium">
      {formatCurrency(price.price_per_sqm)}/m²
    </span>
  </div>
</SelectItem>
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/orcamentos/AddProductPanel.tsx` | Corrigir lógica de cálculo: usar preço do vidro em vez de somar |
| `src/components/produtos/EditProductPricingDialog.tsx` | Corrigir tooltip explicativo |

## Fluxo Correto Após Correção

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PRECIFICAÇÃO DE PRODUTO COM VIDRO                        │
└─────────────────────────────────────────────────────────────────────────────┘

1. PRODUTO: Janela de Correr 2 Folhas
   └── uses_glass: true
   └── price_per_sqm: R$ 700 (fallback se não selecionar vidro)

2. SELEÇÃO DE VIDRO:
   ├── Vidro Incolor 6mm → Preço final: R$ 900/m²
   ├── Vidro Verde 8mm   → Preço final: R$ 750/m²
   └── Vidro Fumê 8mm    → Preço final: R$ 850/m²

3. CÁLCULO FINAL:
   └── Área (1.2m × 1.5m) = 1.8 m²
   └── Preço = 1.8 × R$ 900 = R$ 1.620 ✓

   (NÃO é: 1.8 × (700 + 900) = R$ 2.880 ❌)
```

## Seção Técnica

### Lógica de Fallback

```typescript
// Nova lógica de precificação
const getFinalPricePerSqm = (): number => {
  // Se não usa vidro, usar preço base
  if (!productUsesGlass) {
    return productBasePricePerSqm;
  }
  
  // Se usa vidro mas não tem vidro selecionado, usar preço base como fallback
  if (!hasGlass || !selectedGlassPrice || glassPricePerSqm <= 0) {
    return productBasePricePerSqm;
  }
  
  // Se usa vidro e tem vidro selecionado, o preço do vidro É o preço do produto
  return glassPricePerSqm;
};
```

### Impacto no Cálculo de Custos

A mesma lógica se aplica ao custo:

```typescript
// Custo também vem do vidro quando aplicável
const getFinalCostPerSqm = (): number => {
  if (!productUsesGlass || !hasGlass || !selectedGlassPrice) {
    return productBaseCostPerSqm;
  }
  return selectedGlassPrice.cost_per_sqm || 0;
};
```

## Benefícios

1. **Precificação correta**: Preço reflete a realidade do negócio
2. **Transparência**: Cliente vê exatamente o preço por tipo de vidro
3. **Simplicidade**: Um preço por combinação (cor + espessura)
4. **Flexibilidade**: Cada vidro pode ter margem diferente
5. **Consistência**: Mesmo comportamento em orçamentos e vendas

