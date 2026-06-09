## Contexto

A unificação `/caixa-vendas` + `/financeiro` já foi feita:
- `src/pages/CaixaVendas.tsx` foi removido.
- `src/components/financeiro/CaixaOperacionalTab.tsx` recebeu a lógica.
- `src/pages/Financeiro.tsx` já consome a aba via `useSearchParams` (`?tab=caixa`).
- `App.tsx` já redireciona `/caixa-vendas` e `/vendas` → `/financeiro?tab=caixa`.

O que ficou pendente e está quebrando o build / preview: `src/App.tsx` ainda tem na linha 24 um `lazy(() => import("./pages/CaixaVendas"))` apontando para um arquivo inexistente.

## Alterações

1. **`src/App.tsx`**
   - Remover a linha `const CaixaVendas = lazy(() => import("./pages/CaixaVendas"));`.
   - Confirmar que nenhuma `<Route>` referencia mais o componente `CaixaVendas` (as rotas legadas já usam `<Navigate>`).

2. **Verificação pós-edit**
   - `rg "CaixaVendas" src/` deve retornar vazio.
   - Conferir no preview que `/caixa-vendas` redireciona para `/financeiro?tab=caixa` e a aba "Caixa" carrega normalmente.

Nenhuma outra mudança funcional é necessária — a unificação em si já está implementada.