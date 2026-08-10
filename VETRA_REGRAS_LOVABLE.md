# VETRA --- REGRAS DE OURO PARA O LOVABLE

> **Status:** obrigatório\
> **Aplicação:** todo desenvolvimento, correção, refatoração, migration
> e alteração de interface no Vetra.\
> **Regra suprema:** **O Vetra não é um conjunto de telas. É um sistema
> de processos. Integridade e rastreabilidade vêm antes de velocidade de
> implementação.**

## 1. Objetivo deste documento

Este arquivo é o contrato de desenvolvimento do Vetra. Antes de
implementar qualquer tarefa, o agente deve ler e respeitar estas regras.

Nenhuma solicitação do tipo "aproveite e melhore", "refatore o restante"
ou interpretação implícita autoriza mudanças fora do escopo. Quando
houver conflito, ambiguidade ou necessidade de alterar arquitetura,
schema ou outro módulo, **pare e solicite autorização**.

------------------------------------------------------------------------

## 2. Leis fundamentais

### REGRA 01 --- Uma única fonte de verdade

Cada conceito de negócio deve possuir uma fonte canônica.

-   Não criar tabelas, campos ou estados duplicados que representem a
    mesma informação.
-   Não manter dois saldos independentes para a mesma dívida.
-   Não duplicar regras de cálculo em diferentes telas.
-   Antes de criar uma nova estrutura, verificar se já existe uma fonte
    de verdade para o conceito.

**Exemplo financeiro:** `accounts_receivable` representa o que o cliente
deve; `cash_movements` representa o que efetivamente entrou ou saiu do
caixa. Um não deve substituir o outro.

### REGRA 02 --- Processo acima da interface

A interface apenas coleta dados, apresenta informações e dispara ações.

-   Componentes e páginas não devem conter regras críticas de negócio.
-   A UI não deve orquestrar sequências longas de gravações.
-   A mesma regra deve produzir o mesmo resultado independentemente da
    tela que a chamou.
-   Regras devem ficar em casos de uso/serviços de domínio e
    persistência em repositories/RPCs.

Fluxo desejado:

`UI → Hook/ViewModel → Caso de uso → Regra de domínio → Repository/RPC → Supabase`

### REGRA 03 --- Operações críticas devem ser atômicas

Uma operação que altera vários registros relacionados deve concluir
integralmente ou não produzir alteração parcial.

Especialmente: - aprovação de orçamento; - criação de OS; -
recebimentos; - reserva/liberação de estoque; - recebimento de
compras; - cancelamentos com efeitos financeiros ou de estoque.

**Proibido:** deixar metade de uma aprovação persistida porque uma etapa
posterior falhou.

### REGRA 04 --- Toda operação crítica deve ser idempotente

Repetir uma requisição não pode duplicar dados.

Exemplos: - um orçamento aprovado deve gerar exatamente uma OS; - clicar
duas vezes não pode gerar duas vendas; - repetir uma requisição não pode
duplicar contas a receber, reservas ou movimentações.

### REGRA 05 --- Informação nasce uma vez e é reaproveitada

Não pedir ao usuário para redigitar informação que o sistema já possui.

Exemplo:
`Cliente → Orçamento → OS → Materiais → Produção → Entrega → Financeiro`

Dados aprovados devem seguir pelo fluxo mantendo vínculos e
rastreabilidade.

### REGRA 06 --- Documentos e registros devem manter origem

Registros derivados devem saber de onde vieram.

Exemplos: - OS vinculada ao orçamento aprovado; - necessidade de compra
vinculada à OS/material; - recebível vinculado à venda/OS
correspondente; - reserva vinculada ao consumo de material.

Não criar registros operacionais "soltos" quando houver um documento de
origem.

### REGRA 07 --- Toda mudança importante deve ser rastreável

Registrar, quando aplicável: - quem realizou; - quando; - estado
anterior; - estado novo; - documento/origem; - motivo, especialmente em
cancelamentos e ajustes.

Não depender apenas do estado atual para reconstruir acontecimentos
relevantes.

### REGRA 08 --- Estados e transições são controlados

Cada domínio deve ter estados documentados e transições permitidas.

Modelo inicial recomendado:

**Orçamento:**\
`draft → sent → approved`\
`draft/sent → rejected ou cancelled`

**OS:**\
`planning → awaiting_materials → ready_for_production → in_production → ready_for_delivery → delivered → completed`

**Compras:**\
`need_detected → quoted → ordered → partial_received → received`

**Financeiro:**\
`entry_pending / entry_paid` e `balance_pending / balance_paid`

Os nomes podem evoluir, mas não criar novos status isoladamente em
componentes. Alterações no workflow exigem atualização da documentação e
das regras centrais.

### REGRA 09 --- Valores financeiros nunca são inventados

