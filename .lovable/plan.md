# Plano de Lançamento — VetraGlass

> **Data de criação:** 2026-02-12  
> **Objetivo:** Concluir todas as tarefas pendentes para lançamento do sistema  
> **Estimativa total:** ~8-10 prompts (sessões de trabalho)

---

## 📋 Lista Completa de Tarefas

### Sprint 1 — Segurança & Infraestrutura (Prioridade Crítica)

#### Tarefa 1.1: Auditoria de Segurança (RLS)
- **Descrição:** Rodar scan de segurança, revisar todas as políticas RLS, garantir isolamento de dados entre empresas
- **Estimativa:** 1 prompt
- **Recursos:** Ferramenta `supabase--linter`, `security--run_security_scan`
- **Critério de conclusão:** Zero vulnerabilidades críticas, todas as tabelas com RLS ativo
- **Risco:** Pode revelar problemas que exijam migrations adicionais

#### Tarefa 1.2: Edge Functions — Revisão de JWT
- **Descrição:** Revisar funções com `verify_jwt = false` (`focusnfe`, `admin-delete-item-template`, `create-employee-user`, `send-employee-invite`, `generate-system-reminders`). Validar se é intencional e documentar justificativa
- **Estimativa:** 0.5 prompt (junto com 1.1)
- **Recursos:** Leitura de edge functions, `supabase/config.toml`
- **Critério de conclusão:** Cada função sem JWT tem justificativa documentada ou é corrigida

#### Tarefa 1.3: Limpeza do Service Worker / PWA
- **Descrição:** Remover código agressivo de limpeza de SW/cache em `main.tsx` que é apenas debug. Decidir se PWA será mantida no lançamento
- **Estimativa:** 0.5 prompt
- **Recursos:** `src/main.tsx`, `vite.config.ts`
- **Critério de conclusão:** `main.tsx` limpo, sem console.logs de debug em produção

---

### Sprint 2 — Funcionalidades Core (Prioridade Alta)

#### Tarefa 2.1: Imagens Personalizadas nos PDFs
- **Descrição:** Corrigir query em `VisualizarOrcamentoDialog.tsx` para buscar imagens de `company_products` e `company_items`, não apenas `product_templates`. Implementar hierarquia de prioridade de imagens
- **Estimativa:** 1 prompt
- **Recursos:** `VisualizarOrcamentoDialog.tsx`, `generateQuotePdf.ts`, `Orcamentos.tsx`
- **Critério de conclusão:** PDFs exibem imagens de produtos personalizados corretamente
- **Plano detalhado:** Já documentado anteriormente (ver seção "Plano Técnico" abaixo)

#### Tarefa 2.2: Validação do Fluxo Alumínio Completo
- **Descrição:** Testar e validar que `aluminum_color` propaga corretamente em: Orçamento → Aprovação → OS → Produção → Plano de Corte → PDF
- **Estimativa:** 1 prompt
- **Recursos:** `AddProductPanel.tsx`, `Orcamentos.tsx`, `OrdemServicoDetalhes.tsx`, `generateCuttingPlanPdf.ts`
- **Critério de conclusão:** Acabamento visível em todas as etapas do fluxo

#### Tarefa 2.3: Validação de Formulários Críticos
- **Descrição:** Revisar formulários de: cadastro de cliente, novo orçamento, nova venda, nova OS. Garantir validações com mensagens em PT-BR
- **Estimativa:** 1 prompt
- **Recursos:** Componentes de dialog/form em `src/components/`
- **Critério de conclusão:** Nenhum formulário permite submit com dados inválidos

---

### Sprint 3 — Experiência do Usuário (Prioridade Média)

#### Tarefa 3.1: Routing e Landing Page
- **Descrição:** Validar que `/` serve Landing para não-autenticados e redireciona para Dashboard para logados. Garantir redirects corretos após login/logout
- **Estimativa:** 0.5 prompt
- **Recursos:** `App.tsx`, `Landing.tsx`, `Index.tsx`, `AuthContext.tsx`
- **Critério de conclusão:** Fluxo de navegação limpo sem flash de conteúdo errado

