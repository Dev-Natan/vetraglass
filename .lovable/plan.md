
# Plano: Substituir Logo por Imagem com Fundo Transparente

## Objetivo

Substituir o logo atual (`public/vetra-logo.png`) pela nova imagem enviada, que possui fundo transparente e se integrara perfeitamente com a sidebar escura.

---

## Alteracao Tecnica

### Arquivo: `public/vetra-logo.png`

Substituir pela nova imagem enviada:

```
user-uploads://ChatGPT_Image_29_de_jan._de_2026_07_39_25.png -> public/vetra-logo.png
```

### Arquivo: `src/components/layout/Sidebar.tsx`

Nenhuma alteracao necessaria - o codigo ja referencia `/vetra-logo.png`.

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `public/vetra-logo.png` | Substituir pela nova imagem com fundo transparente |

---

## Resultado Esperado

- Logo com os vidros azuis e checkmark prateado exibido na sidebar
- Fundo transparente, integrando perfeitamente com a sidebar escura
- Nome "Vetra" e subtitulo "Sistema de Gestao" mantidos ao lado do logo
