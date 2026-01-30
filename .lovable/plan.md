
## Objetivo
Corrigir o problema em que você desativa um módulo no painel admin, mas ele “continua ativo” (não some do menu/continua acessível), e o toggle parece não refletir o estado real.

---

## Diagnóstico (causa raiz)
Hoje, o painel está tentando **atualizar a tabela `system_module_settings` diretamente pelo frontend**, mas a regra de segurança do backend (RLS) **não permite UPDATE para usuários logados** (mesmo você sendo SaaS Admin).

Conferindo as políticas atuais da tabela:
- Existe policy de **SELECT** para `authenticated` (todos logados conseguem ler).
- Existe policy de **ALL** apenas para `service_role` (chave de servidor).
- **Não existe policy de UPDATE para `authenticated`** baseada em “SaaS admin”.

Resultado:
- O update é bloqueado pelo backend.
- O toggle pode até “mexer” visualmente por um instante, mas volta (ou fica “parecendo estático”).
- O módulo segue “ativo” porque no banco ele nunca foi desativado de verdade.

---

## O que vou implementar (solução)
### 1) Backend: liberar UPDATE para SaaS Admin (com segurança)
Criar uma nova policy na tabela `public.system_module_settings` permitindo que **apenas SaaS admins** consigam atualizar (ativar/desativar) módulos.

- Criar policy `FOR UPDATE` (e opcionalmente `FOR INSERT/DELETE` se você quiser manter o painel capaz de cadastrar/remover módulos no futuro).
- Condição: `public.is_saas_admin(auth.uid())`
- Manter o SELECT para todos logados (necessário para renderização do menu).

Isso fará o toggle “persistir” e o estado mudar de verdade para todos.

### 2) Frontend: melhorar feedback quando a alteração falhar (para ficar óbvio)
Mesmo após a policy, é bom deixar o painel “à prova de dúvida”:

- Garantir que, caso algum erro aconteça, o toast mostre algo mais claro (ex.: “Sem permissão para alterar módulo” / “Falha ao salvar”).
- (Opcional) Logar `error.message` no console para facilitar debug futuro.

### 3) (Recomendado) Bloquear acesso por URL quando módulo estiver desativado
Hoje vocês escondem do menu, mas as rotas continuam acessíveis (porque o `App.tsx` só protege autenticação, não “módulo habilitado”).

Vou adicionar um “guard” de rota do tipo:
- Se o módulo estiver `is_enabled = false`:
  - redireciona para `/dashboard` (ou página “Módulo desativado”)
  - mostra um aviso (“Este módulo foi desativado pelo administrador do sistema”)

Isso resolve 100% o “continua ativo” mesmo se alguém abrir pelo link direto.

### 4) (Opcional) Ajustar estratégia de cache para refletir mais rápido para todos
Seu `useModuleSettings` hoje usa `CACHE_TIMES.STATIC` (5 min). Isso pode fazer alguns usuários demorarem para “ver” a mudança sem recarregar.

Opções:
- Trocar para `CACHE_TIMES.DYNAMIC` (30s) para refletir mais rápido.
- Ou implementar atualização automática (subscription) para refletir em tempo real.

Vou seguir com a opção **DYNAMIC** por ser simples e suficiente na maioria dos casos (e não criar complexidade).

---

## Passo a passo de implementação
1. **Criar uma migration** adicionando policy de UPDATE (e WITH CHECK) em `system_module_settings` para `authenticated` quando `is_saas_admin(auth.uid()) = true`.
2. Ajustar o frontend para:
   - manter o toggle funcionando imediatamente (otimista)
   - deixar erro explícito (mensagem melhor)
3. Implementar guard de rota no `App.tsx` para os módulos principais (clientes, produtos, estoque, caixa, etc.) e também rotas de configurações.
4. Ajustar o cache do `useModuleSettings` para `DYNAMIC` (ou remover o override de STATIC).
5. Testes:
   - Testar desativar um módulo no admin e confirmar que o toggle muda e permanece.
   - Abrir como outro usuário (ou aba anônima) e confirmar que o módulo some do menu.
   - Tentar acessar a rota direta do módulo desativado e confirmar redirecionamento/bloqueio.

---

## Critérios de aceite (como vamos saber que ficou certo)
- Ao desativar um módulo no admin:
  - o toggle muda e fica no estado correto
  - ao atualizar a página, continua desativado
- Em outra sessão/usuário:
  - o item do menu some
  - o acesso direto pela URL é bloqueado (redireciona / avisa)
- Dashboard e Configurações continuam protegidos contra desativação.

---

## Risco/impacto
- Mudança é segura porque a permissão de UPDATE ficará restrita a SaaS Admin.
- Não afeta dados de clientes, apenas controla visibilidade/acesso de módulos.
- Guard de rotas evita “bypass” por URL.

