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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts_receivable: {
        Row: {
          bank_account_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_name: string
          description: string | null
          due_date: string
          id: string
          installment_number: number | null
          notes: string | null
          ordem_servico_id: string | null
          paid_amount: number
          paid_date: string | null
          payment_method: string | null
          quote_id: string | null
          receivable_type: string | null
          sale_id: string | null
          status: string
          total_amount: number
          total_installments: number | null
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_name: string
          description?: string | null
          due_date: string
          id?: string
          installment_number?: number | null
          notes?: string | null
          ordem_servico_id?: string | null
          paid_amount?: number
          paid_date?: string | null
          payment_method?: string | null
          quote_id?: string | null
          receivable_type?: string | null
          sale_id?: string | null
          status?: string
          total_amount: number
          total_installments?: number | null
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string
          description?: string | null
          due_date?: string
          id?: string
          installment_number?: number | null
          notes?: string | null
          ordem_servico_id?: string | null
          paid_amount?: number
          paid_date?: string | null
          payment_method?: string | null
          quote_id?: string | null
          receivable_type?: string | null
          sale_id?: string | null
          status?: string
          total_amount?: number
          total_installments?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_financial_status"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "accounts_receivable_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_glass_colors: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          name: string
          slug: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          name: string
          slug?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          name?: string
          slug?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      admin_glass_thicknesses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          sort_order: number
          thickness_mm: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          sort_order?: number
          thickness_mm: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          sort_order?: number
          thickness_mm?: number
        }
        Relationships: []
      }
      admin_suggested_prices: {
        Row: {
          company_id: string | null
          cost_per_sqm: number | null
          created_at: string
          glass_color: string | null
          id: string
          is_active: boolean
          kind: string | null
          price_per_sqm: number | null
          thickness_mm: number | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          cost_per_sqm?: number | null
          created_at?: string
          glass_color?: string | null
          id?: string
          is_active?: boolean
          kind?: string | null
          price_per_sqm?: number | null
          thickness_mm?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          cost_per_sqm?: number | null
          created_at?: string
          glass_color?: string | null
          id?: string
          is_active?: boolean
          kind?: string | null
          price_per_sqm?: number | null
          thickness_mm?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_suggested_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
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
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          severity: string
          starts_at: string
          target_roles: string[] | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          severity?: string
          starts_at?: string
          target_roles?: string[] | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          severity?: string
          starts_at?: string
          target_roles?: string[] | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string
          active: boolean
          agency: string | null
          bank_code: string | null
          bank_name: string | null
          color: string | null
          company_id: string
          created_at: string
          current_balance: number
          id: string
          initial_balance: number
          is_default: boolean
          name: string
          notes: string | null
          pix_key: string | null
          pix_key_type: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          active?: boolean
          agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_default?: boolean
          name: string
          notes?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          active?: boolean
          agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_default?: boolean
          name?: string
          notes?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          balance_after: number | null
          cash_register_id: string
          category: string | null
          cliente_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          expense_id: string | null
          fornecedor_id: string | null
          funcionario_id: string | null
          id: string
          metadata: Json | null
          ordem_servico_id: string | null
          origem: string | null
          party_id: string | null
          party_name: string | null
          party_type: string | null
          payment_method: string | null
          quote_id: string | null
          receivable_id: string | null
          reference_id: string | null
          reference_type: string | null
          sale_id: string | null
          type: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          cash_register_id: string
          category?: string | null
          cliente_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_id?: string | null
          fornecedor_id?: string | null
          funcionario_id?: string | null
          id?: string
          metadata?: Json | null
          ordem_servico_id?: string | null
          origem?: string | null
          party_id?: string | null
          party_name?: string | null
          party_type?: string | null
          payment_method?: string | null
          quote_id?: string | null
          receivable_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          sale_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          cash_register_id?: string
          category?: string | null
          cliente_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_id?: string | null
          fornecedor_id?: string | null
          funcionario_id?: string | null
          id?: string
          metadata?: Json | null
          ordem_servico_id?: string | null
          origem?: string | null
          party_id?: string | null
          party_name?: string | null
          party_type?: string | null
          payment_method?: string | null
          quote_id?: string | null
          receivable_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          sale_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_financial_status"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "cash_movements_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_advances: {
        Row: {
          amount: number
          cash_register_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          received_by: string | null
        }
        Insert: {
          amount: number
          cash_register_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          received_by?: string | null
        }
        Update: {
          amount?: number
          cash_register_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_advances_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_advances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          company_id: string
          created_at: string
          difference: number | null
          difference_amount: number | null
          excess_collected: number
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_amount: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          company_id: string
          created_at?: string
          difference?: number | null
          difference_amount?: number | null
          excess_collected?: number
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_amount?: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          company_id?: string
          created_at?: string
          difference?: number | null
          difference_amount?: number | null
          excess_collected?: number
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_amount?: number
          status?: string
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
          client_type: string
          company_id: string
          created_at: string
          created_by: string | null
          document: string | null
          document_type: string | null
          email: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
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
          client_type?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
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
          client_type?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
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
          address_cep: string | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          city: string | null
          cnpj: string | null
          complement: string | null
          created_at: string
          default_presentation_text: string | null
          email: string | null
          enable_presentation_page: boolean
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          login_token: string | null
          logo_size: number | null
          logo_url: string | null
          modo_fiscal_ativo: boolean
          name: string
          neighborhood: string | null
          number: string | null
          phone: string | null
          presentation_data: Json | null
          presentation_enabled: boolean
          presentation_template: string | null
          regime_tributario: string | null
          settings: Json
          state: string | null
          street: string | null
          stripe_customer_id: string | null
          subscription_plan: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          created_at?: string
          default_presentation_text?: string | null
          email?: string | null
          enable_presentation_page?: boolean
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          login_token?: string | null
          logo_size?: number | null
          logo_url?: string | null
          modo_fiscal_ativo?: boolean
          name: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          presentation_data?: Json | null
          presentation_enabled?: boolean
          presentation_template?: string | null
          regime_tributario?: string | null
          settings?: Json
          state?: string | null
          street?: string | null
          stripe_customer_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          city?: string | null
          cnpj?: string | null
          complement?: string | null
          created_at?: string
          default_presentation_text?: string | null
          email?: string | null
          enable_presentation_page?: boolean
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          login_token?: string | null
          logo_size?: number | null
          logo_url?: string | null
          modo_fiscal_ativo?: boolean
          name?: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          presentation_data?: Json | null
          presentation_enabled?: boolean
          presentation_template?: string | null
          regime_tributario?: string | null
          settings?: Json
          state?: string | null
          street?: string | null
          stripe_customer_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      company_cash: {
        Row: {
          company_id: string
          current_balance: number
          fixed_fund: number
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          current_balance?: number
          fixed_fund?: number
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          current_balance?: number
          fixed_fund?: number
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_cash_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_cash_movements: {
        Row: {
          amount: number
          balance_after: number | null
          bank_account_id: string | null
          category: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bank_account_id?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bank_account_id?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_cash_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_enabled_linhas: {
        Row: {
          company_id: string
          created_at: string
          id: string
          linha_slug: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          linha_slug: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          linha_slug?: string
        }
        Relationships: []
      }
      company_item_color_prices: {
        Row: {
          color_name: string
          company_id: string
          company_item_id: string | null
          cost: number | null
          cost_per_meter: number | null
          created_at: string
          id: string
          item_template_id: string | null
          price: number | null
          sale_price_per_meter: number | null
          updated_at: string
        }
        Insert: {
          color_name: string
          company_id: string
          company_item_id?: string | null
          cost?: number | null
          cost_per_meter?: number | null
          created_at?: string
          id?: string
          item_template_id?: string | null
          price?: number | null
          sale_price_per_meter?: number | null
          updated_at?: string
        }
        Update: {
          color_name?: string
          company_id?: string
          company_item_id?: string | null
          cost?: number | null
          cost_per_meter?: number | null
          created_at?: string
          id?: string
          item_template_id?: string | null
          price?: number | null
          sale_price_per_meter?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_item_color_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_item_color_prices_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
        ]
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
      company_items: {
        Row: {
          aliquota_cbs: number | null
          aliquota_ibs: number | null
          aliquota_is: number | null
          aliquota_iss: number | null
          altura_mm: number | null
          bar_length_mm: number | null
          cest: string | null
          cfop_venda: string | null
          cfop_venda_interestadual: string | null
          codigo_servico: string | null
          company_id: string
          comprimento_linear_mm: number | null
          cost: number | null
          cost_per_bar: number | null
          cost_per_kg: number | null
          cost_per_meter: number | null
          created_at: string
          default_price: number | null
          description: string | null
          glass_color: string | null
          glass_thickness: number | null
          id: string
          image_url: string | null
          is_active: boolean
          is_custom: boolean
          item_template_id: string | null
          largura_mm: number | null
          linha: string | null
          name: string
          ncm: string | null
          origem: string | null
          preco_unitario: number | null
          price: number | null
          quantity: number | null
          reference_id: string | null
          sale_margin_percent: number | null
          sale_price: number | null
          sale_price_per_bar: number | null
          sale_price_per_kg: number | null
          sale_price_per_meter: number | null
          specifications: Json
          thickness_mm: number | null
          type: string
          unit: string | null
          updated_at: string
          weight_kg: number | null
          weight_per_bar: number | null
          weight_per_meter: number | null
        }
        Insert: {
          aliquota_cbs?: number | null
          aliquota_ibs?: number | null
          aliquota_is?: number | null
          aliquota_iss?: number | null
          altura_mm?: number | null
          bar_length_mm?: number | null
          cest?: string | null
          cfop_venda?: string | null
          cfop_venda_interestadual?: string | null
          codigo_servico?: string | null
          company_id: string
          comprimento_linear_mm?: number | null
          cost?: number | null
          cost_per_bar?: number | null
          cost_per_kg?: number | null
          cost_per_meter?: number | null
          created_at?: string
          default_price?: number | null
          description?: string | null
          glass_color?: string | null
          glass_thickness?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean
          item_template_id?: string | null
          largura_mm?: number | null
          linha?: string | null
          name: string
          ncm?: string | null
          origem?: string | null
          preco_unitario?: number | null
          price?: number | null
          quantity?: number | null
          reference_id?: string | null
          sale_margin_percent?: number | null
          sale_price?: number | null
          sale_price_per_bar?: number | null
          sale_price_per_kg?: number | null
          sale_price_per_meter?: number | null
          specifications?: Json
          thickness_mm?: number | null
          type?: string
          unit?: string | null
          updated_at?: string
          weight_kg?: number | null
          weight_per_bar?: number | null
          weight_per_meter?: number | null
        }
        Update: {
          aliquota_cbs?: number | null
          aliquota_ibs?: number | null
          aliquota_is?: number | null
          aliquota_iss?: number | null
          altura_mm?: number | null
          bar_length_mm?: number | null
          cest?: string | null
          cfop_venda?: string | null
          cfop_venda_interestadual?: string | null
          codigo_servico?: string | null
          company_id?: string
          comprimento_linear_mm?: number | null
          cost?: number | null
          cost_per_bar?: number | null
          cost_per_kg?: number | null
          cost_per_meter?: number | null
          created_at?: string
          default_price?: number | null
          description?: string | null
          glass_color?: string | null
          glass_thickness?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean
          item_template_id?: string | null
          largura_mm?: number | null
          linha?: string | null
          name?: string
          ncm?: string | null
          origem?: string | null
          preco_unitario?: number | null
          price?: number | null
          quantity?: number | null
          reference_id?: string | null
          sale_margin_percent?: number | null
          sale_price?: number | null
          sale_price_per_bar?: number | null
          sale_price_per_kg?: number | null
          sale_price_per_meter?: number | null
          specifications?: Json
          thickness_mm?: number | null
          type?: string
          unit?: string | null
          updated_at?: string
          weight_kg?: number | null
          weight_per_bar?: number | null
          weight_per_meter?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "company_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_items_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      company_linhas: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_linhas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_member_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          company_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_member_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_notification_settings: {
        Row: {
          channel_email: boolean
          channel_inapp: boolean
          company_id: string
          created_at: string
          daily_digest: boolean
          email_expense_due: boolean
          email_low_stock: boolean
          email_new_quote: boolean
          email_order_status: boolean
          email_payment_received: boolean
          email_quote_approved: boolean
          id: string
          notify_expense_alerts: boolean
          notify_low_stock: boolean
          notify_overdue_orders: boolean
          notify_overdue_receivables: boolean
          notify_pending_quotes: boolean
          notify_quote_expiring: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          reminder_appointments: boolean
          reminder_expenses: boolean
          reminder_low_stock: boolean
          reminder_receivables: boolean
          settings: Json | null
          updated_at: string
          weekly_report: boolean
        }
        Insert: {
          channel_email?: boolean
          channel_inapp?: boolean
          company_id: string
          created_at?: string
          daily_digest?: boolean
          email_expense_due?: boolean
          email_low_stock?: boolean
          email_new_quote?: boolean
          email_order_status?: boolean
          email_payment_received?: boolean
          email_quote_approved?: boolean
          id?: string
          notify_expense_alerts?: boolean
          notify_low_stock?: boolean
          notify_overdue_orders?: boolean
          notify_overdue_receivables?: boolean
          notify_pending_quotes?: boolean
          notify_quote_expiring?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reminder_appointments?: boolean
          reminder_expenses?: boolean
          reminder_low_stock?: boolean
          reminder_receivables?: boolean
          settings?: Json | null
          updated_at?: string
          weekly_report?: boolean
        }
        Update: {
          channel_email?: boolean
          channel_inapp?: boolean
          company_id?: string
          created_at?: string
          daily_digest?: boolean
          email_expense_due?: boolean
          email_low_stock?: boolean
          email_new_quote?: boolean
          email_order_status?: boolean
          email_payment_received?: boolean
          email_quote_approved?: boolean
          id?: string
          notify_expense_alerts?: boolean
          notify_low_stock?: boolean
          notify_overdue_orders?: boolean
          notify_overdue_receivables?: boolean
          notify_pending_quotes?: boolean
          notify_quote_expiring?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reminder_appointments?: boolean
          reminder_expenses?: boolean
          reminder_low_stock?: boolean
          reminder_receivables?: boolean
          settings?: Json | null
          updated_at?: string
          weekly_report?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "company_notification_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_notifications: {
        Row: {
          action_at: string | null
          action_by: string | null
          action_taken: boolean
          action_url: string | null
          company_id: string
          created_at: string
          from_user_id: string | null
          id: string
          is_read: boolean
          message: string | null
          metadata: Json | null
          read_at: string | null
          reference_id: string | null
          reference_type: string | null
          severity: string
          title: string
          to_role: string | null
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action_at?: string | null
          action_by?: string | null
          action_taken?: boolean
          action_url?: string | null
          company_id: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          severity?: string
          title: string
          to_role?: string | null
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action_at?: string | null
          action_by?: string | null
          action_taken?: boolean
          action_url?: string | null
          company_id?: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          severity?: string
          title?: string
          to_role?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_payment_settings: {
        Row: {
          accepts_card: boolean
          accepts_cash: boolean
          accepts_pix: boolean
          company_id: string
          created_at: string
          custom_conditions: Json
          default_condicao_id: string | null
          default_forma_id: string | null
          display_mode: string
          id: string
          payment_methods: Json
          settings: Json | null
          show_fees_to_customer: boolean
          show_installments: boolean
          show_other_methods: boolean
          updated_at: string
        }
        Insert: {
          accepts_card?: boolean
          accepts_cash?: boolean
          accepts_pix?: boolean
          company_id: string
          created_at?: string
          custom_conditions?: Json
          default_condicao_id?: string | null
          default_forma_id?: string | null
          display_mode?: string
          id?: string
          payment_methods?: Json
          settings?: Json | null
          show_fees_to_customer?: boolean
          show_installments?: boolean
          show_other_methods?: boolean
          updated_at?: string
        }
        Update: {
          accepts_card?: boolean
          accepts_cash?: boolean
          accepts_pix?: boolean
          company_id?: string
          created_at?: string
          custom_conditions?: Json
          default_condicao_id?: string | null
          default_forma_id?: string | null
          display_mode?: string
          id?: string
          payment_methods?: Json
          settings?: Json | null
          show_fees_to_customer?: boolean
          show_installments?: boolean
          show_other_methods?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_payment_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_payment_settings_default_condicao_id_fkey"
            columns: ["default_condicao_id"]
            isOneToOne: false
            referencedRelation: "condicoes_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_payment_settings_default_forma_id_fkey"
            columns: ["default_forma_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      company_product_items: {
        Row: {
          altura_mm: number | null
          applies_to: string | null
          bar_length_mm: number | null
          calculation_type: string | null
          company_id: string
          company_item_id: string | null
          company_product_id: string
          comprimento_linear_mm: number | null
          cost: number | null
          cost_per_bar: number | null
          cost_per_kg: number | null
          cost_per_meter: number | null
          created_at: string
          cut_angle: number | null
          glass_color: string | null
          height_formula: string | null
          id: string
          image_url: string | null
          is_optional: boolean
          item_template_id: string | null
          largura_mm: number | null
          linha: string | null
          name: string | null
          notes: string | null
          pieces_formula: string | null
          pieces_quantity: number | null
          preco_unitario: number | null
          quantity_formula: string | null
          section: string | null
          side: string | null
          sort_order: number
          thickness_mm: number | null
          type: string | null
          unit: string | null
          updated_at: string
          weight_kg: number | null
          weight_per_bar: number | null
          weight_per_meter: number | null
          width_formula: string | null
        }
        Insert: {
          altura_mm?: number | null
          applies_to?: string | null
          bar_length_mm?: number | null
          calculation_type?: string | null
          company_id: string
          company_item_id?: string | null
          company_product_id: string
          comprimento_linear_mm?: number | null
          cost?: number | null
          cost_per_bar?: number | null
          cost_per_kg?: number | null
          cost_per_meter?: number | null
          created_at?: string
          cut_angle?: number | null
          glass_color?: string | null
          height_formula?: string | null
          id?: string
          image_url?: string | null
          is_optional?: boolean
          item_template_id?: string | null
          largura_mm?: number | null
          linha?: string | null
          name?: string | null
          notes?: string | null
          pieces_formula?: string | null
          pieces_quantity?: number | null
          preco_unitario?: number | null
          quantity_formula?: string | null
          section?: string | null
          side?: string | null
          sort_order?: number
          thickness_mm?: number | null
          type?: string | null
          unit?: string | null
          updated_at?: string
          weight_kg?: number | null
          weight_per_bar?: number | null
          weight_per_meter?: number | null
          width_formula?: string | null
        }
        Update: {
          altura_mm?: number | null
          applies_to?: string | null
          bar_length_mm?: number | null
          calculation_type?: string | null
          company_id?: string
          company_item_id?: string | null
          company_product_id?: string
          comprimento_linear_mm?: number | null
          cost?: number | null
          cost_per_bar?: number | null
          cost_per_kg?: number | null
          cost_per_meter?: number | null
          created_at?: string
          cut_angle?: number | null
          glass_color?: string | null
          height_formula?: string | null
          id?: string
          image_url?: string | null
          is_optional?: boolean
          item_template_id?: string | null
          largura_mm?: number | null
          linha?: string | null
          name?: string | null
          notes?: string | null
          pieces_formula?: string | null
          pieces_quantity?: number | null
          preco_unitario?: number | null
          quantity_formula?: string | null
          section?: string | null
          side?: string | null
          sort_order?: number
          thickness_mm?: number | null
          type?: string | null
          unit?: string | null
          updated_at?: string
          weight_kg?: number | null
          weight_per_bar?: number | null
          weight_per_meter?: number | null
          width_formula?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_product_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_product_items_company_item_id_fkey"
            columns: ["company_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_product_items_company_product_id_fkey"
            columns: ["company_product_id"]
            isOneToOne: false
            referencedRelation: "company_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_product_items_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      company_products: {
        Row: {
          acabamento: string | null
          arremate: string | null
          base_price: number | null
          category: string | null
          commercial_name: string | null
          company_id: string
          company_item_id: string | null
          composition_finished: boolean
          contramarco: string | null
          cor_componentes: string | null
          corte_contramarco: string | null
          cost_per_sqm: number | null
          created_at: string
          description: string | null
          glasses_count: number | null
          has_multiple_sides: boolean
          height_formula: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_custom: boolean
          item_template_id: string | null
          leaves_count: number | null
          linha: string | null
          margin_percent: number | null
          name: string
          panels_count: number | null
          pending_amount: number | null
          pieces_formula: string | null
          pieces_quantity: number | null
          price_per_sqm: number | null
          pricing_type: string | null
          product_template_id: string | null
          quantity_formula: string | null
          reforco: string | null
          side: string | null
          sides_count: number | null
          type: string | null
          unit: string | null
          updated_at: string
          uses_glass: boolean
          width_formula: string | null
        }
        Insert: {
          acabamento?: string | null
          arremate?: string | null
          base_price?: number | null
          category?: string | null
          commercial_name?: string | null
          company_id: string
          company_item_id?: string | null
          composition_finished?: boolean
          contramarco?: string | null
          cor_componentes?: string | null
          corte_contramarco?: string | null
          cost_per_sqm?: number | null
          created_at?: string
          description?: string | null
          glasses_count?: number | null
          has_multiple_sides?: boolean
          height_formula?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean
          item_template_id?: string | null
          leaves_count?: number | null
          linha?: string | null
          margin_percent?: number | null
          name: string
          panels_count?: number | null
          pending_amount?: number | null
          pieces_formula?: string | null
          pieces_quantity?: number | null
          price_per_sqm?: number | null
          pricing_type?: string | null
          product_template_id?: string | null
          quantity_formula?: string | null
          reforco?: string | null
          side?: string | null
          sides_count?: number | null
          type?: string | null
          unit?: string | null
          updated_at?: string
          uses_glass?: boolean
          width_formula?: string | null
        }
        Update: {
          acabamento?: string | null
          arremate?: string | null
          base_price?: number | null
          category?: string | null
          commercial_name?: string | null
          company_id?: string
          company_item_id?: string | null
          composition_finished?: boolean
          contramarco?: string | null
          cor_componentes?: string | null
          corte_contramarco?: string | null
          cost_per_sqm?: number | null
          created_at?: string
          description?: string | null
          glasses_count?: number | null
          has_multiple_sides?: boolean
          height_formula?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean
          item_template_id?: string | null
          leaves_count?: number | null
          linha?: string | null
          margin_percent?: number | null
          name?: string
          panels_count?: number | null
          pending_amount?: number | null
          pieces_formula?: string | null
          pieces_quantity?: number | null
          price_per_sqm?: number | null
          pricing_type?: string | null
          product_template_id?: string | null
          quantity_formula?: string | null
          reforco?: string | null
          side?: string | null
          sides_count?: number | null
          type?: string | null
          unit?: string | null
          updated_at?: string
          uses_glass?: boolean
          width_formula?: string | null
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
            foreignKeyName: "company_products_company_item_id_fkey"
            columns: ["company_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_products_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
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
      company_security_settings: {
        Row: {
          allow_multiple_sessions: boolean
          company_id: string
          created_at: string
          id: string
          lockout_duration_minutes: number
          lockout_minutes: number
          max_login_attempts: number
          password_expiry_days: number
          password_min_length: number
          require_2fa: boolean
          require_strong_password: boolean
          session_timeout_minutes: number
          settings: Json | null
          two_factor_enabled: boolean
          updated_at: string
        }
        Insert: {
          allow_multiple_sessions?: boolean
          company_id: string
          created_at?: string
          id?: string
          lockout_duration_minutes?: number
          lockout_minutes?: number
          max_login_attempts?: number
          password_expiry_days?: number
          password_min_length?: number
          require_2fa?: boolean
          require_strong_password?: boolean
          session_timeout_minutes?: number
          settings?: Json | null
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Update: {
          allow_multiple_sessions?: boolean
          company_id?: string
          created_at?: string
          id?: string
          lockout_duration_minutes?: number
          lockout_minutes?: number
          max_login_attempts?: number
          password_expiry_days?: number
          password_min_length?: number
          require_2fa?: boolean
          require_strong_password?: boolean
          session_timeout_minutes?: number
          settings?: Json | null
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_security_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_stock: {
        Row: {
          allow_fractional: boolean
          bar_length_mm: number | null
          company_id: string
          company_item_id: string | null
          cost: number | null
          cost_per_bar: number | null
          cost_per_kg: number | null
          cost_per_meter: number | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          is_custom: boolean
          item_template_id: string | null
          linha: string | null
          location: string | null
          min_quantity: number | null
          name: string | null
          product_template_id: string | null
          quantity: number
          quantity_reserved: number
          sale_price: number | null
          status: string | null
          supplier_name: string | null
          type: string | null
          unit: string | null
          updated_at: string
          weight_kg: number | null
          weight_per_meter: number | null
        }
        Insert: {
          allow_fractional?: boolean
          bar_length_mm?: number | null
          company_id: string
          company_item_id?: string | null
          cost?: number | null
          cost_per_bar?: number | null
          cost_per_kg?: number | null
          cost_per_meter?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean
          item_template_id?: string | null
          linha?: string | null
          location?: string | null
          min_quantity?: number | null
          name?: string | null
          product_template_id?: string | null
          quantity?: number
          quantity_reserved?: number
          sale_price?: number | null
          status?: string | null
          supplier_name?: string | null
          type?: string | null
          unit?: string | null
          updated_at?: string
          weight_kg?: number | null
          weight_per_meter?: number | null
        }
        Update: {
          allow_fractional?: boolean
          bar_length_mm?: number | null
          company_id?: string
          company_item_id?: string | null
          cost?: number | null
          cost_per_bar?: number | null
          cost_per_kg?: number | null
          cost_per_meter?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean
          item_template_id?: string | null
          linha?: string | null
          location?: string | null
          min_quantity?: number | null
          name?: string | null
          product_template_id?: string | null
          quantity?: number
          quantity_reserved?: number
          sale_price?: number | null
          status?: string | null
          supplier_name?: string | null
          type?: string | null
          unit?: string | null
          updated_at?: string
          weight_kg?: number | null
          weight_per_meter?: number | null
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
            foreignKeyName: "company_stock_company_item_id_fkey"
            columns: ["company_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_stock_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_stock_product_template_id_fkey"
            columns: ["product_template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscriptions: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          plan_name: string
          plan_price: number
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan_name?: string
          plan_price?: number
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan_name?: string
          plan_price?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_suggested_prices: {
        Row: {
          company_id: string
          cost_per_sqm: number | null
          created_at: string
          glass_color: string | null
          id: string
          is_active: boolean
          kind: string | null
          price_per_sqm: number | null
          thickness_mm: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          cost_per_sqm?: number | null
          created_at?: string
          glass_color?: string | null
          id?: string
          is_active?: boolean
          kind?: string | null
          price_per_sqm?: number | null
          thickness_mm?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          cost_per_sqm?: number | null
          created_at?: string
          glass_color?: string | null
          id?: string
          is_active?: boolean
          kind?: string | null
          price_per_sqm?: number | null
          thickness_mm?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_suggested_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      condicoes_pagamento: {
        Row: {
          company_id: string
          created_at: string
          desconto_percent: number
          descricao: string | null
          dias_entre_parcelas: number
          entrada_percent: number | null
          forma_pagamento_id: string | null
          id: string
          installments: number
          interval_days: number
          is_active: boolean
          is_default: boolean | null
          juros_percent: number
          name: string
          nome: string | null
          parcelas: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          desconto_percent?: number
          descricao?: string | null
          dias_entre_parcelas?: number
          entrada_percent?: number | null
          forma_pagamento_id?: string | null
          id?: string
          installments?: number
          interval_days?: number
          is_active?: boolean
          is_default?: boolean | null
          juros_percent?: number
          name: string
          nome?: string | null
          parcelas?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          desconto_percent?: number
          descricao?: string | null
          dias_entre_parcelas?: number
          entrada_percent?: number | null
          forma_pagamento_id?: string | null
          id?: string
          installments?: number
          interval_days?: number
          is_active?: boolean
          is_default?: boolean | null
          juros_percent?: number
          name?: string
          nome?: string | null
          parcelas?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condicoes_pagamento_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condicoes_pagamento_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_commissions: {
        Row: {
          base_amount: number
          commission_amount: number
          commission_percent: number
          company_id: string
          created_at: string
          employee_id: string | null
          id: string
          notes: string | null
          ordem_servico_id: string | null
          paid_at: string | null
          reference_month: string | null
          sale_amount: number | null
          sale_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          base_amount?: number
          commission_amount?: number
          commission_percent?: number
          company_id: string
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          ordem_servico_id?: string | null
          paid_at?: string | null
          reference_month?: string | null
          sale_amount?: number | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          base_amount?: number
          commission_amount?: number
          commission_percent?: number
          company_id?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          ordem_servico_id?: string | null
          paid_at?: string | null
          reference_month?: string | null
          sale_amount?: number | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_commissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_commissions_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_invites: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          employee_id: string | null
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          employee_id?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          employee_id?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_invites_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          admission_date: string | null
          commission_enabled: boolean
          commission_percent: number
          commission_type: string
          company_id: string
          created_at: string
          email: string | null
          hourly_rate: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          permission_profile_id: string | null
          phone: string | null
          photo_url: string | null
          role: string
          salary_payment_day: number | null
          specialty: string | null
          updated_at: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          admission_date?: string | null
          commission_enabled?: boolean
          commission_percent?: number
          commission_type?: string
          company_id: string
          created_at?: string
          email?: string | null
          hourly_rate?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          permission_profile_id?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: string
          salary_payment_day?: number | null
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          admission_date?: string | null
          commission_enabled?: boolean
          commission_percent?: number
          commission_type?: string
          company_id?: string
          created_at?: string
          email?: string | null
          hourly_rate?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          permission_profile_id?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: string
          salary_payment_day?: number | null
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_permission_profile_id_fkey"
            columns: ["permission_profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachments: Json | null
          bank_account_id: string | null
          category: string | null
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          document_number: string | null
          due_date: string
          employee_id: string | null
          id: string
          installment_number: number | null
          is_auto_generated: boolean
          is_recurring: boolean | null
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          paid_date: string | null
          parent_expense_id: string | null
          parent_payable_id: string | null
          payment_method: string | null
          recurrence: Json | null
          recurrence_day: number | null
          reference_id: string | null
          reference_type: string | null
          status: string
          supplier_document: string | null
          supplier_id: string | null
          supplier_name: string | null
          total_installments: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          attachments?: Json | null
          bank_account_id?: string | null
          category?: string | null
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          document_number?: string | null
          due_date: string
          employee_id?: string | null
          id?: string
          installment_number?: number | null
          is_auto_generated?: boolean
          is_recurring?: boolean | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_date?: string | null
          parent_expense_id?: string | null
          parent_payable_id?: string | null
          payment_method?: string | null
          recurrence?: Json | null
          recurrence_day?: number | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          supplier_document?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          total_installments?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          attachments?: Json | null
          bank_account_id?: string | null
          category?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          document_number?: string | null
          due_date?: string
          employee_id?: string | null
          id?: string
          installment_number?: number | null
          is_auto_generated?: boolean
          is_recurring?: boolean | null
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          paid_date?: string | null
          parent_expense_id?: string | null
          parent_payable_id?: string | null
          payment_method?: string | null
          recurrence?: Json | null
          recurrence_day?: number | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          supplier_document?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          total_installments?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_parent_payable_id_fkey"
            columns: ["parent_payable_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_votes: {
        Row: {
          created_at: string
          feedback_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_votes_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedbacks"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          admin_response: string | null
          category: string
          company_id: string
          created_at: string
          description: string
          id: string
          is_public: boolean
          status: string
          title: string
          updated_at: string
          user_id: string
          votes_count: number
        }
        Insert: {
          admin_response?: string | null
          category: string
          company_id: string
          created_at?: string
          description: string
          id?: string
          is_public?: boolean
          status?: string
          title: string
          updated_at?: string
          user_id: string
          votes_count?: number
        }
        Update: {
          admin_response?: string | null
          category?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          is_public?: boolean
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          votes_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          active: boolean
          color: string | null
          company_id: string
          created_at: string
          dre_group: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_system: boolean
          kind: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          company_id: string
          created_at?: string
          dre_group?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          kind: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          company_id?: string
          created_at?: string
          dre_group?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          kind?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pagamento: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean | null
          name: string
          nome: string | null
          prazo_recebimento_dias: number | null
          sort_order: number
          taxa_fixa: number | null
          taxa_percent: number | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean | null
          name: string
          nome?: string | null
          prazo_recebimento_dias?: number | null
          sort_order?: number
          taxa_fixa?: number | null
          taxa_percent?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean | null
          name?: string
          nome?: string | null
          prazo_recebimento_dias?: number | null
          sort_order?: number
          taxa_fixa?: number | null
          taxa_percent?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formas_pagamento_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      glass_line_formulas: {
        Row: {
          category: string | null
          created_at: string
          formula_name: string | null
          has_multiple_sides: boolean
          height_formula: string | null
          id: string
          is_active: boolean
          linha: string | null
          name: string | null
          panel_index: number | null
          product_template_id: string | null
          updated_at: string
          width_formula: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          formula_name?: string | null
          has_multiple_sides?: boolean
          height_formula?: string | null
          id?: string
          is_active?: boolean
          linha?: string | null
          name?: string | null
          panel_index?: number | null
          product_template_id?: string | null
          updated_at?: string
          width_formula?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          formula_name?: string | null
          has_multiple_sides?: boolean
          height_formula?: string | null
          id?: string
          is_active?: boolean
          linha?: string | null
          name?: string | null
          panel_index?: number | null
          product_template_id?: string | null
          updated_at?: string
          width_formula?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "glass_line_formulas_product_template_id_fkey"
            columns: ["product_template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      glass_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      investment_allocations: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          name: string
          percentage: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
          percentage?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          percentage?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      item_template_color_prices: {
        Row: {
          color_name: string
          company_id: string | null
          cost: number | null
          cost_per_meter: number | null
          created_at: string
          id: string
          is_active: boolean
          item_template_id: string
          price: number | null
          sale_price_per_meter: number | null
          updated_at: string
        }
        Insert: {
          color_name: string
          company_id?: string | null
          cost?: number | null
          cost_per_meter?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_template_id: string
          price?: number | null
          sale_price_per_meter?: number | null
          updated_at?: string
        }
        Update: {
          color_name?: string
          company_id?: string | null
          cost?: number | null
          cost_per_meter?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_template_id?: string
          price?: number | null
          sale_price_per_meter?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_template_color_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_template_color_prices_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      item_templates: {
        Row: {
          aliquota_cbs: number | null
          aliquota_ibs: number | null
          aliquota_is: number | null
          aliquota_iss: number | null
          bar_length_mm: number | null
          cest: string | null
          cfop_venda: string | null
          cfop_venda_interestadual: string | null
          codigo_servico: string | null
          company_id: string | null
          cost: number | null
          created_at: string
          default_cost: number | null
          default_formulas: Json
          default_price: number | null
          default_sale_price: number | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          item_template_id: string | null
          linha: string | null
          name: string
          ncm: string | null
          origem: string | null
          price: number | null
          specifications: Json
          type: string
          unit: string | null
          updated_at: string
          weight_per_bar: number | null
          weight_per_meter: number | null
        }
        Insert: {
          aliquota_cbs?: number | null
          aliquota_ibs?: number | null
          aliquota_is?: number | null
          aliquota_iss?: number | null
          bar_length_mm?: number | null
          cest?: string | null
          cfop_venda?: string | null
          cfop_venda_interestadual?: string | null
          codigo_servico?: string | null
          company_id?: string | null
          cost?: number | null
          created_at?: string
          default_cost?: number | null
          default_formulas?: Json
          default_price?: number | null
          default_sale_price?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          item_template_id?: string | null
          linha?: string | null
          name: string
          ncm?: string | null
          origem?: string | null
          price?: number | null
          specifications?: Json
          type?: string
          unit?: string | null
          updated_at?: string
          weight_per_bar?: number | null
          weight_per_meter?: number | null
        }
        Update: {
          aliquota_cbs?: number | null
          aliquota_ibs?: number | null
          aliquota_is?: number | null
          aliquota_iss?: number | null
          bar_length_mm?: number | null
          cest?: string | null
          cfop_venda?: string | null
          cfop_venda_interestadual?: string | null
          codigo_servico?: string | null
          company_id?: string | null
          cost?: number | null
          created_at?: string
          default_cost?: number | null
          default_formulas?: Json
          default_price?: number | null
          default_sale_price?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          item_template_id?: string | null
          linha?: string | null
          name?: string
          ncm?: string | null
          origem?: string | null
          price?: number | null
          specifications?: Json
          type?: string
          unit?: string | null
          updated_at?: string
          weight_per_bar?: number | null
          weight_per_meter?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_templates_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      item_types: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          unit_default: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          unit_default?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          unit_default?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          error_message: string | null
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          success: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      material_consumption: {
        Row: {
          company_id: string
          company_item_id: string | null
          consumed_at: string
          cost: number | null
          created_at: string
          formula_used: string | null
          id: string
          input_height: number | null
          input_quantity: number | null
          input_width: number | null
          item_name: string | null
          item_template_id: string | null
          item_type: string | null
          name: string | null
          ordem_servico_id: string | null
          os_item_id: string | null
          quantity: number | null
          quantity_calculated: number | null
          quote_item_id: string | null
          status: string | null
          stock_movement_id: string | null
          stock_reservation_id: string | null
          unit: string | null
        }
        Insert: {
          company_id: string
          company_item_id?: string | null
          consumed_at?: string
          cost?: number | null
          created_at?: string
          formula_used?: string | null
          id?: string
          input_height?: number | null
          input_quantity?: number | null
          input_width?: number | null
          item_name?: string | null
          item_template_id?: string | null
          item_type?: string | null
          name?: string | null
          ordem_servico_id?: string | null
          os_item_id?: string | null
          quantity?: number | null
          quantity_calculated?: number | null
          quote_item_id?: string | null
          status?: string | null
          stock_movement_id?: string | null
          stock_reservation_id?: string | null
          unit?: string | null
        }
        Update: {
          company_id?: string
          company_item_id?: string | null
          consumed_at?: string
          cost?: number | null
          created_at?: string
          formula_used?: string | null
          id?: string
          input_height?: number | null
          input_quantity?: number | null
          input_width?: number | null
          item_name?: string | null
          item_template_id?: string | null
          item_type?: string | null
          name?: string | null
          ordem_servico_id?: string | null
          os_item_id?: string | null
          quantity?: number | null
          quantity_calculated?: number | null
          quote_item_id?: string | null
          status?: string | null
          stock_movement_id?: string | null
          stock_reservation_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_consumption_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_company_item_id_fkey"
            columns: ["company_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_stock_movement_id_fkey"
            columns: ["stock_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_stock_reservation_id_fkey"
            columns: ["stock_reservation_id"]
            isOneToOne: false
            referencedRelation: "stock_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_checklist: {
        Row: {
          created_at: string
          id: string
          is_checked: boolean
          item_label: string
          measurement_id: string
          notes: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_checked?: boolean
          item_label: string
          measurement_id: string
          notes?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_checked?: boolean
          item_label?: string
          measurement_id?: string
          notes?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "measurement_checklist_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "site_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_items: {
        Row: {
          created_at: string
          depth: number | null
          height: number | null
          id: string
          item_name: string
          item_type: string | null
          measurement_id: string
          notes: string | null
          peitoril: number | null
          position: string | null
          quantity: number
          room: string | null
          sort_order: number
          suggested_product: string | null
          updated_at: string
          vao_altura: number | null
          vao_largura: number | null
          width: number | null
        }
        Insert: {
          created_at?: string
          depth?: number | null
          height?: number | null
          id?: string
          item_name: string
          item_type?: string | null
          measurement_id: string
          notes?: string | null
          peitoril?: number | null
          position?: string | null
          quantity?: number
          room?: string | null
          sort_order?: number
          suggested_product?: string | null
          updated_at?: string
          vao_altura?: number | null
          vao_largura?: number | null
          width?: number | null
        }
        Update: {
          created_at?: string
          depth?: number | null
          height?: number | null
          id?: string
          item_name?: string
          item_type?: string | null
          measurement_id?: string
          notes?: string | null
          peitoril?: number | null
          position?: string | null
          quantity?: number
          room?: string | null
          sort_order?: number
          suggested_product?: string | null
          updated_at?: string
          vao_altura?: number | null
          vao_largura?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_items_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "site_measurements"
            referencedColumns: ["id"]
          },
        ]
      }
      municipios_ibge: {
        Row: {
          codigo_ibge: string
          created_at: string
          nome_municipio: string
          uf_codigo: string
          uf_nome: string | null
        }
        Insert: {
          codigo_ibge: string
          created_at?: string
          nome_municipio: string
          uf_codigo: string
          uf_nome?: string | null
        }
        Update: {
          codigo_ibge?: string
          created_at?: string
          nome_municipio?: string
          uf_codigo?: string
          uf_nome?: string | null
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          cancelada_em: string | null
          chave: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          danfe_url: string | null
          emitida_em: string | null
          focusnfe_payload: Json | null
          focusnfe_ref: string | null
          focusnfe_response: Json | null
          focusnfe_status: string | null
          id: string
          motivo_cancelamento: string | null
          numero: string | null
          ordem_servico_id: string | null
          quote_id: string | null
          ref_externa: string | null
          sale_id: string | null
          serie: string | null
          status: string
          tipo: string
          updated_at: string
          valor_total: number | null
          xml_url: string | null
        }
        Insert: {
          cancelada_em?: string | null
          chave?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          danfe_url?: string | null
          emitida_em?: string | null
          focusnfe_payload?: Json | null
          focusnfe_ref?: string | null
          focusnfe_response?: Json | null
          focusnfe_status?: string | null
          id?: string
          motivo_cancelamento?: string | null
          numero?: string | null
          ordem_servico_id?: string | null
          quote_id?: string | null
          ref_externa?: string | null
          sale_id?: string | null
          serie?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor_total?: number | null
          xml_url?: string | null
        }
        Update: {
          cancelada_em?: string | null
          chave?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          danfe_url?: string | null
          emitida_em?: string | null
          focusnfe_payload?: Json | null
          focusnfe_ref?: string | null
          focusnfe_response?: Json | null
          focusnfe_status?: string | null
          id?: string
          motivo_cancelamento?: string | null
          numero?: string | null
          ordem_servico_id?: string | null
          quote_id?: string | null
          ref_externa?: string | null
          sale_id?: string | null
          serie?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor_total?: number | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "notas_fiscais_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_financial_status"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "notas_fiscais_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          current_stage: string | null
          customer_address: string | null
          customer_document: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          delivery_date: string | null
          estimated_end: string | null
          id: string
          installation_date: string | null
          installation_status: string | null
          notes: string | null
          os_number: number
          paid_amount: number
          payment_status: string | null
          pending_amount: number
          priority: string | null
          production_status: string | null
          quote_id: string | null
          sale_id: string | null
          stages: Json | null
          status: string
          technical_notes: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          current_stage?: string | null
          customer_address?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_date?: string | null
          estimated_end?: string | null
          id?: string
          installation_date?: string | null
          installation_status?: string | null
          notes?: string | null
          os_number?: number
          paid_amount?: number
          payment_status?: string | null
          pending_amount?: number
          priority?: string | null
          production_status?: string | null
          quote_id?: string | null
          sale_id?: string | null
          stages?: Json | null
          status?: string
          technical_notes?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_stage?: string | null
          customer_address?: string | null
          customer_document?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_date?: string | null
          estimated_end?: string | null
          id?: string
          installation_date?: string | null
          installation_status?: string | null
          notes?: string | null
          os_number?: number
          paid_amount?: number
          payment_status?: string | null
          pending_amount?: number
          priority?: string | null
          production_status?: string | null
          quote_id?: string | null
          sale_id?: string | null
          stages?: Json | null
          status?: string
          technical_notes?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "quote_financial_status"
            referencedColumns: ["quote_id"]
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
      os_cutting_plan: {
        Row: {
          bar_length_mm: number | null
          bars: Json | null
          bars_needed: number | null
          color: string | null
          company_id: string
          created_at: string
          cuts: Json | null
          cuts_data: Json | null
          glass_cuts_data: Json | null
          id: string
          item_name: string
          item_status: Json | null
          item_template_id: string | null
          metadata: Json | null
          ordem_servico_id: string
          os_item_id: string | null
          product_name: string | null
          profile_name: string | null
          progress: Json | null
          quantity: number | null
          status: string | null
          waste_mm: number | null
          waste_percent: number | null
        }
        Insert: {
          bar_length_mm?: number | null
          bars?: Json | null
          bars_needed?: number | null
          color?: string | null
          company_id: string
          created_at?: string
          cuts?: Json | null
          cuts_data?: Json | null
          glass_cuts_data?: Json | null
          id?: string
          item_name: string
          item_status?: Json | null
          item_template_id?: string | null
          metadata?: Json | null
          ordem_servico_id: string
          os_item_id?: string | null
          product_name?: string | null
          profile_name?: string | null
          progress?: Json | null
          quantity?: number | null
          status?: string | null
          waste_mm?: number | null
          waste_percent?: number | null
        }
        Update: {
          bar_length_mm?: number | null
          bars?: Json | null
          bars_needed?: number | null
          color?: string | null
          company_id?: string
          created_at?: string
          cuts?: Json | null
          cuts_data?: Json | null
          glass_cuts_data?: Json | null
          id?: string
          item_name?: string
          item_status?: Json | null
          item_template_id?: string | null
          metadata?: Json | null
          ordem_servico_id?: string
          os_item_id?: string | null
          product_name?: string | null
          profile_name?: string | null
          progress?: Json | null
          quantity?: number | null
          status?: string | null
          waste_mm?: number | null
          waste_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "os_cutting_plan_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_cutting_plan_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_cutting_plan_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_cutting_plan_os_item_id_fkey"
            columns: ["os_item_id"]
            isOneToOne: false
            referencedRelation: "os_items"
            referencedColumns: ["id"]
          },
        ]
      }
      os_dimension_history: {
        Row: {
          created_at: string
          field: string
          id: string
          new_value: number
          os_item_id: string
          previous_value: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          new_value: number
          os_item_id: string
          previous_value?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          new_value?: number
          os_item_id?: string
          previous_value?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_dimension_history_os_item_id_fkey"
            columns: ["os_item_id"]
            isOneToOne: false
            referencedRelation: "os_items"
            referencedColumns: ["id"]
          },
        ]
      }
      os_glass_projects: {
        Row: {
          area_m2: number | null
          company_id: string
          created_at: string
          glass_color: string | null
          glass_thickness: number | null
          glass_type_id: string | null
          height_mm: number | null
          id: string
          metadata: Json | null
          ordem_servico_id: string
          os_item_id: string | null
          panels: Json | null
          procurement_status: string | null
          quantity: number | null
          status: string | null
          width_mm: number | null
        }
        Insert: {
          area_m2?: number | null
          company_id: string
          created_at?: string
          glass_color?: string | null
          glass_thickness?: number | null
          glass_type_id?: string | null
          height_mm?: number | null
          id?: string
          metadata?: Json | null
          ordem_servico_id: string
          os_item_id?: string | null
          panels?: Json | null
          procurement_status?: string | null
          quantity?: number | null
          status?: string | null
          width_mm?: number | null
        }
        Update: {
          area_m2?: number | null
          company_id?: string
          created_at?: string
          glass_color?: string | null
          glass_thickness?: number | null
          glass_type_id?: string | null
          height_mm?: number | null
          id?: string
          metadata?: Json | null
          ordem_servico_id?: string
          os_item_id?: string | null
          panels?: Json | null
          procurement_status?: string | null
          quantity?: number | null
          status?: string | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "os_glass_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_glass_projects_glass_type_id_fkey"
            columns: ["glass_type_id"]
            isOneToOne: false
            referencedRelation: "glass_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_glass_projects_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_glass_projects_os_item_id_fkey"
            columns: ["os_item_id"]
            isOneToOne: false
            referencedRelation: "os_items"
            referencedColumns: ["id"]
          },
        ]
      }
      os_items: {
        Row: {
          altura_producao: number
          altura_producao_b: number | null
          altura_producao_c: number | null
          altura_venda: number
          altura_venda_b: number | null
          altura_venda_c: number | null
          aluminum_color: string | null
          company_product_id: string | null
          created_at: string
          glass_color: string | null
          glass_thickness: number | null
          height_production: number | null
          height_production_b: number | null
          height_sold: number | null
          height_sold_b: number | null
          id: string
          item_status: Json | null
          largura_producao: number
          largura_producao_b: number | null
          largura_producao_c: number | null
          largura_venda: number
          largura_venda_b: number | null
          largura_venda_c: number | null
          last_recalculated_at: string | null
          os_id: string
          product_id: string | null
          product_name: string
          product_template_id: string | null
          quantity: number
          quote_item_id: string | null
          recalculation_required: boolean | null
          technical_notes: string | null
          width_production: number | null
          width_production_b: number | null
          width_sold: number | null
          width_sold_b: number | null
        }
        Insert: {
          altura_producao?: number
          altura_producao_b?: number | null
          altura_producao_c?: number | null
          altura_venda?: number
          altura_venda_b?: number | null
          altura_venda_c?: number | null
          aluminum_color?: string | null
          company_product_id?: string | null
          created_at?: string
          glass_color?: string | null
          glass_thickness?: number | null
          height_production?: number | null
          height_production_b?: number | null
          height_sold?: number | null
          height_sold_b?: number | null
          id?: string
          item_status?: Json | null
          largura_producao?: number
          largura_producao_b?: number | null
          largura_producao_c?: number | null
          largura_venda?: number
          largura_venda_b?: number | null
          largura_venda_c?: number | null
          last_recalculated_at?: string | null
          os_id: string
          product_id?: string | null
          product_name: string
          product_template_id?: string | null
          quantity?: number
          quote_item_id?: string | null
          recalculation_required?: boolean | null
          technical_notes?: string | null
          width_production?: number | null
          width_production_b?: number | null
          width_sold?: number | null
          width_sold_b?: number | null
        }
        Update: {
          altura_producao?: number
          altura_producao_b?: number | null
          altura_producao_c?: number | null
          altura_venda?: number
          altura_venda_b?: number | null
          altura_venda_c?: number | null
          aluminum_color?: string | null
          company_product_id?: string | null
          created_at?: string
          glass_color?: string | null
          glass_thickness?: number | null
          height_production?: number | null
          height_production_b?: number | null
          height_sold?: number | null
          height_sold_b?: number | null
          id?: string
          item_status?: Json | null
          largura_producao?: number
          largura_producao_b?: number | null
          largura_producao_c?: number | null
          largura_venda?: number
          largura_venda_b?: number | null
          largura_venda_c?: number | null
          last_recalculated_at?: string | null
          os_id?: string
          product_id?: string | null
          product_name?: string
          product_template_id?: string | null
          quantity?: number
          quote_item_id?: string | null
          recalculation_required?: boolean | null
          technical_notes?: string | null
          width_production?: number | null
          width_production_b?: number | null
          width_sold?: number | null
          width_sold_b?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "os_items_company_product_id_fkey"
            columns: ["company_product_id"]
            isOneToOne: false
            referencedRelation: "company_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_items_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_items_product_template_id_fkey"
            columns: ["product_template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_items_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
        ]
      }
      os_materials: {
        Row: {
          bar_length_mm: number | null
          bars_needed: number | null
          color: string | null
          company_id: string
          company_item_id: string | null
          created_at: string
          created_by: string | null
          id: string
          item_name: string
          item_template_id: string | null
          item_type: string | null
          metadata: Json | null
          notes: string | null
          ordem_servico_id: string
          os_item_id: string | null
          pieces_count: number | null
          profile_name: string | null
          quantity: number | null
          total_cost: number | null
          total_length_mm: number | null
          unit: string | null
          unit_cost: number | null
          waste_mm: number | null
          waste_percent: number | null
        }
        Insert: {
          bar_length_mm?: number | null
          bars_needed?: number | null
          color?: string | null
          company_id: string
          company_item_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_name: string
          item_template_id?: string | null
          item_type?: string | null
          metadata?: Json | null
          notes?: string | null
          ordem_servico_id: string
          os_item_id?: string | null
          pieces_count?: number | null
          profile_name?: string | null
          quantity?: number | null
          total_cost?: number | null
          total_length_mm?: number | null
          unit?: string | null
          unit_cost?: number | null
          waste_mm?: number | null
          waste_percent?: number | null
        }
        Update: {
          bar_length_mm?: number | null
          bars_needed?: number | null
          color?: string | null
          company_id?: string
          company_item_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_name?: string
          item_template_id?: string | null
          item_type?: string | null
          metadata?: Json | null
          notes?: string | null
          ordem_servico_id?: string
          os_item_id?: string | null
          pieces_count?: number | null
          profile_name?: string | null
          quantity?: number | null
          total_cost?: number | null
          total_length_mm?: number | null
          unit?: string | null
          unit_cost?: number | null
          waste_mm?: number | null
          waste_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "os_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_materials_company_item_id_fkey"
            columns: ["company_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_materials_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_materials_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_materials_os_item_id_fkey"
            columns: ["os_item_id"]
            isOneToOne: false
            referencedRelation: "os_items"
            referencedColumns: ["id"]
          },
        ]
      }
      os_photos: {
        Row: {
          caption: string | null
          company_id: string
          created_at: string
          description: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          ordem_servico_id: string
          photo_type: string | null
          photo_url: string | null
          stage: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          ordem_servico_id: string
          photo_type?: string | null
          photo_url?: string | null
          stage?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          ordem_servico_id?: string
          photo_type?: string | null
          photo_url?: string | null
          stage?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_photos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_profiles: {
        Row: {
          can_approve_discounts: boolean
          can_approve_refunds: boolean
          can_cancel_sales: boolean
          can_manage_stock: boolean
          can_operate_cash: boolean
          can_view_reports: boolean
          company_id: string
          created_at: string
          description: string | null
          hide_costs: boolean
          hide_prices: boolean
          id: string
          is_default: boolean
          is_system: boolean
          name: string
          permissions: Json
          profile_name: string | null
          profile_type: string | null
          updated_at: string
        }
        Insert: {
          can_approve_discounts?: boolean
          can_approve_refunds?: boolean
          can_cancel_sales?: boolean
          can_manage_stock?: boolean
          can_operate_cash?: boolean
          can_view_reports?: boolean
          company_id: string
          created_at?: string
          description?: string | null
          hide_costs?: boolean
          hide_prices?: boolean
          id?: string
          is_default?: boolean
          is_system?: boolean
          name: string
          permissions?: Json
          profile_name?: string | null
          profile_type?: string | null
          updated_at?: string
        }
        Update: {
          can_approve_discounts?: boolean
          can_approve_refunds?: boolean
          can_cancel_sales?: boolean
          can_manage_stock?: boolean
          can_operate_cash?: boolean
          can_view_reports?: boolean
          company_id?: string
          created_at?: string
          description?: string | null
          hide_costs?: boolean
          hide_prices?: boolean
          id?: string
          is_default?: boolean
          is_system?: boolean
          name?: string
          permissions?: Json
          profile_name?: string | null
          profile_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          color: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_glass_prices: {
        Row: {
          company_product_id: string
          cost_per_sqm: number | null
          created_at: string
          glass_color: string | null
          glass_type: string | null
          id: string
          is_active: boolean
          price_per_sqm: number | null
          thickness_mm: number | null
          updated_at: string
        }
        Insert: {
          company_product_id: string
          cost_per_sqm?: number | null
          created_at?: string
          glass_color?: string | null
          glass_type?: string | null
          id?: string
          is_active?: boolean
          price_per_sqm?: number | null
          thickness_mm?: number | null
          updated_at?: string
        }
        Update: {
          company_product_id?: string
          cost_per_sqm?: number | null
          created_at?: string
          glass_color?: string | null
          glass_type?: string | null
          id?: string
          is_active?: boolean
          price_per_sqm?: number | null
          thickness_mm?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_glass_prices_company_product_id_fkey"
            columns: ["company_product_id"]
            isOneToOne: false
            referencedRelation: "company_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_linhas: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_template_items: {
        Row: {
          bar_length_mm: number | null
          company_id: string | null
          created_at: string
          cut_angle: number | null
          cut_angle_end: number | null
          cut_angle_start: number | null
          height_formula: string | null
          id: string
          image_url: string | null
          is_optional: boolean
          item_template_id: string | null
          name: string | null
          notes: string | null
          pieces_formula: string | null
          pieces_quantity: number | null
          product_template_id: string
          quantity_formula: string | null
          section: string | null
          side: string | null
          sort_order: number
          type: string | null
          unit: string | null
          updated_at: string
          width_formula: string | null
        }
        Insert: {
          bar_length_mm?: number | null
          company_id?: string | null
          created_at?: string
          cut_angle?: number | null
          cut_angle_end?: number | null
          cut_angle_start?: number | null
          height_formula?: string | null
          id?: string
          image_url?: string | null
          is_optional?: boolean
          item_template_id?: string | null
          name?: string | null
          notes?: string | null
          pieces_formula?: string | null
          pieces_quantity?: number | null
          product_template_id: string
          quantity_formula?: string | null
          section?: string | null
          side?: string | null
          sort_order?: number
          type?: string | null
          unit?: string | null
          updated_at?: string
          width_formula?: string | null
        }
        Update: {
          bar_length_mm?: number | null
          company_id?: string | null
          created_at?: string
          cut_angle?: number | null
          cut_angle_end?: number | null
          cut_angle_start?: number | null
          height_formula?: string | null
          id?: string
          image_url?: string | null
          is_optional?: boolean
          item_template_id?: string | null
          name?: string | null
          notes?: string | null
          pieces_formula?: string | null
          pieces_quantity?: number | null
          product_template_id?: string
          quantity_formula?: string | null
          section?: string | null
          side?: string | null
          sort_order?: number
          type?: string | null
          unit?: string | null
          updated_at?: string
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
          aliquota_cbs: number | null
          aliquota_cofins: number | null
          aliquota_ibs: number | null
          aliquota_icms: number | null
          aliquota_ipi: number | null
          aliquota_is: number | null
          aliquota_iss: number | null
          aliquota_pis: number | null
          altura_mm: number | null
          bar_length_mm: number | null
          base_price: number | null
          category: string | null
          cest: string | null
          cfop_venda: string | null
          cfop_venda_interestadual: string | null
          codigo_barras: string | null
          codigo_beneficio_fiscal: string | null
          codigo_interno: string | null
          company_id: string | null
          created_at: string
          cst_cofins: string | null
          cst_icms: string | null
          cst_ipi: string | null
          cst_pis: string | null
          default_glasses_count: number | null
          default_leaves_count: number | null
          default_panels_count: number | null
          default_sides_count: number | null
          description: string | null
          ex_tipi: string | null
          fabricante: string | null
          has_cutting_plan: boolean
          has_multiple_sides: boolean
          height_formula: string | null
          id: string
          image_url: string | null
          is_active: boolean
          largura_mm: number | null
          linha: string | null
          marca: string | null
          max_height: number | null
          max_width: number | null
          min_height: number | null
          min_width: number | null
          modelo: string | null
          name: string
          ncm: string | null
          observacoes_fiscais: string | null
          origem: string | null
          peso: number | null
          peso_bruto: number | null
          peso_liquido: number | null
          pieces_formula: string | null
          pieces_quantity: number | null
          product_template_id: string | null
          profundidade_mm: number | null
          quantity_formula: string | null
          side: string | null
          type: string | null
          unidade_tributavel: string | null
          unit: string | null
          updated_at: string
          uses_glass: boolean | null
          weight_per_meter: number | null
          width_formula: string | null
        }
        Insert: {
          aliquota_cbs?: number | null
          aliquota_cofins?: number | null
          aliquota_ibs?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_is?: number | null
          aliquota_iss?: number | null
          aliquota_pis?: number | null
          altura_mm?: number | null
          bar_length_mm?: number | null
          base_price?: number | null
          category?: string | null
          cest?: string | null
          cfop_venda?: string | null
          cfop_venda_interestadual?: string | null
          codigo_barras?: string | null
          codigo_beneficio_fiscal?: string | null
          codigo_interno?: string | null
          company_id?: string | null
          created_at?: string
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          default_glasses_count?: number | null
          default_leaves_count?: number | null
          default_panels_count?: number | null
          default_sides_count?: number | null
          description?: string | null
          ex_tipi?: string | null
          fabricante?: string | null
          has_cutting_plan?: boolean
          has_multiple_sides?: boolean
          height_formula?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          largura_mm?: number | null
          linha?: string | null
          marca?: string | null
          max_height?: number | null
          max_width?: number | null
          min_height?: number | null
          min_width?: number | null
          modelo?: string | null
          name: string
          ncm?: string | null
          observacoes_fiscais?: string | null
          origem?: string | null
          peso?: number | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          pieces_formula?: string | null
          pieces_quantity?: number | null
          product_template_id?: string | null
          profundidade_mm?: number | null
          quantity_formula?: string | null
          side?: string | null
          type?: string | null
          unidade_tributavel?: string | null
          unit?: string | null
          updated_at?: string
          uses_glass?: boolean | null
          weight_per_meter?: number | null
          width_formula?: string | null
        }
        Update: {
          aliquota_cbs?: number | null
          aliquota_cofins?: number | null
          aliquota_ibs?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_is?: number | null
          aliquota_iss?: number | null
          aliquota_pis?: number | null
          altura_mm?: number | null
          bar_length_mm?: number | null
          base_price?: number | null
          category?: string | null
          cest?: string | null
          cfop_venda?: string | null
          cfop_venda_interestadual?: string | null
          codigo_barras?: string | null
          codigo_beneficio_fiscal?: string | null
          codigo_interno?: string | null
          company_id?: string | null
          created_at?: string
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          default_glasses_count?: number | null
          default_leaves_count?: number | null
          default_panels_count?: number | null
          default_sides_count?: number | null
          description?: string | null
          ex_tipi?: string | null
          fabricante?: string | null
          has_cutting_plan?: boolean
          has_multiple_sides?: boolean
          height_formula?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          largura_mm?: number | null
          linha?: string | null
          marca?: string | null
          max_height?: number | null
          max_width?: number | null
          min_height?: number | null
          min_width?: number | null
          modelo?: string | null
          name?: string
          ncm?: string | null
          observacoes_fiscais?: string | null
          origem?: string | null
          peso?: number | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          pieces_formula?: string | null
          pieces_quantity?: number | null
          product_template_id?: string | null
          profundidade_mm?: number | null
          quantity_formula?: string | null
          side?: string | null
          type?: string | null
          unidade_tributavel?: string | null
          unit?: string | null
          updated_at?: string
          uses_glass?: boolean | null
          weight_per_meter?: number | null
          width_formula?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_templates_product_template_id_fkey"
            columns: ["product_template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          actual_cost: number | null
          company_item_id: string | null
          created_at: string
          description: string | null
          estimated_cost: number | null
          height_mm: number | null
          id: string
          item_template_id: string | null
          name: string | null
          notes: string | null
          os_glass_project_id: string | null
          os_material_id: string | null
          procurement_status: string | null
          purchase_order_id: string
          quantity: number | null
          received_at: string | null
          received_quantity: number | null
          status: string | null
          total_actual: number | null
          unit: string | null
          unit_cost: number | null
          updated_at: string
          width_mm: number | null
        }
        Insert: {
          actual_cost?: number | null
          company_item_id?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          height_mm?: number | null
          id?: string
          item_template_id?: string | null
          name?: string | null
          notes?: string | null
          os_glass_project_id?: string | null
          os_material_id?: string | null
          procurement_status?: string | null
          purchase_order_id: string
          quantity?: number | null
          received_at?: string | null
          received_quantity?: number | null
          status?: string | null
          total_actual?: number | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
          width_mm?: number | null
        }
        Update: {
          actual_cost?: number | null
          company_item_id?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          height_mm?: number | null
          id?: string
          item_template_id?: string | null
          name?: string | null
          notes?: string | null
          os_glass_project_id?: string | null
          os_material_id?: string | null
          procurement_status?: string | null
          purchase_order_id?: string
          quantity?: number | null
          received_at?: string | null
          received_quantity?: number | null
          status?: string | null
          total_actual?: number | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_company_item_id_fkey"
            columns: ["company_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          expected_delivery: string | null
          id: string
          item_template_id: string | null
          notes: string | null
          ordem_servico_id: string | null
          order_number: number | null
          os_number: string | null
          procurement_status: string | null
          quantity: number | null
          received_at: string | null
          status: string
          supplier_name: string | null
          total_actual: number | null
          total_estimated: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          expected_delivery?: string | null
          id?: string
          item_template_id?: string | null
          notes?: string | null
          ordem_servico_id?: string | null
          order_number?: number | null
          os_number?: string | null
          procurement_status?: string | null
          quantity?: number | null
          received_at?: string | null
          status?: string
          supplier_name?: string | null
          total_actual?: number | null
          total_estimated?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          expected_delivery?: string | null
          id?: string
          item_template_id?: string | null
          notes?: string | null
          ordem_servico_id?: string | null
          order_number?: number | null
          os_number?: string | null
          procurement_status?: string | null
          quantity?: number | null
          received_at?: string | null
          status?: string
          supplier_name?: string | null
          total_actual?: number | null
          total_estimated?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_deposits: {
        Row: {
          amount: number
          cash_movement_id: string | null
          cash_register_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          deposit_status: string | null
          due_date: string | null
          id: string
          notes: string | null
          ordem_servico_id: string | null
          payment_method: string | null
          quote_id: string
          received_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          cash_movement_id?: string | null
          cash_register_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deposit_status?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          ordem_servico_id?: string | null
          payment_method?: string | null
          quote_id: string
          received_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cash_movement_id?: string | null
          cash_register_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          deposit_status?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          ordem_servico_id?: string | null
          payment_method?: string | null
          quote_id?: string
          received_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_deposits_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_deposits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_deposits_os_fk"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_deposits_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_financial_status"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_deposits_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          aluminum_color: string | null
          company_item_id: string | null
          company_product_id: string | null
          composition: Json | null
          created_at: string
          description: string | null
          excluded_optional_ids: Json | null
          glass_color: string | null
          glass_thickness: string | null
          glasses_count: number | null
          has_glass: boolean | null
          height: number | null
          height_b: number | null
          height_c: number | null
          id: string
          include_contramarco: boolean | null
          item_notes: string | null
          item_template_id: string | null
          item_type: string | null
          leaves_count: number | null
          notes: string | null
          panels_count: number | null
          position: number | null
          product_template_id: string | null
          quantity: number
          quote_id: string
          sides_count: number | null
          total_price: number
          unit: string | null
          unit_price: number
          width: number | null
          width_b: number | null
          width_c: number | null
        }
        Insert: {
          aluminum_color?: string | null
          company_item_id?: string | null
          company_product_id?: string | null
          composition?: Json | null
          created_at?: string
          description?: string | null
          excluded_optional_ids?: Json | null
          glass_color?: string | null
          glass_thickness?: string | null
          glasses_count?: number | null
          has_glass?: boolean | null
          height?: number | null
          height_b?: number | null
          height_c?: number | null
          id?: string
          include_contramarco?: boolean | null
          item_notes?: string | null
          item_template_id?: string | null
          item_type?: string | null
          leaves_count?: number | null
          notes?: string | null
          panels_count?: number | null
          position?: number | null
          product_template_id?: string | null
          quantity?: number
          quote_id: string
          sides_count?: number | null
          total_price?: number
          unit?: string | null
          unit_price?: number
          width?: number | null
          width_b?: number | null
          width_c?: number | null
        }
        Update: {
          aluminum_color?: string | null
          company_item_id?: string | null
          company_product_id?: string | null
          composition?: Json | null
          created_at?: string
          description?: string | null
          excluded_optional_ids?: Json | null
          glass_color?: string | null
          glass_thickness?: string | null
          glasses_count?: number | null
          has_glass?: boolean | null
          height?: number | null
          height_b?: number | null
          height_c?: number | null
          id?: string
          include_contramarco?: boolean | null
          item_notes?: string | null
          item_template_id?: string | null
          item_type?: string | null
          leaves_count?: number | null
          notes?: string | null
          panels_count?: number | null
          position?: number | null
          product_template_id?: string | null
          quantity?: number
          quote_id?: string
          sides_count?: number | null
          total_price?: number
          unit?: string | null
          unit_price?: number
          width?: number | null
          width_b?: number | null
          width_c?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_company_item_id_fkey"
            columns: ["company_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_company_product_id_fkey"
            columns: ["company_product_id"]
            isOneToOne: false
            referencedRelation: "company_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
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
            referencedRelation: "quote_financial_status"
            referencedColumns: ["quote_id"]
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
          approved_at: string | null
          approved_by: string | null
          client_id: string | null
          company_id: string
          condicao_pagamento_id: string | null
          converted_at: string | null
          cover_html: string | null
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_document: string | null
          customer_document_type: string | null
          customer_email: string | null
          customer_marital_status: string | null
          customer_name: string
          customer_phone: string | null
          customer_profession: string | null
          deposit_amount: number | null
          deposit_status: string | null
          discount_amount: number | null
          discount_percent: number | null
          final_amount: number
          forma_pagamento_id: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          presentation_enabled: boolean | null
          presentation_template: string | null
          quote_number: number
          show_m2_column: boolean | null
          show_measures_column: boolean | null
          status: string
          subtotal: number
          total_amount: number
          updated_at: string
          valid_until: string | null
          valor_final_aprovado: number | null
          valor_original: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          company_id: string
          condicao_pagamento_id?: string | null
          converted_at?: string | null
          cover_html?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_document?: string | null
          customer_document_type?: string | null
          customer_email?: string | null
          customer_marital_status?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_profession?: string | null
          deposit_amount?: number | null
          deposit_status?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          final_amount?: number
          forma_pagamento_id?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          presentation_enabled?: boolean | null
          presentation_template?: string | null
          quote_number?: number
          show_m2_column?: boolean | null
          show_measures_column?: boolean | null
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          valor_final_aprovado?: number | null
          valor_original?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          company_id?: string
          condicao_pagamento_id?: string | null
          converted_at?: string | null
          cover_html?: string | null
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_document?: string | null
          customer_document_type?: string | null
          customer_email?: string | null
          customer_marital_status?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_profession?: string | null
          deposit_amount?: number | null
          deposit_status?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          final_amount?: number
          forma_pagamento_id?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          presentation_enabled?: boolean | null
          presentation_template?: string | null
          quote_number?: number
          show_m2_column?: boolean | null
          show_measures_column?: boolean | null
          status?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          valor_final_aprovado?: number | null
          valor_original?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          company_id: string
          created_at: string
          id: string
          module: string
          permissions: Json
          role: Database["public"]["Enums"]["company_role"]
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          company_id: string
          created_at?: string
          id?: string
          module: string
          permissions?: Json
          role: Database["public"]["Enums"]["company_role"]
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          company_id?: string
          created_at?: string
          id?: string
          module?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_company_id_fkey"
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
      sale_item_components: {
        Row: {
          company_id: string
          company_item_id: string | null
          created_at: string
          id: string
          item_name: string
          item_template_id: string | null
          metadata: Json | null
          quantity: number
          sale_item_id: string
          source: string | null
          unit: string | null
        }
        Insert: {
          company_id: string
          company_item_id?: string | null
          created_at?: string
          id?: string
          item_name: string
          item_template_id?: string | null
          metadata?: Json | null
          quantity?: number
          sale_item_id: string
          source?: string | null
          unit?: string | null
        }
        Update: {
          company_id?: string
          company_item_id?: string | null
          created_at?: string
          id?: string
          item_name?: string
          item_template_id?: string | null
          metadata?: Json | null
          quantity?: number
          sale_item_id?: string
          source?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_item_components_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_components_company_item_id_fkey"
            columns: ["company_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_components_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_components_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          company_item_id: string | null
          company_product_id: string | null
          created_at: string
          height: number | null
          id: string
          item_name: string
          item_template_id: string | null
          item_unit: string | null
          metadata: Json | null
          notes: string | null
          quantity: number
          sale_id: string
          total_price: number
          unit_price: number
          width: number | null
        }
        Insert: {
          company_item_id?: string | null
          company_product_id?: string | null
          created_at?: string
          height?: number | null
          id?: string
          item_name: string
          item_template_id?: string | null
          item_unit?: string | null
          metadata?: Json | null
          notes?: string | null
          quantity?: number
          sale_id: string
          total_price?: number
          unit_price?: number
          width?: number | null
        }
        Update: {
          company_item_id?: string | null
          company_product_id?: string | null
          created_at?: string
          height?: number | null
          id?: string
          item_name?: string
          item_template_id?: string | null
          item_unit?: string | null
          metadata?: Json | null
          notes?: string | null
          quantity?: number
          sale_id?: string
          total_price?: number
          unit_price?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_company_item_id_fkey"
            columns: ["company_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
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
      sales: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_register_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          customer_name: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          notes: string | null
          ordem_servico_id: string | null
          paid_amount: number
          parent_sale_id: string | null
          payment_method: string | null
          payment_status: string
          pending_amount: number
          quote_id: string | null
          sale_number: number
          sale_type: string | null
          sold_by: string | null
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_register_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          customer_name?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          notes?: string | null
          ordem_servico_id?: string | null
          paid_amount?: number
          parent_sale_id?: string | null
          payment_method?: string | null
          payment_status?: string
          pending_amount?: number
          quote_id?: string | null
          sale_number?: number
          sale_type?: string | null
          sold_by?: string | null
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_register_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          customer_name?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          notes?: string | null
          ordem_servico_id?: string | null
          paid_amount?: number
          parent_sale_id?: string | null
          payment_method?: string | null
          payment_status?: string
          pending_amount?: number
          quote_id?: string | null
          sale_number?: number
          sale_type?: string | null
          sold_by?: string | null
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_cash_register_fk"
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
            referencedRelation: "quote_financial_status"
            referencedColumns: ["quote_id"]
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
      service_appointments: {
        Row: {
          address: string | null
          all_day: boolean
          appointment_type: string
          assigned_to: string | null
          assigned_to_name: string | null
          client_id: string | null
          color: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          duration_minutes: number | null
          ends_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          ordem_servico_id: string | null
          quote_id: string | null
          scheduled_at: string | null
          scheduled_date: string | null
          scheduled_time_end: string | null
          scheduled_time_start: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          all_day?: boolean
          appointment_type?: string
          assigned_to?: string | null
          assigned_to_name?: string | null
          client_id?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          ordem_servico_id?: string | null
          quote_id?: string | null
          scheduled_at?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          all_day?: boolean
          appointment_type?: string
          assigned_to?: string | null
          assigned_to_name?: string | null
          client_id?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          duration_minutes?: number | null
          ends_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          ordem_servico_id?: string | null
          quote_id?: string | null
          scheduled_at?: string | null
          scheduled_date?: string | null
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_appointments_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_appointments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_financial_status"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "service_appointments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      site_measurements: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          id: string
          location_address: string | null
          location_name: string | null
          measured_at: string | null
          measured_by: string | null
          measured_by_name: string | null
          measurement_number: number
          notes: string | null
          observations: string | null
          room_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          location_address?: string | null
          location_name?: string | null
          measured_at?: string | null
          measured_by?: string | null
          measured_by_name?: string | null
          measurement_number?: number
          notes?: string | null
          observations?: string | null
          room_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          location_address?: string | null
          location_name?: string | null
          measured_at?: string | null
          measured_by?: string | null
          measured_by_name?: string | null
          measurement_number?: number
          notes?: string | null
          observations?: string | null
          room_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_measurements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_measurements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          category: string | null
          company_id: string
          company_item_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          full_name: string | null
          id: string
          item_template_id: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          type: string
          unit_cost: number | null
          valor_financeiro: number | null
        }
        Insert: {
          category?: string | null
          company_id: string
          company_item_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          full_name?: string | null
          id?: string
          item_template_id?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          type: string
          unit_cost?: number | null
          valor_financeiro?: number | null
        }
        Update: {
          category?: string | null
          company_id?: string
          company_item_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          full_name?: string | null
          id?: string
          item_template_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          unit_cost?: number | null
          valor_financeiro?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_company_item_id_fkey"
            columns: ["company_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_offcuts: {
        Row: {
          color: string | null
          company_id: string
          company_item_id: string | null
          created_at: string
          created_by: string | null
          height_mm: number | null
          id: string
          item_template_id: string | null
          kind: string
          length_mm: number | null
          name: string
          notes: string | null
          quantity: number
          source: string
          source_os_id: string | null
          source_reference: string | null
          status: string
          thickness: number | null
          updated_at: string
          width_mm: number | null
        }
        Insert: {
          color?: string | null
          company_id: string
          company_item_id?: string | null
          created_at?: string
          created_by?: string | null
          height_mm?: number | null
          id?: string
          item_template_id?: string | null
          kind: string
          length_mm?: number | null
          name: string
          notes?: string | null
          quantity?: number
          source?: string
          source_os_id?: string | null
          source_reference?: string | null
          status?: string
          thickness?: number | null
          updated_at?: string
          width_mm?: number | null
        }
        Update: {
          color?: string | null
          company_id?: string
          company_item_id?: string | null
          created_at?: string
          created_by?: string | null
          height_mm?: number | null
          id?: string
          item_template_id?: string | null
          kind?: string
          length_mm?: number | null
          name?: string
          notes?: string | null
          quantity?: number
          source?: string
          source_os_id?: string | null
          source_reference?: string | null
          status?: string
          thickness?: number | null
          updated_at?: string
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_offcuts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_offcuts_company_item_id_fkey"
            columns: ["company_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_offcuts_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_offcuts_source_os_id_fkey"
            columns: ["source_os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          cancelled_at: string | null
          company_id: string
          company_item_id: string | null
          created_at: string
          created_by: string | null
          id: string
          item_template_id: string | null
          ordem_servico_id: string | null
          os_glass_project_id: string | null
          quantity_reserved: number
          status: string
          unit: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          company_id: string
          company_item_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_template_id?: string | null
          ordem_servico_id?: string | null
          os_glass_project_id?: string | null
          quantity_reserved?: number
          status?: string
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          company_id?: string
          company_item_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_template_id?: string | null
          ordem_servico_id?: string | null
          os_glass_project_id?: string | null
          quantity_reserved?: number
          status?: string
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_company_item_id_fkey"
            columns: ["company_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      support_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string | null
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string
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
          category: string
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
      system_module_settings: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_enabled: boolean
          module_key: string
          module_name: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_enabled?: boolean
          module_key: string
          module_name?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_enabled?: boolean
          module_key?: string
          module_name?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_reminders: {
        Row: {
          company_id: string
          created_at: string
          dismissed_at: string | null
          due_at: string | null
          id: string
          message: string | null
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          reminder_type: string
          title: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          dismissed_at?: string | null
          due_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          reminder_type: string
          title: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          dismissed_at?: string | null
          due_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          reminder_type?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_reminders_company_id_fkey"
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
          aliquota_iss: number | null
          cest: string | null
          cfop: string | null
          cofins_percent: number | null
          company_id: string | null
          created_at: string
          icms_percent: number | null
          id: string
          ipi_percent: number | null
          is_active: boolean
          name: string
          ncm: string | null
          ncm_code: string | null
          origem: string | null
          pis_percent: number | null
          updated_at: string
        }
        Insert: {
          aliquota_cbs?: number | null
          aliquota_ibs?: number | null
          aliquota_is?: number | null
          aliquota_iss?: number | null
          cest?: string | null
          cfop?: string | null
          cofins_percent?: number | null
          company_id?: string | null
          created_at?: string
          icms_percent?: number | null
          id?: string
          ipi_percent?: number | null
          is_active?: boolean
          name: string
          ncm?: string | null
          ncm_code?: string | null
          origem?: string | null
          pis_percent?: number | null
          updated_at?: string
        }
        Update: {
          aliquota_cbs?: number | null
          aliquota_ibs?: number | null
          aliquota_is?: number | null
          aliquota_iss?: number | null
          cest?: string | null
          cfop?: string | null
          cofins_percent?: number | null
          company_id?: string | null
          created_at?: string
          icms_percent?: number | null
          id?: string
          ipi_percent?: number | null
          is_active?: boolean
          name?: string
          ncm?: string | null
          ncm_code?: string | null
          origem?: string | null
          pis_percent?: number | null
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
          invited_by: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["company_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["company_role"]
          updated_at?: string
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
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      company_members_view: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          role: Database["public"]["Enums"]["company_role"] | null
          user_id: string | null
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
      quote_financial_status: {
        Row: {
          company_id: string | null
          created_at: string | null
          customer_name: string | null
          final_amount: number | null
          financial_status: string | null
          pending_amount: number | null
          quote_id: string | null
          quote_number: number | null
          status: string | null
          total_deposits: number | null
          total_sold: number | null
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
    }
    Functions: {
      accept_employee_invite: {
        Args: { _token: string; _user_id: string }
        Returns: Json
      }
      activate_product_template_for_company: {
        Args: { _company_id: string; _product_template_id: string }
        Returns: string
      }
      bulk_adjust_item_cost: {
        Args: {
          p_company_id: string
          p_linha?: string
          p_percent: number
          p_type?: string
        }
        Returns: number
      }
      calculate_sale_commission: {
        Args: { _employee_id: string; _sale_id: string }
        Returns: string
      }
      cancel_approved_quote: { Args: { _quote_id: string }; Returns: Json }
      cancel_os_materials: {
        Args: { _ordem_servico_id: string }
        Returns: Json
      }
      cancel_sale: {
        Args: {
          p_company_id: string
          p_reason?: string
          p_sale_id: string
          p_user_id: string
        }
        Returns: Json
      }
      change_company_member_role: {
        Args: {
          _company_id: string
          _new_role: string
          _target_user_id: string
        }
        Returns: Json
      }
      check_login_rate_limit: {
        Args: {
          _email: string
          _max_attempts?: number
          _window_minutes?: number
        }
        Returns: Json
      }
      close_cash_register_direct: {
        Args: { _cash_register_id: string; _counts: Json; _notes?: string }
        Returns: Json
      }
      convert_quote_to_os: { Args: { _quote_id: string }; Returns: string }
      create_company_and_assign_admin: {
        Args: {
          _address?: string
          _cnpj?: string
          _email?: string
          _name: string
          _phone?: string
        }
        Returns: Json
      }
      create_custom_product: {
        Args: {
          _base_price?: number
          _category?: string
          _company_id: string
          _description?: string
          _image_url?: string
          _linha?: string
          _name: string
        }
        Returns: string
      }
      create_default_payment_options: {
        Args: { _company_id: string }
        Returns: undefined
      }
      deactivate_company_member: {
        Args: { _company_id: string; _target_user_id: string }
        Returns: Json
      }
      get_cash_flow_projection: {
        Args: { p_company_id: string; p_end: string; p_start: string }
        Returns: {
          date: string
          projected_in: number
          projected_out: number
          realized_in: number
          realized_out: number
        }[]
      }
      get_cutting_plan_items: {
        Args: { _company_id?: string; _template_id: string }
        Returns: {
          bar_length_mm: number
          cut_angle: number
          cut_angle_end: number
          cut_angle_start: number
          height_formula: string
          id: string
          is_optional: boolean
          item_template_id: string
          item_template_image_url: string
          item_template_name: string
          item_template_type: string
          notes: string
          pieces_formula: string
          pieces_quantity: number
          quantity_formula: string
          section: string
          side: string
          source: string
          width_formula: string
        }[]
      }
      get_dre_report: {
        Args: { p_company_id: string; p_end: string; p_start: string }
        Returns: {
          amount: number
          category_color: string
          category_id: string
          category_name: string
          count: number
          dre_group: string
          kind: string
        }[]
      }
      get_employee_login_email: {
        Args: { p_username: string }
        Returns: string
      }
      get_operator_pending_discrepancies: {
        Args: { _company_id: string }
        Returns: {
          created_at: string
          description: string
          id: string
        }[]
      }
      get_pending_advances_summary: {
        Args: { _company_id: string }
        Returns: Json
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_open_cash_register: {
        Args: { _company_id: string }
        Returns: {
          id: string
          opened_at: string
          opening_amount: number
        }[]
      }
      get_user_permission_profile: {
        Args: { _company_id: string; _user_id: string }
        Returns: {
          can_approve_discounts: boolean
          can_approve_refunds: boolean
          can_cancel_sales: boolean
          can_manage_stock: boolean
          can_operate_cash: boolean
          can_view_reports: boolean
          hide_costs: boolean
          hide_prices: boolean
          permissions: Json
          profile_id: string
          profile_name: string
          profile_type: string
        }[]
      }
      grant_saas_admin: { Args: { _email: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initialize_company_cash: {
        Args: {
          _company_id: string
          _fixed_fund?: number
          _initial_balance?: number
        }
        Returns: Json
      }
      is_saas_admin: { Args: { _user_id: string }; Returns: boolean }
      list_effective_product_templates: {
        Args: { _company_id: string }
        Returns: {
          aliquota_cbs: number | null
          aliquota_cofins: number | null
          aliquota_ibs: number | null
          aliquota_icms: number | null
          aliquota_ipi: number | null
          aliquota_is: number | null
          aliquota_iss: number | null
          aliquota_pis: number | null
          altura_mm: number | null
          bar_length_mm: number | null
          base_price: number | null
          category: string | null
          cest: string | null
          cfop_venda: string | null
          cfop_venda_interestadual: string | null
          codigo_barras: string | null
          codigo_beneficio_fiscal: string | null
          codigo_interno: string | null
          company_id: string | null
          created_at: string
          cst_cofins: string | null
          cst_icms: string | null
          cst_ipi: string | null
          cst_pis: string | null
          default_glasses_count: number | null
          default_leaves_count: number | null
          default_panels_count: number | null
          default_sides_count: number | null
          description: string | null
          ex_tipi: string | null
          fabricante: string | null
          has_cutting_plan: boolean
          has_multiple_sides: boolean
          height_formula: string | null
          id: string
          image_url: string | null
          is_active: boolean
          largura_mm: number | null
          linha: string | null
          marca: string | null
          max_height: number | null
          max_width: number | null
          min_height: number | null
          min_width: number | null
          modelo: string | null
          name: string
          ncm: string | null
          observacoes_fiscais: string | null
          origem: string | null
          peso: number | null
          peso_bruto: number | null
          peso_liquido: number | null
          pieces_formula: string | null
          pieces_quantity: number | null
          product_template_id: string | null
          profundidade_mm: number | null
          quantity_formula: string | null
          side: string | null
          type: string | null
          unidade_tributavel: string | null
          unit: string | null
          updated_at: string
          uses_glass: boolean | null
          weight_per_meter: number | null
          width_formula: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "product_templates"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_saas_admins: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          user_id: string
        }[]
      }
      list_schema_migrations: {
        Args: never
        Returns: {
          name: string
          statements: string[]
          version: string
        }[]
      }
      open_daily_cash: {
        Args: { _company_id: string; _opening_amount: number; _user_id: string }
        Returns: Json
      }
      reactivate_company_member: {
        Args: { _company_id: string; _target_user_id: string }
        Returns: Json
      }
      record_login_attempt: {
        Args: {
          _email: string
          _ip_address?: string
          _success: boolean
          _user_agent?: string
        }
        Returns: undefined
      }
      register_cash_exit_with_reinforcement: {
        Args: {
          _amount: number
          _cash_register_id: string
          _category: string
          _description: string
          _payment_method?: string
        }
        Returns: Json
      }
      register_company_cash_movement: {
        Args: {
          _amount: number
          _category: string
          _company_id: string
          _description?: string
          _type: string
        }
        Returns: Json
      }
      release_materials_for_production: {
        Args: { _ordem_servico_id: string }
        Returns: Json
      }
      reserve_os_materials: {
        Args: { _ordem_servico_id: string }
        Returns: Json
      }
      reset_company_product_item: {
        Args: { p_company_product_item_id: string }
        Returns: Json
      }
      reset_company_product_to_template: {
        Args: { p_company_product_id: string; p_user_id?: string }
        Returns: Json
      }
      reset_composition_item: { Args: { _item_id: string }; Returns: undefined }
      revoke_saas_admin: { Args: { _user_id: string }; Returns: Json }
      save_composition_item: {
        Args: { _company_id: string; _item_id: string; _patch: Json }
        Returns: string
      }
      seed_default_financial_categories: {
        Args: { _company_id: string }
        Returns: undefined
      }
      transfer_company_ownership: {
        Args: { _company_id: string; _new_admin_user_id: string }
        Returns: Json
      }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_role_in_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["company_role"]
      }
      validate_invite_token: { Args: { _token: string }; Returns: Json }
    }
    Enums: {
      app_role: "saas_admin" | "admin" | "manager" | "employee"
      company_role: "admin" | "manager" | "employee"
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
      app_role: ["saas_admin", "admin", "manager", "employee"],
      company_role: ["admin", "manager", "employee"],
    },
  },
} as const
