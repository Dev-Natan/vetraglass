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
      accounts_receivable: {
        Row: {
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
            foreignKeyName: "accounts_receivable_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
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
            foreignKeyName: "accounts_receivable_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          cash_register_id: string
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          expense_id: string | null
          id: string
          origem: string | null
          payment_method: string | null
          receivable_id: string | null
          sale_id: string | null
          type: string
        }
        Insert: {
          amount: number
          cash_register_id: string
          category: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_id?: string | null
          id?: string
          origem?: string | null
          payment_method?: string | null
          receivable_id?: string | null
          sale_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          cash_register_id?: string
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_id?: string | null
          id?: string
          origem?: string | null
          payment_method?: string | null
          receivable_id?: string | null
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
            foreignKeyName: "cash_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
            foreignKeyName: "cash_register_advances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
      cash_registers: {
        Row: {
          actual_amount: number | null
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          closing_justification: string | null
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
          status: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          closing_justification?: string | null
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
          status?: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          closing_justification?: string | null
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
          {
            foreignKeyName: "cash_registers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          {
            foreignKeyName: "cash_shortages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          ambiente_fiscal: string | null
          certificado_cnpj: string | null
          certificado_digital_nome: string | null
          certificado_digital_url: string | null
          certificado_digital_validade: string | null
          certificado_emissor: string | null
          certificado_serial: string | null
          certificado_status: string | null
          certificado_ultima_verificacao: string | null
          cnpj: string
          codigo_municipio_ibge: string | null
          created_at: string
          email: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logo_size: number | null
          logo_url: string | null
          modo_fiscal_ativo: boolean
          name: string
          phone: string | null
          regime_tributario: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          ambiente_fiscal?: string | null
          certificado_cnpj?: string | null
          certificado_digital_nome?: string | null
          certificado_digital_url?: string | null
          certificado_digital_validade?: string | null
          certificado_emissor?: string | null
          certificado_serial?: string | null
          certificado_status?: string | null
          certificado_ultima_verificacao?: string | null
          cnpj: string
          codigo_municipio_ibge?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_size?: number | null
          logo_url?: string | null
          modo_fiscal_ativo?: boolean
          name: string
          phone?: string | null
          regime_tributario?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          ambiente_fiscal?: string | null
          certificado_cnpj?: string | null
          certificado_digital_nome?: string | null
          certificado_digital_url?: string | null
          certificado_digital_validade?: string | null
          certificado_emissor?: string | null
          certificado_serial?: string | null
          certificado_status?: string | null
          certificado_ultima_verificacao?: string | null
          cnpj?: string
          codigo_municipio_ibge?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logo_size?: number | null
          logo_url?: string | null
          modo_fiscal_ativo?: boolean
          name?: string
          phone?: string | null
          regime_tributario?: string | null
          updated_at?: string
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
          {
            foreignKeyName: "company_cash_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
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
          {
            foreignKeyName: "company_cash_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
            foreignKeyName: "company_item_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          company_id: string
          cost: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_custom: boolean
          item_template_id: string | null
          linha: string | null
          name: string
          sale_price: number | null
          specifications: Json | null
          type: string
          unit: string
          updated_at: string
        }
        Insert: {
          company_id: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean
          item_template_id?: string | null
          linha?: string | null
          name: string
          sale_price?: number | null
          specifications?: Json | null
          type?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean
          item_template_id?: string | null
          linha?: string | null
          name?: string
          sale_price?: number | null
          specifications?: Json | null
          type?: string
          unit?: string
          updated_at?: string
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
            foreignKeyName: "company_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          {
            foreignKeyName: "company_linhas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
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
          notify_pending_quotes: boolean | null
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
          notify_pending_quotes?: boolean | null
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
          notify_pending_quotes?: boolean | null
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
          {
            foreignKeyName: "company_notification_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
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
          {
            foreignKeyName: "company_payment_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      company_product_items: {
        Row: {
          company_item_id: string | null
          company_product_id: string
          created_at: string | null
          cut_angle: number | null
          height_formula: string | null
          id: string
          is_optional: boolean | null
          item_template_id: string | null
          notes: string | null
          pieces_quantity: number | null
          quantity_formula: string
          sort_order: number | null
          updated_at: string | null
          width_formula: string | null
        }
        Insert: {
          company_item_id?: string | null
          company_product_id: string
          created_at?: string | null
          cut_angle?: number | null
          height_formula?: string | null
          id?: string
          is_optional?: boolean | null
          item_template_id?: string | null
          notes?: string | null
          pieces_quantity?: number | null
          quantity_formula?: string
          sort_order?: number | null
          updated_at?: string | null
          width_formula?: string | null
        }
        Update: {
          company_item_id?: string | null
          company_product_id?: string
          created_at?: string | null
          cut_angle?: number | null
          height_formula?: string | null
          id?: string
          is_optional?: boolean | null
          item_template_id?: string | null
          notes?: string | null
          pieces_quantity?: number | null
          quantity_formula?: string
          sort_order?: number | null
          updated_at?: string | null
          width_formula?: string | null
        }
        Relationships: [
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
          base_price: number | null
          category: string | null
          commercial_name: string
          company_id: string
          cost_per_sqm: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_custom: boolean | null
          linha: string | null
          margin_percent: number | null
          max_height: number | null
          max_width: number | null
          min_height: number | null
          min_width: number | null
          price_per_sqm: number | null
          product_template_id: string | null
          updated_at: string
        }
        Insert: {
          base_price?: number | null
          category?: string | null
          commercial_name: string
          company_id: string
          cost_per_sqm?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean | null
          linha?: string | null
          margin_percent?: number | null
          max_height?: number | null
          max_width?: number | null
          min_height?: number | null
          min_width?: number | null
          price_per_sqm?: number | null
          product_template_id?: string | null
          updated_at?: string
        }
        Update: {
          base_price?: number | null
          category?: string | null
          commercial_name?: string
          company_id?: string
          cost_per_sqm?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean | null
          linha?: string | null
          margin_percent?: number | null
          max_height?: number | null
          max_width?: number | null
          min_height?: number | null
          min_width?: number | null
          price_per_sqm?: number | null
          product_template_id?: string | null
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
            foreignKeyName: "company_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          {
            foreignKeyName: "company_security_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
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
            foreignKeyName: "company_stock_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          {
            foreignKeyName: "company_tax_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies_safe"
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
            foreignKeyName: "employee_commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
            foreignKeyName: "employee_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          commission_enabled: boolean | null
          commission_percent: number | null
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
          role: string | null
          specialty: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          commission_enabled?: boolean | null
          commission_percent?: number | null
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
          role?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          commission_enabled?: boolean | null
          commission_percent?: number | null
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
          role?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string | null
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
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          category: string
          company_id: string
          created_at: string | null
          created_by: string | null
          description: string
          due_date: string | null
          employee_id: string | null
          id: string
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          recurrence: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          category: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          description: string
          due_date?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          recurrence?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string
          due_date?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          recurrence?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
            foreignKeyName: "glass_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          default_price: number | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          linha: string | null
          name: string
          ncm: string | null
          origem: string | null
          specifications: Json | null
          type: Database["public"]["Enums"]["item_type"]
          unit: string
          updated_at: string
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
          default_price?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          linha?: string | null
          name: string
          ncm?: string | null
          origem?: string | null
          specifications?: Json | null
          type: Database["public"]["Enums"]["item_type"]
          unit?: string
          updated_at?: string
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
          default_price?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          linha?: string | null
          name?: string
          ncm?: string | null
          origem?: string | null
          specifications?: Json | null
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string
          updated_at?: string
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
            foreignKeyName: "notas_fiscais_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
            foreignKeyName: "ordens_servico_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
      os_cutting_plan: {
        Row: {
          created_at: string
          cuts_data: Json
          glass_cuts_data: Json | null
          id: string
          ordem_servico_id: string
          product_name: string
          product_template_id: string | null
          quantity: number
          quote_item_id: string | null
          vao_height: number
          vao_width: number
        }
        Insert: {
          created_at?: string
          cuts_data?: Json
          glass_cuts_data?: Json | null
          id?: string
          ordem_servico_id: string
          product_name: string
          product_template_id?: string | null
          quantity?: number
          quote_item_id?: string | null
          vao_height: number
          vao_width: number
        }
        Update: {
          created_at?: string
          cuts_data?: Json
          glass_cuts_data?: Json | null
          id?: string
          ordem_servico_id?: string
          product_name?: string
          product_template_id?: string | null
          quantity?: number
          quote_item_id?: string | null
          vao_height?: number
          vao_width?: number
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
      os_glass_projects: {
        Row: {
          created_at: string
          glass_color: string | null
          glass_type: string | null
          id: string
          ordem_servico_id: string
          panels_data: Json
          product_name: string
          product_template_id: string | null
          quantity: number
          quote_item_id: string | null
          total_area_m2: number | null
          vao_height: number
          vao_width: number
        }
        Insert: {
          created_at?: string
          glass_color?: string | null
          glass_type?: string | null
          id?: string
          ordem_servico_id: string
          panels_data?: Json
          product_name: string
          product_template_id?: string | null
          quantity?: number
          quote_item_id?: string | null
          total_area_m2?: number | null
          vao_height: number
          vao_width: number
        }
        Update: {
          created_at?: string
          glass_color?: string | null
          glass_type?: string | null
          id?: string
          ordem_servico_id?: string
          panels_data?: Json
          product_name?: string
          product_template_id?: string | null
          quantity?: number
          quote_item_id?: string | null
          total_area_m2?: number | null
          vao_height?: number
          vao_width?: number
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
            foreignKeyName: "os_glass_projects_product_template_id_fkey"
            columns: ["product_template_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_glass_projects_quote_item_id_fkey"
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
          pieces_count: number
          total_length_mm: number | null
          unit: string | null
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
          pieces_count?: number
          total_length_mm?: number | null
          unit?: string | null
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
          pieces_count?: number
          total_length_mm?: number | null
          unit?: string | null
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
          {
            foreignKeyName: "permission_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
            foreignKeyName: "product_template_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          aliquota_iss: number | null
          base_price: number | null
          category: Database["public"]["Enums"]["product_category"]
          cest: string | null
          cfop_venda: string | null
          cfop_venda_interestadual: string | null
          codigo_servico: string | null
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
          ncm: string | null
          origem: string | null
          updated_at: string
        }
        Insert: {
          aliquota_iss?: number | null
          base_price?: number | null
          category: Database["public"]["Enums"]["product_category"]
          cest?: string | null
          cfop_venda?: string | null
          cfop_venda_interestadual?: string | null
          codigo_servico?: string | null
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
          ncm?: string | null
          origem?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_iss?: number | null
          base_price?: number | null
          category?: Database["public"]["Enums"]["product_category"]
          cest?: string | null
          cfop_venda?: string | null
          cfop_venda_interestadual?: string | null
          codigo_servico?: string | null
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
          ncm?: string | null
          origem?: string | null
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
            foreignKeyName: "quote_deposits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
          notes: string | null
          payment_terms: string | null
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
          id?: string
          notes?: string | null
          payment_terms?: string | null
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
          id?: string
          notes?: string | null
          payment_terms?: string | null
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
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          {
            foreignKeyName: "role_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
            foreignKeyName: "sale_taxes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          cash_register_id: string
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
          cash_register_id?: string
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
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
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
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
            foreignKeyName: "service_appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
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
            foreignKeyName: "service_appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
            foreignKeyName: "site_measurements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
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
            foreignKeyName: "site_measurements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          created_at: string
          created_by: string | null
          description: string | null
          expense_id: string | null
          id: string
          item_template_id: string | null
          quantity: number
          sale_id: string | null
          type: string
          unit_cost: number | null
          valor_financeiro: number
        }
        Insert: {
          cash_movement_id?: string | null
          category: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_id?: string | null
          id?: string
          item_template_id?: string | null
          quantity?: number
          sale_id?: string | null
          type: string
          unit_cost?: number | null
          valor_financeiro?: number
        }
        Update: {
          cash_movement_id?: string | null
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_id?: string | null
          id?: string
          item_template_id?: string | null
          quantity?: number
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
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          {
            foreignKeyName: "support_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          {
            foreignKeyName: "tax_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
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
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      clients_safe: {
        Row: {
          address: string | null
          city: string | null
          company_id: string | null
          created_at: string | null
          document: string | null
          document_type: string | null
          email: string | null
          id: string | null
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string | null
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: never
          city?: string | null
          company_id?: string | null
          created_at?: string | null
          document?: never
          document_type?: never
          email?: never
          id?: string | null
          is_active?: boolean | null
          latitude?: never
          longitude?: never
          name?: string | null
          notes?: string | null
          phone?: never
          state?: string | null
          updated_at?: string | null
          zip_code?: never
        }
        Update: {
          address?: never
          city?: string | null
          company_id?: string | null
          created_at?: string | null
          document?: never
          document_type?: never
          email?: never
          id?: string | null
          is_active?: boolean | null
          latitude?: never
          longitude?: never
          name?: string | null
          notes?: string | null
          phone?: never
          state?: string | null
          updated_at?: string | null
          zip_code?: never
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      companies_safe: {
        Row: {
          address: string | null
          ambiente_fiscal: string | null
          certificado_cnpj: string | null
          certificado_digital_nome: string | null
          certificado_digital_url: string | null
          certificado_digital_validade: string | null
          certificado_emissor: string | null
          certificado_serial: string | null
          certificado_status: string | null
          certificado_ultima_verificacao: string | null
          cnpj: string | null
          codigo_municipio_ibge: string | null
          created_at: string | null
          email: string | null
          id: string | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logo_size: number | null
          logo_url: string | null
          modo_fiscal_ativo: boolean | null
          name: string | null
          phone: string | null
          regime_tributario: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          ambiente_fiscal?: never
          certificado_cnpj?: never
          certificado_digital_nome?: never
          certificado_digital_url?: never
          certificado_digital_validade?: never
          certificado_emissor?: never
          certificado_serial?: never
          certificado_status?: never
          certificado_ultima_verificacao?: never
          cnpj?: string | null
          codigo_municipio_ibge?: never
          created_at?: string | null
          email?: string | null
          id?: string | null
          inscricao_estadual?: never
          inscricao_municipal?: never
          logo_size?: number | null
          logo_url?: string | null
          modo_fiscal_ativo?: boolean | null
          name?: string | null
          phone?: string | null
          regime_tributario?: never
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          ambiente_fiscal?: never
          certificado_cnpj?: never
          certificado_digital_nome?: never
          certificado_digital_url?: never
          certificado_digital_validade?: never
          certificado_emissor?: never
          certificado_serial?: never
          certificado_status?: never
          certificado_ultima_verificacao?: never
          cnpj?: string | null
          codigo_municipio_ibge?: never
          created_at?: string | null
          email?: string | null
          id?: string | null
          inscricao_estadual?: never
          inscricao_municipal?: never
          logo_size?: number | null
          logo_url?: string | null
          modo_fiscal_ativo?: boolean | null
          name?: string | null
          phone?: string | null
          regime_tributario?: never
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_employee_invite: {
        Args: { _token: string; _user_id: string }
        Returns: Json
      }
      activate_product_template_for_company: {
        Args: {
          _commercial_name?: string
          _company_id: string
          _product_template_id: string
        }
        Returns: {
          base_price: number | null
          category: string | null
          commercial_name: string
          company_id: string
          cost_per_sqm: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_custom: boolean | null
          linha: string | null
          margin_percent: number | null
          max_height: number | null
          max_width: number | null
          min_height: number | null
          min_width: number | null
          price_per_sqm: number | null
          product_template_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "company_products"
          isOneToOne: true
          isSetofReturn: false
        }
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
          _cnpj: string
          _email?: string
          _name: string
          _phone?: string
        }
        Returns: {
          address: string | null
          ambiente_fiscal: string | null
          certificado_cnpj: string | null
          certificado_digital_nome: string | null
          certificado_digital_url: string | null
          certificado_digital_validade: string | null
          certificado_emissor: string | null
          certificado_serial: string | null
          certificado_status: string | null
          certificado_ultima_verificacao: string | null
          cnpj: string
          codigo_municipio_ibge: string | null
          created_at: string
          email: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logo_size: number | null
          logo_url: string | null
          modo_fiscal_ativo: boolean
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
      create_default_permission_profiles: {
        Args: { _company_id: string }
        Returns: undefined
      }
      create_default_permissions: {
        Args: { _company_id: string }
        Returns: undefined
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
      insert_login_attempt: {
        Args: {
          _email: string
          _ip_address?: string
          _success: boolean
          _user_agent?: string
        }
        Returns: undefined
      }
      is_saas_admin: { Args: { _user_id: string }; Returns: boolean }
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
      normalize_text: { Args: { input_text: string }; Returns: string }
      open_daily_cash: {
        Args: { _company_id: string; _opening_amount: number; _user_id: string }
        Returns: Json
      }
      open_daily_cash_multiuser: {
        Args: { _company_id: string; _opening_amount: number; _user_id: string }
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
      reset_company_product_to_template: {
        Args: { p_company_product_id: string; p_user_id: string }
        Returns: Json
      }
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
      validate_invite_token: { Args: { _token: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
      item_type: "glass" | "profile" | "accessory" | "service"
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
