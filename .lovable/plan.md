
# Plano: Reorganizar Ordem dos Modulos no Menu

## Objetivo

Reordenar os itens do menu lateral conforme solicitado, movendo Estoque para logo abaixo de Produtos.

---

## Nova Ordem dos Modulos

| Posicao | Modulo | Acao |
|---------|--------|------|
| 1 | Dashboard | Mantém |
| 2 | Clientes | Mantém |
| 3 | Produtos | Mantém |
| 4 | Estoque | Subir (estava na posicao 10) |
| 5 | Orcamentos | Mantém |
| 6 | Caixa e Vendas | Subir |
| 7 | Ordens de Servico | Descer |
| 8 | Agenda | Mantém |
| 9 | Medicoes | Mantém |
| 10 | Plano de Corte | Mantém |
| 11 | Projeto de Vidro | Mantém |
| 12 | Financeiro | Mantém |
| 13 | Notas Fiscais | Mantém |
| 14 | Funcionarios | Mantém |
| 15 | Configuracoes | Mantém |

---

## Alteracao Tecnica

### Arquivo: `src/components/layout/Sidebar.tsx`

Reorganizar o array `menuItems` (linhas 44-71):

```typescript
const menuItems: MenuItem[] = [
  // Visao Geral
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', module: 'dashboard' },
  
  // Comercial
  { icon: Users, label: 'Clientes', path: '/clientes', module: 'clientes' },
  { icon: Package, label: 'Produtos', path: '/produtos', module: 'produtos' },
  { icon: Boxes, label: 'Estoque', path: '/estoque', module: 'estoque' },
  { icon: FileText, label: 'Orcamentos', path: '/orcamentos', module: 'orcamentos' },
  { icon: ShoppingCart, label: 'Caixa & Vendas', path: '/caixa-vendas', module: 'caixa-vendas' },
  { icon: ClipboardList, label: 'Ordens de Servico', path: '/ordens-servico', module: 'ordens-servico' },
  
  // Operacional
  { icon: Calendar, label: 'Agenda', path: '/agenda', module: 'agenda' },
  { icon: Ruler, label: 'Medicoes', path: '/medicoes', module: 'medicoes' },
  { icon: Scissors, label: 'Plano de Corte', path: '/plano-corte', module: 'plano-corte' },
  { icon: Square, label: 'Projeto de Vidro', path: '/projeto-vidro', module: 'plano-corte' },
  
  // Financeiro
  { icon: DollarSign, label: 'Financeiro', path: '/financeiro', module: 'financeiro' },
  { icon: Receipt, label: 'Notas Fiscais', path: '/notas-fiscais', module: 'notas-fiscais' },
  
  // Administracao
  { icon: UserCog, label: 'Funcionarios', path: '/funcionarios', module: 'funcionarios' },
  { icon: Settings, label: 'Configuracoes', path: '/configuracoes', module: 'configuracoes' },
];
```

---

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/layout/Sidebar.tsx` | Reorganizar array menuItems |

---

## Resultado Esperado

Menu lateral exibindo os modulos na ordem:
Dashboard - Clientes - Produtos - Estoque - Orcamentos - Caixa e Vendas - Ordens de Servico - Agenda - Medicoes - Plano de Corte - Projeto de Vidro - Financeiro - Notas Fiscais - Funcionarios - Configuracoes
