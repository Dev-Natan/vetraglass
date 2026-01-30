
# Plano: Corrigir Estado Visual dos Toggles de Módulos

## Problema Identificado

Através da análise do console, identifiquei dois problemas:

1. **Warning de React**: "Function components cannot be given refs" no `ModuleRow`
2. **React.memo impedindo re-render**: O componente está memoizado mas a comparação de props pode estar falhando

O Switch está funcionando tecnicamente (o módulo é desativado no banco), mas a **UI não atualiza visualmente** após a mutação.

---

## Causa Raiz

O `React.memo` está usando comparação shallow por padrão. Quando os dados são invalidados e refetchados, o objeto `module` pode ter a mesma referência ou a comparação está falhando.

Além disso, o uso de `React.memo` com named function está causando warning de ref.

---

## Solução

### Arquivo: `src/components/admin/settings/ModulesTab.tsx`

**1. Remover React.memo do ModuleRow**

O React.memo está causando problemas de re-render. Como a lista de módulos é pequena (menos de 20 itens), o ganho de performance é negligível e está causando bugs.

```typescript
// ANTES
const ModuleRow = React.memo(function ModuleRow({ ... }) {
  ...
});

// DEPOIS
function ModuleRow({ module, onToggle, isLoading }: ModuleRowProps) {
  ...
}
```

**2. Adicionar key única baseada no estado**

Forçar re-render quando o estado muda usando uma key composta:

```typescript
// ANTES
<ModuleRow
  key={module.id}
  module={module}
  ...
/>

// DEPOIS  
<ModuleRow
  key={`${module.id}-${module.is_enabled}`}
  module={module}
  ...
/>
```

**3. Garantir que o Switch receba prop checked corretamente**

Adicionar conversão explícita para boolean:

```typescript
// ANTES
checked={module.is_enabled === true}

// DEPOIS
checked={Boolean(module.is_enabled)}
```

---

## Mudanças Completas

```text
src/components/admin/settings/ModulesTab.tsx
├── Linha 64: Remover React.memo wrapper
├── Linha 217: Adicionar key composta com estado
└── Linha 93: Usar Boolean() para checked
```

---

## Resultado Esperado

| Estado | Visual do Switch |
|--------|------------------|
| `is_enabled: true` | Toggle verde/ativo, bolinha à direita |
| `is_enabled: false` | Toggle cinza/inativo, bolinha à esquerda |
| Badge | "Ativo" (verde) ou "Oculto" (âmbar) |
| Ícone do módulo | Colorido (ativo) ou cinza (inativo) |

Após a correção, ao clicar no toggle:
1. Mutação é enviada ao banco
2. Query é invalidada
3. Dados frescos são buscados
4. Componente re-renderiza com novo estado
5. Switch atualiza visualmente
