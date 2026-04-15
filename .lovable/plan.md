

## Plano: Resolver erro "Could not find 'has_multiple_sides' column"

### Diagnóstico

Confirmei via inspeção direta do banco de dados que as colunas **não existem** nas tabelas reais:

- `product_templates` **NÃO TEM** `has_multiple_sides`
- `product_template_items` **NÃO TEM** `side`
- `company_products` **NÃO TEM** `has_multiple_sides`
- `company_product_items` **NÃO TEM** `side`
- `quote_items` **NÃO TEM** `width_b` / `height_b`

Existem 3 arquivos de migração no repositório tentando adicionar essas colunas, mas **nenhum foi aplicado ao banco de dados**. Arquivos `.sql` criados manualmente via `code--write` ou `code--exec` não são automaticamente executados pelo sistema de migração do Lovable Cloud.

### Causa Raiz

O sistema de migração do Lovable Cloud requer que as migrações sejam criadas através da **ferramenta de migração de banco de dados** (database migration tool), não simplesmente escrevendo arquivos `.sql` no diretório `supabase/migrations/`.

### Plano de Resolução

#### Passo 1: Limpar migrações órfãs
Remover os 3 arquivos de migração que nunca foram aplicados para evitar conflitos futuros:
- `supabase/migrations/20260315143000_add_has_multiple_sides_to_product_templates.sql`
- `supabase/migrations/20260317143000_add_has_multiple_sides_to_product_templates.sql`
- `supabase/migrations/20260412203000_f2a66cfd-c4a8-4a3f-9e45-55886f8e2a2a.sql`
- `supabase/migrations/20260413000000_fix_multi_side_columns.sql`

#### Passo 2: Aplicar migração corretamente via ferramenta de migração
Usar a ferramenta correta de migração do Lovable Cloud para executar:

```sql
ALTER TABLE public.product_templates 
  ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;

ALTER TABLE public.product_template_items 
  ADD COLUMN IF NOT EXISTS side TEXT;

ALTER TABLE public.company_product_items 
  ADD COLUMN IF NOT EXISTS side TEXT;

ALTER TABLE public.quote_items 
  ADD COLUMN IF NOT EXISTS width_b NUMERIC;

ALTER TABLE public.quote_items 
  ADD COLUMN IF NOT EXISTS height_b NUMERIC;
```

#### Passo 3: Aguardar regeneração do `types.ts`
Após a migração ser aplicada, o arquivo `src/integrations/supabase/types.ts` será regenerado automaticamente com as novas colunas.

#### Passo 4: Verificar e corrigir referências no código
Garantir que `ProductTemplates.tsx` e demais arquivos usem as colunas corretamente (já estão usando, só precisam que o banco aceite).

### Resultado Esperado
Após este plano, salvar um produto com "Múltiplos Lados" ativado vai persistir corretamente no banco de dados.

