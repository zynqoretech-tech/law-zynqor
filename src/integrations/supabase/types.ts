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
      ai_analyses: {
        Row: {
          created_at: string
          document_id: string | null
          id: string
          input_text: string | null
          model_used: string | null
          result: Json | null
          risk_score: number | null
          status: string | null
          tokens_used: number | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          id?: string
          input_text?: string | null
          model_used?: string | null
          result?: Json | null
          risk_score?: number | null
          status?: string | null
          tokens_used?: number | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string | null
          id?: string
          input_text?: string | null
          model_used?: string | null
          result?: Json | null
          risk_score?: number | null
          status?: string | null
          tokens_used?: number | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_files: {
        Row: {
          case_id: string | null
          client_id: string | null
          consultation_id: string | null
          created_at: string
          description: string | null
          expense_id: string | null
          hearing_id: string | null
          id: string
          invoice_id: string | null
          lawyer_id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          consultation_id?: string | null
          created_at?: string
          description?: string | null
          expense_id?: string | null
          hearing_id?: string | null
          id?: string
          invoice_id?: string | null
          lawyer_id: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          consultation_id?: string | null
          created_at?: string
          description?: string | null
          expense_id?: string | null
          hearing_id?: string | null
          id?: string
          invoice_id?: string | null
          lawyer_id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "archive_files_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "manual_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_files_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_files_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "case_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_files_hearing_id_fkey"
            columns: ["hearing_id"]
            isOneToOne: false
            referencedRelation: "hearings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_files_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_expenses: {
        Row: {
          amount: number
          case_id: string
          created_at: string
          description: string
          id: string
          is_billable: boolean
          is_reimbursed: boolean
          lawyer_id: string
          paid_at: string | null
          receipt_url: string | null
          type: string
        }
        Insert: {
          amount: number
          case_id: string
          created_at?: string
          description: string
          id?: string
          is_billable?: boolean
          is_reimbursed?: boolean
          lawyer_id: string
          paid_at?: string | null
          receipt_url?: string | null
          type: string
        }
        Update: {
          amount?: number
          case_id?: string
          created_at?: string
          description?: string
          id?: string
          is_billable?: boolean
          is_reimbursed?: boolean
          lawyer_id?: string
          paid_at?: string | null
          receipt_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_expenses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_expenses_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_number: string | null
          case_value: number | null
          client_id: string | null
          court: string | null
          court_department: string | null
          created_at: string
          deleted_at: string | null
          facts: string | null
          id: string
          judge: string | null
          lawyer_id: string | null
          manual_client_id: string | null
          next_hearing: string | null
          notes_private: string | null
          opposing_lawyer: string | null
          opposing_party: string | null
          paid_fees: number | null
          power_of_attorney_date: string | null
          power_of_attorney_expires: string | null
          priority: string | null
          stage: string | null
          status: string | null
          success_fee_percent: number | null
          tags: string[] | null
          title: string
          total_fees: number | null
          type: string
          updated_at: string
        }
        Insert: {
          case_number?: string | null
          case_value?: number | null
          client_id?: string | null
          court?: string | null
          court_department?: string | null
          created_at?: string
          deleted_at?: string | null
          facts?: string | null
          id?: string
          judge?: string | null
          lawyer_id?: string | null
          manual_client_id?: string | null
          next_hearing?: string | null
          notes_private?: string | null
          opposing_lawyer?: string | null
          opposing_party?: string | null
          paid_fees?: number | null
          power_of_attorney_date?: string | null
          power_of_attorney_expires?: string | null
          priority?: string | null
          stage?: string | null
          status?: string | null
          success_fee_percent?: number | null
          tags?: string[] | null
          title: string
          total_fees?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          case_number?: string | null
          case_value?: number | null
          client_id?: string | null
          court?: string | null
          court_department?: string | null
          created_at?: string
          deleted_at?: string | null
          facts?: string | null
          id?: string
          judge?: string | null
          lawyer_id?: string | null
          manual_client_id?: string | null
          next_hearing?: string | null
          notes_private?: string | null
          opposing_lawyer?: string | null
          opposing_party?: string | null
          paid_fees?: number | null
          power_of_attorney_date?: string | null
          power_of_attorney_expires?: string | null
          priority?: string | null
          stage?: string | null
          status?: string | null
          success_fee_percent?: number | null
          tags?: string[] | null
          title?: string
          total_fees?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_manual_client_id_fkey"
            columns: ["manual_client_id"]
            isOneToOne: false
            referencedRelation: "manual_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          client_type: string | null
          company_name: string | null
          created_at: string
          id: string
          national_id: string | null
          notes: string | null
        }
        Insert: {
          address?: string | null
          client_type?: string | null
          company_name?: string | null
          created_at?: string
          id: string
          national_id?: string | null
          notes?: string | null
        }
        Update: {
          address?: string | null
          client_type?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          national_id?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          client_id: string | null
          client_notes: string | null
          created_at: string
          deposit_status: string | null
          duration_minutes: number | null
          id: string
          lawyer_id: string | null
          meeting_link: string | null
          notes: string | null
          price: number
          rating: number | null
          review: string | null
          scheduled_at: string
          status: string | null
          type: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_notes?: string | null
          created_at?: string
          deposit_status?: string | null
          duration_minutes?: number | null
          id?: string
          lawyer_id?: string | null
          meeting_link?: string | null
          notes?: string | null
          price: number
          rating?: number | null
          review?: string | null
          scheduled_at: string
          status?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_notes?: string | null
          created_at?: string
          deposit_status?: string | null
          duration_minutes?: number | null
          id?: string
          lawyer_id?: string | null
          meeting_link?: string | null
          notes?: string | null
          price?: number
          rating?: number | null
          review?: string | null
          scheduled_at?: string
          status?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_shared: boolean
          lawyer_id: string
          title: string
          updated_at: string
          usage_count: number
          variables: Json
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          is_shared?: boolean
          lawyer_id: string
          title: string
          updated_at?: string
          usage_count?: number
          variables?: Json
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_shared?: boolean
          lawyer_id?: string
          title?: string
          updated_at?: string
          usage_count?: number
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          lawyer_id: string
          source: string
          source_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          lawyer_id: string
          source?: string
          source_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          lawyer_id?: string
          source?: string
          source_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deadlines: {
        Row: {
          alert_days_before: number
          case_id: string | null
          created_at: string
          deadline_days: number
          due_date: string
          id: string
          lawyer_id: string
          notes: string | null
          status: string
          title: string
          trigger_date: string
          type: string
        }
        Insert: {
          alert_days_before?: number
          case_id?: string | null
          created_at?: string
          deadline_days: number
          due_date: string
          id?: string
          lawyer_id: string
          notes?: string | null
          status?: string
          title: string
          trigger_date: string
          type: string
        }
        Update: {
          alert_days_before?: number
          case_id?: string | null
          created_at?: string
          deadline_days?: number
          due_date?: string
          id?: string
          lawyer_id?: string
          notes?: string | null
          status?: string
          title?: string
          trigger_date?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string
          file_size: number | null
          file_url: string
          folder: string | null
          id: string
          is_analyzed: boolean | null
          mime_type: string | null
          name: string
          type: string | null
          uploaded_by: string | null
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          file_size?: number | null
          file_url: string
          folder?: string | null
          id?: string
          is_analyzed?: boolean | null
          mime_type?: string | null
          name: string
          type?: string | null
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          file_size?: number | null
          file_url?: string
          folder?: string | null
          id?: string
          is_analyzed?: boolean | null
          mime_type?: string | null
          name?: string
          type?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_requests: {
        Row: {
          budget: number | null
          case_type: string | null
          client_id: string
          created_at: string
          description: string | null
          id: string
          lawyer_id: string
          lawyer_response: string | null
          message: string | null
          responded_at: string | null
          response: string | null
          status: string
          subject: string
        }
        Insert: {
          budget?: number | null
          case_type?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          lawyer_id: string
          lawyer_response?: string | null
          message?: string | null
          responded_at?: string | null
          response?: string | null
          status?: string
          subject: string
        }
        Update: {
          budget?: number | null
          case_type?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          lawyer_id?: string
          lawyer_response?: string | null
          message?: string | null
          responded_at?: string | null
          response?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_requests_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      hearings: {
        Row: {
          case_id: string | null
          court: string | null
          created_at: string
          decision: string | null
          hearing_date: string
          id: string
          judge: string | null
          next_hearing_date: string | null
          notes: string | null
          result: string | null
        }
        Insert: {
          case_id?: string | null
          court?: string | null
          created_at?: string
          decision?: string | null
          hearing_date: string
          id?: string
          judge?: string | null
          next_hearing_date?: string | null
          notes?: string | null
          result?: string | null
        }
        Update: {
          case_id?: string | null
          court?: string | null
          created_at?: string
          decision?: string | null
          hearing_date?: string
          id?: string
          judge?: string | null
          next_hearing_date?: string | null
          notes?: string | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hearings_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          case_id: string | null
          client_id: string | null
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          lawyer_id: string | null
          line_items: Json | null
          manual_client_id: string | null
          notes: string | null
          paid_amount: number | null
          status: string | null
          tax_amount: number | null
          tax_percent: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          lawyer_id?: string | null
          line_items?: Json | null
          manual_client_id?: string | null
          notes?: string | null
          paid_amount?: number | null
          status?: string | null
          tax_amount?: number | null
          tax_percent?: number | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          amount?: number
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          lawyer_id?: string | null
          line_items?: Json | null
          manual_client_id?: string | null
          notes?: string | null
          paid_amount?: number | null
          status?: string | null
          tax_amount?: number | null
          tax_percent?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_manual_client_id_fkey"
            columns: ["manual_client_id"]
            isOneToOne: false
            referencedRelation: "manual_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyer_verification_requests: {
        Row: {
          bar_document_url: string | null
          bar_number: string | null
          created_at: string
          documents: Json
          id: string
          id_document_url: string | null
          lawyer_id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          status: string
        }
        Insert: {
          bar_document_url?: string | null
          bar_number?: string | null
          created_at?: string
          documents?: Json
          id?: string
          id_document_url?: string | null
          lawyer_id: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
        }
        Update: {
          bar_document_url?: string | null
          bar_number?: string | null
          created_at?: string
          documents?: Json
          id?: string
          id_document_url?: string | null
          lawyer_id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lawyer_verification_requests_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lawyer_verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lawyers: {
        Row: {
          address: string | null
          available_office: boolean | null
          available_online: boolean | null
          bar_number: string | null
          bio: string | null
          cases_won: number | null
          city: string | null
          consultation_price: number | null
          consultation_price_online: number | null
          created_at: string
          education: string | null
          experience_years: number | null
          firm_name: string | null
          hourly_rate: number | null
          id: string
          profile_completed: boolean | null
          rating: number | null
          requires_deposit: boolean | null
          reviews_count: number | null
          specializations: string[] | null
          total_cases: number | null
          verified: boolean | null
        }
        Insert: {
          address?: string | null
          available_office?: boolean | null
          available_online?: boolean | null
          bar_number?: string | null
          bio?: string | null
          cases_won?: number | null
          city?: string | null
          consultation_price?: number | null
          consultation_price_online?: number | null
          created_at?: string
          education?: string | null
          experience_years?: number | null
          firm_name?: string | null
          hourly_rate?: number | null
          id: string
          profile_completed?: boolean | null
          rating?: number | null
          requires_deposit?: boolean | null
          reviews_count?: number | null
          specializations?: string[] | null
          total_cases?: number | null
          verified?: boolean | null
        }
        Update: {
          address?: string | null
          available_office?: boolean | null
          available_online?: boolean | null
          bar_number?: string | null
          bio?: string | null
          cases_won?: number | null
          city?: string | null
          consultation_price?: number | null
          consultation_price_online?: number | null
          created_at?: string
          education?: string | null
          experience_years?: number | null
          firm_name?: string | null
          hourly_rate?: number | null
          id?: string
          profile_completed?: boolean | null
          rating?: number | null
          requires_deposit?: boolean | null
          reviews_count?: number | null
          specializations?: string[] | null
          total_cases?: number | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "lawyers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_research: {
        Row: {
          case_id: string | null
          created_at: string
          id: string
          is_saved: boolean
          lawyer_id: string
          query: string
          result: string | null
          sources: Json
          title: string
          type: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          id?: string
          is_saved?: boolean
          lawyer_id: string
          query: string
          result?: string | null
          sources?: Json
          title: string
          type?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          id?: string
          is_saved?: boolean
          lawyer_id?: string
          query?: string
          result?: string | null
          sources?: Json
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_research_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_research_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_clients: {
        Row: {
          address: string | null
          client_type: string
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          lawyer_id: string
          national_id: string | null
          notes: string | null
          phone: string | null
          platform_user_id: string | null
        }
        Insert: {
          address?: string | null
          client_type?: string
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          lawyer_id: string
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          platform_user_id?: string | null
        }
        Update: {
          address?: string | null
          client_type?: string
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          lawyer_id?: string
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          platform_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_clients_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          body: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          body: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean | null
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          error: Json | null
          id: string
          meta: Json
          metadata: Json
          provider: string | null
          provider_ref: string | null
          purpose: string | null
          related_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          error?: Json | null
          id?: string
          meta?: Json
          metadata?: Json
          provider?: string | null
          provider_ref?: string | null
          purpose?: string | null
          related_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          error?: Json | null
          id?: string
          meta?: Json
          metadata?: Json
          provider?: string | null
          provider_ref?: string | null
          purpose?: string | null
          related_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          disabled_at: string | null
          disabled_reason: string | null
          features_override: Json | null
          full_name: string
          id: string
          is_disabled: boolean
          location: string | null
          phone: string | null
          plan: string | null
          plan_expires_at: string | null
          role: string
          telegram_chat_id: number | null
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          disabled_at?: string | null
          disabled_reason?: string | null
          features_override?: Json | null
          full_name: string
          id: string
          is_disabled?: boolean
          location?: string | null
          phone?: string | null
          plan?: string | null
          plan_expires_at?: string | null
          role: string
          telegram_chat_id?: number | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          disabled_at?: string | null
          disabled_reason?: string | null
          features_override?: Json | null
          full_name?: string
          id?: string
          is_disabled?: boolean
          location?: string | null
          phone?: string | null
          plan?: string | null
          plan_expires_at?: string | null
          role?: string
          telegram_chat_id?: number | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          client_id: string | null
          consultation_id: string | null
          created_at: string
          id: string
          is_visible: boolean | null
          lawyer_id: string | null
          rating: number
          review: string | null
        }
        Insert: {
          client_id?: string | null
          consultation_id?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean | null
          lawyer_id?: string | null
          rating: number
          review?: string | null
        }
        Update: {
          client_id?: string | null
          consultation_id?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean | null
          lawyer_id?: string | null
          rating?: number
          review?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_paid: number | null
          billing_cycle: string | null
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          plan: string
          started_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          billing_cycle?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan: string
          started_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          billing_cycle?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          plan?: string
          started_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_hours: number
          assigned_to: string | null
          case_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_hours: number
          id: string
          is_billable: boolean
          lawyer_id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number
          assigned_to?: string | null
          case_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number
          id?: string
          is_billable?: boolean
          lawyer_id: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number
          assigned_to?: string | null
          case_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number
          id?: string
          is_billable?: boolean
          lawyer_id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      team_chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          body: string
          created_at: string
          id: string
          is_ai: boolean
          office_id: string
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          id?: string
          is_ai?: boolean
          office_id: string
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          id?: string
          is_ai?: boolean
          office_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_chat_messages_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          can_edit_cases: boolean
          can_view_all_cases: boolean
          can_view_billing: boolean
          id: string
          is_active: boolean
          joined_at: string
          member_profile_id: string
          office_lawyer_id: string
          permissions: Json
          role: string
        }
        Insert: {
          can_edit_cases?: boolean
          can_view_all_cases?: boolean
          can_view_billing?: boolean
          id?: string
          is_active?: boolean
          joined_at?: string
          member_profile_id: string
          office_lawyer_id: string
          permissions?: Json
          role?: string
        }
        Update: {
          can_edit_cases?: boolean
          can_view_all_cases?: boolean
          can_view_billing?: boolean
          id?: string
          is_active?: boolean
          joined_at?: string
          member_profile_id?: string
          office_lawyer_id?: string
          permissions?: Json
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_member_profile_id_fkey"
            columns: ["member_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_office_lawyer_id_fkey"
            columns: ["office_lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_link_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code?: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          billed_amount: number
          case_id: string | null
          created_at: string
          description: string
          duration_minutes: number
          ended_at: string | null
          hourly_rate: number
          id: string
          is_billable: boolean
          lawyer_id: string
          started_at: string | null
          status: string
          task_id: string | null
        }
        Insert: {
          billed_amount?: number
          case_id?: string | null
          created_at?: string
          description: string
          duration_minutes?: number
          ended_at?: string | null
          hourly_rate?: number
          id?: string
          is_billable?: boolean
          lawyer_id: string
          started_at?: string | null
          status?: string
          task_id?: string | null
        }
        Update: {
          billed_amount?: number
          case_id?: string | null
          created_at?: string
          description?: string
          duration_minutes?: number
          ended_at?: string | null
          hourly_rate?: number
          id?: string
          is_billable?: boolean
          lawyer_id?: string
          started_at?: string | null
          status?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "lawyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_subscription_from_payment: {
        Args: { _plan?: string; _user_id: string }
        Returns: undefined
      }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          features_override: Json
          full_name: string
          id: string
          phone: string
          plan: string
          plan_expires_at: string
          role: string
        }[]
      }
      admin_set_lawyer_verification: {
        Args: { _lawyer_id: string; _notes?: string; _verified: boolean }
        Returns: undefined
      }
      admin_set_user_plan: {
        Args: {
          _expires_at?: string
          _features?: Json
          _notes?: string
          _plan: string
          _user_id: string
        }
        Returns: undefined
      }
      check_plan_limit: { Args: { p_resource: string }; Returns: boolean }
      client_lawyer_contacts: {
        Args: never
        Returns: {
          address: string
          avatar_url: string
          bar_number: string
          bio: string
          city: string
          consultation_price: number
          email: string
          experience_years: number
          firm_name: string
          full_name: string
          lawyer_id: string
          phone: string
          rating: number
          specializations: string[]
          verified: boolean
        }[]
      }
      complete_signup:
        | { Args: { _full_name?: string; _role: string }; Returns: undefined }
        | {
            Args: {
              _bar_number?: string
              _firm_name?: string
              _full_name?: string
              _location?: string
              _phone?: string
              _role: string
              _specializations?: string[]
            }
            Returns: undefined
          }
      current_office_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_office_member: {
        Args: { _office: string; _user: string }
        Returns: boolean
      }
      lawyer_client_contacts: {
        Args: never
        Returns: {
          avatar_url: string
          client_id: string
          email: string
          full_name: string
          location: string
          phone: string
        }[]
      }
      open_conversation: {
        Args: {
          _client_id: string
          _lawyer_id: string
          _source?: string
          _source_id?: string
        }
        Returns: string
      }
      push_notification: {
        Args: {
          _body: string
          _related_id?: string
          _related_type?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "lawyer" | "client"
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
    Enums: {
      app_role: ["admin", "moderator", "user", "lawyer", "client"],
    },
  },
} as const
