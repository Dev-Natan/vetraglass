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
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          login_token: string | null
          logo_url: string | null
          modo_fiscal_ativo: boolean
          name: string
          phone: string | null
          presentation_data: Json | null
          presentation_enabled: boolean
          presentation_template: string | null
          settings: Json
          stripe_customer_id: string | null
          subscription_plan: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string
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
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          login_token?: string | null
          logo_url?: string | null
          modo_fiscal_ativo?: boolean
          name: string
          phone?: string | null
          presentation_data?: Json | null
          presentation_enabled?: boolean
          presentation_template?: string | null
          settings?: Json
          stripe_customer_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
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
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          login_token?: string | null
          logo_url?: string | null
          modo_fiscal_ativo?: boolean
          name?: string
          phone?: string | null
          presentation_data?: Json | null
          presentation_enabled?: boolean
          presentation_template?: string | null
          settings?: Json
          stripe_customer_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
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
          altura_mm: number | null
          bar_length_mm: number | null
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
          weight_per_meter: number | null
        }
        Insert: {
          altura_mm?: number | null
          bar_length_mm?: number | null
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
          weight_per_meter?: number | null
        }
        Update: {
          altura_mm?: number | null
          bar_length_mm?: number | null
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
          base_price: number | null
          category: string | null
          commercial_name: string | null
          company_id: string
          company_item_id: string | null
          cost_per_sqm: number | null
          created_at: string
          description: string | null
          has_multiple_sides: boolean
          height_formula: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_custom: boolean
          item_template_id: string | null
          linha: string | null
          margin_percent: number | null
          name: string
          pending_amount: number | null
          pieces_formula: string | null
          pieces_quantity: number | null
          price_per_sqm: number | null
          pricing_type: string | null
          product_template_id: string | null
          quantity_formula: string | null
          side: string | null
          type: string | null
          unit: string | null
          updated_at: string
          uses_glass: boolean
          width_formula: string | null
        }
        Insert: {
          base_price?: number | null
          category?: string | null
          commercial_name?: string | null
          company_id: string
          company_item_id?: string | null
          cost_per_sqm?: number | null
          created_at?: string
          description?: string | null
          has_multiple_sides?: boolean
          height_formula?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean
          item_template_id?: string | null
          linha?: string | null
          margin_percent?: number | null
          name: string
          pending_amount?: number | null
          pieces_formula?: string | null
          pieces_quantity?: number | null
          price_per_sqm?: number | null
          pricing_type?: string | null
          product_template_id?: string | null
          quantity_formula?: string | null
          side?: string | null
          type?: string | null
          unit?: string | null
          updated_at?: string
          uses_glass?: boolean
          width_formula?: string | null
        }
        Update: {
          base_price?: number | null
          category?: string | null
          commercial_name?: string | null
          company_id?: string
          company_item_id?: string | null
          cost_per_sqm?: number | null
          created_at?: string
          description?: string | null
          has_multiple_sides?: boolean
          height_formula?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_custom?: boolean
          item_template_id?: string | null
          linha?: string | null
          margin_percent?: number | null
          name?: string
          pending_amount?: number | null
          pieces_formula?: string | null
          pieces_quantity?: number | null
          price_per_sqm?: number | null
          pricing_type?: string | null
          product_template_id?: string | null
          quantity_formula?: string | null
          side?: string | null
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
          id: string
          item_name: string | null
          item_template_id: string | null
          item_type: string | null
          name: string | null
          ordem_servico_id: string | null
          quantity: number | null
          quantity_calculated: number | null
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
          id?: string
          item_name?: string | null
          item_template_id?: string | null
          item_type?: string | null
          name?: string | null
          ordem_servico_id?: string | null
          quantity?: number | null
          quantity_calculated?: number | null
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
          id?: string
          item_name?: string | null
          item_template_id?: string | null
          item_type?: string | null
          name?: string | null
          ordem_servico_id?: string | null
          quantity?: number | null
          quantity_calculated?: number | null
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
      permission_profiles: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          permissions?: Json
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
          category: string | null
          company_id: string | null
          created_at: string
          default_glasses_count: number | null
          default_leaves_count: number | null
          default_panels_count: number | null
          default_sides_count: number | null
          description: string | null
          has_cutting_plan: boolean
          has_multiple_sides: boolean
          height_formula: string | null
          id: string
          image_url: string | null
          is_active: boolean
          linha: string | null
          name: string
          pieces_formula: string | null
          pieces_quantity: number | null
          product_template_id: string | null
          quantity_formula: string | null
          side: string | null
          type: string | null
          unit: string | null
          updated_at: string
          width_formula: string | null
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          default_glasses_count?: number | null
          default_leaves_count?: number | null
          default_panels_count?: number | null
          default_sides_count?: number | null
          description?: string | null
          has_cutting_plan?: boolean
          has_multiple_sides?: boolean
          height_formula?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          linha?: string | null
          name: string
          pieces_formula?: string | null
          pieces_quantity?: number | null
          product_template_id?: string | null
          quantity_formula?: string | null
          side?: string | null
          type?: string | null
          unit?: string | null
          updated_at?: string
          width_formula?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          default_glasses_count?: number | null
          default_leaves_count?: number | null
          default_panels_count?: number | null
          default_sides_count?: number | null
          description?: string | null
          has_cutting_plan?: boolean
          has_multiple_sides?: boolean
          height_formula?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          linha?: string | null
          name?: string
          pieces_formula?: string | null
          pieces_quantity?: number | null
          product_template_id?: string | null
          quantity_formula?: string | null
          side?: string | null
          type?: string | null
          unit?: string | null
          updated_at?: string
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
          id: string
          item_template_id: string | null
          name: string | null
          os_glass_project_id: string | null
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
        }
        Insert: {
          actual_cost?: number | null
          company_item_id?: string | null
          created_at?: string
          id?: string
          item_template_id?: string | null
          name?: string | null
          os_glass_project_id?: string | null
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
        }
        Update: {
          actual_cost?: number | null
          company_item_id?: string | null
          created_at?: string
          id?: string
          item_template_id?: string | null
          name?: string | null
          os_glass_project_id?: string | null
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
          order_number: string | null
          os_number: string | null
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
          order_number?: string | null
          os_number?: string | null
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
          order_number?: string | null
          os_number?: string | null
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
        ]
      }
      role_permissions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          module: string
          permissions: Json
          role: Database["public"]["Enums"]["company_role"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          module: string
          permissions?: Json
          role: Database["public"]["Enums"]["company_role"]
          updated_at?: string
        }
        Update: {
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
      system_module_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          module_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
    }
    Functions: {
      activate_product_template_for_company: {
        Args: { _company_id: string; _template_id: string }
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
      create_custom_product: {
        Args: {
          p_category?: string
          p_company_id: string
          p_linha?: string
          p_name: string
        }
        Returns: string
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_saas_admin: { Args: { _user_id: string }; Returns: boolean }
      list_effective_product_templates: {
        Args: { _company_id: string }
        Returns: {
          category: string | null
          company_id: string | null
          created_at: string
          default_glasses_count: number | null
          default_leaves_count: number | null
          default_panels_count: number | null
          default_sides_count: number | null
          description: string | null
          has_cutting_plan: boolean
          has_multiple_sides: boolean
          height_formula: string | null
          id: string
          image_url: string | null
          is_active: boolean
          linha: string | null
          name: string
          pieces_formula: string | null
          pieces_quantity: number | null
          product_template_id: string | null
          quantity_formula: string | null
          side: string | null
          type: string | null
          unit: string | null
          updated_at: string
          width_formula: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "product_templates"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reset_company_product_item: {
        Args: { _item_id: string }
        Returns: undefined
      }
      reset_company_product_to_template: {
        Args: { _company_product_id: string }
        Returns: undefined
      }
      reset_composition_item: { Args: { _item_id: string }; Returns: undefined }
      save_composition_item: { Args: { _data: Json }; Returns: string }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_role_in_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["company_role"]
      }
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
