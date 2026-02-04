
# Adicionar Suporte a "Chaparia" (sheet) no Estoque

## Diagnóstico do Problema

A linha "Chaparia" foi criada na interface, mas o sistema de estoque não permite cadastrar itens desse tipo porque:

1. **A linha "Chaparia"** já existe na tabela `product_linhas` ✓
2. **O tipo "sheet"** já existe na tabela dinâmica `item_types` ✓
3. **O ENUM `item_type`** no banco de dados NÃO contém o valor `sheet` ✗

O ENUM atual só aceita: `glass`, `profile`, `accessory`, `service`

---

## Solução

Adicionar o valor `sheet` ao ENUM `item_type` do PostgreSQL para permitir o cadastro de itens do tipo Chaparia.

---
## Criar categorias chaparia para produtos
## mover produtos do tipo espelho da linha temperado para a linha chaparia
## Alteração no Banco de Dados

Uma única migração SQL para adicionar o novo valor ao ENUM:

```sql
ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'sheet';
```

Isso permitirá que a tabela `item_templates` aceite itens com `type = 'sheet'`.

---

## Código Já Preparado

O código frontend já está pronto para suportar o tipo `sheet`:

| Arquivo | Status |
|---------|--------|
| `AddStockDialog.tsx` | ✓ Já tem label "Chaparia" para `sheet` |
| `useItemTypes.ts` | ✓ Hook dinâmico já busca `sheet` da tabela `item_types` |
| `product_linhas` | ✓ Linha "Chaparia" já cadastrada |
| `item_types` | ✓ Tipo "sheet" com slug, cor e unidade m² |

---

## Resultado Esperado

Após a migração:
- Novos itens poderão ser cadastrados com `type = 'sheet'`
- A categoria "Chaparia" aparecerá no filtro do estoque
- Compras de espelhos, acrílicos e chapas poderão ser registradas normalmente
