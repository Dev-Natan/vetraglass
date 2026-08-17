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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounts_receivable: {
        Row: {
          bank_account_id: string | null
          category_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_name: string
          description: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          ordem_servico_id: string | null
          paid_amount: number | null
          paid_date: string | null
          payment_method: string | null
          quote_id: string | null
          receivable_type: string | null
          sale_id: string | null
          status: string
          total_amount: number
          total_installments: number
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          category_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_name: string
          description: string
          due_date: string
          id?: string
          installment_number?: number
          notes?: string | null
          ordem_servico_id?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          payment_method?: string | null
          quote_id?: string | null
          receivable_type?: string | null
          sale_id?: string | null
          status?: string
          total_amount: number
          total_installments?: number
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          category_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string
          description?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          ordem_servico_id?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          payment_method?: string | null
          quote_id?: string | null
          receivable_type?: string | null
          sale_id?: string | null
          status?: string
          total_amount?: number
          total_installments?: number
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
            foreignKeyName: "accounts_receivable_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
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
      admin_aluminum_colors: {
        Row: {
          created_at: string
          hex_color: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          hex_color?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          hex_color?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_glass_colors: {
        Row: {
          created_at: string
          hex_color: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          hex_color?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          hex_color?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_glass_thicknesses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          thickness_mm: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          thickness_mm: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          thickness_mm?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_suggested_prices: {
        Row: {
          aluminum_color: string | null
          cost_per_meter: number | null
          cost_per_sqm: number | null
          created_at: string
          glass_color: string | null
          id: string
          kind: string
          price_per_meter: number | null
          price_per_sqm: number | null
          thickness_mm: number | null
          updated_at: string
        }
        Insert: {
          aluminum_color?: string | null
          cost_per_meter?: number | null
          cost_per_sqm?: number | null
          created_at?: string
          glass_color?: string | null
          id?: string
          kind: string
          price_per_meter?: number | null
          price_per_sqm?: number | null
          thickness_mm?: number | null
          updated_at?: string
        }
        Update: {
          aluminum_color?: string | null
          cost_per_meter?: number | null
          cost_per_sqm?: number | null
          created_at?: string
          glass_color?: string | null
          id?: string
          kind?: string
          price_per_meter?: number | null
          price_per_sqm?: number | null
          thickness_mm?: number | null
          updated_at?: string
        }
        Relationships: []
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
      audit_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
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
      cash_counts: {
        Row: {
          cash_register_id: string
          created_at: string | null
          id: string
          payment_method: string
          user_id: string
          valor_informado: number
        }
        Insert: {
          cash_register_id: string
          created_at?: string | null
          id?: string
          payment_method: string
          user_id: string
          valor_informado?: number
        }
        Update: {
          cash_register_id?: string
          created_at?: string | null
          id?: string
          payment_method?: string
          user_id?: string
          valor_informado?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_counts_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          bank_account_id: string | null
          cash_register_id: string | null
          category: string
          cliente_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          expense_id: string | null
          fornecedor_id: string | null
          funcionario_id: string | null
          id: string
          operation_key: string | null
          ordem_servico_id: string | null
          origem: string | null
          party_id: string | null
          party_name: string | null
          party_type: string | null
          payment_method: string | null
          quote_id: string | null
          receivable_id: string | null
          sale_id: string | null
          type: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          cash_register_id?: string | null
          category: string
          cliente_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_id?: string | null
          fornecedor_id?: string | null
          funcionario_id?: string | null
          id?: string
          operation_key?: string | null
          ordem_servico_id?: string | null
          origem?: string | null
          party_id?: string | null
          party_name?: string | null
          party_type?: string | null
          payment_method?: string | null
          quote_id?: string | null
          receivable_id?: string | null
          sale_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          cash_register_id?: string | null
          category?: string
          cliente_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_id?: string | null
          fornecedor_id?: string | null
          funcionario_id?: string | null
          id?: string
          operation_key?: string | null
          ordem_servico_id?: string | null
          origem?: string | null
          party_id?: string | null
          party_name?: string | null
          party_type?: string | null
          payment_method?: string | null
          quote_id?: string | null
          receivable_id?: string | null
          sale_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
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
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
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
            foreignKeyName: "cash_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
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
            foreignKeyName: "cash_movements_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
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
          cash_register_id: string | null
          company_id: string
          company_movement_id: string | null
          compensated_amount: number | null
          compensated_at: string | null
          created_at: string | null
          created_by: string | null
          daily_movement_id: string | null
          id: string
          reason: string
          status: string | null
        }
        Insert: {
          amount: number
          cash_register_id?: string | null
          company_id: string
          company_movement_id?: string | null
          compensated_amount?: number | null
          compensated_at?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_movement_id?: string | null
          id?: string
          reason: string
          status?: string | null
        }
        Update: {
          amount?: number
          cash_register_id?: string | null
          company_id?: string
          company_movement_id?: string | null
          compensated_amount?: number | null
          compensated_at?: string | null
          created_at?: string | null
          created_by?: string | null
          daily_movement_id?: string | null
          id?: string
          reason?: string
          status?: string | null
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
          {
            foreignKeyName: "cash_register_advances_company_movement_id_fkey"
            columns: ["company_movement_id"]
            isOneToOne: false
            referencedRelation: "company_cash_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_advances_daily_movement_id_fkey"
            columns: ["daily_movement_id"]
            isOneToOne: false
            referencedRelation: "cash_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_audits: {
        Row: {
          adjustment_amount: number | null
          audited_at: string | null
          auditor_action: string | null
          auditor_id: string | null
          auditor_name: string | null
          auditor_notes: string | null
          cash_register_id: string
          company_id: string
          counts_submitted: Json
          created_at: string
          difference: number
          expected_amount: number
          id: string
          operator_id: string | null
          operator_name: string | null
          operator_notes: string | null
          status: string
          submitted_at: string
          total_counted: number
          updated_at: string
        }
        Insert: {
          adjustment_amount?: number | null
          audited_at?: string | null
          auditor_action?: string | null
          auditor_id?: string | null
          auditor_name?: string | null
          auditor_notes?: string | null
          cash_register_id: string
          company_id: string
          counts_submitted: Json
          created_at?: string
          difference: number
          expected_amount: number
          id?: string
          operator_id?: string | null
          operator_name?: string | null
          operator_notes?: string | null
          status?: string
          submitted_at?: string
          total_counted: number
          updated_at?: string
        }
        Update: {
          adjustment_amount?: number | null
          audited_at?: string | null
          auditor_action?: string | null
          auditor_id?: string | null
          auditor_name?: string | null
          auditor_notes?: string | null
          cash_register_id?: string
          company_id?: string
          counts_submitted?: Json
          created_at?: string
          difference?: number
          expected_amount?: number
          id?: string
          operator_id?: string | null
          operator_name?: string | null
          operator_notes?: string | null
          status?: string
          submitted_at?: string
          total_counted?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_audits_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_audits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          actual_amount: number | null
          audit_notes: string | null
          audit_status: string | null
          audited_at: string | null
          audited_by: string | null
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          closing_justification: string | null
          closing_requested_at: string | null
          company_id: string
          created_at: string
          difference: number | null
          excess_collected: number | null
          fixed_fund_at_close: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          operator_id: string | null
          previous_discrepancy: number | null
          previous_discrepancy_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number | null
          audit_notes?: string | null
          audit_status?: string | null
          audited_at?: string | null
          audited_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          closing_justification?: string | null
          closing_requested_at?: string | null
          company_id: string
          created_at?: string
          difference?: number | null
          excess_collected?: number | null
          fixed_fund_at_close?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_amount?: number
          operator_id?: string | null
          previous_discrepancy?: number | null
          previous_discrepancy_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number | null
          audit_notes?: string | null
          audit_status?: string | null
          audited_at?: string | null
          audited_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          closing_justification?: string | null
          closing_requested_at?: string | null
          company_id?: string
          created_at?: string
          difference?: number | null
          excess_collected?: number | null
          fixed_fund_at_close?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          operator_id?: string | null
          previous_discrepancy?: number | null
          previous_discrepancy_notes?: string | null
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
      cash_shortages: {
        Row: {
          amount: number
          cash_register_id: string | null
          company_id: string
          compensated_amount: number | null
          compensated_at: string | null
          created_at: string | null
          id: string
          reason: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          amount: number
          cash_register_id?: string | null
          company_id: string
          compensated_amount?: number | null
          compensated_at?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          cash_register_id?: string | null
          company_id?: string
          compensated_amount?: number | null
          compensated_at?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_shortages_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_shortages_company_id_fkey"
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
          address_number: string | null
          ambiente_fiscal: string | null
          certificado_cnpj: string | null
          certificado_digital_nome: string | null
          certificado_digital_url: string | null
          certificado_digital_validade: string | null
          certificado_emissor: string | null
          certificado_serial: string | null
          certificado_status: string | null
          certificado_ultima_verificacao: string | null
          city: string | null
          cnpj: string | null
          codigo_municipio_ibge: string | null
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
          phone: string | null
          primary_color: string | null
          regime_tributario: string | null
          secondary_color: string | null
          state: string | null
          street: string | null
          stripe_customer_id: string | null
          subscription_status: string
          trial_ends_at: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          ambiente_fiscal?: string | null
          certificado_cnpj?: string | null
          certificado_digital_nome?: string | null
          certificado_digital_url?: string | null
          certificado_digital_validade?: string | null
          certificado_emissor?: string | null
          certificado_serial?: string | null
          certificado_status?: string | null
          certificado_ultima_verificacao?: string | null
          city?: string | null
          cnpj?: string | null
          codigo_municipio_ibge?: string | null
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
          phone?: string | null
          primary_color?: string | null
          regime_tributario?: string | null
          secondary_color?: string | null
          state?: string | null
          street?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          ambiente_fiscal?: string | null
          certificado_cnpj?: string | null
          certificado_digital_nome?: string | null
          certificado_digital_url?: string | null
          certificado_digital_validade?: string | null
          certificado_emissor?: string | null
          certificado_serial?: string | null
          certificado_status?: string | null
          certificado_ultima_verificacao?: string | null
          city?: string | null
          cnpj?: string | null
          codigo_municipio_ibge?: string | null
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
          phone?: string | null
          primary_color?: string | null
          regime_tributario?: string | null
          secondary_color?: string | null
          state?: string | null
          street?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      company_cash: {
        Row: {
          company_id: string
          created_at: string
          current_balance: number
          fixed_fund: number
          id: string
          last_movement_at: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_balance?: number
          fixed_fund?: number
          id?: string
          last_movement_at?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_balance?: number
          fixed_fund?: number
          id?: string
          last_movement_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_cash_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_cash_movements: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          cash_register_id: string | null
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          cash_register_id?: string | null
          category: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          cash_register_id?: string | null
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_cash_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_document_sequences: {
        Row: {
          company_id: string
          document_type: string
          last_value: number
          updated_at: string | null
          year: number
        }
        Insert: {
          company_id: string
          document_type: string
          last_value?: number
          updated_at?: string | null
          year: number
        }
        Update: {
          company_id?: string
          document_type?: string
          last_value?: number
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_document_sequences_company_id_fkey"
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
        Relationships: [
          {
            foreignKeyName: "company_enabled_linhas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_enabled_linhas_linha_slug_fkey"
            columns: ["linha_slug"]
            isOneToOne: false
            referencedRelation: "product_linhas"
            referencedColumns: ["slug"]
          },
        ]
      }
      company_folga_settings: {
        Row: {
          company_id: string
          created_at: string
          folga_altura: number
          folga_largura: number
          id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          folga_altura?: number
          folga_largura?: number
          id?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          folga_altura?: number
          folga_largura?: number
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_folga_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_item_color_prices: {
        Row: {
          color_name: string
          company_id: string
          cost_per_meter: number | null
          created_at: string
          id: string
          item_template_id: string
          price_per_meter: number | null
          updated_at: string
        }
        Insert: {
          color_name: string
          company_id: string
          cost_per_meter?: number | null
          created_at?: string
          id?: string
          item_template_id: string
          price_per_meter?: number | null
          updated_at?: string
        }
        Update: {
          color_name?: string
          company_id?: string
          cost_per_meter?: number | null
          created_at?: string
          id?: string
          item_template_id?: string
          price_per_meter?: number | null
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
          description: string | null
          glass_color: string | null
          glass_thickness: string | null
          glass_type_detail: string | null
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
          sale_margin_percent: number | null
          sale_price: number | null
          sale_price_per_bar: number | null
          sale_price_per_kg: number | null
          sale_price_per_meter: number | null
          specifications: Json | null
          thickness_mm: number | null
          type: string
          unit: string
          updated_at: string
          weight_kg: number | null
          weight_per_meter: number | null
        }
        Insert: {
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
          description?: string | null
          glass_color?: string | null
          glass_thickness?: string | null
          glass_type_detail?: string | null
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
          sale_margin_percent?: number | null
          sale_price?: number | null
          sale_price_per_bar?: number | null
          sale_price_per_kg?: number | null
          sale_price_per_meter?: number | null
          specifications?: Json | null
          thickness_mm?: number | null
          type?: string
          unit?: string
          updated_at?: string
          weight_kg?: number | null
          weight_per_meter?: number | null
        }
        Update: {
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
          description?: string | null
          glass_color?: string | null
          glass_thickness?: string | null
          glass_type_detail?: string | null
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
          sale_margin_percent?: number | null
          sale_price?: number | null
          sale_price_per_bar?: number | null
          sale_price_per_kg?: number | null
          sale_price_per_meter?: number | null
          specifications?: Json | null
          thickness_mm?: number | null
          type?: string
          unit?: string
          updated_at?: string
          weight_kg?: number | null
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
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
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
          id: string
          metadata: Json
          new_role: string | null
          old_role: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          metadata?: Json
          new_role?: string | null
          old_role?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          new_role?: string | null
          old_role?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      company_notification_settings: {
        Row: {
          company_id: string
          created_at: string | null
          daily_digest: boolean | null
          email_expense_due: boolean | null
          email_low_stock: boolean | null
          email_new_quote: boolean | null
          email_order_status: boolean | null
          email_payment_received: boolean | null
          email_quote_approved: boolean | null
          id: string
          notify_expense_alerts: boolean | null
          notify_low_stock: boolean | null
          notify_overdue_orders: boolean | null
          notify_overdue_receivables: boolean | null
          notify_pending_quotes: boolean | null
          notify_quote_expiring: boolean | null
          updated_at: string | null
          weekly_report: boolean | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          daily_digest?: boolean | null
          email_expense_due?: boolean | null
          email_low_stock?: boolean | null
          email_new_quote?: boolean | null
          email_order_status?: boolean | null
          email_payment_received?: boolean | null
          email_quote_approved?: boolean | null
          id?: string
          notify_expense_alerts?: boolean | null
          notify_low_stock?: boolean | null
          notify_overdue_orders?: boolean | null
          notify_overdue_receivables?: boolean | null
          notify_pending_quotes?: boolean | null
          notify_quote_expiring?: boolean | null
          updated_at?: string | null
          weekly_report?: boolean | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          daily_digest?: boolean | null
          email_expense_due?: boolean | null
          email_low_stock?: boolean | null
          email_new_quote?: boolean | null
          email_order_status?: boolean | null
          email_payment_received?: boolean | null
          email_quote_approved?: boolean | null
          id?: string
          notify_expense_alerts?: boolean | null
          notify_low_stock?: boolean | null
          notify_overdue_orders?: boolean | null
          notify_overdue_receivables?: boolean | null
          notify_pending_quotes?: boolean | null
          notify_quote_expiring?: boolean | null
          updated_at?: string | null
          weekly_report?: boolean | null
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
          action_taken: boolean | null
          company_id: string
          created_at: string | null
          from_user_id: string
          id: string
          is_read: boolean | null
          message: string | null
          metadata: Json | null
          title: string
          to_role: string
          type: string
          updated_at: string | null
        }
        Insert: {
          action_at?: string | null
          action_by?: string | null
          action_taken?: boolean | null
          company_id: string
          created_at?: string | null
          from_user_id: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          metadata?: Json | null
          title: string
          to_role: string
          type: string
          updated_at?: string | null
        }
        Update: {
          action_at?: string | null
          action_by?: string | null
          action_taken?: boolean | null
          company_id?: string
          created_at?: string | null
          from_user_id?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          metadata?: Json | null
          title?: string
          to_role?: string
          type?: string
          updated_at?: string | null
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
          company_id: string
          created_at: string
          custom_conditions: string | null
          display_mode: string
          id: string
          payment_methods: Json
          show_fees_to_customer: boolean
          show_installments: boolean | null
          show_other_methods: boolean | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          custom_conditions?: string | null
          display_mode?: string
          id?: string
          payment_methods?: Json
          show_fees_to_customer?: boolean
          show_installments?: boolean | null
          show_other_methods?: boolean | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          custom_conditions?: string | null
          display_mode?: string
          id?: string
          payment_methods?: Json
          show_fees_to_customer?: boolean
          show_installments?: boolean | null
          show_other_methods?: boolean | null
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
        ]
      }
      company_product_items: {
        Row: {
          applies_to: string | null
          calculation_type: string | null
          company_id: string | null
          company_item_id: string | null
          company_product_id: string
          created_at: string | null
          cut_angle: number | null
          cut_angle_end: number | null
          cut_angle_start: number | null
          height_formula: string | null
          id: string
          is_optional: boolean | null
          item_template_id: string | null
          loss_percent: number | null
          notes: string | null
          pieces_formula: string | null
          pieces_quantity: number | null
          quantity_formula: string
          section: string | null
          side: string | null
          sort_order: number | null
          updated_at: string | null
          width_formula: string | null
        }
        Insert: {
          applies_to?: string | null
          calculation_type?: string | null
          company_id?: string | null
          company_item_id?: string | null
          company_product_id: string
          created_at?: string | null
          cut_angle?: number | null
          cut_angle_end?: number | null
          cut_angle_start?: number | null
          height_formula?: string | null
          id?: string
          is_optional?: boolean | null
          item_template_id?: string | null
          loss_percent?: number | null
          notes?: string | null
          pieces_formula?: string | null
          pieces_quantity?: number | null
          quantity_formula?: string
          section?: string | null
          side?: string | null
          sort_order?: number | null
          updated_at?: string | null
          width_formula?: string | null
        }
        Update: {
          applies_to?: string | null
          calculation_type?: string | null
          company_id?: string | null
          company_item_id?: string | null
          company_product_id?: string
          created_at?: string | null
          cut_angle?: number | null
          cut_angle_end?: number | null
          cut_angle_start?: number | null
          height_formula?: string | null
          id?: string
          is_optional?: boolean | null
          item_template_id?: string | null
          loss_percent?: number | null
          notes?: string | null
          pieces_formula?: string | null
          pieces_quantity?: number | null
          quantity_formula?: string
          section?: string | null
          side?: string | null
          sort_order?: number | null
          updated_at?: string | null
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
      company_product_price_lines: {
        Row: {
          attributes: Json
          color: string | null
          company_id: string
          company_product_id: string
          cost: number | null
          created_at: string
          description: string
          glass_type: string | null
          id: string
          is_active: boolean
          price: number
          sort_order: number
          thickness_mm: number | null
          unit: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          color?: string | null
          company_id: string
          company_product_id: string
          cost?: number | null
          created_at?: string
          description: string
          glass_type?: string | null
          id?: string
          is_active?: boolean
          price?: number
          sort_order?: number
          thickness_mm?: number | null
          unit?: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          color?: string | null
          company_id?: string
          company_product_id?: string
          cost?: number | null
          created_at?: string
          description?: string
          glass_type?: string | null
          id?: string
          is_active?: boolean
          price?: number
          sort_order?: number
          thickness_mm?: number | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_product_price_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_product_price_lines_product_company_fkey"
            columns: ["company_product_id", "company_id"]
            isOneToOne: false
            referencedRelation: "company_products"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      company_products: {
        Row: {
          acabamento: string | null
          arremate: string | null
          base_price: number | null
          category: string | null
          commercial_name: string
          company_id: string
          contramarco: string | null
          cor_componentes: string | null
          corte_contramarco: string | null
          cost_per_sqm: number | null
          created_at: string
          customized_at: string | null
          description: string | null
          glasses_count: number | null
          has_multiple_sides: boolean | null
          id: string
          image_url: string | null
          is_active: boolean
          is_custom: boolean | null
          leaves_count: number | null
          linha: string | null
          margin_percent: number | null
          max_height: number | null
          max_width: number | null
          min_height: number | null
          min_width: number | null
          overridden_fields: Json
          panels_count: number | null
          price_per_sqm: number | null
          pricing_type: string
          product_template_id: string | null
          reforco: string | null
          sides_count: number | null
          updated_at: string
          uses_glass: boolean | null
        }
        Insert: {
          acabamento?: string | null
          arremate?: string | null
          base_price?: number | null
          category?: string | null
          commercial_name: string
          company_id: string
          contramarco?: string | null
          cor_componentes?: string | null
          corte_contramarco?: string | null
          cost_per_sqm?: number | null
          created_at?: string
          customized_at?: string | null
          description?: string | null
          glasses_count?: number | null
          has_multiple_sides?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean | null
          leaves_count?: number | null
          linha?: string | null
          margin_percent?: number | null
          max_height?: number | null
          max_width?: number | null
          min_height?: number | null
          min_width?: number | null
          overridden_fields?: Json
          panels_count?: number | null
          price_per_sqm?: number | null
          pricing_type?: string
          product_template_id?: string | null
          reforco?: string | null
          sides_count?: number | null
          updated_at?: string
          uses_glass?: boolean | null
        }
        Update: {
          acabamento?: string | null
          arremate?: string | null
          base_price?: number | null
          category?: string | null
          commercial_name?: string
          company_id?: string
          contramarco?: string | null
          cor_componentes?: string | null
          corte_contramarco?: string | null
          cost_per_sqm?: number | null
          created_at?: string
          customized_at?: string | null
          description?: string | null
          glasses_count?: number | null
          has_multiple_sides?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean | null
          leaves_count?: number | null
          linha?: string | null
          margin_percent?: number | null
          max_height?: number | null
          max_width?: number | null
          min_height?: number | null
          min_width?: number | null
          overridden_fields?: Json
          panels_count?: number | null
          price_per_sqm?: number | null
          pricing_type?: string
          product_template_id?: string | null
          reforco?: string | null
          sides_count?: number | null
          updated_at?: string
          uses_glass?: boolean | null
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
      company_sales_goals: {
        Row: {
          company_id: string
          created_at: string
          goal_amount: number
          id: string
          month: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          goal_amount?: number
          id?: string
          month: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          goal_amount?: number
          id?: string
          month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_sales_goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_security_settings: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          lockout_duration_minutes: number | null
          max_login_attempts: number | null
          password_expiry_days: number | null
          require_strong_password: boolean | null
          session_timeout_minutes: number | null
          two_factor_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          lockout_duration_minutes?: number | null
          max_login_attempts?: number | null
          password_expiry_days?: number | null
          require_strong_password?: boolean | null
          session_timeout_minutes?: number | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          lockout_duration_minutes?: number | null
          max_login_attempts?: number | null
          password_expiry_days?: number | null
          require_strong_password?: boolean | null
          session_timeout_minutes?: number | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
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
          company_id: string
          company_item_id: string | null
          created_at: string
          id: string
          is_active: boolean
          item_template_id: string | null
          location: string | null
          min_quantity: number | null
          quantity: number
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          allow_fractional?: boolean
          company_id: string
          company_item_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_template_id?: string | null
          location?: string | null
          min_quantity?: number | null
          quantity?: number
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          allow_fractional?: boolean
          company_id?: string
          company_item_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_template_id?: string | null
          location?: string | null
          min_quantity?: number | null
          quantity?: number
          supplier_name?: string | null
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
        ]
      }
      company_subscriptions: {
        Row: {
          cancelled_at: string | null
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          plan_name: string
          plan_price: number
          renewed_at: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan_name?: string
          plan_price?: number
          renewed_at?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan_name?: string
          plan_price?: number
          renewed_at?: string | null
          started_at?: string
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
          aluminum_color: string | null
          company_id: string
          cost_per_meter: number | null
          cost_per_sqm: number | null
          created_at: string
          glass_color: string | null
          id: string
          kind: string
          price_per_meter: number | null
          price_per_sqm: number | null
          thickness_mm: number | null
          updated_at: string
        }
        Insert: {
          aluminum_color?: string | null
          company_id: string
          cost_per_meter?: number | null
          cost_per_sqm?: number | null
          created_at?: string
          glass_color?: string | null
          id?: string
          kind: string
          price_per_meter?: number | null
          price_per_sqm?: number | null
          thickness_mm?: number | null
          updated_at?: string
        }
        Update: {
          aluminum_color?: string | null
          company_id?: string
          cost_per_meter?: number | null
          cost_per_sqm?: number | null
          created_at?: string
          glass_color?: string | null
          id?: string
          kind?: string
          price_per_meter?: number | null
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
      condicoes_pagamento: {
        Row: {
          company_id: string
          created_at: string
          desconto_percent: number
          dias_entre_parcelas: number
          forma_pagamento_id: string | null
          id: string
          is_active: boolean
          juros_percent: number
          nome: string
          parcelas: number
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          desconto_percent?: number
          dias_entre_parcelas?: number
          forma_pagamento_id?: string | null
          id?: string
          is_active?: boolean
          juros_percent?: number
          nome: string
          parcelas?: number
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          desconto_percent?: number
          dias_entre_parcelas?: number
          forma_pagamento_id?: string | null
          id?: string
          is_active?: boolean
          juros_percent?: number
          nome?: string
          parcelas?: number
          sort_order?: number | null
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
          commission_amount: number
          commission_percent: number
          company_id: string
          created_at: string | null
          employee_id: string
          id: string
          notes: string | null
          paid_at: string | null
          sale_amount: number
          sale_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          commission_amount?: number
          commission_percent?: number
          company_id: string
          created_at?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          sale_amount?: number
          sale_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          commission_amount?: number
          commission_percent?: number
          company_id?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          sale_amount?: number
          sale_id?: string
          status?: string
          updated_at?: string | null
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
            referencedRelation: "company_members_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_commissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
          created_at: string | null
          created_by: string | null
          email: string
          employee_id: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          email: string
          employee_id: string
          expires_at: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          email?: string
          employee_id?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
            referencedRelation: "company_members_view"
            referencedColumns: ["employee_id"]
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
      employee_permission_profiles: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          is_primary: boolean
          permission_profile_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          is_primary?: boolean
          permission_profile_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          is_primary?: boolean
          permission_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_permission_profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "company_members_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_permission_profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_permission_profiles_permission_profile_id_fkey"
            columns: ["permission_profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          admission_date: string | null
          commission_enabled: boolean | null
          commission_percent: number | null
          commission_trigger: string | null
          commission_type: string | null
          company_id: string
          created_at: string
          email: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          permission_profile_id: string | null
          phone: string | null
          photo_url: string | null
          role: string | null
          salary_payment_day: number | null
          specialty: string | null
          updated_at: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          admission_date?: string | null
          commission_enabled?: boolean | null
          commission_percent?: number | null
          commission_trigger?: string | null
          commission_type?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          permission_profile_id?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          salary_payment_day?: number | null
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          admission_date?: string | null
          commission_enabled?: boolean | null
          commission_percent?: number | null
          commission_trigger?: string | null
          commission_type?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          permission_profile_id?: string | null
          phone?: string | null
          photo_url?: string | null
          role?: string | null
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
          attachment_url: string | null
          bank_account_id: string | null
          category: string
          category_id: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string
          document_number: string | null
          due_date: string | null
          employee_id: string | null
          id: string
          installment_number: number
          is_auto_generated: boolean | null
          notes: string | null
          paid_amount: number | null
          paid_date: string | null
          parent_expense_id: string | null
          parent_payable_id: string | null
          payment_method: string | null
          recurrence: string | null
          recurrence_day: number | null
          status: string
          supplier_document: string | null
          supplier_name: string | null
          total_installments: number
          updated_at: string | null
        }
        Insert: {
          amount?: number
          attachment_url?: string | null
          bank_account_id?: string | null
          category: string
          category_id?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description: string
          document_number?: string | null
          due_date?: string | null
          employee_id?: string | null
          id?: string
          installment_number?: number
          is_auto_generated?: boolean | null
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          parent_expense_id?: string | null
          parent_payable_id?: string | null
          payment_method?: string | null
          recurrence?: string | null
          recurrence_day?: number | null
          status?: string
          supplier_document?: string | null
          supplier_name?: string | null
          total_installments?: number
          updated_at?: string | null
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          bank_account_id?: string | null
          category?: string
          category_id?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          document_number?: string | null
          due_date?: string | null
          employee_id?: string | null
          id?: string
          installment_number?: number
          is_auto_generated?: boolean | null
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          parent_expense_id?: string | null
          parent_payable_id?: string | null
          payment_method?: string | null
          recurrence?: string | null
          recurrence_day?: number | null
          status?: string
          supplier_document?: string | null
          supplier_name?: string | null
          total_installments?: number
          updated_at?: string | null
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
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "company_members_view"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_parent_expense_id_fkey"
            columns: ["parent_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_parent_payable_id_fkey"
            columns: ["parent_payable_id"]
            isOneToOne: false
            referencedRelation: "expenses"
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
          category?: string
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
      financial_audit_logs: {
        Row: {
          action: string
          changed_by: string | null
          company_id: string | null
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_audit_logs_company_id_fkey"
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
          dre_group: string
          icon: string | null
          id: string
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
          dre_group: string
          icon?: string | null
          id?: string
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
          dre_group?: string
          icon?: string | null
          id?: string
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
      financial_operation_keys: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          operation_key: string
          operation_type: string
          reference_id: string | null
          result: Json | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          operation_key: string
          operation_type: string
          reference_id?: string | null
          result?: Json | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          operation_key?: string
          operation_type?: string
          reference_id?: string | null
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_operation_keys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          company_id: string | null
          created_at: string | null
          id: string
          is_closed: boolean | null
          month: number
          year: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_closed?: boolean | null
          month: number
          year: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_closed?: boolean | null
          month?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          nome: string
          sort_order: number | null
          tipo: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          nome: string
          sort_order?: number | null
          tipo: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          nome?: string
          sort_order?: number | null
          tipo?: string
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
      glass_colors: {
        Row: {
          company_id: string
          created_at: string
          hex_color: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          hex_color?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          hex_color?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "glass_colors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      glass_line_formulas: {
        Row: {
          created_at: string
          description: string | null
          formula_name: string
          height_formula: string
          id: string
          is_active: boolean
          is_movable: boolean | null
          linha: string
          panel_index: number | null
          product_template_id: string | null
          side: string | null
          updated_at: string
          width_formula: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          formula_name: string
          height_formula?: string
          id?: string
          is_active?: boolean
          is_movable?: boolean | null
          linha: string
          panel_index?: number | null
          product_template_id?: string | null
          side?: string | null
          updated_at?: string
          width_formula?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          formula_name?: string
          height_formula?: string
          id?: string
          is_active?: boolean
          is_movable?: boolean | null
          linha?: string
          panel_index?: number | null
          product_template_id?: string | null
          side?: string | null
          updated_at?: string
          width_formula?: string
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
      glass_price_matrix: {
        Row: {
          company_id: string
          cost_per_sqm: number
          created_at: string
          glass_color_id: string
          glass_thickness_id: string
          glass_type_id: string
          id: string
          is_active: boolean
          price_per_sqm: number
          updated_at: string
        }
        Insert: {
          company_id: string
          cost_per_sqm?: number
          created_at?: string
          glass_color_id: string
          glass_thickness_id: string
          glass_type_id: string
          id?: string
          is_active?: boolean
          price_per_sqm?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          cost_per_sqm?: number
          created_at?: string
          glass_color_id?: string
          glass_thickness_id?: string
          glass_type_id?: string
          id?: string
          is_active?: boolean
          price_per_sqm?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "glass_price_matrix_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glass_price_matrix_glass_color_id_fkey"
            columns: ["glass_color_id"]
            isOneToOne: false
            referencedRelation: "glass_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glass_price_matrix_glass_thickness_id_fkey"
            columns: ["glass_thickness_id"]
            isOneToOne: false
            referencedRelation: "glass_thicknesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glass_price_matrix_glass_type_id_fkey"
            columns: ["glass_type_id"]
            isOneToOne: false
            referencedRelation: "glass_types"
            referencedColumns: ["id"]
          },
        ]
      }
      glass_projects: {
        Row: {
          company_id: string
          created_at: string
          id: string
          lock_height: number | null
          name: string
          notes: string | null
          panels: Json
          product_template_id: string | null
          quantity: number
          updated_at: string
          vao_height: number
          vao_width: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          lock_height?: number | null
          name: string
          notes?: string | null
          panels?: Json
          product_template_id?: string | null
          quantity?: number
          updated_at?: string
          vao_height: number
          vao_width: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          lock_height?: number | null
          name?: string
          notes?: string | null
          panels?: Json
          product_template_id?: string | null
          quantity?: number
          updated_at?: string
          vao_height?: number
          vao_width?: number
        }
        Relationships: [
          {
            foreignKeyName: "glass_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glass_projects_product_template_id_fkey"
            columns: ["product_template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      glass_thicknesses: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          thickness: string
          thickness_mm: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          thickness: string
          thickness_mm: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          thickness?: string
          thickness_mm?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "glass_thicknesses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      glass_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
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
          cost_per_meter: number | null
          created_at: string
          id: string
          item_template_id: string
          price_per_meter: number | null
          updated_at: string
        }
        Insert: {
          color_name: string
          cost_per_meter?: number | null
          created_at?: string
          id?: string
          item_template_id: string
          price_per_meter?: number | null
          updated_at?: string
        }
        Update: {
          color_name?: string
          cost_per_meter?: number | null
          created_at?: string
          id?: string
          item_template_id?: string
          price_per_meter?: number | null
          updated_at?: string
        }
        Relationships: [
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
          created_at: string
          default_cost: number | null
          default_formulas: Json | null
          default_price: number | null
          default_sale_price: number | null
          default_supplier: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          linha: string | null
          name: string
          ncm: string | null
          origem: string | null
          procurement_type: string | null
          specifications: Json | null
          type: Database["public"]["Enums"]["item_type"]
          unit: string
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
          created_at?: string
          default_cost?: number | null
          default_formulas?: Json | null
          default_price?: number | null
          default_sale_price?: number | null
          default_supplier?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          linha?: string | null
          name: string
          ncm?: string | null
          origem?: string | null
          procurement_type?: string | null
          specifications?: Json | null
          type: Database["public"]["Enums"]["item_type"]
          unit?: string
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
          created_at?: string
          default_cost?: number | null
          default_formulas?: Json | null
          default_price?: number | null
          default_sale_price?: number | null
          default_supplier?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          linha?: string | null
          name?: string
          ncm?: string | null
          origem?: string | null
          procurement_type?: string | null
          specifications?: Json | null
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string
          updated_at?: string
          weight_per_bar?: number | null
          weight_per_meter?: number | null
        }
        Relationships: []
      }
      item_types: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
          unit_default: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          unit_default?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          unit_default?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
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
          consumed_at: string | null
          created_at: string
          formula_used: string | null
          id: string
          input_height: number | null
          input_quantity: number | null
          input_width: number | null
          item_name: string
          item_template_id: string | null
          item_type: string
          ordem_servico_id: string
          os_item_id: string | null
          purchase_order_item_id: string | null
          quantity_calculated: number
          quote_item_id: string | null
          released_at: string | null
          status: string
          stock_movement_id: string | null
          stock_reservation_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          company_id: string
          company_item_id?: string | null
          consumed_at?: string | null
          created_at?: string
          formula_used?: string | null
          id?: string
          input_height?: number | null
          input_quantity?: number | null
          input_width?: number | null
          item_name: string
          item_template_id?: string | null
          item_type: string
          ordem_servico_id: string
          os_item_id?: string | null
          purchase_order_item_id?: string | null
          quantity_calculated?: number
          quote_item_id?: string | null
          released_at?: string | null
          status?: string
          stock_movement_id?: string | null
          stock_reservation_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          company_item_id?: string | null
          consumed_at?: string | null
          created_at?: string
          formula_used?: string | null
          id?: string
          input_height?: number | null
          input_quantity?: number | null
          input_width?: number | null
          item_name?: string
          item_template_id?: string | null
          item_type?: string
          ordem_servico_id?: string
          os_item_id?: string | null
          purchase_order_item_id?: string | null
          quantity_calculated?: number
          quote_item_id?: string | null
          released_at?: string | null
          status?: string
          stock_movement_id?: string | null
          stock_reservation_id?: string | null
          unit?: string
          updated_at?: string
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
            foreignKeyName: "material_consumption_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_os_item_id_fkey"
            columns: ["os_item_id"]
            isOneToOne: false
            referencedRelation: "os_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
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
          is_checked: boolean | null
          item_label: string
          measurement_id: string
          notes: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_checked?: boolean | null
          item_label: string
          measurement_id: string
          notes?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_checked?: boolean | null
          item_label?: string
          measurement_id?: string
          notes?: string | null
          sort_order?: number | null
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
          product_template_id: string | null
          quantity: number | null
          room: string | null
          sort_order: number | null
          suggested_product: string | null
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
          product_template_id?: string | null
          quantity?: number | null
          room?: string | null
          sort_order?: number | null
          suggested_product?: string | null
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
          product_template_id?: string | null
          quantity?: number | null
          room?: string | null
          sort_order?: number | null
          suggested_product?: string | null
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
          {
            foreignKeyName: "measurement_items_product_template_id_fkey"
            columns: ["product_template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          measurement_id: string
          measurement_item_id: string | null
          photo_type: string | null
          photo_url: string
          sort_order: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          measurement_id: string
          measurement_item_id?: string | null
          photo_type?: string | null
          photo_url: string
          sort_order?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          measurement_id?: string
          measurement_item_id?: string | null
          photo_type?: string | null
          photo_url?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_photos_measurement_id_fkey"
            columns: ["measurement_id"]
            isOneToOne: false
            referencedRelation: "site_measurements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_photos_measurement_item_id_fkey"
            columns: ["measurement_item_id"]
            isOneToOne: false
            referencedRelation: "measurement_items"
            referencedColumns: ["id"]
          },
        ]
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
      operator_discrepancies: {
        Row: {
          amount: number
          cash_register_id: string
          company_id: string
          compensated_amount: number | null
          compensated_at: string | null
          compensated_in_register_id: string | null
          created_at: string
          discrepancy_type: string
          id: string
          notes: string | null
          operator_id: string | null
          status: string
        }
        Insert: {
          amount: number
          cash_register_id: string
          company_id: string
          compensated_amount?: number | null
          compensated_at?: string | null
          compensated_in_register_id?: string | null
          created_at?: string
          discrepancy_type: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          cash_register_id?: string
          company_id?: string
          compensated_amount?: number | null
          compensated_at?: string | null
          compensated_in_register_id?: string | null
          created_at?: string
          discrepancy_type?: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_discrepancies_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_discrepancies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_discrepancies_compensated_in_register_id_fkey"
            columns: ["compensated_in_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
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
          completed_at: string | null
          completed_by: string | null
          created_at: string
          cuts_data: Json
          glass_cuts_data: Json | null
          id: string
          item_status: Json | null
          ordem_servico_id: string
          os_item_id: string | null
          product_name: string
          product_template_id: string | null
          quantity: number
          quote_item_id: string | null
          status: string
          vao_height: number
          vao_height_b: number | null
          vao_width: number
          vao_width_b: number | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          cuts_data?: Json
          glass_cuts_data?: Json | null
          id?: string
          item_status?: Json | null
          ordem_servico_id: string
          os_item_id?: string | null
          product_name: string
          product_template_id?: string | null
          quantity?: number
          quote_item_id?: string | null
          status?: string
          vao_height: number
          vao_height_b?: number | null
          vao_width: number
          vao_width_b?: number | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          cuts_data?: Json
          glass_cuts_data?: Json | null
          id?: string
          item_status?: Json | null
          ordem_servico_id?: string
          os_item_id?: string | null
          product_name?: string
          product_template_id?: string | null
          quantity?: number
          quote_item_id?: string | null
          status?: string
          vao_height?: number
          vao_height_b?: number | null
          vao_width?: number
          vao_width_b?: number | null
        }
        Relationships: [
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
          {
            foreignKeyName: "os_cutting_plan_product_template_id_fkey"
            columns: ["product_template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_cutting_plan_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
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
          created_at: string
          glass_color: string | null
          glass_type: string | null
          id: string
          material_origin: string | null
          ordem_servico_id: string
          os_item_id: string | null
          panels_data: Json
          procurement_status: string | null
          product_name: string
          product_template_id: string | null
          purchase_actual_cost: number | null
          purchase_order_item_id: string | null
          purchase_quantity_needed: number | null
          quantity: number
          quote_item_id: string | null
          stock_item_id: string | null
          stock_quantity_used: number | null
          stock_unit_cost: number | null
          total_area_m2: number | null
          vao_height: number
          vao_height_b: number | null
          vao_width: number
          vao_width_b: number | null
        }
        Insert: {
          created_at?: string
          glass_color?: string | null
          glass_type?: string | null
          id?: string
          material_origin?: string | null
          ordem_servico_id: string
          os_item_id?: string | null
          panels_data?: Json
          procurement_status?: string | null
          product_name: string
          product_template_id?: string | null
          purchase_actual_cost?: number | null
          purchase_order_item_id?: string | null
          purchase_quantity_needed?: number | null
          quantity?: number
          quote_item_id?: string | null
          stock_item_id?: string | null
          stock_quantity_used?: number | null
          stock_unit_cost?: number | null
          total_area_m2?: number | null
          vao_height: number
          vao_height_b?: number | null
          vao_width: number
          vao_width_b?: number | null
        }
        Update: {
          created_at?: string
          glass_color?: string | null
          glass_type?: string | null
          id?: string
          material_origin?: string | null
          ordem_servico_id?: string
          os_item_id?: string | null
          panels_data?: Json
          procurement_status?: string | null
          product_name?: string
          product_template_id?: string | null
          purchase_actual_cost?: number | null
          purchase_order_item_id?: string | null
          purchase_quantity_needed?: number | null
          quantity?: number
          quote_item_id?: string | null
          stock_item_id?: string | null
          stock_quantity_used?: number | null
          stock_unit_cost?: number | null
          total_area_m2?: number | null
          vao_height?: number
          vao_height_b?: number | null
          vao_width?: number
          vao_width_b?: number | null
        }
        Relationships: [
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
          {
            foreignKeyName: "os_glass_projects_product_template_id_fkey"
            columns: ["product_template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_glass_projects_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_glass_projects_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_glass_projects_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id"]
          },
        ]
      }
      os_items: {
        Row: {
          altura_producao: number | null
          altura_producao_b: number | null
          altura_producao_c: number | null
          altura_venda: number | null
          altura_venda_b: number | null
          altura_venda_c: number | null
          created_at: string
          height_production: number
          height_production_b: number | null
          height_sold: number
          height_sold_b: number | null
          id: string
          largura_producao: number | null
          largura_producao_b: number | null
          largura_producao_c: number | null
          largura_venda: number | null
          largura_venda_b: number | null
          largura_venda_c: number | null
          last_recalculated_at: string | null
          os_id: string
          product_id: string | null
          product_name: string
          quantity: number
          quote_item_id: string | null
          recalculation_required: boolean | null
          technical_notes: string | null
          updated_at: string
          width_production: number
          width_production_b: number | null
          width_sold: number
          width_sold_b: number | null
        }
        Insert: {
          altura_producao?: number | null
          altura_producao_b?: number | null
          altura_producao_c?: number | null
          altura_venda?: number | null
          altura_venda_b?: number | null
          altura_venda_c?: number | null
          created_at?: string
          height_production: number
          height_production_b?: number | null
          height_sold: number
          height_sold_b?: number | null
          id?: string
          largura_producao?: number | null
          largura_producao_b?: number | null
          largura_producao_c?: number | null
          largura_venda?: number | null
          largura_venda_b?: number | null
          largura_venda_c?: number | null
          last_recalculated_at?: string | null
          os_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          quote_item_id?: string | null
          recalculation_required?: boolean | null
          technical_notes?: string | null
          updated_at?: string
          width_production: number
          width_production_b?: number | null
          width_sold: number
          width_sold_b?: number | null
        }
        Update: {
          altura_producao?: number | null
          altura_producao_b?: number | null
          altura_producao_c?: number | null
          altura_venda?: number | null
          altura_venda_b?: number | null
          altura_venda_c?: number | null
          created_at?: string
          height_production?: number
          height_production_b?: number | null
          height_sold?: number
          height_sold_b?: number | null
          id?: string
          largura_producao?: number | null
          largura_producao_b?: number | null
          largura_producao_c?: number | null
          largura_venda?: number | null
          largura_venda_b?: number | null
          largura_venda_c?: number | null
          last_recalculated_at?: string | null
          os_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          quote_item_id?: string | null
          recalculation_required?: boolean | null
          technical_notes?: string | null
          updated_at?: string
          width_production?: number
          width_production_b?: number | null
          width_sold?: number
          width_sold_b?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "os_items_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
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
          created_at: string
          cut_length_mm: number | null
          id: string
          item_name: string
          item_template_id: string | null
          item_type: string
          notes: string | null
          ordem_servico_id: string
          os_item_id: string | null
          pieces_count: number
          procurement_status: string | null
          purchase_order_item_id: string | null
          total_length_mm: number | null
          unit: string | null
          vao_height_b: number | null
          vao_width_b: number | null
          waste_mm: number | null
          waste_percent: number | null
        }
        Insert: {
          bar_length_mm?: number | null
          bars_needed?: number | null
          created_at?: string
          cut_length_mm?: number | null
          id?: string
          item_name: string
          item_template_id?: string | null
          item_type: string
          notes?: string | null
          ordem_servico_id: string
          os_item_id?: string | null
          pieces_count?: number
          procurement_status?: string | null
          purchase_order_item_id?: string | null
          total_length_mm?: number | null
          unit?: string | null
          vao_height_b?: number | null
          vao_width_b?: number | null
          waste_mm?: number | null
          waste_percent?: number | null
        }
        Update: {
          bar_length_mm?: number | null
          bars_needed?: number | null
          created_at?: string
          cut_length_mm?: number | null
          id?: string
          item_name?: string
          item_template_id?: string | null
          item_type?: string
          notes?: string | null
          ordem_servico_id?: string
          os_item_id?: string | null
          pieces_count?: number
          procurement_status?: string | null
          purchase_order_item_id?: string | null
          total_length_mm?: number | null
          unit?: string | null
          vao_height_b?: number | null
          vao_width_b?: number | null
          waste_mm?: number | null
          waste_percent?: number | null
        }
        Relationships: [
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
          {
            foreignKeyName: "os_materials_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      os_photos: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          id: string
          ordem_servico_id: string
          photo_type: string | null
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          id?: string
          ordem_servico_id: string
          photo_type?: string | null
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          id?: string
          ordem_servico_id?: string
          photo_type?: string | null
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
          can_approve_discounts: boolean | null
          can_approve_refunds: boolean | null
          can_cancel_sales: boolean | null
          can_manage_stock: boolean | null
          can_operate_cash: boolean | null
          can_view_reports: boolean | null
          company_id: string
          created_at: string | null
          description: string | null
          hide_costs: boolean | null
          hide_prices: boolean | null
          id: string
          is_system: boolean | null
          name: string
          permissions: Json
          profile_type: Database["public"]["Enums"]["permission_profile_type"]
          updated_at: string | null
        }
        Insert: {
          can_approve_discounts?: boolean | null
          can_approve_refunds?: boolean | null
          can_cancel_sales?: boolean | null
          can_manage_stock?: boolean | null
          can_operate_cash?: boolean | null
          can_view_reports?: boolean | null
          company_id: string
          created_at?: string | null
          description?: string | null
          hide_costs?: boolean | null
          hide_prices?: boolean | null
          id?: string
          is_system?: boolean | null
          name: string
          permissions?: Json
          profile_type?: Database["public"]["Enums"]["permission_profile_type"]
          updated_at?: string | null
        }
        Update: {
          can_approve_discounts?: boolean | null
          can_approve_refunds?: boolean | null
          can_cancel_sales?: boolean | null
          can_manage_stock?: boolean | null
          can_operate_cash?: boolean | null
          can_view_reports?: boolean | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          hide_costs?: boolean | null
          hide_prices?: boolean | null
          id?: string
          is_system?: boolean | null
          name?: string
          permissions?: Json
          profile_type?: Database["public"]["Enums"]["permission_profile_type"]
          updated_at?: string | null
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
      pricing_policies: {
        Row: {
          admin_fee: number
          commission_percent: number
          company_id: string
          created_at: string
          default_loss_percent: number
          default_margin: number
          id: string
          include_commission: boolean
          include_installation: boolean
          include_labor: boolean
          include_packaging: boolean
          include_tax: boolean
          include_transport: boolean
          installation_cost_per_sqm: number
          labor_cost_per_sqm: number
          margin_type: string
          packaging_cost_per_unit: number
          price_decimals: number
          rounding_mode: string
          tax_percent: number
          transport_cost_per_unit: number
          updated_at: string
        }
        Insert: {
          admin_fee?: number
          commission_percent?: number
          company_id: string
          created_at?: string
          default_loss_percent?: number
          default_margin?: number
          id?: string
          include_commission?: boolean
          include_installation?: boolean
          include_labor?: boolean
          include_packaging?: boolean
          include_tax?: boolean
          include_transport?: boolean
          installation_cost_per_sqm?: number
          labor_cost_per_sqm?: number
          margin_type?: string
          packaging_cost_per_unit?: number
          price_decimals?: number
          rounding_mode?: string
          tax_percent?: number
          transport_cost_per_unit?: number
          updated_at?: string
        }
        Update: {
          admin_fee?: number
          commission_percent?: number
          company_id?: string
          created_at?: string
          default_loss_percent?: number
          default_margin?: number
          id?: string
          include_commission?: boolean
          include_installation?: boolean
          include_labor?: boolean
          include_packaging?: boolean
          include_tax?: boolean
          include_transport?: boolean
          installation_cost_per_sqm?: number
          labor_cost_per_sqm?: number
          margin_type?: string
          packaging_cost_per_unit?: number
          price_decimals?: number
          rounding_mode?: string
          tax_percent?: number
          transport_cost_per_unit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_aluminum_prices: {
        Row: {
          color_name: string
          company_product_id: string
          cost_per_meter: number | null
          cost_per_sqm: number
          created_at: string
          id: string
          is_active: boolean
          price_per_meter: number | null
          price_per_sqm: number
          updated_at: string
        }
        Insert: {
          color_name: string
          company_product_id: string
          cost_per_meter?: number | null
          cost_per_sqm?: number
          created_at?: string
          id?: string
          is_active?: boolean
          price_per_meter?: number | null
          price_per_sqm?: number
          updated_at?: string
        }
        Update: {
          color_name?: string
          company_product_id?: string
          cost_per_meter?: number | null
          cost_per_sqm?: number
          created_at?: string
          id?: string
          is_active?: boolean
          price_per_meter?: number | null
          price_per_sqm?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_aluminum_prices_company_product_id_fkey"
            columns: ["company_product_id"]
            isOneToOne: false
            referencedRelation: "company_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      product_glass_prices: {
        Row: {
          company_product_id: string
          cost_per_sqm: number
          created_at: string | null
          glass_color: string | null
          glass_type: string
          id: string
          is_active: boolean | null
          price_per_sqm: number
          thickness_mm: number
          updated_at: string | null
        }
        Insert: {
          company_product_id: string
          cost_per_sqm?: number
          created_at?: string | null
          glass_color?: string | null
          glass_type: string
          id?: string
          is_active?: boolean | null
          price_per_sqm?: number
          thickness_mm: number
          updated_at?: string | null
        }
        Update: {
          company_product_id?: string
          cost_per_sqm?: number
          created_at?: string | null
          glass_color?: string | null
          glass_type?: string
          id?: string
          is_active?: boolean | null
          price_per_sqm?: number
          thickness_mm?: number
          updated_at?: string | null
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
          color: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      product_template_items: {
        Row: {
          applies_to: string | null
          calculation_type: string | null
          company_id: string | null
          created_at: string
          cut_angle: number
          cut_angle_end: number | null
          cut_angle_start: number | null
          height_formula: string | null
          id: string
          is_optional: boolean
          item_template_id: string
          loss_percent: number | null
          notes: string | null
          parent_item_id: string | null
          pieces_formula: string | null
          pieces_quantity: number
          product_template_id: string
          quantity_formula: string
          section: string | null
          side: string | null
          width_formula: string | null
        }
        Insert: {
          applies_to?: string | null
          calculation_type?: string | null
          company_id?: string | null
          created_at?: string
          cut_angle?: number
          cut_angle_end?: number | null
          cut_angle_start?: number | null
          height_formula?: string | null
          id?: string
          is_optional?: boolean
          item_template_id: string
          loss_percent?: number | null
          notes?: string | null
          parent_item_id?: string | null
          pieces_formula?: string | null
          pieces_quantity?: number
          product_template_id: string
          quantity_formula?: string
          section?: string | null
          side?: string | null
          width_formula?: string | null
        }
        Update: {
          applies_to?: string | null
          calculation_type?: string | null
          company_id?: string | null
          created_at?: string
          cut_angle?: number
          cut_angle_end?: number | null
          cut_angle_start?: number | null
          height_formula?: string | null
          id?: string
          is_optional?: boolean
          item_template_id?: string
          loss_percent?: number | null
          notes?: string | null
          parent_item_id?: string | null
          pieces_formula?: string | null
          pieces_quantity?: number
          product_template_id?: string
          quantity_formula?: string
          section?: string | null
          side?: string | null
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
            foreignKeyName: "product_template_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "product_template_items"
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
          acabamento: string | null
          aliquota_iss: number | null
          arremate: string | null
          base_price: number | null
          category: string
          cest: string | null
          cfop_venda: string | null
          cfop_venda_interestadual: string | null
          codigo_servico: string | null
          company_id: string | null
          contramarco: string | null
          cor_componentes: string | null
          corte_contramarco: string | null
          created_at: string
          default_glasses_count: number | null
          default_leaves_count: number | null
          default_panels_count: number | null
          default_sides_count: number | null
          description: string | null
          has_cutting_plan: boolean
          has_multiple_sides: boolean | null
          id: string
          image_url: string | null
          is_active: boolean
          linha: string | null
          max_height: number | null
          max_width: number | null
          min_height: number | null
          min_width: number | null
          name: string
          ncm: string | null
          origem: string | null
          parent_template_id: string | null
          reforco: string | null
          updated_at: string
        }
        Insert: {
          acabamento?: string | null
          aliquota_iss?: number | null
          arremate?: string | null
          base_price?: number | null
          category: string
          cest?: string | null
          cfop_venda?: string | null
          cfop_venda_interestadual?: string | null
          codigo_servico?: string | null
          company_id?: string | null
          contramarco?: string | null
          cor_componentes?: string | null
          corte_contramarco?: string | null
          created_at?: string
          default_glasses_count?: number | null
          default_leaves_count?: number | null
          default_panels_count?: number | null
          default_sides_count?: number | null
          description?: string | null
          has_cutting_plan?: boolean
          has_multiple_sides?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          linha?: string | null
          max_height?: number | null
          max_width?: number | null
          min_height?: number | null
          min_width?: number | null
          name: string
          ncm?: string | null
          origem?: string | null
          parent_template_id?: string | null
          reforco?: string | null
          updated_at?: string
        }
        Update: {
          acabamento?: string | null
          aliquota_iss?: number | null
          arremate?: string | null
          base_price?: number | null
          category?: string
          cest?: string | null
          cfop_venda?: string | null
          cfop_venda_interestadual?: string | null
          codigo_servico?: string | null
          company_id?: string | null
          contramarco?: string | null
          cor_componentes?: string | null
          corte_contramarco?: string | null
          created_at?: string
          default_glasses_count?: number | null
          default_leaves_count?: number | null
          default_panels_count?: number | null
          default_sides_count?: number | null
          description?: string | null
          has_cutting_plan?: boolean
          has_multiple_sides?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          linha?: string | null
          max_height?: number | null
          max_width?: number | null
          min_height?: number | null
          min_width?: number | null
          name?: string
          ncm?: string | null
          origem?: string | null
          parent_template_id?: string | null
          reforco?: string | null
          updated_at?: string
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
            foreignKeyName: "product_templates_parent_template_id_fkey"
            columns: ["parent_template_id"]
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
      purchase_order_items: {
        Row: {
          actual_cost: number | null
          created_at: string
          description: string
          estimated_cost: number
          height_mm: number | null
          id: string
          item_template_id: string | null
          notes: string | null
          os_glass_project_id: string | null
          os_material_id: string | null
          purchase_order_id: string
          quantity: number
          received_at: string | null
          received_quantity: number | null
          status: string
          unit: string
          updated_at: string
          width_mm: number | null
        }
        Insert: {
          actual_cost?: number | null
          created_at?: string
          description: string
          estimated_cost?: number
          height_mm?: number | null
          id?: string
          item_template_id?: string | null
          notes?: string | null
          os_glass_project_id?: string | null
          os_material_id?: string | null
          purchase_order_id: string
          quantity?: number
          received_at?: string | null
          received_quantity?: number | null
          status?: string
          unit?: string
          updated_at?: string
          width_mm?: number | null
        }
        Update: {
          actual_cost?: number | null
          created_at?: string
          description?: string
          estimated_cost?: number
          height_mm?: number | null
          id?: string
          item_template_id?: string | null
          notes?: string | null
          os_glass_project_id?: string | null
          os_material_id?: string | null
          purchase_order_id?: string
          quantity?: number
          received_at?: string | null
          received_quantity?: number | null
          status?: string
          unit?: string
          updated_at?: string
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_os_material_id_fkey"
            columns: ["os_material_id"]
            isOneToOne: false
            referencedRelation: "os_materials"
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
          expected_delivery: string | null
          id: string
          notes: string | null
          ordem_servico_id: string | null
          order_number: number
          received_at: string | null
          status: string
          supplier_name: string | null
          total_actual: number | null
          total_estimated: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          ordem_servico_id?: string | null
          order_number?: number
          received_at?: string | null
          status?: string
          supplier_name?: string | null
          total_actual?: number | null
          total_estimated?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          ordem_servico_id?: string | null
          order_number?: number
          received_at?: string | null
          status?: string
          supplier_name?: string | null
          total_actual?: number | null
          total_estimated?: number
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
            foreignKeyName: "purchase_orders_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_os_company_fkey"
            columns: ["ordem_servico_id", "company_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      quote_deposits: {
        Row: {
          amount: number
          cash_movement_id: string | null
          cash_register_id: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          ordem_servico_id: string | null
          payment_method: string | null
          quote_id: string
          received_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          cash_movement_id?: string | null
          cash_register_id?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          ordem_servico_id?: string | null
          payment_method?: string | null
          quote_id: string
          received_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          cash_movement_id?: string | null
          cash_register_id?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          ordem_servico_id?: string | null
          payment_method?: string | null
          quote_id?: string
          received_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_deposits_cash_movement_id_fkey"
            columns: ["cash_movement_id"]
            isOneToOne: false
            referencedRelation: "cash_movements"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "quote_deposits_ordem_servico_id_fkey"
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
          composition_snapshot: Json | null
          created_at: string
          description: string
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
          item_type: string | null
          leaves_count: number | null
          notes: string | null
          panels_count: number | null
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
          composition_snapshot?: Json | null
          created_at?: string
          description: string
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
          item_type?: string | null
          leaves_count?: number | null
          notes?: string | null
          panels_count?: number | null
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
          composition_snapshot?: Json | null
          created_at?: string
          description?: string
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
          item_type?: string | null
          leaves_count?: number | null
          notes?: string | null
          panels_count?: number | null
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
      quote_price_revisions: {
        Row: {
          created_at: string
          id: string
          preco_original: number
          preco_tabela_atual: number
          preco_usado: number
          quote_id: string
          quote_item_id: string
          usou_preco_atual: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          preco_original: number
          preco_tabela_atual: number
          preco_usado: number
          quote_id: string
          quote_item_id: string
          usou_preco_atual?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          preco_original?: number
          preco_tabela_atual?: number
          preco_usado?: number
          quote_id?: string
          quote_item_id?: string
          usou_preco_atual?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "quote_price_revisions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_financial_status"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "quote_price_revisions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_price_revisions_quote_item_id_fkey"
            columns: ["quote_item_id"]
            isOneToOne: false
            referencedRelation: "quote_items"
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
          created_at: string
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
          quote_number: number
          reajuste_aplicado: boolean | null
          show_m2_column: boolean
          show_measures_column: boolean
          status: string
          total_amount: number
          updated_at: string
          valid_until: string | null
          valor_final_aprovado: number | null
          valor_original: number | null
          valor_reajustado: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          company_id: string
          condicao_pagamento_id?: string | null
          created_at?: string
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
          quote_number?: number
          reajuste_aplicado?: boolean | null
          show_m2_column?: boolean
          show_measures_column?: boolean
          status?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          valor_final_aprovado?: number | null
          valor_original?: number | null
          valor_reajustado?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          company_id?: string
          condicao_pagamento_id?: string | null
          created_at?: string
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
          quote_number?: number
          reajuste_aplicado?: boolean | null
          show_m2_column?: boolean
          show_measures_column?: boolean
          status?: string
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          valor_final_aprovado?: number | null
          valor_original?: number | null
          valor_reajustado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_company_fkey"
            columns: ["client_id", "company_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_condicao_pagamento_id_fkey"
            columns: ["condicao_pagamento_id"]
            isOneToOne: false
            referencedRelation: "condicoes_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          company_id: string
          created_at: string | null
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          company_id: string
          created_at?: string | null
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          company_id?: string
          created_at?: string | null
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
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
          quantity: number
          sale_item_id: string
          source: string
          unit: string
        }
        Insert: {
          company_id: string
          company_item_id?: string | null
          created_at?: string
          id?: string
          item_name: string
          item_template_id?: string | null
          quantity: number
          sale_item_id: string
          source?: string
          unit: string
        }
        Update: {
          company_id?: string
          company_item_id?: string | null
          created_at?: string
          id?: string
          item_name?: string
          item_template_id?: string | null
          quantity?: number
          sale_item_id?: string
          source?: string
          unit?: string
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
          cash_register_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          customer_name: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          installments_count: number | null
          notes: string | null
          ordem_servico_id: string | null
          paid_amount: number | null
          parent_sale_id: string | null
          payment_method: string
          payment_status: string
          payment_type: string | null
          pending_amount: number | null
          quote_id: string | null
          remaining_amount: number | null
          sale_number: number
          sale_type: string | null
          sold_by: string
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          cash_register_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          customer_name?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          installments_count?: number | null
          notes?: string | null
          ordem_servico_id?: string | null
          paid_amount?: number | null
          parent_sale_id?: string | null
          payment_method: string
          payment_status?: string
          payment_type?: string | null
          pending_amount?: number | null
          quote_id?: string | null
          remaining_amount?: number | null
          sale_number?: number
          sale_type?: string | null
          sold_by: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cash_register_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          customer_name?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          installments_count?: number | null
          notes?: string | null
          ordem_servico_id?: string | null
          paid_amount?: number | null
          parent_sale_id?: string | null
          payment_method?: string
          payment_status?: string
          payment_type?: string | null
          pending_amount?: number | null
          quote_id?: string | null
          remaining_amount?: number | null
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
          all_day: boolean | null
          appointment_type: string
          assigned_to: string | null
          assigned_to_name: string | null
          client_id: string | null
          color: string | null
          company_id: string
          created_at: string
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          id: string
          notes: string | null
          ordem_servico_id: string | null
          quote_id: string | null
          scheduled_date: string
          scheduled_time_end: string | null
          scheduled_time_start: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean | null
          appointment_type?: string
          assigned_to?: string | null
          assigned_to_name?: string | null
          client_id?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          ordem_servico_id?: string | null
          quote_id?: string | null
          scheduled_date: string
          scheduled_time_end?: string | null
          scheduled_time_start?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean | null
          appointment_type?: string
          assigned_to?: string | null
          assigned_to_name?: string | null
          client_id?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          ordem_servico_id?: string | null
          quote_id?: string | null
          scheduled_date?: string
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
          appointment_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          id: string
          location_address: string | null
          location_name: string | null
          measured_at: string | null
          measured_by: string
          measured_by_name: string | null
          measurement_number: number
          notes: string | null
          observations: string | null
          ordem_servico_id: string | null
          quote_id: string | null
          room_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          location_address?: string | null
          location_name?: string | null
          measured_at?: string | null
          measured_by: string
          measured_by_name?: string | null
          measurement_number?: number
          notes?: string | null
          observations?: string | null
          ordem_servico_id?: string | null
          quote_id?: string | null
          room_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          location_address?: string | null
          location_name?: string | null
          measured_at?: string | null
          measured_by?: string
          measured_by_name?: string | null
          measurement_number?: number
          notes?: string | null
          observations?: string | null
          ordem_servico_id?: string | null
          quote_id?: string | null
          room_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_measurements_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "service_appointments"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "site_measurements_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_measurements_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_financial_status"
            referencedColumns: ["quote_id"]
          },
          {
            foreignKeyName: "site_measurements_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          cash_movement_id: string | null
          category: string
          company_id: string
          company_item_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expense_id: string | null
          id: string
          item_template_id: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          sale_id: string | null
          type: string
          unit_cost: number | null
          valor_financeiro: number
        }
        Insert: {
          cash_movement_id?: string | null
          category: string
          company_id: string
          company_item_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_id?: string | null
          id?: string
          item_template_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          sale_id?: string | null
          type: string
          unit_cost?: number | null
          valor_financeiro?: number
        }
        Update: {
          cash_movement_id?: string | null
          category?: string
          company_id?: string
          company_item_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_id?: string | null
          id?: string
          item_template_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          sale_id?: string | null
          type?: string
          unit_cost?: number | null
          valor_financeiro?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_cash_movement_id_fkey"
            columns: ["cash_movement_id"]
            isOneToOne: false
            referencedRelation: "cash_movements"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "stock_movements_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
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
            foreignKeyName: "stock_offcuts_company_item_company_fkey"
            columns: ["company_item_id", "company_id"]
            isOneToOne: false
            referencedRelation: "company_items"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "stock_offcuts_item_template_id_fkey"
            columns: ["item_template_id"]
            isOneToOne: false
            referencedRelation: "item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_offcuts_source_os_company_fkey"
            columns: ["source_os_id", "company_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          cancelled_at: string | null
          company_id: string
          company_item_id: string
          consumed_at: string | null
          created_at: string | null
          created_by: string | null
          id: string
          ordem_servico_id: string
          os_glass_project_id: string | null
          quantity_reserved: number
          reserved_at: string | null
          status: string | null
          unit: string
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          company_id: string
          company_item_id: string
          consumed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          ordem_servico_id: string
          os_glass_project_id?: string | null
          quantity_reserved: number
          reserved_at?: string | null
          status?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          company_id?: string
          company_item_id?: string
          consumed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          ordem_servico_id?: string
          os_glass_project_id?: string | null
          quantity_reserved?: number
          reserved_at?: string | null
          status?: string | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string | null
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
            foreignKeyName: "stock_reservations_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_os_glass_project_id_fkey"
            columns: ["os_glass_project_id"]
            isOneToOne: false
            referencedRelation: "os_glass_projects"
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
      system_module_settings: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_enabled: boolean | null
          module_key: string
          module_name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          module_key: string
          module_name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          module_key?: string
          module_name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_reminders: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          reference_id: string
          reference_table: string
          reminder_type: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          reference_id: string
          reference_table: string
          reminder_type: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          reference_id?: string
          reference_table?: string
          reminder_type?: string
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
      company_members_view: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          employee_email: string | null
          employee_id: string | null
          employee_name: string | null
          employee_phone: string | null
          employee_photo_url: string | null
          employee_specialty: string | null
          is_active: boolean | null
          joined_at: string | null
          permission_profile_id: string | null
          profile_name: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          user_company_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_permission_profile_id_fkey"
            columns: ["permission_profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
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
      activate_all_linhas_for_company: {
        Args: { _company_id: string }
        Returns: number
      }
      activate_all_products_for_company: {
        Args: { _company_id: string }
        Returns: number
      }
      activate_product_template_for_company: {
        Args: { _company_id: string; _product_template_id: string }
        Returns: string
      }
      approve_quote_transactional: {
        Args: {
          p_balance_due_date?: string
          p_card_net_amount?: number
          p_company_id: string
          p_condicao_pagamento_id?: string
          p_entry_amount?: number
          p_estimated_end?: string
          p_forma_pagamento_id?: string
          p_notes?: string
          p_payment_method?: string
          p_priority?: string
          p_quote_id: string
          p_total_amount: number
        }
        Returns: Json
      }
      pay_employee_commissions_transactional: {
        Args: {
          _cash_register_id: string
          _commission_ids: string[]
          _notes?: string
          _operation_key: string
        }
        Returns: Json
      }
      pay_expense_transactional: {
        Args: {
          _amount: number
          _bank_account_id: string | null
          _cash_register_id: string | null
          _expense_id: string
          _operation_key: string
          _paid_date?: string
          _payment_method: string
        }
        Returns: Json
      }
      receive_quote_deposit_transactional: {
        Args: {
          _cash_register_id: string
          _deposit_id: string
          _operation_key: string
          _payment_method: string
        }
        Returns: Json
      }
      receive_receivable_payment: {
        Args: {
          _amount: number
          _cash_register_id: string
          _operation_key: string
          _payment_method: string
          _receivable_id: string
        }
        Returns: Json
      }
      receive_sale_payment_transactional: {
        Args: {
          _amount: number
          _cash_register_id: string
          _operation_key: string
          _payment_method: string
          _sale_id: string
        }
        Returns: Json
      }
      register_cash_movement_transactional: {
        Args: {
          _amount: number
          _cash_register_id: string
          _category: string
          _cliente_id?: string
          _description: string
          _fornecedor_id?: string
          _funcionario_id?: string
          _operation_key: string
          _payment_method: string
          _quote_id?: string
          _type: string
        }
        Returns: Json
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
        Returns: number
      }
      can_open_daily_cash: {
        Args: { _company_id: string; _opening_amount: number }
        Returns: Json
      }
      can_user_open_cash: {
        Args: { _company_id: string; _user_id: string }
        Returns: Json
      }
      cancel_approved_quote: { Args: { _quote_id: string }; Returns: Json }
      phase2a_eval_formula: {
        Args: { p_formula: string; p_height: number; p_width: number }
        Returns: number
      }
      cancel_os_materials: {
        Args: { _ordem_servico_id: string }
        Returns: number
      }
      complete_os_production: {
        Args: {
          _cancelled_consumption_ids?: string[]
          _lines: Json
          _ordem_servico_id: string
        }
        Returns: Json
      }
      cancel_sale: {
        Args: {
          p_company_id: string
          p_reason: string
          p_sale_id: string
          p_user_id: string
        }
        Returns: Json
      }
      change_company_member_role: {
        Args: {
          _company_id: string
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: Json
      }
      check_employee_username_exists: {
        Args: { p_username: string }
        Returns: boolean
      }
      check_login_rate_limit: {
        Args: {
          _email: string
          _max_attempts?: number
          _window_minutes?: number
        }
        Returns: Json
      }
      cleanup_login_attempts: { Args: never; Returns: undefined }
      cleanup_old_logs: { Args: never; Returns: undefined }
      close_cash_register_direct: {
        Args: { _cash_register_id: string; _counts: Json; _notes?: string }
        Returns: Json
      }
      close_daily_cash: {
        Args: {
          _actual_amount: number
          _cash_register_id: string
          _notes?: string
          _user_id?: string
        }
        Returns: Json
      }
      close_daily_cash_multiuser: {
        Args: { _cash_register_id: string; _notes?: string }
        Returns: Json
      }
      compensate_advances_on_closing: {
        Args: {
          _cash_register_id: string
          _company_id: string
          _excess_amount: number
        }
        Returns: Json
      }
      create_company_and_assign_admin: {
        Args: {
          _address?: string
          _cnpj?: string
          _email?: string
          _name: string
          _phone?: string
        }
        Returns: {
          address: string | null
          address_number: string | null
          ambiente_fiscal: string | null
          certificado_cnpj: string | null
          certificado_digital_nome: string | null
          certificado_digital_url: string | null
          certificado_digital_validade: string | null
          certificado_emissor: string | null
          certificado_serial: string | null
          certificado_status: string | null
          certificado_ultima_verificacao: string | null
          city: string | null
          cnpj: string | null
          codigo_municipio_ibge: string | null
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
          phone: string | null
          primary_color: string | null
          regime_tributario: string | null
          secondary_color: string | null
          state: string | null
          street: string | null
          stripe_customer_id: string | null
          subscription_status: string
          trial_ends_at: string | null
          updated_at: string
          zip_code: string | null
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_company_item_from_template: {
        Args: {
          _company_id: string
          _cost?: number
          _item_template_id: string
          _sale_price?: number
        }
        Returns: string
      }
      create_custom_company_item: {
        Args: {
          _company_id: string
          _cost?: number
          _description?: string
          _linha?: string
          _name: string
          _sale_price?: number
          _type?: string
          _unit?: string
        }
        Returns: string
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
      create_default_permission_profiles: {
        Args: { _company_id: string }
        Returns: undefined
      }
      create_default_permissions: {
        Args: { _company_id: string }
        Returns: undefined
      }
      deactivate_company_member: {
        Args: { _company_id: string; _target_user_id: string }
        Returns: Json
      }
      distribute_product_template_to_all_companies: {
        Args: { _product_template_id: string }
        Returns: undefined
      }
      generate_next_recurring_expense: {
        Args: { expense_id: string }
        Returns: string
      }
      get_all_open_cash_registers: {
        Args: { _company_id: string }
        Returns: {
          current_balance: number
          id: string
          opened_at: string
          opened_by: string
          opened_by_name: string
          opening_amount: number
        }[]
      }
      get_available_stock: {
        Args: { _company_item_id: string }
        Returns: number
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
      get_company_daily_summary: {
        Args: { _company_id: string; _end_date?: string; _start_date?: string }
        Returns: {
          paid_revenue: number
          payment_method: string
          pending_revenue: number
          sale_date: string
          total_revenue: number
          total_sales: number
          unique_clients: number
        }[]
      }
      get_cutting_plan_items: {
        Args: { _company_id?: string; _template_id: string }
        Returns: {
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
      get_next_document_number: {
        Args: { p_company_id: string; p_document_type: string; p_year?: number }
        Returns: number
      }
      get_operator_pending_discrepancies: {
        Args: { _company_id: string; _operator_id: string }
        Returns: Json
      }
      get_os_material_availability: {
        Args: { _ordem_servico_id: string }
        Returns: Json
      }
      get_pending_advances_summary: {
        Args: { _company_id: string }
        Returns: Json
      }
      get_user_company_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_open_cash_register: {
        Args: { _company_id: string }
        Returns: {
          company_id: string
          id: string
          opened_at: string
          opened_by: string
          opening_amount: number
          status: string
        }[]
      }
      get_user_permission_profile: {
        Args: { _company_id: string; _user_id: string }
        Returns: {
          can_approve_discounts: boolean
          can_cancel_sales: boolean
          can_manage_stock: boolean
          can_operate_cash: boolean
          can_view_reports: boolean
          hide_costs: boolean
          hide_prices: boolean
          permissions: Json
          profile_id: string
          profile_name: string
          profile_type: Database["public"]["Enums"]["permission_profile_type"]
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      grant_saas_admin: { Args: { _email: string }; Returns: string }
      initialize_company_cash: {
        Args: {
          _company_id: string
          _fixed_fund?: number
          _initial_balance?: number
        }
        Returns: {
          company_id: string
          created_at: string
          current_balance: number
          fixed_fund: number
          id: string
          last_movement_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "company_cash"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      initialize_company_item_prices: {
        Args: { _company_id: string }
        Returns: undefined
      }
      initialize_glass_options_for_company: {
        Args: { _company_id: string }
        Returns: undefined
      }
      insert_login_attempt: {
        Args: {
          _email: string
          _ip_address?: string
          _success: boolean
          _user_agent?: string
        }
        Returns: undefined
      }
      is_financial_admin: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_module_enabled: { Args: { _module_key: string }; Returns: boolean }
      is_saas_admin: { Args: { _user_id: string }; Returns: boolean }
      list_cutting_plan_templates: {
        Args: { _category?: string; _linha?: string }
        Returns: {
          category: string
          id: string
          image_url: string
          linha: string
          name: string
        }[]
      }
      list_effective_product_templates: {
        Args: { _company_id: string }
        Returns: {
          acabamento: string | null
          aliquota_iss: number | null
          arremate: string | null
          base_price: number | null
          category: string
          cest: string | null
          cfop_venda: string | null
          cfop_venda_interestadual: string | null
          codigo_servico: string | null
          company_id: string | null
          contramarco: string | null
          cor_componentes: string | null
          corte_contramarco: string | null
          created_at: string
          default_glasses_count: number | null
          default_leaves_count: number | null
          default_panels_count: number | null
          default_sides_count: number | null
          description: string | null
          has_cutting_plan: boolean
          has_multiple_sides: boolean | null
          id: string
          image_url: string | null
          is_active: boolean
          linha: string | null
          max_height: number | null
          max_width: number | null
          min_height: number | null
          min_width: number | null
          name: string
          ncm: string | null
          origem: string | null
          parent_template_id: string | null
          reforco: string | null
          updated_at: string
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
          user_id: string
        }[]
      }
      list_schema_migrations: {
        Args: never
        Returns: {
          applied_at: string
          name: string
          preview: string
          statements_count: number
          version: string
        }[]
      }
      log_audit_event: {
        Args: {
          _action: string
          _company_id?: string
          _metadata?: Json
          _new_data?: Json
          _old_data?: Json
          _record_id?: string
          _table_name: string
        }
        Returns: undefined
      }
      mark_company_product_override: {
        Args: { p_company_product_id: string; p_field: string }
        Returns: undefined
      }
      normalize_text: { Args: { input_text: string }; Returns: string }
      open_daily_cash: {
        Args: { _company_id: string; _opening_amount: number; _user_id: string }
        Returns: Json
      }
      open_daily_cash_multiuser: {
        Args: { _company_id: string; _opening_amount: number; _user_id: string }
        Returns: Json
      }
      reactivate_company_member: {
        Args: { _company_id: string; _target_user_id: string }
        Returns: Json
      }
      receive_purchase_order_items: {
        Args: {
          _items: Json
          _purchase_order_id: string
          _total_actual?: number
        }
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
      refresh_daily_summary: { Args: never; Returns: undefined }
      register_cash_count: {
        Args: { _cash_register_id: string; _counts: Json }
        Returns: Json
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
          _cash_register_id?: string
          _category: string
          _company_id: string
          _description: string
          _reference_id?: string
          _reference_type?: string
          _type: string
        }
        Returns: {
          amount: number
          balance_after: number
          balance_before: number
          cash_register_id: string | null
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        SetofOptions: {
          from: "*"
          to: "company_cash_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_material_purchase: {
        Args: {
          _amount: number
          _cash_register_id: string
          _description: string
          _item_template_id?: string
          _quantity?: number
          _user_id?: string
        }
        Returns: Json
      }
      release_materials_for_production: {
        Args: { _ordem_servico_id: string }
        Returns: number
      }
      request_cash_reinforcement: {
        Args: {
          _cash_register_id: string
          _company_id: string
          _current_daily_balance: number
          _reason: string
          _required_amount: number
        }
        Returns: Json
      }
      reserve_os_materials: {
        Args: { _ordem_servico_id: string }
        Returns: Json
      }
      reset_company_product_field: {
        Args: { p_company_product_id: string; p_field: string }
        Returns: Json
      }
      reset_company_product_item: {
        Args: { p_company_product_item_id: string }
        Returns: Json
      }
      reset_company_product_to_template: {
        Args: { p_company_product_id: string; p_user_id: string }
        Returns: Json
      }
      reset_composition_item: { Args: { _item_id: string }; Returns: undefined }
      resolve_product_linha_slug: { Args: { _input: string }; Returns: string }
      revoke_saas_admin: { Args: { _user_id: string }; Returns: undefined }
      save_composition_item: {
        Args: { _company_id: string; _item_id: string; _patch: Json }
        Returns: string
      }
      seed_default_financial_categories: {
        Args: { _company_id: string }
        Returns: undefined
      }
      start_os_production: {
        Args: { _ordem_servico_id: string }
        Returns: Json
      }
      transfer_company_ownership: {
        Args: { _company_id: string; _new_admin_user_id: string }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_overdue_receivables: { Args: never; Returns: undefined }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_operate_cash: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_see_prices: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_elevated_role_in_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
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
      users_share_active_company: {
        Args: { _target_id: string; _viewer_id: string }
        Returns: boolean
      }
      validate_invite_token: { Args: { _token: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
      item_type: "glass" | "profile" | "accessory" | "service" | "sheet"
      permission_profile_type:
        | "admin"
        | "gerente"
        | "vendedor"
        | "caixa"
        | "almoxarifado"
        | "producao"
        | "instalador"
        | "financeiro"
        | "custom"
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
      item_type: ["glass", "profile", "accessory", "service", "sheet"],
      permission_profile_type: [
        "admin",
        "gerente",
        "vendedor",
        "caixa",
        "almoxarifado",
        "producao",
        "instalador",
        "financeiro",
        "custom",
      ],
    },
  },
} as const
