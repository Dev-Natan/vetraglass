export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          is_active: boolean
          starts_at: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          starts_at?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          starts_at?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_registers: {
        Row: {
          actual_amount: number | null
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          company_id: string
          created_at: string
          difference: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          company_id: string
          created_at?: string
          difference?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          company_id?: string
          created_at?: string
          difference?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          document: string | null
          document_type: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          ambiente_fiscal: string | null
          cnpj: string
          codigo_municipio_ibge: string | null
          created_at: string
          email: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logo_url: string | null
          name: string
          phone: string | null
          regime_tributario: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          ambiente_fiscal?: string | null
          cnpj: string
          codigo_municipio_ibge?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          regime_tributario?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          ambiente_fiscal?: string | null
          cnpj?: string
          codigo_municipio_ibge?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          regime_tributario?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_item_prices: {
        Row: {
          company_id: string
          cost: number | null
          created_at: string
          id: string
          item_template_id: string
          price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          cost?: number | null
          created_at?: string
          id?: string
          item_template_id: string
          price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          cost?: number | null
          created_at?: string
          id?: string
          item_template_id?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_item_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_item_prices_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      company_products: {
        Row: {
          base_price: number | null
          commercial_name: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          margin_percent: number | null
          product_template_id: string
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          commercial_name: string
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          margin_percent?: number | null
          product_template_id: string
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          commercial_name?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          margin_percent?: number | null
          product_template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_products_product_template_id_fkey"
            columns: ["product_template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      company_stock: {
        Row: {
          allow_fractional: boolean
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          item_template_id: string
          location: string | null
          min_quantity: number | null
          quantity: number
          updated_at: string
        }
        Insert: {
          allow_fractional?: boolean
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          item_template_id: string
          location?: string | null
          min_quantity?: number | null
          quantity?: number
          updated_at?: string
        }
        Update: {
          allow_fractional?: boolean
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          item_template_id?: string
          location?: string | null
          min_quantity?: number | null
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_stock_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_stock_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      company_tax_config: {
        Row: {
          aliquota_efetiva: number
          anexo_simples: string
          company_id: string
          created_at: string
          faixa_simples: number
          id: string
          receita_bruta_12_meses: number | null
          regime_tributario: string
          updated_at: string
        }
        Insert: {
          aliquota_efetiva?: number
          anexo_simples?: string
          company_id: string
          created_at?: string
          faixa_simples?: number
          id?: string
          receita_bruta_12_meses?: number | null
          regime_tributario?: string
          updated_at?: string
        }
        Update: {
          aliquota_efetiva?: number
          anexo_simples?: string
          company_id?: string
          created_at?: string
          faixa_simples?: number
          id?: string
          receita_bruta_12_meses?: number | null
          regime_tributario?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_tax_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      item_templates: {
        Row: {
          created_at: string
          default_price: number | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          linha: string | null
          name: string
          specifications: Json | null
          type: Database["public"]["Enums"]["item_type"]
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_price?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          linha?: string | null
          name: string
          specifications?: Json | null
          type: Database["public"]["Enums"]["item_type"]
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_price?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          linha?: string | null
          name?: string
          specifications?: Json | null
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      municipios_ibge: {
        Row: {
          codigo_ibge: string
          created_at: string
          id: string
          nome_municipio: string
          uf_codigo: string
          uf_nome: string
        }
        Insert: {
          codigo_ibge: string
          created_at?: string
          id?: string
          nome_municipio: string
          uf_codigo: string
          uf_nome: string
        }
        Update: {
          codigo_ibge?: string
          created_at?: string
          id?: string
          nome_municipio?: string
          uf_codigo?: string
          uf_nome?: string
        }
        Relationships: []
      }
      nota_fiscal_itens: {
        Row: {
          cfop: string | null
          codigo: string | null
          cofins_aliquota: number | null
          cofins_situacao_tributaria: string | null
          cofins_valor: number | null
          created_at: string
          descricao: string
          icms_aliquota: number | null
          icms_origem: string | null
          icms_situacao_tributaria: string | null
          icms_valor: number | null
          id: string
          iss_aliquota: number | null
          iss_valor: number | null
          ncm: string | null
          nota_fiscal_id: string
          pis_aliquota: number | null
          pis_situacao_tributaria: string | null
          pis_valor: number | null
          quantidade: number
          unidade: string | null
          valor_desconto: number | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          cfop?: string | null
          codigo?: string | null
          cofins_aliquota?: number | null
          cofins_situacao_tributaria?: string | null
          cofins_valor?: number | null
          created_at?: string
          descricao: string
          icms_aliquota?: number | null
          icms_origem?: string | null
          icms_situacao_tributaria?: string | null
          icms_valor?: number | null
          id?: string
          iss_aliquota?: number | null
          iss_valor?: number | null
          ncm?: string | null
          nota_fiscal_id: string
          pis_aliquota?: number | null
          pis_situacao_tributaria?: string | null
          pis_valor?: number | null
          quantidade?: number
          unidade?: string | null
          valor_desconto?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          cfop?: string | null
          codigo?: string | null
          cofins_aliquota?: number | null
          cofins_situacao_tributaria?: string | null
          cofins_valor?: number | null
          created_at?: string
          descricao?: string
          icms_aliquota?: number | null
          icms_origem?: string | null
          icms_situacao_tributaria?: string | null
          icms_valor?: number | null
          id?: string
          iss_aliquota?: number | null
          iss_valor?: number | null
          ncm?: string | null
          nota_fiscal_id?: string
          pis_aliquota?: number | null
          pis_situacao_tributaria?: string | null
          pis_valor?: number | null
          quantidade?: number
          unidade?: string | null
          valor_desconto?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "nota_fiscal_itens_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          chave_acesso: string | null
          codigo_servico: string | null
          company_id: string
          created_at: string
          data_autorizacao: string | null
          data_cancelamento: string | null
          data_emissao: string | null
          destinatario_cep: string | null
          destinatario_cidade: string | null
          destinatario_documento: string | null
          destinatario_email: string | null
          destinatario_endereco: string | null
          destinatario_nome: string
          destinatario_telefone: string | null
          destinatario_tipo: string | null
          destinatario_uf: string | null
          discriminacao_servicos: string | null
          emitente_cnpj: string
          emitente_ie: string | null
          emitente_im: string | null
          emitente_razao_social: string
          focusnfe_ref: string | null
          focusnfe_status: string | null
          id: string
          informacoes_complementares: string | null
          motivo_rejeicao: string | null
          natureza_operacao: string | null
          numero: number | null
          ordem_servico_id: string | null
          pdf_url: string | null
          sale_id: string | null
          serie: string | null
          status: string
          status_sefaz: string | null
          tipo: string
          updated_at: string
          valor_cofins: number | null
          valor_desconto: number | null
          valor_frete: number | null
          valor_icms: number | null
          valor_iss: number | null
          valor_pis: number | null
          valor_produtos: number
          valor_servicos: number
          valor_total: number
          xml_nota: string | null
        }
        Insert: {
          chave_acesso?: string | null
          codigo_servico?: string | null
          company_id: string
          created_at?: string
          data_autorizacao?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          destinatario_cep?: string | null
          destinatario_cidade?: string | null
          destinatario_documento?: string | null
          destinatario_email?: string | null
          destinatario_endereco?: string | null
          destinatario_nome: string
          destinatario_telefone?: string | null
          destinatario_tipo?: string | null
          destinatario_uf?: string | null
          discriminacao_servicos?: string | null
          emitente_cnpj: string
          emitente_ie?: string | null
          emitente_im?: string | null
          emitente_razao_social: string
          focusnfe_ref?: string | null
          focusnfe_status?: string | null
          id?: string
          informacoes_complementares?: string | null
          motivo_rejeicao?: string | null
          natureza_operacao?: string | null
          numero?: number | null
          ordem_servico_id?: string | null
          pdf_url?: string | null
          sale_id?: string | null
          serie?: string | null
          status?: string
          status_sefaz?: string | null
          tipo: string
          updated_at?: string
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_iss?: number | null
          valor_pis?: number | null
          valor_produtos?: number
          valor_servicos?: number
          valor_total?: number
          xml_nota?: string | null
        }
        Update: {
          chave_acesso?: string | null
          codigo_servico?: string | null
          company_id?: string
          created_at?: string
          data_autorizacao?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          destinatario_cep?: string | null
          destinatario_cidade?: string | null
          destinatario_documento?: string | null
          destinatario_email?: string | null
          destinatario_endereco?: string | null
          destinatario_nome?: string
          destinatario_telefone?: string | null
          destinatario_tipo?: string | null
          destinatario_uf?: string | null
          discriminacao_servicos?: string | null
          emitente_cnpj?: string
          emitente_ie?: string | null
          emitente_im?: string | null
          emitente_razao_social?: string
          focusnfe_ref?: string | null
          focusnfe_status?: string | null
          id?: string
          informacoes_complementares?: string | null
          motivo_rejeicao?: string | null
          natureza_operacao?: string | null
          numero?: number | null
          ordem_servico_id?: string | null
          pdf_url?: string | null
          sale_id?: string | null
          serie?: string | null
          status?: string
          status_sefaz?: string | null
          tipo?: string
          updated_at?: string
          valor_cofins?: number | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_icms?: number | null
          valor_iss?: number | null
          valor_pis?: number | null
          valor_produtos?: number
          valor_servicos?: number
          valor_total?: number
          xml_nota?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          assigned_to: string | null
          company_id: string
          created_at: string
          current_stage: string | null
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          estimated_end: string | null
          estimated_start: string | null
          id: string
          notes: string | null
          os_number: number
          paid_amount: number
          pending_amount: number
          priority: string | null
          quote_id: string
          sale_id: string | null
          stages: Json | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          assigned_to?: string | null
          company_id: string
          created_at?: string
          current_stage?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          estimated_end?: string | null
          estimated_start?: string | null
          id?: string
          notes?: string | null
          os_number?: number
          paid_amount?: number
          pending_amount?: number
          priority?: string | null
          quote_id: string
          sale_id?: string | null
          stages?: Json | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          current_stage?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          estimated_end?: string | null
          estimated_start?: string | null
          id?: string
          notes?: string | null
          os_number?: number
          paid_amount?: number
          pending_amount?: number
          priority?: string | null
          quote_id?: string
          sale_id?: string | null
          stages?: Json | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_template_items: {
        Row: {
          company_id: string | null
          created_at: string
          cut_angle: number
          height_formula: string | null
          id: string
          is_optional: boolean
          item_template_id: string
          notes: string | null
          pieces_quantity: number
          product_template_id: string
          quantity_formula: string
          width_formula: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          cut_angle?: number
          height_formula?: string | null
          id?: string
          is_optional?: boolean
          item_template_id: string
          notes?: string | null
          pieces_quantity?: number
          product_template_id: string
          quantity_formula?: string
          width_formula?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          cut_angle?: number
          height_formula?: string | null
          id?: string
          is_optional?: boolean
          item_template_id?: string
          notes?: string | null
          pieces_quantity?: number
          product_template_id?: string
          quantity_formula?: string
          width_formula?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_template_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_template_items_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_template_items_product_template_id_fkey"
            columns: ["product_template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      product_templates: {
        Row: {
          base_price: number | null
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          linha: string | null
          max_height: number | null
          max_width: number | null
          min_height: number | null
          min_width: number | null
          name: string
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          linha?: string | null
          max_height?: number | null
          max_width?: number | null
          min_height?: number | null
          min_width?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          linha?: string | null
          max_height?: number | null
          max_width?: number | null
          min_height?: number | null
          min_width?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          company_product_id: string | null
          created_at: string
          description: string
          glass_color: string | null
          glass_thickness: string | null
          has_glass: boolean | null
          height: number | null
          id: string
          notes: string | null
          product_template_id: string | null
          quantity: number
          quote_id: string
          total_price: number
          unit_price: number
          width: number | null
        }
        Insert: {
          company_product_id?: string | null
          created_at?: string
          description: string
          glass_color?: string | null
          glass_thickness?: string | null
          has_glass?: boolean | null
          height?: number | null
          id?: string
          notes?: string | null
          product_template_id?: string | null
          quantity?: number
          quote_id: string
          total_price?: number
          unit_price?: number
          width?: number | null
        }
        Update: {
          company_product_id?: string | null
          created_at?: string
          description?: string
          glass_color?: string | null
          glass_thickness?: string | null
          has_glass?: boolean | null
          height?: number | null
          id?: string
          notes?: string | null
          product_template_id?: string | null
          quantity?: number
          quote_id?: string
          total_price?: number
          unit_price?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_company_product_id_fkey"
            columns: ["company_product_id"]
            isOneToOne: false
            referencedRelation: "company_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_product_template_id_fkey"
            columns: ["product_template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          company_id: string
          created_at: string
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          discount_amount: number | null
          discount_percent: number | null
          final_amount: number
          id: string
          notes: string | null
          quote_number: number
          status: string
          total_amount: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          final_amount?: number
          id?: string
          notes?: string | null
          quote_number?: number
          status?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          final_amount?: number
          id?: string
          notes?: string | null
          quote_number?: number
          status?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          company_product_id: string | null
          created_at: string
          height: number | null
          id: string
          item_name: string
          item_template_id: string | null
          item_unit: string
          notes: string | null
          quantity: number
          sale_id: string
          total_price: number
          unit_price: number
          width: number | null
        }
        Insert: {
          company_product_id?: string | null
          created_at?: string
          height?: number | null
          id?: string
          item_name: string
          item_template_id?: string | null
          item_unit: string
          notes?: string | null
          quantity?: number
          sale_id: string
          total_price?: number
          unit_price?: number
          width?: number | null
        }
        Update: {
          company_product_id?: string | null
          created_at?: string
          height?: number | null
          id?: string
          item_name?: string
          item_template_id?: string | null
          item_unit?: string
          notes?: string | null
          quantity?: number
          sale_id?: string
          total_price?: number
          unit_price?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_company_product_id_fkey"
            columns: ["company_product_id"]
            isOneToOne: false
            referencedRelation: "company_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_taxes: {
        Row: {
          aliquota_total: number
          base_calculo: number
          company_id: string
          created_at: string
          id: string
          regime_tributario: string
          sale_id: string
          valor_cbs: number
          valor_ibs: number
          valor_simples: number
          valor_total_impostos: number
        }
        Insert: {
          aliquota_total?: number
          base_calculo?: number
          company_id: string
          created_at?: string
          id?: string
          regime_tributario?: string
          sale_id: string
          valor_cbs?: number
          valor_ibs?: number
          valor_simples?: number
          valor_total_impostos?: number
        }
        Update: {
          aliquota_total?: number
          base_calculo?: number
          company_id?: string
          created_at?: string
          id?: string
          regime_tributario?: string
          sale_id?: string
          valor_cbs?: number
          valor_ibs?: number
          valor_simples?: number
          valor_total_impostos?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_taxes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_taxes_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cash_register_id: string
          client_id: string | null
          company_id: string
          created_at: string
          customer_name: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          notes: string | null
          ordem_servico_id: string | null
          paid_amount: number | null
          parent_sale_id: string | null
          payment_method: string
          payment_status: string
          pending_amount: number | null
          quote_id: string | null
          sale_number: number
          sale_type: string | null
          sold_by: string
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          cash_register_id: string
          client_id?: string | null
          company_id: string
          created_at?: string
          customer_name?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          notes?: string | null
          ordem_servico_id?: string | null
          paid_amount?: number | null
          parent_sale_id?: string | null
          payment_method: string
          payment_status?: string
          pending_amount?: number | null
          quote_id?: string | null
          sale_number?: number
          sale_type?: string | null
          sold_by: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cash_register_id?: string
          client_id?: string | null
          company_id?: string
          created_at?: string
          customer_name?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          notes?: string | null
          ordem_servico_id?: string | null
          paid_amount?: number | null
          parent_sale_id?: string | null
          payment_method?: string
          payment_status?: string
          pending_amount?: number | null
          quote_id?: string | null
          sale_number?: number
          sale_type?: string | null
          sold_by?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_parent_sale_id_fkey"
            columns: ["parent_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      support_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_admin: boolean
          ticket_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_admin?: boolean
          ticket_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          company_id: string
          created_at: string
          id: string
          priority: string
          status: string
          subject: string
          ticket_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          id?: string
          priority?: string
          status?: string
          subject: string
          ticket_number?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          ticket_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_categories: {
        Row: {
          aliquota_cbs: number | null
          aliquota_ibs: number | null
          aliquota_is: number | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          ncm_code: string | null
          updated_at: string
        }
        Insert: {
          aliquota_cbs?: number | null
          aliquota_ibs?: number | null
          aliquota_is?: number | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          ncm_code?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_cbs?: number | null
          aliquota_ibs?: number | null
          aliquota_is?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          ncm_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_product_template_for_company: {
        Args: {
          _commercial_name?: string
          _company_id: string
          _product_template_id: string
        }
        Returns: {
          base_price: number | null
          commercial_name: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          margin_percent: number | null
          product_template_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "company_products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_company_and_assign_admin: {
        Args: {
          _address?: string
          _cnpj: string
          _email?: string
          _name: string
          _phone?: string
        }
        Returns: {
          address: string | null
          ambiente_fiscal: string | null
          cnpj: string
          codigo_municipio_ibge: string | null
          created_at: string
          email: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logo_url: string | null
          name: string
          phone: string | null
          regime_tributario: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      initialize_company_item_prices: {
        Args: { _company_id: string }
        Returns: undefined
      }
      is_saas_admin: { Args: { _user_id: string }; Returns: boolean }
      normalize_text: { Args: { input_text: string }; Returns: string }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_role_in_company: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
      item_type: "glass" | "profile" | "accessory" | "service"
      product_category:
        | "window"
        | "door"
        | "partition"
        | "mirror"
        | "shower"
        | "facade"
        | "other"
        | "guarda_corpo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "employee"],
      item_type: ["glass", "profile", "accessory", "service"],
      product_category: [
        "window",
        "door",
        "partition",
        "mirror",
        "shower",
        "facade",
        "other",
        "guarda_corpo",
      ],
    },
  },
} as const
