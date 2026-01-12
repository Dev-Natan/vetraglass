-- Tabela para notas fiscais emitidas
CREATE TABLE public.notas_fiscais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  
  -- Tipo e identificação
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('nfe', 'nfse')),
  numero INTEGER,
  serie VARCHAR(5),
  chave_acesso VARCHAR(60),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'autorizada', 'rejeitada', 'cancelada')),
  status_sefaz VARCHAR(10),
  motivo_rejeicao TEXT,
  
  -- Referência Focusnfe
  focusnfe_ref VARCHAR(100),
  focusnfe_status VARCHAR(50),
  
  -- Dados do emitente (empresa)
  emitente_cnpj VARCHAR(20) NOT NULL,
  emitente_razao_social VARCHAR(200) NOT NULL,
  emitente_ie VARCHAR(20),
  emitente_im VARCHAR(20),
  
  -- Dados do destinatário
  destinatario_tipo VARCHAR(10) CHECK (destinatario_tipo IN ('cpf', 'cnpj')),
  destinatario_documento VARCHAR(20),
  destinatario_nome VARCHAR(200) NOT NULL,
  destinatario_email VARCHAR(200),
  destinatario_telefone VARCHAR(20),
  destinatario_endereco TEXT,
  destinatario_cidade VARCHAR(100),
  destinatario_uf VARCHAR(2),
  destinatario_cep VARCHAR(10),
  
  -- Valores
  valor_produtos DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_servicos DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_desconto DECIMAL(12,2) DEFAULT 0,
  valor_frete DECIMAL(12,2) DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- Impostos
  valor_icms DECIMAL(12,2) DEFAULT 0,
  valor_iss DECIMAL(12,2) DEFAULT 0,
  valor_pis DECIMAL(12,2) DEFAULT 0,
  valor_cofins DECIMAL(12,2) DEFAULT 0,
  
  -- Dados adicionais
  natureza_operacao VARCHAR(100) DEFAULT 'Venda de mercadorias',
  codigo_servico VARCHAR(20),
  discriminacao_servicos TEXT,
  informacoes_complementares TEXT,
  
  -- XMLs e PDFs
  xml_nota TEXT,
  pdf_url TEXT,
  
  -- Datas
  data_emissao TIMESTAMP WITH TIME ZONE,
  data_autorizacao TIMESTAMP WITH TIME ZONE,
  data_cancelamento TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para itens da nota fiscal
CREATE TABLE public.nota_fiscal_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nota_fiscal_id UUID NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  
  -- Identificação do item
  codigo VARCHAR(60),
  descricao VARCHAR(200) NOT NULL,
  ncm VARCHAR(10),
  cfop VARCHAR(10),
  unidade VARCHAR(10) DEFAULT 'UN',
  
  -- Quantidades e valores
  quantidade DECIMAL(15,4) NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(15,4) NOT NULL DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_desconto DECIMAL(12,2) DEFAULT 0,
  
  -- Impostos do item
  icms_origem VARCHAR(2) DEFAULT '0',
  icms_situacao_tributaria VARCHAR(5),
  icms_aliquota DECIMAL(5,2) DEFAULT 0,
  icms_valor DECIMAL(12,2) DEFAULT 0,
  
  pis_situacao_tributaria VARCHAR(5),
  pis_aliquota DECIMAL(5,2) DEFAULT 0,
  pis_valor DECIMAL(12,2) DEFAULT 0,
  
  cofins_situacao_tributaria VARCHAR(5),
  cofins_aliquota DECIMAL(5,2) DEFAULT 0,
  cofins_valor DECIMAL(12,2) DEFAULT 0,
  
  -- ISS (para serviços)
  iss_aliquota DECIMAL(5,2) DEFAULT 0,
  iss_valor DECIMAL(12,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_notas_fiscais_company ON public.notas_fiscais(company_id);
CREATE INDEX idx_notas_fiscais_status ON public.notas_fiscais(status);
CREATE INDEX idx_notas_fiscais_tipo ON public.notas_fiscais(tipo);
CREATE INDEX idx_notas_fiscais_sale ON public.notas_fiscais(sale_id);
CREATE INDEX idx_nota_fiscal_itens_nota ON public.nota_fiscal_itens(nota_fiscal_id);

-- RLS
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nota_fiscal_itens ENABLE ROW LEVEL SECURITY;

-- Policies para notas_fiscais
CREATE POLICY "Users can view company notas fiscais"
ON public.notas_fiscais FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can create notas fiscais"
ON public.notas_fiscais FOR INSERT
WITH CHECK (user_has_role_in_company(auth.uid(), company_id, 'admin'));

CREATE POLICY "Admins can update notas fiscais"
ON public.notas_fiscais FOR UPDATE
USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- Policies para itens (herdam da nota)
CREATE POLICY "Users can view nota fiscal itens"
ON public.nota_fiscal_itens FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.notas_fiscais nf 
  WHERE nf.id = nota_fiscal_id 
  AND user_belongs_to_company(auth.uid(), nf.company_id)
));

CREATE POLICY "Admins can manage nota fiscal itens"
ON public.nota_fiscal_itens FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.notas_fiscais nf 
  WHERE nf.id = nota_fiscal_id 
  AND user_has_role_in_company(auth.uid(), nf.company_id, 'admin')
));

-- Trigger para updated_at
CREATE TRIGGER update_notas_fiscais_updated_at
BEFORE UPDATE ON public.notas_fiscais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();