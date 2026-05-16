## Problema identificado

O botão de engrenagem (Settings) no header superior do `MainLayout.tsx` (linha 44-46) é apenas decorativo — não possui `onClick` nem está envolvido por um `Link`. Por isso, ao clicar, nada acontece.

```tsx
<Button variant="ghost" size="icon" ...>
  <Settings className="w-5 h-5" />
</Button>
```

## Solução proposta

Envolver o botão em um `<Link to="/configuracoes">` do `react-router-dom`, mantendo a aparência atual (variant ghost, ícone, tamanho 9x9). Ao clicar, o usuário será levado direto para a tela de Configurações da empresa.

### Alterações

**Arquivo:** `src/components/layout/MainLayout.tsx`

1. Adicionar `import { Link } from 'react-router-dom';`
2. Trocar o `<Button>` solto por:
   ```tsx
   <Button asChild variant="ghost" size="icon" ...>
     <Link to="/configuracoes" aria-label="Configurações">
       <Settings className="w-5 h-5" />
     </Link>
   </Button>
   ```

### Validação
- Clicar no ícone de engrenagem leva para `/configuracoes`.
- Aparência e hover do botão permanecem idênticos.
- Funciona tanto em desktop quanto mobile (não altera responsividade).

Nenhuma outra parte do sistema é afetada.
