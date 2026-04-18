
User wants to start a new, cleaner, lighter project with all current configurations. They've been migrating to external Supabase and dealing with 196 migration files. Now they want a fresh start.

Key considerations:
1. They have a working production app (vetraglass.com) with 196 migrations, complex schema, edge functions, storage, auth users.
2. They want "cleaner and lighter" — implies removing accumulated cruft.
3. They want to keep all current configurations/functionality.

Best strategies (present as options to choose):

**Option A: Fork + Squash (clone do projeto atual + limpeza)**
- Duplicar o projeto Lovable atual
- No clone: fazer squash das migrations (1 baseline), limpar código morto, reorganizar
- Manter o banco apontando para o mesmo Supabase OU criar novo Supabase com dump
- Vantagem: preserva 100% do código e funcionalidades
- Desvantagem: ainda carrega o histórico de decisões

**Option B: Novo projeto Lovable + import seletivo**
- Criar projeto Lovable novo do zero
- Importar apenas: schema baseline (1 arquivo SQL), edge functions essenciais, componentes core
- Recriar configs (Cloud, secrets, domínio)
- Vantagem: realmente limpo, leve, sem cruft
- Desvantagem: trabalho manual de copiar código

**Option C: Novo projeto + Supabase Externo já migrado**
- Como já está migrando para Supabase Externo, criar projeto Lovable novo apontando para esse Supabase
- Copiar código essencial via cross_project tools
- Vantagem: aproveita migração em andamento, separa frontend de backend
- Desvantagem: precisa configurar conexão Supabase externo no novo Lovable

I should ask which approach they prefer. Keep concise.
