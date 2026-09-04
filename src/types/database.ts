export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_sessions: {
        Row: {
          admin_account_id: string | null
          auth_user_id: string
          camp_id: string | null
          code_version: number | null
          created_at: string
          expires_at: string | null
          id: string
          member_id: string | null
          revoked_at: string | null
          revoked_reason: string | null
          surface: string
          updated_at: string
        }
        Insert: {
          admin_account_id?: string | null
          auth_user_id: string
          camp_id?: string | null
          code_version?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          member_id?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          surface: string
          updated_at?: string
        }
        Update: {
          admin_account_id?: string | null
          auth_user_id?: string
          camp_id?: string | null
          code_version?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          member_id?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          surface?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_sessions_admin_account_id_fkey"
            columns: ["admin_account_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_sessions_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_sessions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "camp_members"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          active: boolean
          camp_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          camp_id: string
          created_at?: string
          id?: string
          name: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          camp_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_rounds: {
        Row: {
          active: boolean
          activity_id: string
          created_at: string
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          activity_id: string
          created_at?: string
          id?: string
          label: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          activity_id?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_rounds_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_accounts: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          failed_pin_attempts: number
          id: string
          last_failed_at: string | null
          locked_until: string | null
          must_change_pin: boolean
          pin_hash: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          failed_pin_attempts?: number
          id?: string
          last_failed_at?: string | null
          locked_until?: string | null
          must_change_pin?: boolean
          pin_hash: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          failed_pin_attempts?: number
          id?: string
          last_failed_at?: string | null
          locked_until?: string | null
          must_change_pin?: boolean
          pin_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_admin_account_id: string | null
          actor_member_id: string | null
          after_data: Json | null
          before_data: Json | null
          camp_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_admin_account_id?: string | null
          actor_member_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          camp_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_admin_account_id?: string | null
          actor_member_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          camp_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_admin_account_id_fkey"
            columns: ["actor_admin_account_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_member_id_fkey"
            columns: ["actor_member_id"]
            isOneToOne: false
            referencedRelation: "camp_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_members: {
        Row: {
          active: boolean
          admin_account_id: string | null
          camp_id: string
          created_at: string
          display_name: string
          id: string
          role: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          admin_account_id?: string | null
          camp_id: string
          created_at?: string
          display_name: string
          id?: string
          role: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          admin_account_id?: string | null
          camp_id?: string
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camp_members_admin_account_id_fkey"
            columns: ["admin_account_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_members_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      camps: {
        Row: {
          camp_date: string
          closed_at: string | null
          code: string
          created_at: string
          created_by_admin_account_id: string | null
          distributed_amount: number
          id: string
          leaderboard_visible: boolean
          location_name: string | null
          name: string
          public_code_version: number
          public_leaderboard_code: string | null
          public_result_limit: number
          staff_code_version: number
          staff_join_code: string | null
          status: string
          total_budget: number
          updated_at: string
          warning_amount: number | null
          warning_percent: number | null
        }
        Insert: {
          camp_date: string
          closed_at?: string | null
          code: string
          created_at?: string
          created_by_admin_account_id?: string | null
          distributed_amount?: number
          id?: string
          leaderboard_visible?: boolean
          location_name?: string | null
          name: string
          public_code_version?: number
          public_leaderboard_code?: string | null
          public_result_limit?: number
          staff_code_version?: number
          staff_join_code?: string | null
          status?: string
          total_budget: number
          updated_at?: string
          warning_amount?: number | null
          warning_percent?: number | null
        }
        Update: {
          camp_date?: string
          closed_at?: string | null
          code?: string
          created_at?: string
          created_by_admin_account_id?: string | null
          distributed_amount?: number
          id?: string
          leaderboard_visible?: boolean
          location_name?: string | null
          name?: string
          public_code_version?: number
          public_leaderboard_code?: string | null
          public_result_limit?: number
          staff_code_version?: number
          staff_join_code?: string | null
          status?: string
          total_budget?: number
          updated_at?: string
          warning_amount?: number | null
          warning_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "camps_created_by_admin_account_id_fkey"
            columns: ["created_by_admin_account_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_actions: {
        Row: {
          action: string
          auth_user_id: string
          camp_id: string
          client_action_id: string
          completed_at: string | null
          created_at: string
          payload_hash: string
          result: Json | null
        }
        Insert: {
          action: string
          auth_user_id: string
          camp_id: string
          client_action_id: string
          completed_at?: string | null
          created_at?: string
          payload_hash: string
          result?: Json | null
        }
        Update: {
          action?: string
          auth_user_id?: string
          camp_id?: string
          client_action_id?: string
          completed_at?: string | null
          created_at?: string
          payload_hash?: string
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "client_actions_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      color_presets: {
        Row: {
          hex: string
          key: string
          name_th: string
          sort_order: number
          text_color: string
        }
        Insert: {
          hex: string
          key: string
          name_th: string
          sort_order: number
          text_color: string
        }
        Update: {
          hex?: string
          key?: string
          name_th?: string
          sort_order?: number
          text_color?: string
        }
        Relationships: []
      }
      groups: {
        Row: {
          active: boolean
          camp_id: string
          color_hex: string
          color_key: string
          color_name: string
          created_at: string
          current_score: number
          custom_name: string
          id: string
          score_reached_at: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          camp_id: string
          color_hex: string
          color_key: string
          color_name: string
          created_at?: string
          current_score?: number
          custom_name: string
          id?: string
          score_reached_at?: string | null
          sort_order: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          camp_id?: string
          color_hex?: string
          color_key?: string
          color_name?: string
          created_at?: string
          current_score?: number
          custom_name?: string
          id?: string
          score_reached_at?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_color_key_fkey"
            columns: ["color_key"]
            isOneToOne: false
            referencedRelation: "color_presets"
            referencedColumns: ["key"]
          },
        ]
      }
      score_buttons: {
        Row: {
          amount: number
          camp_id: string
          created_at: string
          enabled: boolean
          id: string
          label: string
          requires_confirmation: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount: number
          camp_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          label: string
          requires_confirmation?: boolean
          sort_order: number
          updated_at?: string
        }
        Update: {
          amount?: number
          camp_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string
          requires_confirmation?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_buttons_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          activity_id: string | null
          activity_name_snapshot: string | null
          actor_name_snapshot: string
          adjusts_transaction_id: string | null
          amount: number
          camp_id: string
          client_action_id: string
          created_at: string
          group_color_hex_snapshot: string
          group_color_name_snapshot: string
          group_custom_name_snapshot: string
          group_id: string
          id: string
          member_id: string
          reason: string | null
          reverses_transaction_id: string | null
          round_id: string | null
          round_label_snapshot: string | null
          score_button_id: string | null
          transaction_type: string
        }
        Insert: {
          activity_id?: string | null
          activity_name_snapshot?: string | null
          actor_name_snapshot: string
          adjusts_transaction_id?: string | null
          amount: number
          camp_id: string
          client_action_id: string
          created_at?: string
          group_color_hex_snapshot: string
          group_color_name_snapshot: string
          group_custom_name_snapshot: string
          group_id: string
          id?: string
          member_id: string
          reason?: string | null
          reverses_transaction_id?: string | null
          round_id?: string | null
          round_label_snapshot?: string | null
          score_button_id?: string | null
          transaction_type: string
        }
        Update: {
          activity_id?: string | null
          activity_name_snapshot?: string | null
          actor_name_snapshot?: string
          adjusts_transaction_id?: string | null
          amount?: number
          camp_id?: string
          client_action_id?: string
          created_at?: string
          group_color_hex_snapshot?: string
          group_color_name_snapshot?: string
          group_custom_name_snapshot?: string
          group_id?: string
          id?: string
          member_id?: string
          reason?: string | null
          reverses_transaction_id?: string | null
          round_id?: string | null
          round_label_snapshot?: string | null
          score_button_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_adjusts_transaction_id_fkey"
            columns: ["adjusts_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_action_id_fkey"
            columns: ["client_action_id"]
            isOneToOne: true
            referencedRelation: "client_actions"
            referencedColumns: ["client_action_id"]
          },
          {
            foreignKeyName: "transactions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "camp_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_reverses_transaction_id_fkey"
            columns: ["reverses_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "activity_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_score_button_id_fkey"
            columns: ["score_button_id"]
            isOneToOne: false
            referencedRelation: "score_buttons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_camp: { Args: { p_camp_id: string }; Returns: Json }
      add_admin_to_camp: {
        Args: {
          p_camp_id: string
          p_display_name: string
          p_temporary_pin: string
        }
        Returns: Json
      }
      add_staff_member: {
        Args: { p_camp_id: string; p_display_name: string }
        Returns: Json
      }
      admin_adjust_score: {
        Args: {
          p_adjusts_transaction_id: string
          p_amount: number
          p_camp_id: string
          p_client_action_id: string
          p_group_id: string
          p_reason: string
        }
        Returns: Json
      }
      apply_score_transaction: {
        Args: {
          p_activity_id: string
          p_camp_id: string
          p_client_action_id: string
          p_group_id: string
          p_round_id: string
          p_score_button_id: string
        }
        Returns: Json
      }
      bootstrap_first_admin: {
        Args: { p_display_name: string; p_temporary_pin: string }
        Returns: Json
      }
      change_admin_pin: {
        Args: { p_current_pin: string; p_new_pin: string }
        Returns: Json
      }
      close_camp: {
        Args: { p_camp_id: string; p_reason: string }
        Returns: Json
      }
      create_draft_camp: {
        Args: {
          p_camp_date: string
          p_location_name: string
          p_name: string
          p_total_budget: number
        }
        Returns: Json
      }
      get_admin_camp_snapshot: { Args: { p_camp_id: string }; Returns: Json }
      get_admin_camps: { Args: never; Returns: Json }
      get_admin_login_options: { Args: never; Returns: Json }
      get_audit_log: {
        Args: {
          p_before_created_at?: string
          p_before_id?: string
          p_camp_id: string
          p_limit?: number
        }
        Returns: Json
      }
      get_camp_snapshot: { Args: { p_camp_id: string }; Returns: Json }
      get_current_admin_session: { Args: never; Returns: Json }
      get_leaderboard_snapshot: { Args: { p_camp_id: string }; Returns: Json }
      get_staff_join_options: {
        Args: { p_staff_join_code: string }
        Returns: Json
      }
      get_transaction_history: {
        Args: {
          p_activity_id?: string
          p_before_created_at?: string
          p_before_id?: string
          p_camp_id: string
          p_group_id?: string
          p_limit?: number
          p_member_id?: string
          p_transaction_type?: string
        }
        Returns: Json
      }
      join_public_leaderboard: {
        Args: { p_public_code: string }
        Returns: Json
      }
      join_staff_camp: {
        Args: { p_member_id: string; p_staff_join_code: string }
        Returns: Json
      }
      login_admin: {
        Args: { p_admin_account_id: string; p_pin: string }
        Returns: Json
      }
      logout_admin: { Args: never; Returns: Json }
      quick_undo: {
        Args: {
          p_camp_id: string
          p_client_action_id: string
          p_transaction_id: string
        }
        Returns: Json
      }
      reset_admin_pin: {
        Args: {
          p_admin_account_id: string
          p_camp_id: string
          p_reason: string
          p_temporary_pin: string
        }
        Returns: Json
      }
      rotate_camp_access_code: {
        Args: { p_camp_id: string; p_reason: string; p_surface: string }
        Returns: Json
      }
      save_activity_configuration: {
        Args: { p_activities: Json; p_camp_id: string }
        Returns: Json
      }
      save_draft_setup: {
        Args: { p_camp_id: string; p_groups: Json; p_staff_names: string[] }
        Returns: Json
      }
      save_score_buttons: {
        Args: { p_buttons: Json; p_camp_id: string }
        Returns: Json
      }
      set_camp_member_active: {
        Args: { p_active: boolean; p_camp_id: string; p_member_id: string }
        Returns: Json
      }
      set_leaderboard_visibility: {
        Args: { p_camp_id: string; p_visible: boolean }
        Returns: Json
      }
      set_public_result_limit: {
        Args: { p_camp_id: string; p_limit: number }
        Returns: Json
      }
      update_camp_budget: {
        Args: {
          p_camp_id: string
          p_reason: string
          p_total_budget: number
          p_warning_amount: number
          p_warning_percent: number
        }
        Returns: Json
      }
      update_camp_details: {
        Args: {
          p_camp_date: string
          p_camp_id: string
          p_location_name: string
          p_name: string
        }
        Returns: Json
      }
      update_group_identity: {
        Args: {
          p_camp_id: string
          p_color_key: string
          p_custom_name: string
          p_group_id: string
        }
        Returns: Json
      }
      update_staff_group_name: {
        Args: { p_camp_id: string; p_custom_name: string; p_group_id: string }
        Returns: Json
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

