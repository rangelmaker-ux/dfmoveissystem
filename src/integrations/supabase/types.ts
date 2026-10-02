export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      commercial_documents: {
        Row: { id: string; user_id: string; client_id: string; data: Json; revision: number; updated_at: string };
        Insert: { id: string; user_id: string; client_id: string; data: Json; revision?: number };
        Update: { data?: Json; revision?: number };
        Relationships: [];
      };
      orcamento_workspace: {
        Row: { user_id: string; current_items: Json; saved_budgets: Json; settings: Json; materials: Json; catalog: Json; current_budget_id: string | null; updated_at: string; revision: number };
        Insert: { user_id: string; current_items?: Json; settings?: Json; current_budget_id?: string | null; revision?: number };
        Update: { current_items?: Json; settings?: Json; current_budget_id?: string | null; revision?: number };
        Relationships: [];
      };
      orcamento_catalog: {
        Row: { id: number; materials: Json; catalog: Json; revision: number; updated_at: string };
        Insert: { id?: number; materials: Json; catalog: Json; revision?: number };
        Update: { materials?: Json; catalog?: Json; revision?: number };
        Relationships: [];
      };
      orcamento_budgets: {
        Row: { id: string; user_id: string; client_id: string | null; projeto_id: string | null; data: Json; revision: number; updated_at: string };
        Insert: { id: string; user_id: string; client_id?: string | null; projeto_id?: string | null; data: Json; revision?: number };
        Update: { data?: Json; revision?: number };
        Relationships: [];
      };
      agendamentos: {
        Row: {
          cliente_id: string | null;
          created_at: string;
          criado_por: string;
          data_fim: string;
          data_inicio: string;
          descricao: string | null;
          id: string;
          status: string;
          tipo: string;
          titulo: string;
          updated_at: string;
          data_sugerida_inicio?: string | null;
          data_sugerida_fim?: string | null;
          motivo_alteracao?: string | null;
        };
        Insert: {
          cliente_id?: string | null;
          created_at?: string;
          criado_por: string;
          data_fim: string;
          data_inicio: string;
          descricao?: string | null;
          id?: string;
          status?: string;
          tipo?: string;
          titulo: string;
          updated_at?: string;
          data_sugerida_inicio?: string | null;
          data_sugerida_fim?: string | null;
          motivo_alteracao?: string | null;
        };
        Update: {
          cliente_id?: string | null;
          created_at?: string;
          criado_por?: string;
          data_fim?: string;
          data_inicio?: string;
          descricao?: string | null;
          id?: string;
          status?: string;
          tipo?: string;
          titulo?: string;
          updated_at?: string;
          data_sugerida_inicio?: string | null;
          data_sugerida_fim?: string | null;
          motivo_alteracao?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agendamentos_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      anotacoes_projeto: {
        Row: {
          autor_id: string;
          autor_nome: string;
          conteudo: string;
          created_at: string;
          id: string;
          projeto_id: string;
        };
        Insert: {
          autor_id: string;
          autor_nome: string;
          conteudo: string;
          created_at?: string;
          id?: string;
          projeto_id: string;
        };
        Update: {
          autor_id?: string;
          autor_nome?: string;
          conteudo?: string;
          created_at?: string;
          id?: string;
          projeto_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "anotacoes_projeto_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anotacoes_projeto_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
        ];
      };
      clientes: {
        Row: {
          created_at: string | null;
          email: string | null;
          endereco: string | null;
          id: string;
          nome: string;
          projetista_id: string | null;
          telefone: string | null;
        };
        Insert: {
          created_at?: string | null;
          email?: string | null;
          endereco?: string | null;
          id?: string;
          nome: string;
          projetista_id?: string | null;
          telefone?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string | null;
          endereco?: string | null;
          id?: string;
          nome?: string;
          projetista_id?: string | null;
          telefone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clientes_projetista_id_fkey";
            columns: ["projetista_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      comissoes: {
        Row: {
          created_at: string | null;
          id: string;
          mes_referencia: string;
          percentual: number;
          projetista_id: string;
          projeto_id: string;
          valor_calculado: number;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          mes_referencia: string;
          percentual: number;
          projetista_id: string;
          projeto_id: string;
          valor_calculado: number;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          mes_referencia?: string;
          percentual?: number;
          projetista_id?: string;
          projeto_id?: string;
          valor_calculado?: number;
        };
        Relationships: [
          {
            foreignKeyName: "comissoes_projetista_id_fkey";
            columns: ["projetista_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comissoes_projeto_id_fkey";
            columns: ["projeto_id"];
            isOneToOne: false;
            referencedRelation: "projetos";
            referencedColumns: ["id"];
          },
        ];
      };
      projetos: {
        Row: {
          arquivo_url: string | null;
          cliente_id: string;
          created_at: string | null;
          data_inicio: string;
          estagio_andamento: string;
          fonte: string | null;
          forma_pagamento: string | null;
          forma_pagamento_entrada: string | null;
          id: string;
          motivo_perda: string | null;
          nome: string | null;
          nome_arquiteto: string | null;
          numero_parcelas: number | null;
          observacoes: string | null;
          percentual_comissao: number | null;
          prazo_termino: string | null;
          projetista_id: string | null;
          rt_arquiteto: number | null;
          status: Database["public"]["Enums"]["project_status"];
          status_venda: Database["public"]["Enums"]["sale_status"];
          valor_entrada: number | null;
          valor_parcela: number | null;
          valor_venda: number | null;
        };
        Insert: {
          arquivo_url?: string | null;
          cliente_id: string;
          created_at?: string | null;
          data_inicio: string;
          estagio_andamento?: string;
          fonte?: string | null;
          forma_pagamento?: string | null;
          forma_pagamento_entrada?: string | null;
          id?: string;
          motivo_perda?: string | null;
          nome?: string | null;
          nome_arquiteto?: string | null;
          numero_parcelas?: number | null;
          observacoes?: string | null;
          percentual_comissao?: number | null;
          prazo_termino?: string | null;
          projetista_id?: string | null;
          rt_arquiteto?: number | null;
          status?: Database["public"]["Enums"]["project_status"];
          status_venda?: Database["public"]["Enums"]["sale_status"];
          valor_entrada?: number | null;
          valor_parcela?: number | null;
          valor_venda?: number | null;
        };
        Update: {
          arquivo_url?: string | null;
          cliente_id?: string;
          created_at?: string | null;
          data_inicio?: string;
          estagio_andamento?: string;
          fonte?: string | null;
          forma_pagamento?: string | null;
          forma_pagamento_entrada?: string | null;
          id?: string;
          motivo_perda?: string | null;
          nome?: string | null;
          nome_arquiteto?: string | null;
          numero_parcelas?: number | null;
          observacoes?: string | null;
          percentual_comissao?: number | null;
          prazo_termino?: string | null;
          projetista_id?: string | null;
          rt_arquiteto?: number | null;
          status?: Database["public"]["Enums"]["project_status"];
          status_venda?: Database["public"]["Enums"]["sale_status"];
          valor_entrada?: number | null;
          valor_parcela?: number | null;
          valor_venda?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "projetos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projetos_projetista_id_fkey";
            columns: ["projetista_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          auth_user_id: string | null;
          bio: string;
          approved_at: string | null;
          approved_by: string | null;
          avatar_url: string | null;
          created_at: string | null;
          email: string;
          id: string;
          nome: string;
          password: string | null;
          role: Database["public"]["Enums"]["user_role"];
          status: string;
        };
        Insert: {
          auth_user_id?: string | null;
          bio?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          email: string;
          id?: string;
          nome: string;
          password?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status?: string;
        };
        Update: {
          auth_user_id?: string | null;
          bio?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string;
          id?: string;
          nome?: string;
          password?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      save_commercial_document: { Args: { p_id: string; p_client_id: string; p_data: Json; p_revision: number | null }; Returns: number };
      save_budget_record: { Args: { p_id: string; p_data: Json; p_revision: number | null }; Returns: number };
      save_budget_workspace: { Args: { p_items: Json; p_settings: Json; p_budget_id: string | null; p_revision: number }; Returns: number };
      save_company_catalog: { Args: { p_materials: Json; p_catalog: Json; p_revision: number }; Returns: number };
      create_client_with_project: { Args: { p_client: Json; p_project: Json }; Returns: Json };
      assign_project: { Args: { p_project_id: string; p_designer_id: string; p_deadline: string }; Returns: undefined };
      admin_create_designer: {
        Args: {
          p_admin_id: string;
          p_admin_password: string;
          p_email: string;
          p_nome: string;
          p_password: string;
        };
        Returns: Json;
      };
      admin_delete_designer: {
        Args: {
          p_admin_id: string;
          p_admin_password: string;
          p_designer_id: string;
        };
        Returns: Json;
      };
      import_client_spreadsheet: {
        Args: {
          p_importing_user_id: string;
          p_rows: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      project_status:
        "PRONTO" | "EM_EXECUCAO" | "PAUSADO" | "ATRASADO" | "FINALIZADO" | "EM_ACOMPANHAMENTO";
      sale_status: "EM_NEGOCIACAO" | "VENDEU" | "NAO_VENDEU";
      user_role: "ADMIN" | "PROJETISTA";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      project_status: [
        "PRONTO",
        "EM_EXECUCAO",
        "PAUSADO",
        "ATRASADO",
        "FINALIZADO",
        "EM_ACOMPANHAMENTO",
      ],
      sale_status: ["EM_NEGOCIACAO", "VENDEU", "NAO_VENDEU"],
      user_role: ["ADMIN", "PROJETISTA"],
    },
  },
} as const;
