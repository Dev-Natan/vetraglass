## Plano revisado

### Contexto corrigido
- **`natanjk7@gmail.com`** = único SaaS Admin (acesso total ao painel administrativo, edição de templates, imagens, linhas).
- **`natan-sn@hotmail.com`** = conta de empresa (usuária comum, NÃO deve ter acesso administrativo do SaaS).
- O erro de RLS aconteceu porque a sessão no mobile estava logada como `natan-sn@hotmail.com` tentando salvar `product_templates` — comportamento correto do sistema, faltou apenas mensagem clara e impedir a tela de carregar.

### 1. Reforçar bloqueio de acesso
- Garantir que `natan-sn@hotmail.com` **não** está em `saas_admins` (confirmar e remover se voltou).
- Revisar `AdminRoute` para fazer **double-check** server-side a cada navegação (chamar `is_saas_admin` em vez de confiar em cache de sessão), redirecionando não-admins para `/dashboard` com toast explicativo.
- Esconder qualquer item de menu administrativo no `AdminLayout`/Sidebar quando `is_saas_admin = false`.

### 2. Mensagens de erro em `ProductTemplates.tsx`
- Capturar erros do Supabase com código `42501` / texto "row-level security" e exibir toast:
  > "Você não tem permissão para alterar templates de produto. Apenas o administrador do sistema (`natanjk7@gmail.com`) pode realizar essa ação."
- Mesma tratativa nos uploads para o bucket `product-templates`.

### 3. UI de gestão de SaaS Admins — `/admin/settings` (aba "Administradores SaaS")
Acessível apenas a quem já é SaaS Admin (na prática, só `natanjk7@gmail.com`):
- Listagem com e-mail, data de cadastro, ícone de cadeado em contas mestras.
- Adicionar admin por e-mail (RPC `grant_saas_admin`).
- Remover admin (RPC `revoke_saas_admin`) — com regra que **proíbe remover `natanjk7@gmail.com`** e impede esvaziar a tabela.
- Toda RPC é `SECURITY DEFINER` com checagem `is_saas_admin(auth.uid())` no topo.

### 4. Página dedicada `/admin/product-images` (somente SaaS Admin)
Foco exclusivo em mídia, sem risco de tocar em outros campos:
- Grid responsivo de todos os `product_templates` com thumbnail, nome, linha, categoria.
- Filtros: linha, categoria, "Sem imagem".
- **Trocar imagem** → upload no bucket `product-templates` → atualiza só `image_url` (não dispara o trigger pesado de distribuição, pois `is_active` não muda).
- **Remover imagem**.
- Cache busting `?t=Date.now()` em todas as URLs.
- Link na sidebar admin (ícone `ImageIcon`, "Imagens de Produtos").

### 5. Atualização de memória
Corrigir o core rule atual:
> "Never delete master accounts `natan-sn@hotmail.com` & `natanjk7@gmail.com`"

Para:
> "SaaS Admin único: `natanjk7@gmail.com` (nunca remover). `natan-sn@hotmail.com` é conta mestra de empresa — nunca conceder acesso SaaS Admin."

### 6. Verificação
- Login como `natan-sn@hotmail.com` (mobile) → tentar `/admin/*` → redirecionado com toast claro.
- Login como `natanjk7@gmail.com` → editar template, trocar imagem, gerenciar admins na nova aba — tudo funcional.

## Detalhes técnicos

**Arquivos:**
- `src/components/admin/settings/SaasAdminsTab.tsx` (novo)
- `src/pages/admin/AdminSettings.tsx` (adicionar aba)
- `src/pages/admin/AdminProductImages.tsx` (novo)
- `src/pages/admin/ProductTemplates.tsx` (tratamento de erro 42501)
- `src/App.tsx` (rota `/admin/product-images`)
- `src/components/layout/AdminLayout.tsx` (item de menu + hardening do guard)

**Migration:**
- `grant_saas_admin(_email text)`, `revoke_saas_admin(_user_id uuid)`, `list_saas_admins()` — todas `SECURITY DEFINER`, checam `is_saas_admin(auth.uid())`, com regra que protege `natanjk7@gmail.com`.

Posso seguir?
