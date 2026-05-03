
## Contexto Atual

O sistema já implementa multi-empresa/multi-usuário, mas com algumas duplicações e fricções:

```text
profiles (id, user_id, full_name, avatar_url)
user_companies (id, user_id, company_id, role, is_active)   ← vínculo N:N
employees (id, company_id, user_id, name, email, role, permission_profile_id, ...)
companies (id, name, cnpj, ...)
```

Problemas observados:
1. **Duplicação `employees` x `user_companies`**: o mesmo usuário aparece nas duas tabelas; `role` existe em ambas e pode divergir.
2. **Sem fluxo de convite "self-service"**: hoje admin cria `employee` e dispara convite via Edge Function (`AceitarConvite`), mas não há reenvio, expiração visível, nem revogação clara.
3. **Troca de empresa**: usa `localStorage.currentCompanyId` mas não há indicador claro de "empresa ativa" no header nem atalho rápido.
4. **`is_active` em duas dimensões** (`user_companies.is_active` e `employees.is_active`) — pode dessincronizar.
5. **Sem auditoria de quem entrou/saiu da empresa**, nem histórico de mudança de papel.
6. **Permissões mistas**: `role` (admin/manager/employee) + `permission_profile_id` + `role_permissions` — confuso para o admin configurar.

## Proposta de Melhorias

### 1. Consolidar fonte da verdade do vínculo
- `user_companies` continua como **única fonte** de "quem tem acesso a qual empresa + papel".
- `employees` passa a ser **dado de RH** (nome, foto, comissão, especialidade) — `role` ali vira informativo (cargo no organograma) e **não** controla permissão.
- Trigger no banco: ao alterar `user_companies.is_active`, sincronizar `employees.is_active` automaticamente.

### 2. Convites mais robustos (`company_invites`)
Tabela já existe (via `validate_invite_token`). Adicionar UI em **Configurações → Usuários**:
- Listar convites pendentes com email, papel, expiração, status.
- Botões: **Reenviar**, **Copiar link**, **Revogar**.
- Aceite cria automaticamente `profile` + `user_companies` + vincula a `employees` (se houver).

### 3. Página unificada "Usuários & Acessos"
Substituir parte da `ConfiguracoesUsuarios.tsx` atual por 3 abas:
- **Membros**: lista todos com acesso (join `user_companies` + `employees` + `profiles`), papel, status, último login. Ações: alterar papel, desativar/reativar, remover da empresa, transferir titularidade.
- **Convites**: pendentes/expirados com ações acima.
- **Permissões**: matriz de `role_permissions` + perfis de permissão (já existente).

### 4. Multi-empresa no header
- `CompanySwitcher` no `MainLayout`/`Sidebar`: dropdown com todas as empresas do usuário, badge do papel, troca instantânea (já existe `setCurrentCompany`, falta UI consistente).
- Atalho de teclado e indicação visual da empresa ativa.

### 5. Auditoria
- Tabela `company_member_audit` (ações: invited, accepted, role_changed, deactivated, removed, transferred_ownership) com `actor_user_id`, `target_user_id`, `before/after`.
- Aba "Histórico" na página de Membros.

### 6. Transferência e múltiplos admins
- Permitir mais de 1 admin por empresa.
- Ação "Transferir titularidade" para garantir que sempre exista pelo menos 1 admin (bloqueia desativar/remover o último admin).

### 7. Sessão e segurança
- Ao desativar `user_companies`, invalidar sessões (já há `toggle-employee-access` que faz ban — manter, mas só banir auth se o usuário **não** pertencer a nenhuma outra empresa; caso contrário só remover acesso àquela empresa).

## Detalhes Técnicos

**Migrações SQL:**
- Trigger `sync_employee_active_on_user_company_change`.
- Constraint: garantir que cada `(user_id, company_id)` em `user_companies` seja único (provavelmente já é).
- Nova tabela `company_member_audit` com RLS por empresa.
- Função `transfer_company_ownership(_company_id, _new_admin_user_id)`.
- Função `remove_member_from_company(_company_id, _user_id)` — valida se não é último admin, marca `is_active=false`, audita, e só dá ban no auth se `count(active user_companies) = 0`.

**Edge Functions (atualizar):**
- `toggle-employee-access`: ajustar para ban condicional (multi-empresa).
- Nova `resend-invite` e `revoke-invite` (ou consolidar em uma função `manage-invite`).

**Frontend:**
- Refatorar `src/pages/ConfiguracoesUsuarios.tsx` em 3 abas (Membros, Convites, Permissões).
- Novo componente `CompanySwitcher` em `src/components/layout/`.
- Novo componente `InviteMemberDialog` (substitui criação atual via `EmployeeDialog` quando o objetivo é só dar acesso).
- Hook `useCompanyMembers(companyId)` agregando `user_companies + employees + profiles`.

**Sem breaking changes**: dados de `employees` permanecem; apenas o fluxo de permissão passa a ler exclusivamente de `user_companies` + `role_permissions`.

## Entregáveis (fases)

1. Trigger de sincronização + auditoria + função de remoção segura.
2. Refatoração da página Configurações → Usuários (Membros + Convites).
3. CompanySwitcher no header.
4. Transferência de titularidade + ajuste do ban condicional.

Posso começar pela fase 1 + 2 (núcleo) e seguir incrementalmente. Confirma esta direção?
