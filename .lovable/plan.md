
# Fase 1 — Quebrar God Components

Objetivo: reduzir os 10 maiores arquivos (~11.500 linhas) extraindo **dados**, **estado** e **UI** em módulos coesos. **Nenhuma mudança de comportamento** — apenas estrutura. Toda fatia preserva props públicas, rotas e contratos com o backend.

## Padrão de quebra (aplicado a cada alvo)

```text
GodComponent.tsx (orquestrador, ~150-250 linhas)
└── _<godcomponent>/
    ├── types.ts             ← interfaces locais (ComponentItem, QuoteItem, etc.)
    ├── hooks/
    │   ├── useXxxData.ts    ← React Query: fetches + mutations
    │   └── useXxxForm.ts    ← state local + handlers (quando aplicável)
    ├── utils.ts             ← funções puras (cálculos, mapeadores)
    └── parts/
        ├── Header.tsx
        ├── ItemList.tsx / Steps.tsx / Tabs.tsx
        ├── ItemRow.tsx
        ├── Footer.tsx
        └── ...
```

Regras:
- Sem alterar props externas dos componentes/páginas alvo
- Sem alterar queries SQL nem RPCs
- Sem alterar nomes de queryKeys do React Query (mantém invalidação cross-module)
- Tipos `any` encontrados na fatia são corrigidos quando triviais; os complexos viram TODO tipado para a Fase 3
- `console.log` residuais removidos
- Imports relativos curtos (`./parts/...`) dentro da pasta da fatia

## Alvos e tamanhos atuais

| # | Arquivo | Linhas | Estratégia |
|---|---|---|---|
| 1 | `components/produtos/ActivateWithCompositionDialog.tsx` | 1.402 | wizard 2 steps → separar `ComponentsStep` e `PricingStep` + hook de auto-add de fórmulas de vidro |
| 2 | `components/caixa/NovaVendaDialog.tsx` | 1.291 | máquina de estado por `ViewMode` → 1 subcomponente por view |
| 3+4 | `pages/EditarProduto.tsx` (1.214) + `pages/EditarProdutoEmpresa.tsx` (910) | 2.124 | extrair partes comuns para `components/produtos/edit/` (header, abas de tipo, lista de itens, dialog de item). Cada página vira fina (~200 linhas) consumindo as partes |
| 5 | `pages/Agenda.tsx` | 1.213 | separar `useAgendaData`, `AgendaCalendar`, `AppointmentDialog`, `AppointmentDetails` |
| 6 | `components/orcamentos/NovoOrcamentoDialog.tsx` | 1.087 | já tem `Step` ('client' \| 'products' \| 'review') → 1 arquivo por step + `useQuoteForm` |
| 7 | `components/orcamentos/AprovarOrcamentoDialog.tsx` | 1.056 | `PaymentStep` + `ConfirmStep` + `useApproval` |
| 8 | `pages/Medicoes.tsx` | 1.094 | `useMeasurements`, `MeasurementForm`, `ChecklistEditor`, `ItemsEditor` |
| 9 | `pages/CaixaVendas.tsx` | 1.083 | `useCaixaSales`, `SalesList`, `SaleDetails`, `OpenCloseCashDialog` |
| 10 | `components/orcamentos/AddProductPanel.tsx` | 935 | `useProductPicker`, `GlassPicker`, `DimensionsForm`, `PriceSummary` |

## Ordem de execução (1 fatia = 1 commit)

1. ActivateWithCompositionDialog
2. NovoOrcamentoDialog (estabelece padrão de wizard com steps)
3. AprovarOrcamentoDialog (mesmo padrão)
4. NovaVendaDialog
5. AddProductPanel
6. EditarProduto + EditarProdutoEmpresa (juntos — compartilham partes)
7. Agenda
8. Medicoes
9. CaixaVendas

## Validação por fatia

Após cada fatia:
- TypeScript compila (build automático do Lovable)
- Imports antigos (`@/components/produtos/ActivateWithCompositionDialog`, etc.) continuam válidos via re-export
- Memórias do projeto respeitadas (Zero Cache, queryKeys, RLS, nomenclatura BR)

## Detalhes técnicos da fatia 1 (modelo)

`ActivateWithCompositionDialog` hoje concentra:
- 3 queries React Query (template items globais, glass formulas, glass template genérico)
- 1 mutation (`bulkUpsertMutation`)
- Estado de wizard (2 steps), aba ativa, lista local, item em edição, busca
- Estado de formulário (item template, fórmulas, qty, peças, ângulo, vidro)
- Estado de pricing (custo/preço por m², lista de vidros)
- Auto-injeção de itens "vidro" a partir de `glass_line_formulas`

Quebra proposta:

```text
components/produtos/ActivateWithCompositionDialog.tsx   (orquestrador ~200 ln)
└── _activate-with-composition/
    ├── types.ts                  ← ComponentItem, ItemTemplate, props
    ├── constants.ts              ← itemTypeTabs
    ├── hooks/
    │   ├── useActivationData.ts  ← 3 queries
    │   ├── useAutoGlassItems.ts  ← efeito de auto-injeção
    │   ├── useComponentEditor.ts ← state form de item + add/edit/remove
    │   └── useActivationSubmit.ts← bulkUpsert + invalidação
    ├── parts/
    │   ├── ComponentsStep.tsx
    │   ├── ItemTypeTabs.tsx
    │   ├── ComponentList.tsx
    │   ├── ComponentRow.tsx
    │   ├── AddEditItemForm.tsx
    │   ├── PricingStep.tsx
    │   └── WizardFooter.tsx
    └── utils.ts                  ← filtros por tipo, busca, mapeamentos
```

Comportamento, queryKeys e mutations preservados na íntegra.

## Relatório final (entregue ao concluir a Fase 1)

Ao terminar todas as 9 fatias, gerar um relatório em `/mnt/documents/fase1-relatorio.md` contendo:
- Antes/depois (linhas por arquivo, top 10)
- Total de linhas em arquivos > 500 antes vs depois
- Lista de novos hooks criados e o que cada um faz
- Lista de subcomponentes criados por módulo
- `any` removidos / restantes
- `console.log` removidos
- Memórias do projeto que foram respeitadas/aplicadas
- Arquivos legados mantidos (re-exports) para compatibilidade
- Próximos passos sugeridos (ganchos para Fase 2)

## Fora de escopo (Fase 1)

- Unificar hooks duplicados → Fase 2
- Eliminar todos os `any` → Fase 3
- Padronizar camada `services/` → Fase 4
- Limpeza de logs/erros globais → Fase 5
- Consolidação de policies/funções SQL → Fase 6
