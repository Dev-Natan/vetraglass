
## Plano: Upload de Imagens para Produtos e Itens da Empresa

### Contexto
O usuário deseja que os usuários do sistema possam adicionar imagens personalizadas aos **produtos** e **itens/materiais** criados para sua empresa.

### Situação Atual
| Entidade | Suporte a Imagem | Upload Funcional |
|----------|------------------|------------------|
| `company_products` | Sim (`image_url`) | Parcial - apenas em `EditarProdutoEmpresa` |
| `company_items` | Sim (`image_url`) | Não implementado |

### Mudanças Necessárias

#### 1. Criar Bucket de Storage para Itens
Criar um bucket `company-item-images` no storage para armazenar as imagens dos itens personalizados das empresas.

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-item-images', 'company-item-images', true);

-- RLS policy para permitir upload por usuários autenticados
CREATE POLICY "Authenticated users can upload company item images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-item-images');

CREATE POLICY "Anyone can view company item images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'company-item-images');
```

#### 2. Adicionar Upload de Imagem no Diálogo de Criação de Item Personalizado
**Arquivo:** `src/components/estoque/CreateCustomItemDialog.tsx`

- Adicionar campo de upload de imagem
- Processar imagem com fundo branco usando `processFileWithWhiteBackground`
- Fazer upload para bucket `company-item-images`
- Salvar path no campo `image_url` da tabela `company_items`

#### 3. Adicionar Upload de Imagem no Diálogo de Edição de Item
**Arquivo:** `src/components/estoque/EditItemPriceDialog.tsx`

- Adicionar botão de upload/troca de imagem na seção do item
- Permitir remover imagem existente
- Suportar tanto itens do template quanto itens personalizados
- Para itens personalizados (`company_items`), atualizar `image_url`

#### 4. Melhorar Upload no Diálogo de Criação de Produto Personalizado
**Arquivo:** `src/components/produtos/CreateCustomProductDialog.tsx`

- Adicionar campo de upload de imagem no formulário
- Seguir mesmo padrão de `EditarProdutoEmpresa.tsx`
- Upload para bucket `company-product-images` já existente

#### 5. Adicionar Upload no Diálogo de Edição de Produto Personalizado
**Arquivo:** `src/components/produtos/EditCustomProductDialog.tsx`

- Adicionar seção de imagem similar ao `CreateCustomProductDialog`
- Permitir trocar ou remover imagem

---

### Detalhes Técnicos

#### Componente Reutilizável de Upload de Imagem
Criar um componente genérico `ImageUploadField` que encapsule:
- Preview da imagem atual
- Botão de upload
- Indicador de loading
- Processamento de fundo branco
- Validação de tipo de arquivo

```text
┌─────────────────────────────────────┐
│  ┌───────────┐  Imagem do Produto  │
│  │  Preview  │  [Alterar] [Remover] │
│  │   128x128 │                      │
│  └───────────┘                      │
└─────────────────────────────────────┘
```

#### Estrutura de Arquivos no Storage
```text
company-item-images/
  └── {company_id}/
      └── {item_id}.png

company-product-images/
  └── {company_id}/
      └── {product_id}.png
```

#### Fluxo de Upload
1. Usuário seleciona arquivo (PNG, JPEG, JPG)
2. Validar tipo e tamanho (máx 5MB)
3. Processar imagem (fundo branco)
4. Upload para Supabase Storage
5. Atualizar `image_url` na tabela correspondente
6. Invalidar queries para atualizar UI

### Arquivos a Criar
| Arquivo | Descrição |
|---------|-----------|
| `src/components/common/ImageUploadField.tsx` | Componente reutilizável de upload |

### Arquivos a Modificar
| Arquivo | Mudança |
|---------|---------|
| `src/components/estoque/CreateCustomItemDialog.tsx` | Adicionar upload de imagem |
| `src/components/estoque/EditItemPriceDialog.tsx` | Adicionar upload/edição de imagem |
| `src/components/produtos/CreateCustomProductDialog.tsx` | Adicionar upload de imagem |
| `src/components/produtos/EditCustomProductDialog.tsx` | Adicionar upload/edição de imagem |

### Migrations
| Migration | Descrição |
|-----------|-----------|
| `create_company_item_images_bucket.sql` | Criar bucket e políticas RLS |