Nenhum custo, preço, desconto, margem, taxa ou estimativa operacional
deve ser hardcoded como verdade de negócio sem uma regra explicitamente
aprovada.

-   Custos devem vir de fonte configurada: fornecedor, cotação, último
    custo, tabela ou política definida.
-   Não criar estimativas fixas silenciosas.
-   Arredondamentos devem seguir uma regra única.
-   Alterações financeiras relevantes devem preservar histórico.

### REGRA 10 --- O estoque deve representar a realidade operacional

Toda movimentação deve possuir causa e origem.

-   Reserva deve estar vinculada à necessidade/OS.
-   Consumo deve ser rastreável.
-   Liberação deve desfazer corretamente a reserva relacionada.
-   Falta de material deve gerar necessidade de compra, não ajustes
    arbitrários.
-   Não mascarar inconsistências com correções silenciosas.

### REGRA 11 --- Todo cálculo deve ser determinístico

Com as mesmas entradas e mesma versão das regras, o cálculo deve
produzir o mesmo resultado.

Isso se aplica especialmente a: - fórmulas; - composição de produtos; -
quantidades de materiais; - custos; - margens; - plano de corte.

Mudanças de regra que possam alterar resultados existentes devem ser
tratadas com versionamento ou estratégia de compatibilidade.

### REGRA 12 --- Acesso ao banco deve ser encapsulado

Evitar novos `supabase.from(...)` diretamente em páginas e componentes.

Novo código deve preferir: - repositories para persistência; - casos de
uso para orquestração; - RPCs/transações para operações críticas; -
hooks/ViewModels para ligação com a UI.

Ao refatorar código legado, migrar gradualmente. **Não fazer refatoração
global sem solicitação.**

### REGRA 13 --- Não quebrar contratos existentes sem plano

Antes de alterar: - nomes de campos; - tabelas; - enums/status; -
rotas; - props compartilhadas; - APIs/RPCs; - estrutura de dados
persistida;

o agente deve identificar os consumidores e explicar o impacto.

Mudanças destrutivas exigem migration e estratégia de compatibilidade
quando necessária.

### REGRA 14 --- Segurança multiempresa é obrigatória

Nenhuma consulta ou mutation pode permitir acesso indevido entre
empresas.

-   Preservar `company_id`/tenant scope conforme a arquitetura
    existente.
-   Não remover verificações de permissão para "resolver" erros.
-   Não desabilitar RLS como atalho.
-   Mudanças de autenticação, autorização ou RLS exigem escopo explícito
    e revisão.

### REGRA 15 --- Estabilidade antes de funcionalidade

Não adicionar feature nova para contornar bug estrutural.

Prioridade: 1. integridade dos dados; 2. regras de negócio; 3. testes;
4. rastreabilidade; 5. experiência do usuário; 6. novas funcionalidades.

------------------------------------------------------------------------

## 3. Regra crítica --- Aprovação de orçamento

O fluxo de aprovação é P0.

Uma aprovação deve respeitar, conceitualmente, esta sequência:

1.  Validar orçamento, permissão, forma de pagamento, entrada e
    condições necessárias.
2.  Travar/preservar a versão e os valores comerciais aprovados.
3.  Criar **uma única OS** vinculada ao orçamento.
4.  Registrar corretamente entrada e saldo a receber.
5.  Copiar para a OS o projeto técnico aprovado, incluindo medidas e
    configurações.
6.  Calcular necessidades de materiais de forma determinística.
7.  Reservar o que estiver disponível em estoque.
8.  Classificar faltas e gerar necessidades de compra para o que faltar.
9.  Confirmar a transação principal.
10. Somente após sucesso, executar tarefas secundárias, como PDFs,
    notificações e agenda.

### Invariantes obrigatórias

-   Um orçamento aprovado possui exatamente uma OS.
-   Repetir a aprovação não duplica OS, venda, recebível, reserva ou
    pagamento.
-   Saldo a receber = valor aprovado − pagamentos confirmados, segundo a
    regra financeira canônica.
-   Não existe reserva órfã sem necessidade/consumo correspondente.
-   Falha no meio da transação não deixa aprovação parcial.
-   Falha em PDF/notificação pós-transação não desfaz uma aprovação
    válida.

------------------------------------------------------------------------

## 4. Regras específicas para agentes Lovable/Codex

### Antes de alterar código

O agente deve: 1. Ler este arquivo e a documentação indicada na tarefa.
2. Identificar os arquivos que pretende alterar. 3. Explicar brevemente
o plano. 4. Identificar possíveis impactos em banco, financeiro,
estoque, permissões ou outros módulos. 5. Parar e pedir autorização se
precisar sair do escopo.

### Durante a implementação

O agente deve: - fazer apenas a mudança solicitada; - preservar
comportamento não relacionado; - reutilizar padrões existentes quando
forem seguros; - evitar duplicação; - não criar abstrações
desnecessárias; - não trocar bibliotecas/stack por preferência; - não
alterar estilos globais sem autorização; - não alterar schema sem escopo
explícito; - não fazer "limpeza geral" oportunista.

