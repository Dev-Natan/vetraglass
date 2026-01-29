

# Plano: Usar Logo Completo na Sidebar

## Objetivo

Substituir a area atual do logo (icone + texto separados) por uma unica imagem que contem o logo completo "Vetra" (icone dos vidros azuis + texto "Vetra" integrado).

---

## Situacao Atual

A sidebar possui:
- Uma imagem pequena do icone (40x40px)
- Texto "Vetra" separado em um elemento `<h1>`
- Subtitulo "Sistema de Gestao" em um elemento `<p>`

---

## Alteracoes Tecnicas

### 1. Copiar nova imagem para o projeto

```
user-uploads://ChatGPT_Image_29_de_jan._de_2026_07_51_49.png -> public/vetra-logo.png
```

### 2. Modificar Sidebar.tsx

Substituir a estrutura atual por uma unica imagem do logo completo:

**Antes (linhas 155-164):**
```typescript
<div className="flex items-center gap-3">
  <img 
    src="/vetra-logo.png" 
    alt="Vetra Logo" 
    className="w-10 h-10 object-contain mix-blend-multiply"
  />
  <div>
    <h1 className="font-display font-bold text-lg text-sidebar-foreground">Vetra</h1>
    <p className="text-xs text-sidebar-foreground/50">Sistema de Gestão</p>
  </div>
</div>
```

**Depois:**
```typescript
<div className="flex items-center">
  <img 
    src="/vetra-logo.png" 
    alt="Vetra Logo" 
    className="h-10 object-contain mix-blend-multiply"
  />
</div>
```

A imagem sera dimensionada pela altura (`h-10` = 40px) e a largura sera automatica para manter a proporcao.

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `public/vetra-logo.png` | Substituir pela nova imagem completa |
| `src/components/layout/Sidebar.tsx` | Remover texto separado e usar apenas a imagem |

---

## Resultado Esperado

- Logo completo (icone + texto "Vetra") em uma unica imagem
- Fundo branco removido via `mix-blend-multiply`
- Layout mais limpo e profissional
- Subtitulo "Sistema de Gestao" removido (pois o texto ja esta na imagem)

