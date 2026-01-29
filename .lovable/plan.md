
# Plano: Exibir Produtos Somente Após Selecionar Linha

## Objetivo

Melhorar a experiencia do usuario no painel de adicao de produtos do orcamento, exibindo uma mensagem orientativa ao inves de produtos vazios ou todos os produtos antes da selecao de uma linha.

---

## Comportamento Atual vs Desejado

| Situacao | Atual | Desejado |
|----------|-------|----------|
| Sem linha selecionada | Exibe TODOS os produtos | Exibe mensagem "Selecione uma linha" |
| Com linha selecionada | Exibe produtos filtrados | Mantém igual |
| Sem resultados | Exibe "Nenhum produto encontrado" | Mantém igual |

---

## Alteracoes Tecnicas

### Arquivo: `src/components/orcamentos/AddProductPanel.tsx`

**1. Modificar a logica de `filteredProducts`**

Retornar array vazio quando nenhuma linha estiver selecionada:

```typescript
// Linhas 121-153
const filteredProducts = useMemo(() => {
  // Se não há linha selecionada, não mostrar produtos
  if (!selectedLinha) return [];
  
  let products = (companyProducts || []).map(cp => {
    // ... resto do código
  });
  
  // ... filtros existentes
  return products;
}, [companyProducts, selectedLinha, selectedCategory, searchQuery]);
```

**2. Adicionar estado visual para "selecione uma linha"**

No grid de produtos (linhas 348-354), adicionar condicao para exibir mensagem orientativa:

```typescript
{!selectedLinha ? (
  <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
    <Layers className="w-12 h-12 mb-3 opacity-50" />
    <p className="text-sm font-medium">Selecione uma linha</p>
    <p className="text-xs mt-1 text-center">
      Escolha a linha do produto no filtro acima para ver os produtos disponiveis
    </p>
  </div>
) : filteredProducts.length === 0 ? (
  // Estado existente de "nenhum produto encontrado"
) : (
  // Grid de produtos
)}
```

**3. Importar icone adicional**

Adicionar `Layers` aos imports do lucide-react para o estado visual.

---

## Fluxo do Usuario Apos Alteracao

```text
1. Usuario abre painel de adicionar produto
   ↓
2. Ve mensagem "Selecione uma linha" (sem produtos)
   ↓
3. Escolhe uma linha no dropdown
   ↓
4. Produtos da linha aparecem no grid
   ↓
5. Pode filtrar por categoria ou busca
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/orcamentos/AddProductPanel.tsx` | Adicionar condicao para exibir estado vazio antes da selecao de linha |

---

## Resultado Esperado

- Ao abrir o painel, usuario ve mensagem clara para selecionar uma linha
- Apos selecionar a linha, produtos aparecem imediatamente
- Experiencia mais guiada e menos confusa
- Interface mais limpa sem exibir produtos desnecessariamente
