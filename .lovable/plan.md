

# Plano: Ocultar Informações Financeiras da OS para Não-Financeiros

## Problema Identificado

Atualmente, a página de detalhes da Ordem de Serviço exibe diversas informações financeiras para todos os usuários. Essas informações devem ser restritas apenas para usuários com perfil de **caixa** ou **financeiro**.

### Informações que Serão Ocultadas para Outros Perfis

| Elemento | Localização | Ação |
|----------|-------------|------|
| Aba "Financeiro" completa | Tabs principais | Ocultar aba inteira |
| Timeline com valores de entrada e faturamento | Card OSSalesFlowTimeline | Substituir valores por "•••" ou ocultar |
| Card de Total/Pendente no resumo | Summary Card | Ocultar campos financeiros |
| Valores no OSSalesFlowTimeline | Timeline de fluxo | Ocultar valores monetários |

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VISIBILIDADE POR PERFIL                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                     Financeiro/Caixa/Admin          Produção/Instalador/Outros
                     ─────────────────────          ─────────────────────────

Timeline Fluxo       ✅ Valores visíveis            ❌ Valores ocultos
Aba Financeiro       ✅ Visível                     ❌ Oculta
Card Total/Pendente  ✅ Visível                     ❌ Oculto
OSFinancialDashboard ✅ Acesso completo             ❌ Sem acesso
```

## Mudanças Técnicas

### Arquivo 1: `src/pages/OrdemServicoDetalhes.tsx`

Adicionar verificação de permissões usando o hook `usePermissionProfile`:

1. Importar o hook de permissões
2. Verificar se usuário pode ver dados financeiros
3. Ocultar condicionalmente:
   - Aba "Financeiro" das tabs
   - Card com Total/Pendente no resumo
   - Valores financeiros no OSSalesFlowTimeline

```typescript
// Adicionar import
import { usePermissionProfile } from '@/hooks/usePermissionProfile';

// No componente
const { 
  isAdmin, 
  isGerente, 
  isCaixa, 
  isFinanceiro 
} = usePermissionProfile();

// Definir quem pode ver dados financeiros
const canSeeFinancials = isAdmin || isGerente || isCaixa || isFinanceiro;
```

### Mudanças no JSX:

**1. Aba Financeiro (linhas ~403-440):**
```typescript
// Ocultar aba das tabs
<TabsList className={cn(
  "grid w-full",
  canSeeFinancials ? "grid-cols-6" : "grid-cols-5"
)}>
  {canSeeFinancials && (
    <TabsTrigger value="financial">
      <Wallet className="w-4 h-4" />
      <span className="hidden sm:inline">Financeiro</span>
    </TabsTrigger>
  )}
  {/* ... outras abas */}
</TabsList>

{canSeeFinancials && (
  <TabsContent value="financial">
    <OSFinancialDashboard {...props} />
  </TabsContent>
)}
```

**2. Card de Resumo (linhas ~320-365):**
```typescript
// Ocultar informações de Total e Pendente
{canSeeFinancials && (
  <div className="flex items-start gap-3">
    <DollarSign className="w-5 h-5 text-muted-foreground mt-0.5" />
    <div>
      <div className="text-sm text-muted-foreground">Total</div>
      <div className="font-medium">{formatCurrency(ordem.total_amount)}</div>
      {ordem.pending_amount > 0 && (
        <div className="text-xs text-destructive">
          Pendente: {formatCurrency(ordem.pending_amount)}
        </div>
      )}
    </div>
  </div>
)}
```

**3. Timeline de Fluxo (linhas ~293-309):**

Passar prop para indicar se deve ocultar valores:

```typescript
<OSSalesFlowTimeline
  // ... props existentes
  hideFinancialValues={!canSeeFinancials}
/>
```

### Arquivo 2: `src/components/ordens-servico/OSSalesFlowTimeline.tsx`

Adicionar prop para ocultar valores financeiros:

```typescript
interface OSSalesFlowTimelineProps {
  // ... props existentes
  hideFinancialValues?: boolean;
}

export function OSSalesFlowTimeline({
  // ... props existentes
  hideFinancialValues = false,
}: OSSalesFlowTimelineProps) {
  
  // No getSteps(), ocultar valores se necessário
  {
    id: 'entry',
    label: 'Entrada',
    value: hideFinancialValues 
      ? undefined  // Não mostra valor
      : entryValue > 0 ? formatCurrency(entryValue) : 'Sem entrada',
  },
  {
    id: 'billing',
    label: 'Faturamento',
    value: hideFinancialValues 
      ? undefined 
      : isFullyPaid ? formatCurrency(totalAmount) : formatCurrency(pendingAmount) + ' pendente',
  },
}
```

## Tabela de Permissões

| Perfil | Vê Aba Financeiro? | Vê Valores? | Vê Timeline Completa? |
|--------|-------------------|-------------|----------------------|
| Admin | ✅ | ✅ | ✅ |
| Gerente | ✅ | ✅ | ✅ |
| Financeiro | ✅ | ✅ | ✅ |
| Caixa | ✅ | ✅ | ✅ |
| Vendedor | ❌ | ❌ | ❌ (sem valores) |
| Produção | ❌ | ❌ | ❌ (sem valores) |
| Almoxarifado | ❌ | ❌ | ❌ (sem valores) |
| Instalador | ❌ | ❌ | ❌ (sem valores) |

## Resumo dos Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/OrdemServicoDetalhes.tsx` | Adicionar lógica de permissão para ocultar elementos |
| `src/components/ordens-servico/OSSalesFlowTimeline.tsx` | Adicionar prop para ocultar valores financeiros |

## Comportamento Final

**Para Produção/Instalador/Vendedor:**
- Vê timeline de fluxo SEM valores monetários
- Não vê aba "Financeiro"
- Não vê card de Total/Pendente no resumo
- Pode ver todas as outras abas (Materiais, Corte, Vidros, Fotos, Detalhes)

**Para Admin/Gerente/Financeiro/Caixa:**
- Acesso completo como está hoje

