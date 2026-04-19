
## Causa raiz

A função `activate_all_products_for_company` é **chamada no botão "Habilitar Todos"** (`src/pages/Produtos.tsx`), mas **não existe no banco de dados**. Verifiquei a lista de funções RPC disponíveis e só existe `activate_product_template_for_company` (singular, ativa um por vez).

Resultado: o RPC retorna erro 404/PGRST202, o `toast.promise` cai no `error` e nada é ativado. O mesmo vale para `activate_all_linhas_for_company` (também não existe).

Adicionalmente, o botão "Baixar Tudo" no `AddLinhaSheet.tsx` chama `activate_product_template_for_company` em loop no cliente — funciona, mas é lento e não cria entrada em `company_linhas` antes da ativação, então a linha pode não aparecer corretamente após a operação.

## Correção

**1. Criar função SQL `activate_all_products_for_company`** (migração)
- Itera sobre todos `product_templates` ativos.
- Para cada um, executa a mesma lógica de `activate_product_template_for_company` (cria/reativa `company_products`, copia composição, garante `company_items` e `company_stock`).
- Retorna `INTEGER` com a contagem de produtos ativados.
- `SECURITY DEFINER`, valida `user_belongs_to_company`.

**2. Criar função SQL `activate_all_linhas_for_company`** (migração)
- Faz `INSERT ... ON CONFLICT DO NOTHING` em `company_linhas` para todas as linhas distintas existentes em `product_templates` ativos.
- Marca `is_active = true`.

**3. Ajustar `src/pages/Produtos.tsx`**
- Garantir que o `success` do `toast.promise` use o retorno corretamente (já está OK, só depende das funções existirem).

**4. Ajustar `src/components/produtos/AddLinhaSheet.tsx`** (opcional, melhora performance)
- Substituir o loop de RPCs no cliente por uma nova função `activate_linha_products_for_company(_company_id, _linha)` que faz tudo em uma única transação no banco.

## Arquivos afetados
- Nova migração SQL com 2-3 funções RPC.
- `src/pages/Produtos.tsx` (sem mudança de lógica, apenas valida que o RPC existe).
- `src/components/produtos/AddLinhaSheet.tsx` (refatorar para usar novo RPC).

Aprova para eu aplicar a migração e ajustar o frontend?
