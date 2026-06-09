## Refatorar "Nova Despesa" como Sheet lateral com etapas

Arquivo: `src/components/financeiro/ExpensesTab.tsx` (linhas 613–745).

### Mudanças
1. **Trocar `Dialog` → `Sheet`** (`@/components/ui/sheet`), abrindo lateral à direita, `side="right"`, `w-full sm:max-w-lg`, altura total, com layout `flex flex-col h-full`.
2. **Wizard em 3 etapas** com indicador de progresso (bolinhas numeradas + linha) no topo, dentro do `SheetHeader`:
   - **Etapa 1 – Identificação**: Categoria, Descrição.
   - **Etapa 2 – Valores & Vencimento**: Valor, Vencimento, Status, Recorrência.
   - **Etapa 3 – Pagamento & Notas**: Forma de Pagamento, Observações.
3. **Conteúdo rolável**: `<div className="flex-1 overflow-y-auto px-6 py-4">` com os campos da etapa atual; transições simples (fade).
4. **Footer fixo** (`border-t p-4 flex justify-between gap-2`) com:
   - Esquerda: "Cancelar" (sempre) e "Voltar" (etapas 2–3).
   - Direita: "Próximo" (etapas 1–2) ou "Salvar" (etapa 3, `type="submit"`).
5. **Validação por etapa** antes de avançar: etapa 1 exige `descricao`; etapa 2 exige `valor > 0` e `vencimento`. Toast curto se faltar.
6. **Atalhos**: Enter avança/salva (exceto em `textarea`); Esc fecha; foco automático no primeiro input da etapa ao mudar.
7. **Estado novo**: `const [step, setStep] = useState<1|2|3>(1)`; resetar para 1 em `handleOpenDialog` e `handleCloseDialog`.
8. **No modo edição**: mostrar todas as etapas igualmente (sem pular), mantendo wizard.

Sem mudanças de schema, services ou lógica de submit — só reorganização visual/navegação do modal.
