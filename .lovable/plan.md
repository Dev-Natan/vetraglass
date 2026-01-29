

# Plano: Corrigir Cache de Produtos Desabilitados nos Orçamentos

## Problema Identificado

Os produtos desabilitados estão aparecendo na aba de adicionar produtos porque o cache do React Query não está sendo invalidado corretamente.

### Causa Raiz

O sistema utiliza query keys diferentes para os mesmos dados:

| Página | Query Key |
|--------|-----------|
| `ProdutosLinha.tsx` | `['company-products', companyId]` |
| `AddProductPanel.tsx` | `['company-products-with-templates', companyId]` |
| `ProductSelectionSheet.tsx` | `['company-products-with-templates', companyId]` |

Quando um produto é ativado/desativado em `ProdutosLinha`, apenas `['company-products']` e `['custom-products']` são invalidados, mas **NÃO** `['company-products-with-templates']`.

Resultado: O painel de adicionar produtos exibe dados em cache que ainda contêm produtos inativos.

---

## Solucao

Adicionar invalidacao do cache `company-products-with-templates` em todas as mutacoes que alteram o status de produtos.

---

## Alteracoes Tecnicas

### Arquivo: `src/pages/ProdutosLinha.tsx`

Modificar 4 mutacoes para incluir invalidacao adicional:

**1. `activateProductMutation` (linha 147)**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['company-products'] });
  queryClient.invalidateQueries({ queryKey: ['company-products-with-templates'] }); // NOVO
  toast.success('Produto ativado para venda!');
},
```

**2. `deactivateProductMutation` (linhas 169-170)**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['company-products'] });
  queryClient.invalidateQueries({ queryKey: ['custom-products'] });
  queryClient.invalidateQueries({ queryKey: ['company-products-with-templates'] }); // NOVO
  toast.success('Produto desativado para venda');
},
```

**3. `deactivateCustomProductMutation` (linhas 193-194)**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['company-products'] });
  queryClient.invalidateQueries({ queryKey: ['custom-products'] });
  queryClient.invalidateQueries({ queryKey: ['company-products-with-templates'] }); // NOVO
  toast.success('Produto personalizado desativado');
},
```

**4. `reactivateCustomProductMutation` (linhas 215-216)**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['company-products'] });
  queryClient.invalidateQueries({ queryKey: ['custom-products'] });
  queryClient.invalidateQueries({ queryKey: ['company-products-with-templates'] }); // NOVO
  toast.success('Produto personalizado reativado!');
},
```

---

## Resumo das Alteracoes

| Arquivo | Linhas | Descricao |
|---------|--------|-----------|
| `ProdutosLinha.tsx` | 147 | Adicionar invalidacao em activateProductMutation |
| `ProdutosLinha.tsx` | 169-170 | Adicionar invalidacao em deactivateProductMutation |
| `ProdutosLinha.tsx` | 193-194 | Adicionar invalidacao em deactivateCustomProductMutation |
| `ProdutosLinha.tsx` | 215-216 | Adicionar invalidacao em reactivateCustomProductMutation |

---

## Resultado Esperado

- Quando um produto for ativado ou desativado na pagina de Produtos, o cache sera limpo
- Ao abrir o painel de adicionar produtos no Orcamento, uma nova busca sera feita
- Somente produtos com `is_active = true` serao exibidos

