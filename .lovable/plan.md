
# Plano: Adicionar Acesso à Área Fiscal nas Configurações

## Problema Identificado

A página de Configurações Fiscais (`/configuracoes/fiscal`) já existe e contém:
- Upload de certificado digital A1 (.pfx/.p12)
- Validação automática de CNPJ e validade
- Configuração do modo fiscal
- Dados fiscais da empresa (Inscrição Municipal, Estadual, Código IBGE)

Porém, não há nenhum link visível para acessá-la na página de Configurações principal.

## Solução

Adicionar um card de acesso rápido na página de Configurações (`/configuracoes`) para a Área Fiscal.

---

## Alteração Proposta

### Arquivo: `src/pages/Configuracoes.tsx`

Adicionar ao array `settingsGroups` um novo item para Configurações Fiscais:

```typescript
const settingsGroups = [
  {
    icon: Receipt,  // Ícone de nota fiscal
    title: 'Área Fiscal',
    description: 'Certificado digital, NCM, CFOP e emissão de NF-e.',
    path: '/configuracoes/fiscal',
  },
  // ... demais itens existentes
];
```

O card será exibido junto com os outros:

| Card Atual | Card a Adicionar |
|------------|------------------|
| Usuários e Permissões | **Área Fiscal** (NOVO) |
| Notificações | |
| Segurança | |
| Dados e Exportação | |

---

## Resultado Visual

Após a alteração, a página de Configurações exibirá:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Configurações                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Dados da Empresa] - Card existente com logo, CNPJ, etc.       │
│                                                                 │
│  [Token de Login] - Card existente                              │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ 📋 Área Fiscal  │  │ 👥 Usuários     │  │ 🔔 Notificações │ │
│  │ Certificado     │  │ Controle de     │  │ Alertas por     │ │
│  │ digital, NF-e   │  │ acesso          │  │ email           │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │ 🔒 Segurança    │  │ 💾 Dados        │                      │
│  │ Senhas e        │  │ Exportação e    │                      │
│  │ backups         │  │ backups         │                      │
│  └─────────────────┘  └─────────────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detalhes Técnicos

### Importar ícone

```typescript
import { Receipt } from 'lucide-react';
```

### Novo item no array

```typescript
{
  icon: Receipt,
  title: 'Área Fiscal',
  description: 'Certificado digital, NCM, CFOP e emissão de NF-e.',
  path: '/configuracoes/fiscal',
},
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Configuracoes.tsx` | Adicionar card "Área Fiscal" ao array `settingsGroups` |

---

## Resumo

Alteração simples de **uma única linha** para tornar visível a área fiscal que já existe e já contém toda a funcionalidade de certificado digital.
