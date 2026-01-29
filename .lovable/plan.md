

# Plano: Restaurar Logo Original com Icone "V" e Texto Separado

## Objetivo

Restaurar o logo da sidebar para a versao original que mostra:
- Icone azul com a letra "V" em um quadrado arredondado
- Texto "Vetra" ao lado
- Subtitulo "Sistema de Gestao" abaixo

---

## Alteracoes Tecnicas

### Arquivo: `src/components/layout/Sidebar.tsx`

Restaurar a estrutura original do logo com o icone "V" e textos separados:

**Codigo atual (linhas 155-159):**
```typescript
<img 
  src="/vetra-logo.png" 
  alt="Vetra Logo" 
  className="h-10 object-contain mix-blend-multiply"
/>
```

**Codigo restaurado:**
```typescript
<div className="flex items-center gap-3">
  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
    <span className="text-white text-xl font-bold">V</span>
  </div>
  <div>
    <h1 className="font-display font-bold text-lg text-sidebar-foreground">Vetra</h1>
    <p className="text-xs text-sidebar-foreground/50">Sistema de Gestao</p>
  </div>
</div>
```

Esta versao usa um icone CSS puro (quadrado azul com "V" branco) em vez de depender de uma imagem externa, garantindo consistencia visual.

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/layout/Sidebar.tsx` | Restaurar estrutura original com icone "V" e textos |

---

## Resultado Esperado

- Icone azul com "V" branco em quadrado arredondado
- Texto "Vetra" em destaque ao lado
- Subtitulo "Sistema de Gestao" abaixo
- Nao depende de imagem externa
- Visual identico a imagem de referencia enviada

