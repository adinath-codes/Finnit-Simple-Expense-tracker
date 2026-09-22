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
      backend_events: {
        Row: {
          created_at: string
          estimated_cost_usd: number | null
          event: string
          id: string
          input_tokens: number | null
          metadata: Json
          model: string | null
          output_tokens: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost_usd?: number | null
          event: string
          id?: string
          input_tokens?: number | null
          metadata?: Json
          model?: string | null
          output_tokens?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost_usd?: number | null
          event?: string
          id?: string
          input_tokens?: number | null
          metadata?: Json
          model?: string | null
          output_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          sort_order: number
        }
        Insert: {
          id: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_rules: {
        Row: {
          category_id: string
          merchant_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          merchant_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          merchant_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      contexts: {
        Row: {
          id: string
          name: string
          normalized_name: string | null
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          normalized_name?: string | null
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          normalized_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          minor_digits: number
        }
        Insert: {
          code: string
          minor_digits: number
        }
        Update: {
          code?: string
          minor_digits?: number
        }
        Relationships: []
      }
      entry_contexts: {
        Row: {
          context_id: string
          entry_id: string
          user_id: string
        }
        Insert: {
          context_id: string
          entry_id: string
          user_id: string
        }
        Update: {
          context_id?: string
          entry_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_contexts_user_id_context_id_fkey"
            columns: ["user_id", "context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "entry_contexts_user_id_entry_id_fkey"
            columns: ["user_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      entry_people: {
        Row: {
          entry_id: string
          person_id: string
          user_id: string
        }
        Insert: {
          entry_id: string
          person_id: string
          user_id: string
        }
        Update: {
          entry_id?: string
          person_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_people_user_id_entry_id_fkey"
            columns: ["user_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "entry_people_user_id_person_id_fkey"
            columns: ["user_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      extraction_audits: {
        Row: {
          created_at: string
          entry_id: string
          event: string
          id: string
          payload: Json
          revision: number
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          event: string
          id?: string
          payload: Json
          revision: number
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          event?: string
          id?: string
          payload?: Json
          revision?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_audits_user_id_entry_id_fkey"
            columns: ["user_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          capture_request: Json
          captured_at: string
          catalog_version: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          extraction: Json
          extraction_schema_version: number
          extraction_status: string
          id: string
          input_hash: string | null
          interpretation_summary: string | null
          last_extracted_at: string | null
          llm_attempted: boolean
          llm_attempted_revision: number | null
          occurred_at: string
          occurred_on: string
          original_text: string | null
          prompt_version: string | null
          raw_text: string | null
          revision: number
          search_text: string
          search_vector: unknown
          source_type: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capture_request: Json
          captured_at: string
          catalog_version?: string | null
          created_at?: string
          currency: string
          deleted_at?: string | null
          extraction: Json
          extraction_schema_version?: number
          extraction_status?: string
          id: string
          input_hash?: string | null
          interpretation_summary?: string | null
          last_extracted_at?: string | null
          llm_attempted?: boolean
          llm_attempted_revision?: number | null
          occurred_at: string
          occurred_on: string
          original_text?: string | null
          prompt_version?: string | null
          raw_text?: string | null
          revision?: number
          search_text?: string
          search_vector?: unknown
          source_type?: string
          timezone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capture_request?: Json
          captured_at?: string
          catalog_version?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          extraction?: Json
          extraction_schema_version?: number
          extraction_status?: string
          id?: string
          input_hash?: string | null
          interpretation_summary?: string | null
          last_extracted_at?: string | null
          llm_attempted?: boolean
          llm_attempted_revision?: number | null
          occurred_at?: string
          occurred_on?: string
          original_text?: string | null
          prompt_version?: string | null
          raw_text?: string | null
          revision?: number
          search_text?: string
          search_vector?: unknown
          source_type?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      journal_search_revisions: {
        Row: {
          revision: number
          user_id: string
        }
        Insert: {
          revision?: number
          user_id: string
        }
        Update: {
          revision?: number
          user_id?: string
        }
        Relationships: []
      }
      merchant_aliases: {
        Row: {
          alias: string
          id: string
          merchant_id: string
          user_id: string | null
        }
        Insert: {
          alias: string
          id?: string
          merchant_id: string
          user_id?: string | null
        }
        Update: {
          alias?: string
          id?: string
          merchant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_aliases_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          canonical_name: string
          default_category_id: string
          id: string
          normalized_name: string | null
          user_id: string | null
        }
        Insert: {
          canonical_name: string
          default_category_id: string
          id?: string
          normalized_name?: string | null
          user_id?: string | null
        }
        Update: {
          canonical_name?: string
          default_category_id?: string
          id?: string
          normalized_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchants_default_category_id_fkey"
            columns: ["default_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          id: string
          name: string
          normalized_name: string | null
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          normalized_name?: string | null
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          normalized_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      receipt_attachments: {
        Row: {
          confidence: number
          created_at: string
          currency: string
          entry_id: string
          id: string
          merchant_name: string | null
          model: string
          needs_review: boolean
          printed_subtotal_minor: number | null
          printed_total_minor: number | null
          purchase_date_text: string | null
          status: string
          truncated: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          currency: string
          entry_id: string
          id: string
          merchant_name?: string | null
          model: string
          needs_review: boolean
          printed_subtotal_minor?: number | null
          printed_total_minor?: number | null
          purchase_date_text?: string | null
          status: string
          truncated?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          currency?: string
          entry_id?: string
          id?: string
          merchant_name?: string | null
          model?: string
          needs_review?: boolean
          printed_subtotal_minor?: number | null
          printed_total_minor?: number | null
          purchase_date_text?: string | null
          status?: string
          truncated?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_attachments_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "receipt_attachments_user_id_entry_id_fkey"
            columns: ["user_id", "entry_id"]
            isOneToOne: true
            referencedRelation: "journal_entries"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      receipt_line_items: {
        Row: {
          amount_minor: number
          category_id: string
          confidence: number
          created_at: string
          currency: string
          description: string
          entry_id: string
          evidence_text: string
          id: string
          kind: string
          needs_review: boolean
          ordinal: number
          quantity: number | null
          unit_price_minor: number | null
          user_id: string
        }
        Insert: {
          amount_minor: number
          category_id: string
          confidence: number
          created_at?: string
          currency: string
          description: string
          entry_id: string
          evidence_text: string
          id?: string
          kind: string
          needs_review: boolean
          ordinal: number
          quantity?: number | null
          unit_price_minor?: number | null
          user_id: string
        }
        Update: {
          amount_minor?: number
          category_id?: string
          confidence?: number
          created_at?: string
          currency?: string
          description?: string
          entry_id?: string
          evidence_text?: string
          id?: string
          kind?: string
          needs_review?: boolean
          ordinal?: number
          quantity?: number | null
          unit_price_minor?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_line_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_line_items_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "receipt_line_items_user_id_entry_id_fkey"
            columns: ["user_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      search_plan_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          plan: Json
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          plan: Json
          user_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          plan?: Json
          user_id?: string
        }
        Relationships: []
      }
      transaction_allocations: {
        Row: {
          allocation_type: string
          amount_minor: number
          confidence: number
          evidence: Json | null
          id: string
          needs_review: boolean
          participant_id: string | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          allocation_type: string
          amount_minor: number
          confidence: number
          evidence?: Json | null
          id?: string
          needs_review: boolean
          participant_id?: string | null
          transaction_id: string
          user_id: string
        }
        Update: {
          allocation_type?: string
          amount_minor?: number
          confidence?: number
          evidence?: Json | null
          id?: string
          needs_review?: boolean
          participant_id?: string | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_allocations_user_id_participant_id_fkey"
            columns: ["user_id", "participant_id"]
            isOneToOne: false
            referencedRelation: "transaction_participants"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transaction_allocations_user_id_transaction_id_fkey"
            columns: ["user_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "confirmed_transactions"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transaction_allocations_user_id_transaction_id_fkey"
            columns: ["user_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      transaction_amount_components: {
        Row: {
          confidence: number
          evidence: Json
          id: string
          label: string
          line_total_minor: number
          needs_review: boolean
          ordinal: number
          quantity: number
          semantic_role: string
          transaction_id: string
          unit_price_minor: number
          user_id: string
        }
        Insert: {
          confidence: number
          evidence: Json
          id?: string
          label: string
          line_total_minor: number
          needs_review: boolean
          ordinal: number
          quantity: number
          semantic_role: string
          transaction_id: string
          unit_price_minor: number
          user_id: string
        }
        Update: {
          confidence?: number
          evidence?: Json
          id?: string
          label?: string
          line_total_minor?: number
          needs_review?: boolean
          ordinal?: number
          quantity?: number
          semantic_role?: string
          transaction_id?: string
          unit_price_minor?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_amount_components_user_id_transaction_id_fkey"
            columns: ["user_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "confirmed_transactions"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transaction_amount_components_user_id_transaction_id_fkey"
            columns: ["user_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      transaction_contexts: {
        Row: {
          confidence: number
          context_id: string
          evidence: Json
          needs_review: boolean
          transaction_id: string
          user_id: string
        }
        Insert: {
          confidence: number
          context_id: string
          evidence: Json
          needs_review: boolean
          transaction_id: string
          user_id: string
        }
        Update: {
          confidence?: number
          context_id?: string
          evidence?: Json
          needs_review?: boolean
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_contexts_user_id_context_id_fkey"
            columns: ["user_id", "context_id"]
            isOneToOne: false
            referencedRelation: "contexts"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transaction_contexts_user_id_transaction_id_fkey"
            columns: ["user_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "confirmed_transactions"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transaction_contexts_user_id_transaction_id_fkey"
            columns: ["user_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      transaction_participants: {
        Row: {
          confidence: number
          display_name: string | null
          evidence: Json | null
          id: string
          needs_review: boolean
          participant_count: number
          party_kind: string
          person_id: string | null
          role: string
          share_minor: number | null
          share_percentage: number | null
          source_ordinal: number
          split_method: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          confidence: number
          display_name?: string | null
          evidence?: Json | null
          id?: string
          needs_review: boolean
          participant_count: number
          party_kind: string
          person_id?: string | null
          role: string
          share_minor?: number | null
          share_percentage?: number | null
          source_ordinal: number
          split_method: string
          transaction_id: string
          user_id: string
        }
        Update: {
          confidence?: number
          display_name?: string | null
          evidence?: Json | null
          id?: string
          needs_review?: boolean
          participant_count?: number
          party_kind?: string
          person_id?: string | null
          role?: string
          share_minor?: number | null
          share_percentage?: number | null
          source_ordinal?: number
          split_method?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_participants_user_id_person_id_fkey"
            columns: ["user_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transaction_participants_user_id_transaction_id_fkey"
            columns: ["user_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "confirmed_transactions"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transaction_participants_user_id_transaction_id_fkey"
            columns: ["user_id", "transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      transactions: {
        Row: {
          allocation_status: string
          amount_minor: number | null
          amount_status: string
          cash_flow: string
          category_id: string
          category_source: string
          confidence: number
          currency: string
          description: string
          direction: string
          entry_id: string
          evidence: string | null
          field_confidence: Json
          field_evidence: Json
          group_total_minor: number | null
          id: string
          merchant_id: string | null
          merchant_text: string | null
          needs_review: boolean
          occurred_at: string
          occurred_on: string
          ordinal: number
          paid_by_user_minor: number | null
          participant_count: number | null
          person_id: string | null
          primary_amount_role: string
          quantity: number | null
          quantity_unit: string | null
          receipt_line_kind: string | null
          split_method: string
          unit_price_minor: number | null
          unresolved: Json
          user_id: string
          user_share_minor: number | null
        }
        Insert: {
          allocation_status?: string
          amount_minor?: number | null
          amount_status: string
          cash_flow: string
          category_id: string
          category_source: string
          confidence: number
          currency: string
          description: string
          direction: string
          entry_id: string
          evidence?: string | null
          field_confidence?: Json
          field_evidence?: Json
          group_total_minor?: number | null
          id?: string
          merchant_id?: string | null
          merchant_text?: string | null
          needs_review: boolean
          occurred_at: string
          occurred_on: string
          ordinal: number
          paid_by_user_minor?: number | null
          participant_count?: number | null
          person_id?: string | null
          primary_amount_role?: string
          quantity?: number | null
          quantity_unit?: string | null
          receipt_line_kind?: string | null
          split_method?: string
          unit_price_minor?: number | null
          unresolved: Json
          user_id: string
          user_share_minor?: number | null
        }
        Update: {
          allocation_status?: string
          amount_minor?: number | null
          amount_status?: string
          cash_flow?: string
          category_id?: string
          category_source?: string
          confidence?: number
          currency?: string
          description?: string
          direction?: string
          entry_id?: string
          evidence?: string | null
          field_confidence?: Json
          field_evidence?: Json
          group_total_minor?: number | null
          id?: string
          merchant_id?: string | null
          merchant_text?: string | null
          needs_review?: boolean
          occurred_at?: string
          occurred_on?: string
          ordinal?: number
          paid_by_user_minor?: number | null
          participant_count?: number | null
          person_id?: string | null
          primary_amount_role?: string
          quantity?: number | null
          quantity_unit?: string | null
          receipt_line_kind?: string | null
          split_method?: string
          unit_price_minor?: number | null
          unresolved?: Json
          user_id?: string
          user_share_minor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_entry_id_fkey"
            columns: ["user_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transactions_user_id_person_id_fkey"
            columns: ["user_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      user_onboarding: {
        Row: {
          answers: Json
          base_currency: string | null
          completed_at: string | null
          created_at: string
          current_step_id: string
          flow_version: string
          primary_goal: string | null
          status: string
          tracking_friction: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          base_currency?: string | null
          completed_at?: string | null
          created_at?: string
          current_step_id: string
          flow_version: string
          primary_goal?: string | null
          status: string
          tracking_friction?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          base_currency?: string | null
          completed_at?: string | null
          created_at?: string
          current_step_id?: string
          flow_version?: string
          primary_goal?: string | null
          status?: string
          tracking_friction?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_base_currency_fkey"
            columns: ["base_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      user_presets: {
        Row: {
          amount_minor: number
          category_id: string
          created_at: string
          id: string
          name: string
          note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          category_id: string
          created_at?: string
          id: string
          name: string
          note: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          back_tap_quick_add: boolean
          created_at: string
          currency: string
          location_enabled: boolean
          reminder_frequency: string
          reminder_time: string
          reminders_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          back_tap_quick_add?: boolean
          created_at?: string
          currency: string
          location_enabled?: boolean
          reminder_frequency: string
          reminder_time: string
          reminders_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          back_tap_quick_add?: boolean
          created_at?: string
          currency?: string
          location_enabled?: boolean
          reminder_frequency?: string
          reminder_time?: string
          reminders_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      confirmed_transactions: {
        Row: {
          amount_minor: number | null
          amount_status: string | null
          cash_flow: string | null
          category_id: string | null
          category_source: string | null
          confidence: number | null
          currency: string | null
          description: string | null
          direction: string | null
          entry_id: string | null
          evidence: string | null
          id: string | null
          merchant_id: string | null
          needs_review: boolean | null
          occurred_at: string | null
          occurred_on: string | null
          ordinal: number | null
          person_id: string | null
          quantity: number | null
          unit_price_minor: number | null
          unresolved: Json | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_entry_id_fkey"
            columns: ["user_id", "entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transactions_user_id_person_id_fkey"
            columns: ["user_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      lending_balances: {
        Row: {
          currency: string | null
          net_receivable_minor: string | null
          person_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_user_id_person_id_fkey"
            columns: ["user_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      monthly_comparison: {
        Row: {
          currency: string | null
          difference_minor: string | null
          month: string | null
          previous_month_minor: string | null
          total_minor: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      recurring_candidates: {
        Row: {
          currency: string | null
          first_date: string | null
          last_date: string | null
          maximum_minor: string | null
          merchant_id: string | null
          minimum_minor: string | null
          occurrences: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      spending_by_category: {
        Row: {
          category_id: string | null
          currency: string | null
          month: string | null
          total_minor: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      spending_by_context: {
        Row: {
          context_id: string | null
          currency: string | null
          month: string | null
          total_minor: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      spending_by_merchant: {
        Row: {
          currency: string | null
          merchant_id: string | null
          month: string | null
          total_minor: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      spending_by_person: {
        Row: {
          currency: string | null
          month: string | null
          person_id: string | null
          total_minor: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Functions: {
      finn_active_contexts: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      finn_cache_ask_explanation: {
        Args: { p_explanation: string; p_key: string; p_user: string }
        Returns: undefined
      }
      finn_cache_ask_sql_plan: {
        Args: { p_key: string; p_plan: Json; p_user: string }
        Returns: undefined
      }
      finn_cache_search_plan: {
        Args: { p_key: string; p_plan: Json; p_user: string }
        Returns: undefined
      }
      finn_catalog_document: { Args: { p_user: string }; Returns: Json }
      finn_claim_ai_operation: {
        Args: {
          p_entry_id: string
          p_entry_revision: number
          p_input_hash: string
          p_model_version: string
          p_operation_id: string
          p_prompt_version: string
          p_schema_version: number
          p_task: string
          p_user: string
        }
        Returns: string
      }
      finn_claim_enrichment: {
        Args: { p_id: string; p_revision: number; p_user: string }
        Returns: boolean
      }
      finn_commit_entry: {
        Args: {
          p_audit: Json
          p_expected_revision?: number
          p_extraction: Json
          p_input: Json
          p_operation_id?: string
          p_rule?: Json
          p_user: string
        }
        Returns: Json
      }
      finn_commit_receipt: {
        Args: {
          p_audit: Json
          p_extraction: Json
          p_lines: Json
          p_receipt: Json
          p_request: Json
          p_user: string
        }
        Returns: Json
      }
      finn_correct_receipt: {
        Args: {
          p_attachment: Json
          p_extraction: Json
          p_id: string
          p_lines: Json
          p_operation_id: string
          p_revision: number
          p_user: string
        }
        Returns: Json
      }
      finn_delete_entry: {
        Args: {
          p_id: string
          p_operation_id: string
          p_revision: number
          p_user: string
        }
        Returns: Json
      }
      finn_entry_document: {
        Args: { p_id: string; p_user: string }
        Returns: Json
      }
      finn_finish_ai_operation: {
        Args: {
          p_operation_id: string
          p_status: string
          p_user: string
          p_validation_code?: string
        }
        Returns: undefined
      }
      finn_get_ask_explanation: {
        Args: { p_key: string; p_user: string }
        Returns: string
      }
      finn_get_ask_sql_plan: {
        Args: { p_key: string; p_user: string }
        Returns: Json
      }
      finn_get_ask_sql_session: {
        Args: { p_id: string; p_user: string }
        Returns: Json
      }
      finn_mutation_document: {
        Args: { p_operation_id: string; p_user: string }
        Returns: Json
      }
      finn_prune_sync_changes: { Args: { p_user: string }; Returns: number }
      finn_record_cache_metrics: {
        Args: { p_metrics: Json }
        Returns: undefined
      }
      finn_request_ai_quota_review: {
        Args: { p_user: string }
        Returns: string
      }
      finn_reserve_quota: {
        Args: {
          p_bucket: string
          p_daily: number
          p_minute: number
          p_monthly: number
          p_user: string
        }
        Returns: boolean
      }
      finn_search: {
        Args: {
          p_category?: string
          p_context?: string
          p_currency?: string
          p_direction?: string
          p_end: string
          p_limit?: number
          p_merchant?: string
          p_offset?: number
          p_person?: string
          p_start: string
          p_text?: string
        }
        Returns: Json
      }
      finn_search_catalog: {
        Args: { p_filters?: Json; p_query?: string }
        Returns: Json
      }
      finn_search_page: {
        Args: {
          p_cursor?: Json
          p_filters: Json
          p_limit?: number
          p_revision?: string
        }
        Returns: Json
      }
      finn_search_page_v2: {
        Args: {
          p_cursor?: Json
          p_filters: Json
          p_limit?: number
          p_revision?: string
        }
        Returns: Json
      }
      finn_store_ask_sql_session: {
        Args: {
          p_answer_kind: string
          p_answer_label: string
          p_answer_rows: Json
          p_cohort_sql: string
          p_end: string
          p_matching_count: number
          p_metric: string
          p_revision: string
          p_start: string
          p_user: string
        }
        Returns: string
      }
      finn_sync_journal: {
        Args: {
          p_after_revision?: string
          p_cursor?: Json
          p_limit?: number
          p_snapshot_revision?: string
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
