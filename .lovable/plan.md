
## Causa raiz confirmada

A query em `src/pages/ProdutosLinha.tsx` (linha 106) inclui a coluna `composition_finished` no SELECT de `company_products`. Essa coluna **não existe no banco**, então o Supabase retorna `400 Bad Request` (confirmado nos network requests).

Consequência:
- `companyProducts` fica vazio (`[]`) na página de produtos da linha.
- Como `isProductActivated()` depende dessa lista, **todos** os produtos do template aparecem como desabilitados, mesmo quando já existem com `is_active=true` no banco.
- Quando o usuário clica em "Habilitar", o RPC roda corretamente e ativa o produto no banco — mas a query continua falhando, então a UI nunca atualiza e o produto continua aparecendo na aba "Desabilitados".

Outros arquivos (`EditarProduto.tsx` e `EditarProdutoEmpresa.tsx`) já contornaram esse mesmo problema com comentários "Temporarily disabled due to missing DB column", confirmando que a coluna nunca foi criada.

## Correção

**Opção escolhida: criar a coluna no banco** (mais simples, restaura a funcionalidade completa de "composição concluída" que já existe na UI).

### 1. Migração SQL
```sql
ALTER TABLE public.company_products
ADD COLUMN IF NOT EXISTS composition_finished boolean NOT NULL DEFAULT false;
```

### 2. Reativar writes nos arquivos que estão comentados
- `src/pages/EditarProduto.tsx` (linha 337): descomentar `composition_finished: formData.composition_finished`.
- `src/pages/EditarProdutoEmpresa.tsx` (linha 365): descomentar `composition_finished: formData.composition_finished`.

### 3. Garantir invalidação correta da cache
Verificar que após `reactivateProductMutation` / `activateMutation`, o queryKey `['company-products', currentCompany.id, 'detailed']` (usado em ProdutosLinha) também é invalidado. Hoje só invalida `['company-products']` parcial — adicionar `queryClient.invalidateQueries({ queryKey: ['company-products'] })` já cobre prefixo, mas confirmar que React Query está com `exact: false` (padrão) para invalidar todos os filhos.

## Arquivos afetados
- Nova migração SQL (1 ALTER TABLE).
- `src/pages/EditarProduto.tsx` (1 linha descomentada).
- `src/pages/EditarProdutoEmpresa.tsx` (1 linha descomentada).

Após a migração, o erro 400 some, `companyProducts` carrega corretamente, e os produtos habilitados passam a aparecer na aba "Habilitados" como esperado.
