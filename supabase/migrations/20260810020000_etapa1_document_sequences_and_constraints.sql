-- Migration: 20260810020000_etapa1_document_sequences_and_constraints.sql
-- Etapa 1: Tabela de sequências anuais por empresa, RPC atômica get_next_document_number e constraints de unicidade.

-- 1. Tabela para sequências anuais por empresa e tipo de documento
CREATE TABLE IF NOT EXISTS public.company_document_sequences (
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    year INTEGER NOT NULL,
    last_value INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (company_id, document_type, year)
);

-- Habilitar RLS na tabela de sequências
ALTER TABLE public.company_document_sequences ENABLE ROW LEVEL SECURITY;

-- Remover política se existir para recriar de forma limpa
DROP POLICY IF EXISTS "company_document_sequences_select" ON public.company_document_sequences;

-- Política RLS para leitura por membros da empresa
CREATE POLICY "company_document_sequences_select"
    ON public.company_document_sequences
    FOR SELECT
    USING (public.user_belongs_to_company(auth.uid(), company_id));

-- 2. Função de numeração anual atômica e segura para concorrência (FOR UPDATE)
CREATE OR REPLACE FUNCTION public.get_next_document_number(
    p_company_id UUID,
    p_document_type TEXT,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_norm_type TEXT;
    v_next_val INTEGER;
    v_max_existing INTEGER;
BEGIN
    -- Validar autenticação
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'unauthenticated';
    END IF;

    -- Validar se o usuário pertence à empresa
    IF NOT public.user_belongs_to_company(auth.uid(), p_company_id) THEN
        RAISE EXCEPTION 'unauthorized';
    END IF;

    -- Validar e normalizar o tipo de documento (somente OS e SALE)
    v_norm_type := UPPER(TRIM(p_document_type));
    IF v_norm_type NOT IN ('OS', 'SALE') THEN
        RAISE EXCEPTION 'invalid_document_type: %', p_document_type;
    END IF;

    -- Validar ano
    IF p_year IS NULL OR p_year < 2000 OR p_year > 2100 THEN
        RAISE EXCEPTION 'invalid_year: %', p_year;
    END IF;

    -- Tentar obter e travar a linha da sequência atual para (company_id, document_type, year)
    SELECT last_value + 1
      INTO v_next_val
      FROM public.company_document_sequences
     WHERE company_id = p_company_id
       AND document_type = v_norm_type
       AND year = p_year
       FOR UPDATE;

    IF FOUND THEN
        -- Atualizar o contador da sequência
        UPDATE public.company_document_sequences
           SET last_value = v_next_val,
               updated_at = NOW()
         WHERE company_id = p_company_id
           AND document_type = v_norm_type
           AND year = p_year;

        RETURN v_next_val;
    ELSE
        -- Sequência ainda não existe para esta empresa/tipo/ano neste ciclo.
        -- Inicialização atômica: buscar o maior número existente APENAS daquela empresa E daquele ano.
        IF v_norm_type = 'OS' THEN
            SELECT COALESCE(MAX(os_number), 0)
              INTO v_max_existing
              FROM public.ordens_servico
             WHERE company_id = p_company_id
               AND EXTRACT(YEAR FROM created_at) = p_year;
        ELSIF v_norm_type = 'SALE' THEN
            SELECT COALESCE(MAX(sale_number), 0)
              INTO v_max_existing
              FROM public.sales
             WHERE company_id = p_company_id
               AND EXTRACT(YEAR FROM created_at) = p_year;
        END IF;

        v_next_val := COALESCE(v_max_existing, 0) + 1;

        -- Inserir novo registro de sequência
        INSERT INTO public.company_document_sequences (company_id, document_type, year, last_value, updated_at)
        VALUES (p_company_id, v_norm_type, p_year, v_next_val, NOW())
        ON CONFLICT (company_id, document_type, year) DO UPDATE
        SET last_value = company_document_sequences.last_value + 1,
            updated_at = NOW()
        RETURNING last_value INTO v_next_val;

        RETURN v_next_val;
    END IF;
END;
$$;

-- Permissões estritas na função
REVOKE EXECUTE ON FUNCTION public.get_next_document_number(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_document_number(UUID, TEXT, INTEGER) TO authenticated;

-- 3. Constraints/Índices de unicidade para evitar duplicidades
CREATE UNIQUE INDEX IF NOT EXISTS uq_ordens_servico_quote_id
    ON public.ordens_servico (quote_id)
 WHERE quote_id IS NOT NULL AND status <> 'cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_quote_type
    ON public.sales (quote_id, sale_type)
 WHERE quote_id IS NOT NULL AND payment_status <> 'cancelled';
