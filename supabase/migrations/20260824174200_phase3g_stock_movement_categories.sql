-- Phase 3G: allow the explicit physical receipt and production-consumption audit categories.

ALTER TABLE public.stock_movements
  DROP CONSTRAINT stock_movements_category_check;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_category_check
  CHECK (category = ANY (ARRAY[
    'compra_material'::text,
    'compra'::text,
    'venda'::text,
    'devolucao'::text,
    'perda'::text,
    'ajuste_positivo'::text,
    'ajuste_negativo'::text,
    'producao'::text,
    'consumo_producao'::text
  ]));