#### Tarefa 3.2: Teste de Geração de PDFs
- **Descrição:** Testar todos os geradores de PDF com dados representativos: orçamento, contrato, OS, plano de corte, relatório de caixa
- **Estimativa:** 1 prompt
- **Recursos:** Todos os arquivos em `src/utils/generate*.ts`
- **Critério de conclusão:** PDFs gerados sem erros, com layout correto

#### Tarefa 3.3: Onboarding e Tutorial
- **Descrição:** Validar checklist de onboarding, tutorial overlay, e que novos usuários têm experiência guiada
- **Estimativa:** 0.5 prompt
- **Recursos:** `OnboardingChecklist.tsx`, `TutorialOverlay.tsx`, `useOnboardingStatus.ts`
- **Critério de conclusão:** Novo usuário consegue completar onboarding sem confusão

---

### Sprint 4 — Polimento Final (Prioridade Baixa)

#### Tarefa 4.1: SEO e Meta Tags
- **Descrição:** Verificar/adicionar title, meta description, OG image na Landing. Garantir robots.txt correto
- **Estimativa:** 0.5 prompt
- **Recursos:** `index.html`, `Landing.tsx`, `robots.txt`, `og-image.png`
- **Critério de conclusão:** Preview correto ao compartilhar link em redes sociais

#### Tarefa 4.2: Responsividade Mobile
- **Descrição:** Testar fluxos críticos (login, dashboard, novo orçamento, caixa) em viewport mobile (375px)
- **Estimativa:** 1 prompt
- **Recursos:** Browser tools com viewport mobile
- **Critério de conclusão:** Fluxos principais usáveis em mobile sem overflow ou elementos cortados

---

## 📊 Cronograma de Execução

```
Prompt  │ Tarefas              │ Prioridade │ Status
────────┼──────────────────────┼────────────┼────────
  1     │ 1.1 + 1.2 Segurança  │ 🔴 Crítica │ ✅ Concluído
  2     │ 1.3 SW Cleanup       │ 🔴 Crítica │ ⬜ Pendente
  3     │ 2.1 Imagens PDF      │ 🔴 Alta    │ ✅ Já implementado (corrigido duplicação)
  4     │ 2.2 Fluxo Alumínio   │ 🟡 Alta    │ ⬜ Pendente
  5     │ 2.3 Validações       │ 🟡 Alta    │ ⬜ Pendente
  6     │ 3.1 + 3.3 Routing    │ 🟡 Média   │ ⬜ Pendente
  7     │ 3.2 Teste PDFs       │ 🟡 Média   │ ⬜ Pendente
  8     │ 4.1 SEO              │ 🟢 Baixa   │ ⬜ Pendente
  9     │ 4.2 Mobile           │ 🟢 Baixa   │ ⬜ Pendente
```

---

## 🛡️ Estratégias de Execução

1. **Uma tarefa por prompt** — Evita mudanças conflitantes e facilita rollback
2. **Sempre verificar antes de implementar** — Ler arquivos, rodar scans, checar logs antes de editar
3. **Testar após cada mudança** — Usar browser tools ou console para validar
4. **Não expandir escopo** — Resolver exatamente o que está no plano, anotar melhorias futuras separadamente
5. **Commits atômicos** — Cada prompt = uma unidade de trabalho completa e funcional

---

## 🔧 Plano Técnico — Tarefa 2.1: Imagens nos PDFs

### Problema
A query em `VisualizarOrcamentoDialog.tsx` busca imagens apenas de `product_templates`, ignorando `company_products.image_url` e `company_items.image_url`.

### Solução

**1. Expandir query:**
```typescript
const { data } = await supabase
  .from('quote_items')
  .select(`*, product_templates(image_url, linha, category), company_products(image_url, linha), company_items(image_url)`)
  .eq('quote_id', quote.id);
```

**2. Hierarquia de prioridade:**
```
company_products.image_url → product_templates.image_url → company_items.image_url → null
```

**3. Arquivo a modificar:** `src/components/orcamentos/VisualizarOrcamentoDialog.tsx`

---

## 📝 Notas Adicionais

- O `generateQuotePdf.ts` já suporta `image_url` nos itens — o problema é apenas na fonte de dados
- Algumas edge functions sem JWT (`focusnfe`, `generate-system-reminders`) são intencionais (webhooks/cron)
- O PWA foi desabilitado via código mas o plugin ainda está instalado — considerar remover `vite-plugin-pwa`
