
Objetivo
- Corrigir a navegação vertical (scroll com roda do mouse/trackpad) dentro do modal “Aprovar Orçamento”, permitindo acessar o conteúdo abaixo/ acima mantendo cabeçalho e rodapé fixos.

Diagnóstico (provável causa)
- Hoje o `DialogContent` tem `max-h-[90vh]`, mas não tem uma altura “definida” (`height`). Em layouts flex, quando o container pai tem altura “auto”, o filho com `flex-1` (o `ScrollArea`) não consegue calcular a área disponível corretamente.
- Resultado: o conteúdo fica “cortado” pelo `overflow-hidden` do `DialogContent` e o `ScrollArea` não vira uma área rolável (não existe overflow interno de fato), então a roda do mouse não faz nada.

O que vou mudar (sem alterar outras telas)
1) Ajustar o container do modal para ter altura real
- Arquivo: `src/components/orcamentos/AprovarOrcamentoDialog.tsx`
- Alterar o `DialogContent` para ter uma altura fixa baseada na viewport (mantendo o “máximo” visual):
  - Trocar de:
    - `max-h-[90vh]`
  - Para algo como:
    - `h-[90vh] max-h-[90vh]` (ou somente `h-[90vh]`, conforme o comportamento desejado)
  - Manter `overflow-hidden`, `flex flex-col` e `min-h-0`.

2) Garantir que header e footer não “roubem” a altura do scroll
- Adicionar `shrink-0` no header (bloco do topo) e no footer (bloco dos botões), para assegurar que o “miolo” é quem absorve a rolagem.
  - Header: a `<div className="px-6 ...">` do topo
  - Footer: a `<div className="border-t ...">` de baixo

3) Garantir que a área rolável consegue encolher e virar overflow interno
- No `ScrollArea`, adicionar `min-h-0` junto do `flex-1`.
  - De:
    - `className="flex-1 px-6 py-4"`
  - Para:
    - `className="flex-1 min-h-0 px-6 py-4"`

4) (Fallback de robustez, se ainda houver problema em algum browser)
- Se, mesmo com altura fixa, o Radix `ScrollArea` ainda não capturar a roda do mouse em algum ambiente específico, eu troco apenas neste modal o `ScrollArea` por um container nativo:
  - `div className="flex-1 min-h-0 overflow-y-auto ..."`
- Isso garante 100% de rolagem com mouse/trackpad, mantendo header e footer fixos. (Eu só aplico esse fallback se necessário.)

Como vou validar
- Abrir “Aprovar Orçamento” com bastante conteúdo (como no seu print).
- Testar:
  - Roda do mouse para baixo/cima
  - Trackpad (scroll inercial)
  - Drag na barra (quando visível)
- Confirmar que:
  - Cabeçalho e rodapé permanecem fixos
  - O conteúdo do passo 1, 2 e 3 rola normalmente
  - Não há “corte” do conteúdo no fim da tela

Risco/impacto
- Mudança localizada apenas no modal `AprovarOrcamentoDialog`.
- Não mexe na página `/orcamentos` nem em outras telas, e evita efeitos colaterais globais.

Arquivos envolvidos
- `src/components/orcamentos/AprovarOrcamentoDialog.tsx` (principal)
- (Opcional, somente se o fallback for necessário) ajustes apenas no modal para usar scroll nativo em vez do `ScrollArea`.
