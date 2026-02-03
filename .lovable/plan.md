

# Plano: Linha Chaparia com Categorias, Espessuras e Cores

## Visão Geral

Criar uma nova **Linha de Produto "Chaparia"** dedicada a materiais vendidos por área (m²), como espelhos, vidros comuns, acrílicos, etc. Cada material terá suas próprias combinações de **espessuras** e **cores** com precificação por m².

## Arquitetura Proposta

A proposta reutiliza a infraestrutura existente de precificação de vidros, adaptando-a para a linha Chaparia:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ESTRUTURA DA LINHA CHAPARIA                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Linha: CHAPARIA (product_linhas)                                           │
│     ├── Categorias (glass_types - serão usados como "Tipos de Chaparia"):  │
│     │      ├── Espelho                                                      │
│     │      ├── Vidro Comum                                                  │
│     │      ├── Acrílico                                                     │
│     │      ├── Policarbonato                                                │
│     │      └── ...outras que a empresa adicionar                           │
│     │                                                                       │
│     ├── Espessuras (glass_thicknesses - por empresa):                       │
│     │      ├── 2mm                                                          │
│     │      ├── 3mm                                                          │
│     │      ├── 4mm                                                          │
│     │      └── ...                                                          │
│     │                                                                       │
│     └── Cores (glass_colors - por empresa):                                 │
│            ├── Incolor                                                      │
│            ├── Fumê                                                         │
│            ├── Bronze                                                       │
│            ├── Prata (espelho)                                              │
│            └── ...                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Decisão Arquitetural



### Opção : Criar tabelas específicas para Chaparia
- Criar `sheet_types`, `sheet_thicknesses`, `sheet_colors`, `sheet_price_matrix`
- **Vantagem**: Separação clara entre vidros e chaparia
- **Desvantagem**: Duplicação de código e lógica

**Recomendação**: Opção A, pois a estrutura `glass_*` já representa "materiais por área em m²" e funciona para qualquer tipo de chapa.

---

## Alterações Técnicas

### 1. Migração SQL - Criar Linha e Categorias Iniciais

Inserir dados iniciais no banco:

```sql
-- Criar linha Chaparia
INSERT INTO product_linhas (slug, name, description, color, sort_order, is_active)
VALUES ('chaparia', 'Chaparia', 'Espelhos, vidros comuns, acrílicos e outros materiais por m²', 'cyan', 100, true);

-- Adicionar categorias de chaparia como glass_types
INSERT INTO glass_types (slug, name, description, sort_order, is_active)
VALUES 
  ('espelho', 'Espelho', 'Espelhos comuns e decorativos', 10, true),
  ('vidro_comum', 'Vidro Comum', 'Vidros float não temperados', 11, true),
  ('acrilico', 'Acrílico', 'Chapas de acrílico/PMMA', 12, true),
  ('policarbonato', 'Policarbonato', 'Chapas de policarbonato', 13, true),
  ('espelho_organico', 'Espelho Orgânico', 'Espelhos de acrílico', 14, true)
ON CONFLICT (slug) DO NOTHING;
```

### 2. Atualizar Labels na UI

**Arquivo:** `src/components/admin/categories/GlassTypesTab.tsx`

Atualizar o título e descrição para refletir que a aba gerencia "Tipos de Material" (não apenas vidro):

```typescript
// Antes
<CardTitle>Tipos de Vidro</CardTitle>

// Depois  
<CardTitle>Tipos de Vidro/Chaparia</CardTitle>
<CardDescription>
  Gerencie tipos de vidro, espelhos, acrílicos e outros materiais por m²
</CardDescription>
```

### 3. Atualizar Tab de Preços de Vidros

**Arquivo:** `src/components/precos/GlassPricingTab.tsx`

Ajustar título para incluir chaparia:

```typescript
// Antes
<h2>Preços de Vidros</h2>

// Depois
<h2>Preços de Vidros e Chaparias</h2>
<p>Configure preços por m² para cada combinação de tipo, cor e espessura</p>
```

### 4. Adicionar Tipo de Item "Chaparia" 

**Migração SQL:**

```sql
INSERT INTO item_types (slug, name, color, icon, unit_default, sort_order, is_active)
VALUES ('sheet', 'Chaparia', 'cyan', 'square', 'm²', 5, true)
ON CONFLICT (slug) DO NOTHING;
```

Isso permite cadastrar itens de estoque como "Chaparia" com unidade padrão m².

### 5. Atualizar Fluxo de Vendas no Caixa

**Arquivo:** `src/pages/CaixaVendas.tsx`

Garantir que itens com `unit = 'm²'` ou `type = 'sheet'` tenham cálculo de área automático:

```typescript
// Na lógica de stockDeductions
if (item.unit === 'm²' && item.width && item.height) {
  const areaM2 = (item.width / 1000) * (item.height / 1000) * item.quantity;
  deductionQty = areaM2;
} else {
  deductionQty = item.quantity;
}
```

### 6. Atualizar Cadastro de Estoque

**Arquivo:** `src/components/estoque/AddStockDialog.tsx`

Adicionar o tipo "Chaparia" no seletor de tipos:

```typescript
const itemTypeLabels: Record<string, string> = {
  glass: 'Vidro',
  profile: 'Perfil',
  accessory: 'Acessório',
  service: 'Serviço',
  sheet: 'Chaparia', // Novo
};
```

---

## Fluxo de Uso

### Configuração (Admin/SaaS)
1. A linha "Chaparia" já estará criada com categorias padrão
2. Admin pode adicionar mais categorias em Admin → Categorias → Tipos de Vidro/Chaparia

### Configuração (Empresa)
1. Em Preços → Vidros e Chaparias:
   - Configurar espessuras da empresa (2mm, 3mm, 4mm, etc.)
   - Configurar cores disponíveis (Incolor, Fumê, Prata, etc.)
   - Definir preços por m² para cada combinação tipo+cor+espessura

### Cadastro de Estoque
1. Ir em Estoque → Adicionar Item
2. Selecionar tipo "Chaparia"
3. Sistema já usa unidade m² por padrão

### Venda
1. Caixa → Nova Venda
2. Selecionar item de chaparia
3. Informar dimensões (ex: 1000mm x 800mm)
4. Sistema calcula: 0,8 m² × preço/m² = preço final
5. Ao confirmar, baixa 0,8 m² do estoque

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Migração SQL** | Inserir linha "Chaparia", categorias e tipo de item |
| `src/components/admin/categories/GlassTypesTab.tsx` | Atualizar labels para incluir chaparia |
| `src/components/precos/GlassPricingTab.tsx` | Atualizar título e descrição |
| `src/components/estoque/AddStockDialog.tsx` | Adicionar tipo "Chaparia" |
| `src/pages/CaixaVendas.tsx` | Garantir cálculo de área para itens m² |
| `src/hooks/useItemTypes.ts` | Já funciona dinamicamente, sem alteração necessária |

---

## Benefícios

1. **Reutilização**: Usa toda a infraestrutura existente de precificação por m²
2. **Flexibilidade**: Empresa pode adicionar suas próprias categorias, cores e espessuras
3. **Consistência**: Mesmo fluxo de venda para vidros e chaparias
4. **Rastreabilidade**: Baixa automática de estoque em m²
5. **Organização**: Linha dedicada separa chaparia de outros produtos

