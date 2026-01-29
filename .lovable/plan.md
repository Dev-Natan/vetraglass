

# Plano: Unificar Agenda com Ordens de Serviço

## Visao Geral
Combinar a pagina Agenda e Ordens de Servico em uma unica interface unificada chamada "Ordens de Servico", onde o usuario pode gerenciar tanto as OS quanto os agendamentos em um so lugar.

---

## Arquitetura

```text
+-----------------------------------------------------------------------+
|                         ORDENS DE SERVICO                             |
+-----------------------------------------------------------------------+
|  [Stats: Pendentes | Em Andamento | Concluidas | Atrasadas | Hoje]    |
+-----------------------------------------------------------------------+
|                                                                       |
|  TABS: [ Lista de OS ]  [ Calendario ]  [ Hoje ]                      |
|                                                                       |
|  +-------------------------------------------------------------+     |
|  | TAB: Lista de OS                                            |     |
|  | - Grid de cards com OS (layout atual mantido)               |     |
|  | - Badge de agendamentos proximos em cada card               |     |
|  +-------------------------------------------------------------+     |
|                                                                       |
|  +-------------------------------------------------------------+     |
|  | TAB: Calendario                                              |     |
|  | - Calendario mensal com eventos de agendamentos              |     |
|  | - Sidebar com detalhes do dia e proximos agendamentos        |     |
|  | - Botao "Novo Agendamento"                                   |     |
|  +-------------------------------------------------------------+     |
|                                                                       |
|  +-------------------------------------------------------------+     |
|  | TAB: Hoje                                                    |     |
|  | - Timeline visual do dia atual                               |     |
|  | - OS atrasadas destacadas                                    |     |
|  | - Acoes rapidas para iniciar/concluir                        |     |
|  +-------------------------------------------------------------+     |
+-----------------------------------------------------------------------+
```

---

## Arquivos a Criar

### 1. `src/components/ordens-servico/OSCalendarView.tsx`
Componente com o calendario mensal completo, incluindo:
- Calendario visual com eventos coloridos por tipo
- Sidebar com proximos agendamentos
- Dialog para criar novos agendamentos
- Deteccao de conflitos de horario
- Estatisticas mensais
- Impressao de agenda

### 2. `src/components/ordens-servico/OSTodayView.tsx`
Componente com a timeline do dia atual:
- Cards de resumo (agendamentos, pendentes, concluidos, atrasados)
- Lista de OS atrasadas com destaque
- OS com entrega prevista para hoje
- Timeline visual dos agendamentos do dia
- Acoes rapidas para iniciar/concluir

---

## Arquivos a Modificar

### 1. `src/pages/OrdensServico.tsx`
- Adicionar sistema de tabs com 3 abas: Lista | Calendario | Hoje
- Mover a lista atual de OS para dentro da primeira tab
- Importar e renderizar os novos componentes
- Adicionar stat card "Agenda Hoje" aos cards existentes
- Buscar contagem de agendamentos do dia

### 2. `src/components/layout/Sidebar.tsx`
- Remover o item de menu "Agenda" (linha 62)
- Manter apenas "Ordens de Servico" no menu

### 3. `src/App.tsx`
- Alterar rota `/agenda` para redirecionar para `/ordens-servico?tab=calendario`

---

## Detalhes Tecnicos

### Componentes Reutilizados
- Logica de calendario da Agenda.tsx
- `appointmentTypeConfig` (tipos de agendamento)
- `statusConfig` (status de agendamentos)
- Logica de deteccao de conflitos de horario
- Dialog de criacao de agendamentos

### Queries
- `appointments` - agendamentos do mes (existente)
- `today-appointments` - agendamentos de hoje (novo)
- `today-os` - OS com entrega hoje ou atrasadas (novo)

### Cores dos Tipos de Agendamento
- Medicao: Verde (#10b981)
- Instalacao: Azul (#3b82f6)
- Manutencao: Amarelo (#f59e0b)
- Visita: Roxo (#8b5cf6)
- Entrega: Rosa (#ec4899)
- Outros: Cinza (#6b7280)

---

## Fluxo do Usuario

1. Usuario acessa "Ordens de Servico"
2. Ve stats cards unificados com resumo
3. Pode alternar entre:
   - **Lista**: Ver todas as OS em cards
   - **Calendario**: Ver visao mensal com agendamentos
   - **Hoje**: Foco no dia atual com timeline
4. Ao criar agendamento no calendario, pode vincular a OS
5. Na tab Hoje, ve timeline de atividades e OS atrasadas
6. Clicar em OS ou agendamento abre detalhes

---

## Beneficios

| Antes | Depois |
|-------|--------|
| Duas paginas separadas | Interface unica e coesa |
| Navegacao fragmentada | Tudo em um lugar |
| Agendamentos desconectados | Integrado com OS |
| Duplicacao de contexto | Fluxo unificado |

