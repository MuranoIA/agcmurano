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
      clientes: {
        Row: {
          ciclo_medio_d: number | null
          codigo: string
          created_at: string
          dias_para_acao: number | null
          dias_sem_compra: number | null
          fat_total: number | null
          id: string
          mcc: number | null
          meses: Json
          meses_1a_compra: number | null
          n_pedidos: number | null
          nome: string
          objetivo_rs: number | null
          primeira_compra: string | null
          proxima_acao: string | null
          status: string | null
          tm_mes: number | null
          tm_pedido: number | null
          ultima_compra: string | null
          updated_at: string
          vendedor: string | null
        }
        Insert: {
          ciclo_medio_d?: number | null
          codigo: string
          created_at?: string
          dias_para_acao?: number | null
          dias_sem_compra?: number | null
          fat_total?: number | null
          id?: string
          mcc?: number | null
          meses?: Json
          meses_1a_compra?: number | null
          n_pedidos?: number | null
          nome: string
          objetivo_rs?: number | null
          primeira_compra?: string | null
          proxima_acao?: string | null
          status?: string | null
          tm_mes?: number | null
          tm_pedido?: number | null
          ultima_compra?: string | null
          updated_at?: string
          vendedor?: string | null
        }
        Update: {
          ciclo_medio_d?: number | null
          codigo?: string
          created_at?: string
          dias_para_acao?: number | null
          dias_sem_compra?: number | null
          fat_total?: number | null
          id?: string
          mcc?: number | null
          meses?: Json
          meses_1a_compra?: number | null
          n_pedidos?: number | null
          nome?: string
          objetivo_rs?: number | null
          primeira_compra?: string | null
          proxima_acao?: string | null
          status?: string | null
          tm_mes?: number | null
          tm_pedido?: number | null
          ultima_compra?: string | null
          updated_at?: string
          vendedor?: string | null
        }
        Relationships: []
      }
      overlay_valores_mes: {
        Row: {
          codigo: string
          created_at: string
          id: string
          mes: string
          valor: number
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          mes: string
          valor: number
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          mes?: string
          valor?: number
        }
        Relationships: []
      }
      overlay_vendedores: {
        Row: {
          codigo: string
          created_at: string
          id: string
          vendedor: string
        }
        Insert: {
          codigo: string
          created_at?: string
          id?: string
          vendedor: string
        }
        Update: {
          codigo?: string
          created_at?: string
          id?: string
          vendedor?: string
        }
        Relationships: []
      }
      overlay_visitas: {
        Row: {
          codigo: string
          created_at: string
          data: string
          hora: string
          id: string
          nome: string
          observacao: string | null
          teve_venda: boolean
          vendedor: string
        }
        Insert: {
          codigo: string
          created_at?: string
          data: string
          hora: string
          id?: string
          nome: string
          observacao?: string | null
          teve_venda?: boolean
          vendedor: string
        }
        Update: {
          codigo?: string
          created_at?: string
          data?: string
          hora?: string
          id?: string
          nome?: string
          observacao?: string | null
          teve_venda?: boolean
          vendedor?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