### Depois da implementação

O agente deve informar: 1. o que foi alterado; 2. quais arquivos foram
alterados; 3. por que cada arquivo precisou mudar; 4. migrations/RPCs
criadas ou modificadas; 5. testes executados; 6. riscos ou pendências
conhecidas; 7. qualquer recomendação fora do escopo, **sem
implementá-la**.

------------------------------------------------------------------------

## 5. Testes são parte da implementação

Toda mudança em regra crítica deve possuir testes compatíveis com o
risco.

Prioridade de cobertura: - aprovação de orçamento; - orçamento → OS →
financeiro; - composição/cálculo de materiais; - reserva e liberação de
estoque; - geração de necessidade de compra; - recebimento de compra; -
transições de OS; - recebimento do saldo final; - cancelamentos.

Sempre testar, quando aplicável: - caminho de sucesso; -
duplicidade/repetição; - dados inválidos; - falha intermediária; -
permissão; - isolamento entre empresas.

Não considerar uma regra crítica concluída apenas porque "funcionou
clicando".

------------------------------------------------------------------------

## 6. Práticas proibidas

O agente **NÃO PODE**, sem autorização explícita:

-   reescrever o Vetra do zero;
-   trocar React, Vite, Supabase ou a stack principal;
-   alterar módulos fora do escopo;
-   criar tabelas duplicando conceitos existentes;
-   remover dados ou migrations para fazer um erro desaparecer;
-   desabilitar RLS ou permissões;
-   colocar regra crítica somente no front-end;
-   hardcodar valores financeiros como solução definitiva;
-   criar status novos diretamente em telas;
-   fazer gravações críticas independentes quando deveriam ser
    transacionais;
-   esconder erro com `try/catch` vazio;
-   usar `any` como solução automática para problema de tipagem;
-   quebrar APIs/contratos existentes silenciosamente;
-   modificar estilos globais "aproveitando" outra tarefa;
-   fazer big-bang refactor;
-   implementar recomendação adicional sem aprovação.

------------------------------------------------------------------------

## 7. Política de refatoração

O Vetra será recuperado incrementalmente.

**Manter:** - React/Vite/Supabase; - design system atual quando
adequado; - motor de fórmulas e composições; - plano de corte e
reservas; - permissões/multiempresa; - módulos funcionais aproveitáveis.

**Refatorar por prioridade:** 1. aprovação de orçamento; 2. fluxo
orçamento → OS → financeiro; 3. materiais, reservas e compras; 4.
workflow formal da OS; 5. fontes de verdade do financeiro; 6. camada de
dados/repositories; 7. arquivos grandes quando forem tocados; 8. tipagem
strict gradualmente.

**Evitar agora:** - reescrita total; - troca de stack; - redesign
completo antes de estabilizar processos; - IA complexa antes de dados
confiáveis; - módulos novos que não resolvam o fluxo principal.

------------------------------------------------------------------------

## 8. Template obrigatório de tarefa

Toda tarefa enviada ao agente deve seguir, preferencialmente, este
formato:

### OBJETIVO

Uma única mudança claramente definida.

### CONTEXTO

Documentos e módulos que devem ser lidos antes da implementação.

### ESCOPO PERMITIDO

Arquivos, pastas, tabelas e funções que podem ser alterados.

### FORA DE ESCOPO

O que explicitamente não deve ser alterado.

### REGRAS DE NEGÓCIO

Lista numerada das regras que a implementação deve obedecer.

### INVARIANTES

Condições que devem continuar verdadeiras antes e depois da mudança.

### CRITÉRIOS DE ACEITE

Resultados objetivos que comprovam conclusão.

### TESTES OBRIGATÓRIOS

Cenários que precisam passar.

### ENTREGA

Antes de modificar: apresentar plano.\
Depois de modificar: listar alterações, testes, migrations, riscos e
pendências.

------------------------------------------------------------------------

## 9. Regra de ouro do escopo

> **Nenhum agente pode "aproveitar" uma tarefa para reorganizar outra
> parte do Vetra. Uma melhoria fora do escopo deve ser relatada e
> transformada em uma nova tarefa.**

Se uma tarefa exigir violar qualquer regra deste documento, **não
implementar silenciosamente**. Explicar o conflito e solicitar decisão.

------------------------------------------------------------------------

## 10. Diretriz final

Ao escolher entre uma solução rápida e uma solução que preserve
integridade, rastreabilidade e consistência do processo, escolha a
segunda.

**O Vetra deve reduzir a dependência da memória do dono e transformar
decisões operacionais em processos confiáveis.**

Este documento deve ser tratado como contexto obrigatório para qualquer
agente que altere o projeto.
