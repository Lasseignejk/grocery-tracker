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
      admin_users: {
        Row: {
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      api_logs: {
        Row: {
          completion_tokens: number | null
          created_at: string | null
          error_message: string | null
          estimated_cost: number | null
          finish_reason: string | null
          id: string
          items_enhanced: number | null
          items_parsed: number | null
          model: string | null
          parsing_successful: boolean | null
          prompt_tokens: number | null
          receipt_id: string | null
          response_text: string | null
          total_tokens: number | null
          user_id: string | null
          was_truncated: boolean | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          finish_reason?: string | null
          id?: string
          items_enhanced?: number | null
          items_parsed?: number | null
          model?: string | null
          parsing_successful?: boolean | null
          prompt_tokens?: number | null
          receipt_id?: string | null
          response_text?: string | null
          total_tokens?: number | null
          user_id?: string | null
          was_truncated?: boolean | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string | null
          error_message?: string | null
          estimated_cost?: number | null
          finish_reason?: string | null
          id?: string
          items_enhanced?: number | null
          items_parsed?: number | null
          model?: string | null
          parsing_successful?: boolean | null
          prompt_tokens?: number | null
          receipt_id?: string | null
          response_text?: string | null
          total_tokens?: number | null
          user_id?: string | null
          was_truncated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "api_logs_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      item_merge_rules: {
        Row: {
          created_at: string
          id: string
          match_brand: string | null
          match_generic_name: string | null
          match_receipt_text: string | null
          match_type: string
          match_variant: string | null
          target_brand: string | null
          target_generic_name: string | null
          target_item_name: string
          target_variant: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_brand?: string | null
          match_generic_name?: string | null
          match_receipt_text?: string | null
          match_type: string
          match_variant?: string | null
          target_brand?: string | null
          target_generic_name?: string | null
          target_item_name: string
          target_variant?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_brand?: string | null
          match_generic_name?: string | null
          match_receipt_text?: string | null
          match_type?: string
          match_variant?: string | null
          target_brand?: string | null
          target_generic_name?: string | null
          target_item_name?: string
          target_variant?: string | null
          user_id?: string
        }
        Relationships: []
      }
      receipt_items: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string
          generic_name: string | null
          id: string
          item_name: string
          quantity: number | null
          receipt_id: string | null
          receipt_text: string | null
          size: string | null
          total_price: number | null
          unit: string | null
          unit_price: number | null
          variant: string | null
          was_on_sale: boolean | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string
          generic_name?: string | null
          id?: string
          item_name: string
          quantity?: number | null
          receipt_id?: string | null
          receipt_text?: string | null
          size?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
          variant?: string | null
          was_on_sale?: boolean | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string
          generic_name?: string | null
          id?: string
          item_name?: string
          quantity?: number | null
          receipt_id?: string | null
          receipt_text?: string | null
          size?: string | null
          total_price?: number | null
          unit?: string | null
          unit_price?: number | null
          variant?: string | null
          was_on_sale?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          additional_image_urls: string[]
          created_at: string
          id: string
          image_url: string | null
          purchase_date: string | null
          raw_text: string | null
          store_name: string | null
          total_amount: number | null
          user_id: string | null
        }
        Insert: {
          additional_image_urls?: string[]
          created_at?: string
          id?: string
          image_url?: string | null
          purchase_date?: string | null
          raw_text?: string | null
          store_name?: string | null
          total_amount?: number | null
          user_id?: string | null
        }
        Update: {
          additional_image_urls?: string[]
          created_at?: string
          id?: string
          image_url?: string | null
          purchase_date?: string | null
          raw_text?: string | null
          store_name?: string | null
          total_amount?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      stores: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          normalized_name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          normalized_name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          normalized_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_gpt4o_cost: {
        Args: { input_tokens: number; output_tokens: number }
        Returns: number
      }
      merge_items: {
        Args: { remember_texts?: string[]; sources: Json; target: Json }
        Returns: number
      }
      normalize_store_name: { Args: { store_name: string }; Returns: string }
      normalize_text: { Args: { text_input: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
