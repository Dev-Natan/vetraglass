
## Plano: Excluir todos os produtos templates do banco de dados

### Objetivo
Apagar todos os registros de `product_templates` e dados relacionados **sem alterar nenhum arquivo de código/página**.

### Situação Atual
- Já existe uma migração anterior (`20260515000000_delete_all_product_templates.sql`) que tenta fazer isso, mas ela também apaga `item_templates` — o que pode não ser desejado.
- A migração mais recente (`20260415200000_create_janela_2f_suprema.sql`) criou a "Janela de Correr 02 Folhas" na linha Suprema.
- As páginas `Produtos.tsx` e `ProdutosLinha.tsx` já foram esvaziadas no código anteriormente (retornam arrays vazios), então **nenhuma alteração de página é necessária**.

### Ação: Executar DELETE via insert tool (dados, não schema)
Usar a ferramenta de inserção de dados para executar os seguintes DELETEs na ordem correta de dependências:

```sql
-- 1. Fórmulas de vidro por linha
DELETE FROM public.glass_line_formulas;

-- 2. Composição de produtos da empresa
DELETE FROM public.company_product_items;

-- 3. Nullificar referências em projetos de vidro e orçamentos
UPDATE public.glass_projects SET product_template_id = NULL;
UPDATE public.quote_items SET product_template_id = NULL;

-- 4. Produtos da empresa
DELETE FROM public.company_products;

-- 5. Composição dos templates
DELETE FROM public.product_template_items;

-- 6. Templates de produtos
DELETE FROM public.product_templates;
```

> **Nota:** NÃO vou apagar `item_templates` (perfis, vidros, acessórios) — apenas os **produtos templates**. Os itens (perfis SU-001, etc.) serão preservados para uso futuro.

### O que NÃO será alterado
- Nenhum arquivo `.tsx` ou `.ts`
- Nenhuma página de produtos
- `item_templates` (perfis e materiais permanecem intactos)

### Resultado
Todas as tabelas de product templates estarão vazias, e a página de produtos continuará funcionando normalmente (já retorna lista vazia).
