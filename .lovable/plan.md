

# Centralização do Utilitário WhatsApp

## Resumo
Criar uma função utilitária centralizada `getWhatsappLink` que será usada em todo o sistema para gerar links do WhatsApp, eliminando código duplicado em 4+ componentes.

---

## Problema Atual

O código de geração de links WhatsApp está **duplicado** em múltiplos componentes:

| Arquivo | Função |
|---------|--------|
| `ClientQuickActions.tsx` | `handleWhatsApp()` |
| `ClientsCardView.tsx` | `handleWhatsApp()` |
| `ClientsTableView.tsx` | `handleWhatsApp()` |
| `OverdueReceivablesAlert.tsx` | `handleWhatsApp()` |

Cada um repete a mesma lógica:
1. Limpar telefone (remover não-dígitos)
2. Adicionar DDI 55 se necessário
3. Codificar mensagem
4. Montar URL `wa.me`

---

## Solução

### 1. Criar arquivo utilitário

**Novo arquivo:** `src/utils/whatsapp.ts`

```typescript
/**
 * Gera link do WhatsApp Web com mensagem pré-preenchida
 * @param phone - Telefone (qualquer formato)
 * @param message - Mensagem opcional
 * @returns URL do wa.me ou string vazia se inválido
 */
export function getWhatsappLink(phone: string | null | undefined, message?: string): string {
  if (!phone) return '';
  
  // Remove tudo que não é dígito
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (!cleanPhone) return '';

  let fullPhone = cleanPhone;

  // Adicionar DDI Brasil (55) se estiver faltando
  // Telefone BR: 10 dígitos (fixo) ou 11 dígitos (celular)
  if (fullPhone.length === 10 || fullPhone.length === 11) {
    fullPhone = `55${fullPhone}`;
  }
  
  const encodedMessage = encodeURIComponent(message || '');
  return `https://wa.me/${fullPhone}?text=${encodedMessage}`;
}

/**
 * Abre WhatsApp em nova aba
 * @param phone - Telefone
 * @param message - Mensagem
 * @returns true se abriu, false se telefone inválido
 */
export function openWhatsapp(phone: string | null | undefined, message?: string): boolean {
  const link = getWhatsappLink(phone, message);
  if (!link) return false;
  
  window.open(link, '_blank');
  return true;
}
```

---

### 2. Refatorar componentes

#### `ClientQuickActions.tsx`
```typescript
import { openWhatsapp } from '@/utils/whatsapp';

const handleWhatsApp = () => {
  if (!openWhatsapp(client.phone, `Olá ${client.name}, tudo bem?`)) {
    toast.error('Cliente não possui telefone cadastrado');
  }
};
```

#### `ClientsCardView.tsx`
```typescript
import { openWhatsapp } from '@/utils/whatsapp';

const handleWhatsApp = (client: Client, e: React.MouseEvent) => {
  e.stopPropagation();
  openWhatsapp(client.phone, `Olá ${client.name}, tudo bem?`);
};
```

#### `ClientsTableView.tsx`
```typescript
import { openWhatsapp } from '@/utils/whatsapp';

const handleWhatsApp = (client: Client, e: React.MouseEvent) => {
  e.stopPropagation();
  openWhatsapp(client.phone, `Olá ${client.name}, tudo bem?`);
};
```

#### `OverdueReceivablesAlert.tsx`
```typescript
import { openWhatsapp } from '@/utils/whatsapp';

const handleWhatsApp = (customerPhone?: string) => {
  openWhatsapp(
    customerPhone,
    'Olá! Estamos entrando em contato referente ao pagamento pendente. Por favor, entre em contato conosco para regularizar.'
  );
};
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Lógica duplicada em 4 arquivos | Função única reutilizável |
| Manutenção difícil | Alterar em um lugar afeta todos |
| Sem validação consistente | Validação padronizada |
| Código verboso | Chamada de 1 linha |

---

## Arquivos Afetados

| Ação | Arquivo |
|------|---------|
| **Criar** | `src/utils/whatsapp.ts` |
| Editar | `src/components/clientes/ClientQuickActions.tsx` |
| Editar | `src/components/clientes/ClientsCardView.tsx` |
| Editar | `src/components/clientes/ClientsTableView.tsx` |
| Editar | `src/components/financeiro/OverdueReceivablesAlert.tsx` |

