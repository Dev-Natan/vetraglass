
## Causa raiz

**Erro 1 (principal):** Coluna `composition_finished` não existe em `company_products`. Query 400 → `companyProducts = []` → nenhum produto aparece como ativado, `companyProductId` fica `undefined`, e ao navegar usa o ID do template (que não existe em `company_products`).

**Erro 2:** Quando `companyProductId` falta, o código cai no fallback `id: cp.product_template_id || cp.id` e navega para `/produtos/empresa/editar/<template_id>` → "Produto não encontrado".

## Correções

**1. Migração de schema** (adicionar coluna ausente)
```sql
ALTER TABLE company_products 
ADD COLUMN IF NOT EXISTS composition_finished boolean NOT NULL DEFAULT false;
```

**2. `src/pages/ProdutosLinha.tsx`** — tornar a UI resiliente:
- No card do produto, `id` deve ser sempre o `companyProductId` quando existir (não o template_id), evitando navegação errada.
- Botão "Habilitar/Desabilitar/Preços" deve usar exclusivamente `product.companyProductId`. Se ausente após ativação, refazer fetch antes de navegar.
- Adicionar guard: ao clicar em editar, se `companyProductId` faltar, invalidar query e abortar com toast claro (em vez de cair em template_id).

**3. `src/pages/EditarProdutoEmpresa.tsx`** — fallback robusto:
- Se a busca por `id` retornar vazio, tentar uma segunda busca por `product_template_id = id AND company_id = currentCompany.id`. Se encontrar, redirecionar para a URL canônica `/produtos/empresa/editar/<companyProductId>`.
- Mensagem de erro só após ambas as tentativas falharem.

**4. `src/pages/Produtos.tsx` e `TipologiasSheet.tsx`** — remover `composition_finished` do select caso ainda gere 400 antes da migração rodar (ou deixar somente após a migração).

Pronto para aplicar essas mudanças assim que aprovado.
