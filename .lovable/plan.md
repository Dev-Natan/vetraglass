

# Plano: Corrigir Logo da Sidebar com Fundo Transparente

## Problema Identificado

A imagem do logo atual possui fundo branco, que fica visivel e contrasta mal com a sidebar azul do sistema.

---

## Solucao Proposta

Usar CSS com `mix-blend-mode: multiply` para fazer o fundo branco da imagem se mesclar com o fundo azul da sidebar, tornando-o visualmente transparente.

Esta tecnica funciona porque:
- O modo `multiply` multiplica as cores dos pixels
- Branco (255, 255, 255) multiplicado por qualquer cor resulta na propria cor
- Assim, o fundo branco "desaparece" e so o logo colorido fica visivel

---

## Alteracao Tecnica

### Arquivo: `src/components/layout/Sidebar.tsx`

Adicionar a classe `mix-blend-mode: multiply` na tag de imagem do logo:

**Antes (linha 156-160):**
```typescript
<img 
  src="/vetra-logo.png" 
  alt="Vetra Logo" 
  className="w-10 h-10 object-contain"
/>
```

**Depois:**
```typescript
<img 
  src="/vetra-logo.png" 
  alt="Vetra Logo" 
  className="w-10 h-10 object-contain mix-blend-multiply"
/>
```

---

## Alternativa (caso o resultado visual nao fique bom)

Se o `mix-blend-multiply` nao produzir um resultado satisfatorio, a alternativa seria:

1. Processar a imagem para remover o fundo branco usando uma ferramenta externa
2. Ou criar um CSS filter customizado para tornar pixels brancos transparentes

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/layout/Sidebar.tsx` | Adicionar `mix-blend-multiply` na classe da imagem |

---

## Resultado Esperado

- Logo dos vidros azuis com checkmark prateado exibido na sidebar
- Fundo branco removido visualmente, integrando com a sidebar azul
- Nenhuma alteracao na imagem necessaria

