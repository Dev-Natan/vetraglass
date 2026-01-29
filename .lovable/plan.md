
# Plano: Unificar Plano de Corte e Projeto de Vidros

## Visão Geral
Transformar o módulo Produção em uma interface única e fluida onde o usuário pode ver tanto os cortes de perfil quanto os vidros em uma experiência integrada, sem precisar alternar entre abas.

---

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUÇÃO                                │
├─────────────────────────────────────────────────────────────────┤
│  [Seletores: Linha > Categoria > Produto]  [Vão: L x A]  [Qtd] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              VISUALIZAÇÃO UNIFICADA                       │  │
│  │   (Desenho técnico do produto com perfis e vidros)        │  │
│  │   - Painéis de vidro clicáveis para editar furos/recortes│  │
│  │   - Zoom, dimensões, área total, peso estimado            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │ TABELA DE VIDROS    │  │ TABELA DE PERFIS                │  │
│  │ (com área, peso,    │  │ (com ângulos, posição,          │  │
│  │  checkboxes, etc.)  │  │  checkboxes, etc.)              │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
│                                                                 │
│  [Sub-aba: Otimização de Barras]  [Salvar Projeto] [Exportar]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mudanças Principais

### 1. Interface Unificada
- Remover as tabs "Plano de Corte" vs "Projeto de Vidros"
- Layout em seções verticais fluídas:
  - Header com seletores e dimensões do vão
  - Canvas visual unificado (sempre visível)
  - Tabelas lado a lado (vidros + perfis)
  - Sub-aba para Otimização de Barras

### 2. Canvas Visual Melhorado
- Mostrar desenho técnico do produto completo (não só vidros)
- Manter interatividade: clicar em vidro abre editor de furos/recortes
- Adicionar indicadores visuais para perfis ao redor dos vidros
- Zoom e controles já existentes permanecem

### 3. Tabelas Unificadas
- Exibir vidros e perfis em uma visualização compacta lado a lado
- Manter checkboxes para tracking de produção
- Barra de progresso única combinando vidros + perfis

### 4. Ações Centralizadas
- Botão único "Exportar" com dropdown: PDF, CSV, Etiquetas
- Botão "Salvar Projeto" para salvar estado completo
- Botão "Carregar Projetos" para recuperar projetos salvos

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Duas abas separadas, contexto fragmentado | Interface única e fluída |
| Duplicação de seletores entre abas | Seletores únicos no topo |
| Precisa alternar para ver vidros vs perfis | Visualização completa em uma tela |
| Dados calculados duas vezes | Cálculo único compartilhado |

---

## Detalhes Técnicos

### Arquivos a Modificar:
1. **`src/pages/Producao.tsx`** - Reestruturar layout, remover tabs principais
2. **`src/components/projeto-vidro/GlassProjectCanvas.tsx`** - Adaptar para ser a visualização principal

### Arquivos a Criar:
1. **`src/components/producao/UnifiedProductionView.tsx`** - Novo componente unificado
2. **`src/components/producao/ProductionHeader.tsx`** - Header com seletores e dimensões
3. **`src/components/producao/ProductionTables.tsx`** - Tabelas lado a lado

### Componentes Reutilizados:
- `ProfileCutsTable` - mantido para perfis
- `GlassCutsTable` - mantido para vidros  
- `BarOptimizationView` - mantido como sub-seção
- `HoleCutoutEditor` - mantido para edição de vidros
- `SaveProjectDialog` / `SavedProjectsSheet` - mantidos

---

## Fluxo do Usuário

1. Usuário entra em Produção
2. Seleciona linha, categoria, produto
3. Define dimensões do vão e quantidade
4. Visualização unificada mostra desenho técnico completo
5. Pode clicar em qualquer vidro para adicionar furos/recortes
6. Tabelas abaixo mostram detalhes de vidros e perfis
7. Pode marcar itens como concluídos (checkboxes)
8. Expande "Otimização de Barras" se necessário
9. Salva ou exporta o projeto

