

## Plano: Restaurar páginas e componentes de Produtos

O erro foi interpretar "exclua os produtos" como "remova o módulo de produtos", quando na verdade era para limpar apenas os registros do banco de dados.

### O que precisa ser restaurado:

1. **Páginas removidas indevidamente:**
   - `src/pages/Produtos.tsx`
   - `src/pages/ProdutosLinha.tsx`
   - `src/pages/EditarProduto.tsx`
   - `src/pages/EditarProdutoEmpresa.tsx`
   - `src/pages/admin/ProductTemplates.tsx`
   - `src/pages/admin/AdminLinhas.tsx`
   - `src/components/produtos/` (toda a pasta)

2. **Rotas removidas do `App.tsx`:**
   - `/produtos`, `/produtos/linha/:linha`, `/produtos/editar/:id`, `/produtos/empresa/editar/:id`
   - `/admin/product-templates`, `/admin/linhas`, `/admin/linhas/:linha`

3. **Item do menu lateral (`Sidebar.tsx`):**
   - Restaurar o item "Produtos" no menu

4. **Imports nos componentes de estoque:**
   - Restaurar imports do `FiscalFieldsCard` dos componentes de estoque

5. **Migração para limpar dados:**
   - Criar uma migração SQL que apague apenas os **registros** das tabelas `product_templates`, `product_template_items`, `company_products`, `company_product_items`, `item_templates`, etc. — mantendo as tabelas intactas.

### Como fazer:
- Reverter as alterações no `App.tsx`, `Sidebar.tsx` e componentes de estoque
- Restaurar os arquivos deletados via git (revert das mudanças)
- Criar migração SQL para limpar apenas os dados

