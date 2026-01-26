
# Plano: Corrigir Reativação de Produtos

## Diagnóstico do Problema

Quando um produto é ativado, desativado e depois ativado novamente, ele não aparece na aba "Habilitados". Isso acontece porque:

1. **Primeira ativação**: A função cria um registro em `company_products` com `is_active = true`
2. **Desativação**: O sistema atualiza `is_active = false`
3. **Reativação**: A função RPC encontra o registro existente, mas **não atualiza o `is_active` de volta para `true`**

O código atual da função faz:
```sql
SELECT id INTO v_product_id
FROM company_products
WHERE company_id = _company_id AND product_template_id = _product_template_id;

IF v_product_id IS NULL THEN
    -- Criar novo produto (com is_active = true)
    INSERT INTO company_products (..., is_active = true) ...
END IF;
-- Se já existe, apenas continua sem atualizar is_active!
```

---

## Solução Proposta

### 1. Atualizar a função RPC no banco de dados

Modificar a função `activate_product_template_for_company` para incluir uma atualização do campo `is_active` quando o produto já existir:

```sql
IF v_product_id IS NULL THEN
    -- Criar novo produto
    INSERT INTO company_products (..., is_active = true) RETURNING id INTO v_product_id;
ELSE
    -- Reativar produto existente
    UPDATE company_products 
    SET is_active = true, updated_at = now()
    WHERE id = v_product_id;
END IF;
```

Esta alteração garante que, independentemente do estado anterior, ao chamar a função de ativação o produto sempre ficará com `is_active = true`.

---

## Detalhes Técnicos

### Arquivo de Migração SQL

Será criada uma nova migração SQL que atualiza a função:

```sql
CREATE OR REPLACE FUNCTION activate_product_template_for_company(
  _company_id UUID,
  _product_template_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_item RECORD;
  v_company_item_id UUID;
  v_sort_counter INTEGER := 0;
BEGIN
  SELECT id INTO v_product_id
  FROM company_products
  WHERE company_id = _company_id
    AND product_template_id = _product_template_id;

  IF v_product_id IS NULL THEN
    -- Criar o produto da empresa
    INSERT INTO company_products (...)
    VALUES (..., is_active = true, ...)
    RETURNING id INTO v_product_id;
  ELSE
    -- CORREÇÃO: Reativar produto existente
    UPDATE company_products 
    SET is_active = true, updated_at = now()
    WHERE id = v_product_id;
  END IF;

  -- Resto da lógica (deletar e reinserir itens de composição)
  ...
END;
$$;
```

### Resultado Esperado

Após a implementação:

| Ação | Antes | Depois |
|------|-------|--------|
| Ativar produto novo | ✅ Aparece em "Habilitados" | ✅ Aparece em "Habilitados" |
| Desativar produto | ✅ Some de "Habilitados" | ✅ Some de "Habilitados" |
| Reativar produto | ❌ Não aparece | ✅ Aparece em "Habilitados" |

---

## Resumo das Alterações

| Componente | Alteração |
|------------|-----------|
| **Banco de dados** | Nova migração com função `activate_product_template_for_company` corrigida para incluir `UPDATE ... SET is_active = true` |
| **Frontend** | Nenhuma alteração necessária - a lógica de exibição já está correta |
