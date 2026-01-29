
# Plano: Trocar Logo do Sistema Vetra por Imagem Personalizada

## Objetivo

Substituir o logo atual do sistema (letra "V" em um quadrado com texto "Vetra") pela imagem personalizada enviada pelo usuario.

---

## Implementacao Atual

O logo atual esta na Sidebar (linhas 152-162) e consiste em:
- Um quadrado arredondado com a letra "V"
- Texto "Vetra" ao lado
- Subtitulo "Sistema de Gestao"

```typescript
<div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center font-display font-bold text-sidebar-primary-foreground text-lg">
  V
</div>
<div>
  <h1 className="font-display font-bold text-lg text-sidebar-foreground">Vetra</h1>
  <p className="text-xs text-sidebar-foreground/50">Sistema de Gestão</p>
</div>
```

---

## Alteracoes Tecnicas

### 1. Copiar imagem para o projeto

Copiar a imagem enviada para a pasta `public/`:

```
user-uploads://ChatGPT_Image_29_de_jan._de_2026_07_31_56.png -> public/vetra-logo.png
```

### 2. Modificar Sidebar.tsx

Substituir o elemento de logo atual por uma tag `<img>` com a nova imagem:

```typescript
// Antes (linhas 155-162)
<div className="flex items-center gap-3">
  <div className="w-10 h-10 rounded-xl bg-sidebar-primary ...">
    V
  </div>
  <div>
    <h1>Vetra</h1>
    <p>Sistema de Gestão</p>
  </div>
</div>

// Depois
<div className="flex items-center gap-3">
  <img 
    src="/vetra-logo.png" 
    alt="Vetra Logo" 
    className="w-10 h-10 object-contain"
  />
  <div>
    <h1 className="font-display font-bold text-lg text-sidebar-foreground">Vetra</h1>
    <p className="text-xs text-sidebar-foreground/50">Sistema de Gestão</p>
  </div>
</div>
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `public/vetra-logo.png` | Criar (copiar imagem enviada) |
| `src/components/layout/Sidebar.tsx` | Substituir elemento de logo por tag img |

---

## Resultado Esperado

- Logo personalizado com design de vidros azuis e checkmark prateado exibido na sidebar
- Nome "Vetra" e subtitulo "Sistema de Gestao" mantidos ao lado do logo
- Logo responsivo e bem dimensionado (40x40 pixels)
