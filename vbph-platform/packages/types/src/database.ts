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
      application_admin_notes: {
        Row: {
          application_id: string
          author_id: string | null
          created_at: string
          id: string
          note: string
        }
        Insert: {
          application_id: string
          author_id?: string | null
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          application_id?: string
          author_id?: string | null
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_admin_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_admin_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members: {
        Row: {
          client_id: string
          created_at: string
          id: string
          profile_id: string
          role_in_company: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          profile_id: string
          role_in_company?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          role_in_company?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_email: string | null
          company_name: string
          created_at: string
          id: string
          industry: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          website: string | null
        }
        Insert: {
          billing_email?: string | null
          company_name: string
          created_at?: string
          id?: string
          industry?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          billing_email?: string | null
          company_name?: string
          created_at?: string
          id?: string
          industry?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          hours: number
          id: string
          invoice_id: string
          margin_amount: number | null
          placement_id: string
          rate_hour: number
          time_entry_id: string | null
          va_hourly_rate: number | null
          va_payout_amount: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          hours: number
          id?: string
          invoice_id: string
          margin_amount?: number | null
          placement_id: string
          rate_hour: number
          time_entry_id?: string | null
          va_hourly_rate?: number | null
          va_payout_amount?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          invoice_id?: string
          margin_amount?: number | null
          placement_id?: string
          rate_hour?: number
          time_entry_id?: string | null
          va_hourly_rate?: number | null
          va_payout_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "admin_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "client_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "va_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          cover_note: string | null
          created_at: string
          expected_availability: string | null
          id: string
          job_id: string
          notes: string | null
          relevant_experience: string | null
          status: string
          updated_at: string
          va_id: string
        }
        Insert: {
          cover_note?: string | null
          created_at?: string
          expected_availability?: string | null
          id?: string
          job_id: string
          notes?: string | null
          relevant_experience?: string | null
          status?: string
          updated_at?: string
          va_id: string
        }
        Update: {
          cover_note?: string | null
          created_at?: string
          expected_availability?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          relevant_experience?: string | null
          status?: string
          updated_at?: string
          va_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "admin_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "client_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "va_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_va_id_fkey"
            columns: ["va_id"]
            isOneToOne: false
            referencedRelation: "va_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          agency_margin: number
          application_deadline: string | null
          client_hourly_rate: number
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          experience_level: string | null
          hours_per_week: number | null
          id: string
          num_vas_required: number
          required_skills: string[]
          responsibilities: string | null
          schedule: string | null
          status: string
          timezone: string | null
          title: string
          updated_at: string
          va_hourly_rate: number | null
        }
        Insert: {
          agency_margin?: number
          application_deadline?: string | null
          client_hourly_rate: number
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          experience_level?: string | null
          hours_per_week?: number | null
          id?: string
          num_vas_required?: number
          required_skills?: string[]
          responsibilities?: string | null
          schedule?: string | null
          status?: string
          timezone?: string | null
          title: string
          updated_at?: string
          va_hourly_rate?: number | null
        }
        Update: {
          agency_margin?: number
          application_deadline?: string | null
          client_hourly_rate?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          experience_level?: string | null
          hours_per_week?: number | null
          id?: string
          num_vas_required?: number
          required_skills?: string[]
          responsibilities?: string | null
          schedule?: string | null
          status?: string
          timezone?: string | null
          title?: string
          updated_at?: string
          va_hourly_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
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
          id: string
          invoice_id: string
          paid_at: string | null
          provider: string
          provider_reference: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          paid_at?: string | null
          provider?: string
          provider_reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          paid_at?: string | null
          provider?: string
          provider_reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      placements: {
        Row: {
          agency_margin: number
          client_hourly_rate: number
          client_id: string
          created_at: string
          end_date: string | null
          hours_per_week_expected: number | null
          id: string
          job_id: string | null
          project_id: string | null
          start_date: string
          status: string
          updated_at: string
          va_hourly_rate: number | null
          va_id: string
        }
        Insert: {
          agency_margin: number
          client_hourly_rate: number
          client_id: string
          created_at?: string
          end_date?: string | null
          hours_per_week_expected?: number | null
          id?: string
          job_id?: string | null
          project_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          va_hourly_rate?: number | null
          va_id: string
        }
        Update: {
          agency_margin?: number
          client_hourly_rate?: number
          client_id?: string
          created_at?: string
          end_date?: string | null
          hours_per_week_expected?: number | null
          id?: string
          job_id?: string | null
          project_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          va_hourly_rate?: number | null
          va_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "admin_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "client_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "va_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_va_id_fkey"
            columns: ["va_id"]
            isOneToOne: false
            referencedRelation: "va_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      screenshots: {
        Row: {
          captured_at: string
          created_at: string
          id: string
          storage_path: string
          time_segment_id: string
        }
        Insert: {
          captured_at?: string
          created_at?: string
          id?: string
          storage_path: string
          time_segment_id: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          id?: string
          storage_path?: string
          time_segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screenshots_time_segment_id_fkey"
            columns: ["time_segment_id"]
            isOneToOne: true
            referencedRelation: "time_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          ended_at: string | null
          id: string
          placement_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          placement_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          placement_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "admin_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "client_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "va_placements_view"
            referencedColumns: ["id"]
          },
        ]
      }
      time_segments: {
        Row: {
          activity_percentage: number | null
          client_segment_id: string | null
          created_at: string
          id: string
          keyboard_activity_count: number | null
          memo: string | null
          mouse_activity_count: number | null
          segment_end: string
          segment_start: string
          time_entry_id: string
        }
        Insert: {
          activity_percentage?: number | null
          client_segment_id?: string | null
          created_at?: string
          id?: string
          keyboard_activity_count?: number | null
          memo?: string | null
          mouse_activity_count?: number | null
          segment_end: string
          segment_start: string
          time_entry_id: string
        }
        Update: {
          activity_percentage?: number | null
          client_segment_id?: string | null
          created_at?: string
          id?: string
          keyboard_activity_count?: number | null
          memo?: string | null
          mouse_activity_count?: number | null
          segment_end?: string
          segment_start?: string
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_segments_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_hours: number | null
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          pending_hours: number | null
          placement_id: string
          rejected_hours: number | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          tracked_hours: number | null
          updated_at: string
          week_end: string
          week_start: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_hours?: number | null
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          pending_hours?: number | null
          placement_id: string
          rejected_hours?: number | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tracked_hours?: number | null
          updated_at?: string
          week_end?: string
          week_start: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_hours?: number | null
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          pending_hours?: number | null
          placement_id?: string
          rejected_hours?: number | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tracked_hours?: number | null
          updated_at?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "admin_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "client_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "va_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      va_profiles: {
        Row: {
          approval_status: Database["public"]["Enums"]["va_approval_status"]
          approved_at: string | null
          approved_by: string | null
          bio: string | null
          created_at: string
          experience_years: number | null
          headline: string | null
          id: string
          portfolio_url: string | null
          rejection_reason: string | null
          resume_url: string | null
          skills: string[]
          timezone: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["va_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          created_at?: string
          experience_years?: number | null
          headline?: string | null
          id: string
          portfolio_url?: string | null
          rejection_reason?: string | null
          resume_url?: string | null
          skills?: string[]
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["va_approval_status"]
          approved_at?: string | null
          approved_by?: string | null
          bio?: string | null
          created_at?: string
          experience_years?: number | null
          headline?: string | null
          id?: string
          portfolio_url?: string | null
          rejection_reason?: string | null
          resume_url?: string | null
          skills?: string[]
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "va_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "va_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_compensation_view: {
        Row: {
          approved_hours: number | null
          client_hourly_rate: number | null
          client_id: string | null
          client_revenue: number | null
          gross_margin: number | null
          placement_id: string | null
          timesheet_id: string | null
          va_compensation: number | null
          va_hourly_rate: number | null
          va_id: string | null
          week_end: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_va_id_fkey"
            columns: ["va_id"]
            isOneToOne: false
            referencedRelation: "va_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "admin_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "client_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "va_placements_view"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_invoice_items_view: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          hours: number | null
          id: string | null
          invoice_id: string | null
          margin_amount: number | null
          placement_id: string | null
          rate_hour: number | null
          time_entry_id: string | null
          va_hourly_rate: number | null
          va_payout_amount: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          hours?: number | null
          id?: string | null
          invoice_id?: string | null
          margin_amount?: number | null
          placement_id?: string | null
          rate_hour?: number | null
          time_entry_id?: string | null
          va_hourly_rate?: number | null
          va_payout_amount?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          hours?: number | null
          id?: string | null
          invoice_id?: string | null
          margin_amount?: number | null
          placement_id?: string | null
          rate_hour?: number | null
          time_entry_id?: string | null
          va_hourly_rate?: number | null
          va_payout_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "admin_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "client_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "va_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_jobs_view: {
        Row: {
          agency_margin: number | null
          application_deadline: string | null
          client_hourly_rate: number | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          experience_level: string | null
          hours_per_week: number | null
          id: string | null
          num_vas_required: number | null
          required_skills: string[] | null
          responsibilities: string | null
          schedule: string | null
          status: string | null
          timezone: string | null
          title: string | null
          updated_at: string | null
          va_hourly_rate: number | null
        }
        Insert: {
          agency_margin?: number | null
          application_deadline?: string | null
          client_hourly_rate?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          experience_level?: string | null
          hours_per_week?: number | null
          id?: string | null
          num_vas_required?: number | null
          required_skills?: string[] | null
          responsibilities?: string | null
          schedule?: string | null
          status?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          va_hourly_rate?: number | null
        }
        Update: {
          agency_margin?: number | null
          application_deadline?: string | null
          client_hourly_rate?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          experience_level?: string | null
          hours_per_week?: number | null
          id?: string | null
          num_vas_required?: number | null
          required_skills?: string[] | null
          responsibilities?: string | null
          schedule?: string | null
          status?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          va_hourly_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_placements_view: {
        Row: {
          agency_margin: number | null
          client_hourly_rate: number | null
          client_id: string | null
          created_at: string | null
          end_date: string | null
          hours_per_week_expected: number | null
          id: string | null
          job_id: string | null
          project_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          va_hourly_rate: number | null
          va_id: string | null
        }
        Insert: {
          agency_margin?: number | null
          client_hourly_rate?: number | null
          client_id?: string | null
          created_at?: string | null
          end_date?: string | null
          hours_per_week_expected?: number | null
          id?: string | null
          job_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          va_hourly_rate?: number | null
          va_id?: string | null
        }
        Update: {
          agency_margin?: number | null
          client_hourly_rate?: number | null
          client_id?: string | null
          created_at?: string | null
          end_date?: string | null
          hours_per_week_expected?: number | null
          id?: string | null
          job_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          va_hourly_rate?: number | null
          va_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "admin_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "client_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "va_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_va_id_fkey"
            columns: ["va_id"]
            isOneToOne: false
            referencedRelation: "va_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_jobs_view: {
        Row: {
          application_deadline: string | null
          client_hourly_rate: number | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          experience_level: string | null
          hours_per_week: number | null
          id: string | null
          num_vas_required: number | null
          required_skills: string[] | null
          responsibilities: string | null
          schedule: string | null
          status: string | null
          timezone: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          application_deadline?: string | null
          client_hourly_rate?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          experience_level?: string | null
          hours_per_week?: number | null
          id?: string | null
          num_vas_required?: number | null
          required_skills?: string[] | null
          responsibilities?: string | null
          schedule?: string | null
          status?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          application_deadline?: string | null
          client_hourly_rate?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          experience_level?: string | null
          hours_per_week?: number | null
          id?: string | null
          num_vas_required?: number | null
          required_skills?: string[] | null
          responsibilities?: string | null
          schedule?: string | null
          status?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_placements_view: {
        Row: {
          client_hourly_rate: number | null
          client_id: string | null
          created_at: string | null
          end_date: string | null
          hours_per_week_expected: number | null
          id: string | null
          job_id: string | null
          project_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          va_id: string | null
        }
        Insert: {
          client_hourly_rate?: number | null
          client_id?: string | null
          created_at?: string | null
          end_date?: string | null
          hours_per_week_expected?: number | null
          id?: string | null
          job_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          va_id?: string | null
        }
        Update: {
          client_hourly_rate?: number | null
          client_id?: string | null
          created_at?: string | null
          end_date?: string | null
          hours_per_week_expected?: number | null
          id?: string | null
          job_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          va_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "admin_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "client_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "va_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_va_id_fkey"
            columns: ["va_id"]
            isOneToOne: false
            referencedRelation: "va_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      va_compensation_view: {
        Row: {
          approved_hours: number | null
          expected_compensation: number | null
          placement_id: string | null
          timesheet_id: string | null
          va_hourly_rate: number | null
          week_end: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "admin_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "client_placements_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "va_placements_view"
            referencedColumns: ["id"]
          },
        ]
      }
      va_jobs_view: {
        Row: {
          application_deadline: string | null
          client_id: string | null
          created_at: string | null
          description: string | null
          experience_level: string | null
          hours_per_week: number | null
          id: string | null
          num_vas_required: number | null
          required_skills: string[] | null
          responsibilities: string | null
          schedule: string | null
          status: string | null
          timezone: string | null
          title: string | null
          updated_at: string | null
          va_hourly_rate: number | null
        }
        Insert: {
          application_deadline?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          experience_level?: string | null
          hours_per_week?: number | null
          id?: string | null
          num_vas_required?: number | null
          required_skills?: string[] | null
          responsibilities?: string | null
          schedule?: string | null
          status?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          va_hourly_rate?: number | null
        }
        Update: {
          application_deadline?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          experience_level?: string | null
          hours_per_week?: number | null
          id?: string | null
          num_vas_required?: number | null
          required_skills?: string[] | null
          responsibilities?: string | null
          schedule?: string | null
          status?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          va_hourly_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      va_placements_view: {
        Row: {
          client_id: string | null
          created_at: string | null
          end_date: string | null
          hours_per_week_expected: number | null
          id: string | null
          job_id: string | null
          project_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          va_hourly_rate: number | null
          va_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          end_date?: string | null
          hours_per_week_expected?: number | null
          id?: string | null
          job_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          va_hourly_rate?: number | null
          va_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          end_date?: string | null
          hours_per_week_expected?: number | null
          id?: string | null
          job_id?: string | null
          project_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          va_hourly_rate?: number | null
          va_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "placements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "admin_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "client_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "va_jobs_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_va_id_fkey"
            columns: ["va_id"]
            isOneToOne: false
            referencedRelation: "va_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      active_uid: { Args: never; Returns: string }
      admin_correct_locked_timesheet: {
        Args: {
          new_approved_hours: number
          new_pending_hours: number
          new_rejected_hours: number
          new_tracked_hours: number
          reason: string
          target_timesheet_id: string
        }
        Returns: undefined
      }
      admin_generate_weekly_invoice: {
        Args: { target_client_id: string; target_week_start: string }
        Returns: string
      }
      admin_set_invoice_status: {
        Args: { new_status: string; target_invoice_id: string }
        Returns: undefined
      }
      admin_set_time_entry_status: {
        Args: { new_status: string; target_time_entry_id: string }
        Returns: undefined
      }
      admin_set_timesheet_status: {
        Args: { new_status: string; target_timesheet_id: string }
        Returns: undefined
      }
      admin_update_job_rates: {
        Args: {
          new_client_hourly_rate: number
          new_va_hourly_rate: number
          target_job_id: string
        }
        Returns: undefined
      }
      admin_update_placement_rates: {
        Args: {
          new_client_hourly_rate: number
          new_va_hourly_rate: number
          target_placement_id: string
        }
        Returns: undefined
      }
      client_can_view_va: { Args: { target_va_id: string }; Returns: boolean }
      client_owns_invoice: {
        Args: { target_invoice_id: string }
        Returns: boolean
      }
      client_owns_job: { Args: { target_job_id: string }; Returns: boolean }
      client_owns_placement: {
        Args: { target_placement_id: string }
        Returns: boolean
      }
      client_owns_time_entry: {
        Args: { target_time_entry_id: string }
        Returns: boolean
      }
      client_owns_time_segment: {
        Args: { target_time_segment_id: string }
        Returns: boolean
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      delete_screenshot: {
        Args: { target_screenshot_id: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_client_member: { Args: { target_client_id: string }; Returns: boolean }
      is_client_owner: { Args: { target_client_id: string }; Returns: boolean }
      job_is_open: { Args: { target_job_id: string }; Returns: boolean }
      va_has_placement_on_project: {
        Args: { target_project_id: string }
        Returns: boolean
      }
      va_has_placement_with_client: {
        Args: { target_client_id: string }
        Returns: boolean
      }
      va_is_approved: { Args: never; Returns: boolean }
      va_owns_placement: {
        Args: { target_placement_id: string }
        Returns: boolean
      }
      va_owns_time_entry: {
        Args: { target_time_entry_id: string }
        Returns: boolean
      }
      va_owns_time_segment: {
        Args: { target_time_segment_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "active" | "suspended"
      user_role: "CLIENT" | "VA" | "ADMIN"
      va_approval_status: "pending" | "approved" | "rejected" | "suspended"
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
    Enums: {
      account_status: ["active", "suspended"],
      user_role: ["CLIENT", "VA", "ADMIN"],
      va_approval_status: ["pending", "approved", "rejected", "suspended"],
    },
  },
} as const

