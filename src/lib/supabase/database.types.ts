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
      attendance_records: {
        Row: {
          attendance_date: string
          check_in_time: string | null
          check_out_time: string | null
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attendance_date: string
          check_in_time?: string | null
          check_out_time?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attendance_date?: string
          check_in_time?: string | null
          check_out_time?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_same_company"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "attendance_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
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
          created_at: string
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["company_status"]
          subdomain: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["company_status"]
          subdomain?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["company_status"]
          subdomain?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["company_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["company_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["company_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_packages: {
        Row: {
          activated_at: string | null
          assigned_at: string
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          installation_source: Database["public"]["Enums"]["install_source"]
          package_key: string
          package_version: string | null
          status: Database["public"]["Enums"]["company_package_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          assigned_at?: string
          company_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          installation_source?: Database["public"]["Enums"]["install_source"]
          package_key: string
          package_version?: string | null
          status?: Database["public"]["Enums"]["company_package_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          assigned_at?: string
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          installation_source?: Database["public"]["Enums"]["install_source"]
          package_key?: string
          package_version?: string | null
          status?: Database["public"]["Enums"]["company_package_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_packages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_packages_package_key_fkey"
            columns: ["package_key"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["key"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_email: string | null
          company_id: string
          created_at: string
          locale: string | null
          logo_url: string | null
          phone: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          company_email?: string | null
          company_id: string
          created_at?: string
          locale?: string | null
          logo_url?: string | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          company_email?: string | null
          company_id?: string
          created_at?: string
          locale?: string | null
          logo_url?: string | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          company_id: string
          created_at: string
          head: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["hr_record_status"]
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          head?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["hr_record_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          head?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["hr_record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_checks: {
        Row: {
          created_at: string
          detail: string
          dimension: Database["public"]["Enums"]["diagnostic_dimension"]
          id: string
          report_id: string
          required: boolean
          status: Database["public"]["Enums"]["diagnostic_status"]
        }
        Insert: {
          created_at?: string
          detail?: string
          dimension: Database["public"]["Enums"]["diagnostic_dimension"]
          id?: string
          report_id: string
          required?: boolean
          status?: Database["public"]["Enums"]["diagnostic_status"]
        }
        Update: {
          created_at?: string
          detail?: string
          dimension?: Database["public"]["Enums"]["diagnostic_dimension"]
          id?: string
          report_id?: string
          required?: boolean
          status?: Database["public"]["Enums"]["diagnostic_status"]
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_checks_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_reports: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          package_version_id: string
          recommendation: string
          result: Database["public"]["Enums"]["diagnostic_status"]
          summary: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          package_version_id: string
          recommendation?: string
          result?: Database["public"]["Enums"]["diagnostic_status"]
          summary?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          package_version_id?: string
          recommendation?: string
          result?: Database["public"]["Enums"]["diagnostic_status"]
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_reports_package_version_id_fkey"
            columns: ["package_version_id"]
            isOneToOne: false
            referencedRelation: "package_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          company_id: string
          created_at: string
          department_id: string | null
          employee_number: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          id: string
          position_id: string | null
          status: Database["public"]["Enums"]["employee_status"]
          termination_date: string | null
          termination_reason: string | null
          updated_at: string
          user_id: string | null
          work_email: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          department_id?: string | null
          employee_number: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name: string
          id?: string
          position_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string
          user_id?: string | null
          work_email?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          department_id?: string | null
          employee_number?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name?: string
          id?: string
          position_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          termination_date?: string | null
          termination_reason?: string | null
          updated_at?: string
          user_id?: string | null
          work_email?: string | null
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
            foreignKeyName: "employees_department_same_company"
            columns: ["company_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "employees_position_same_company"
            columns: ["company_id", "position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_request_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_same_company"
            columns: ["company_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      package_installations: {
        Row: {
          attempt_count: number
          company_id: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          last_attempt_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          package_key: string
          release_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["installation_status"]
          version: string
        }
        Insert: {
          attempt_count?: number
          company_id: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          package_key: string
          release_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["installation_status"]
          version: string
        }
        Update: {
          attempt_count?: number
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          package_key?: string
          release_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["installation_status"]
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_installations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_installations_package_key_fkey"
            columns: ["package_key"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "package_installations_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "package_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      package_release_targets: {
        Row: {
          company_id: string
          created_at: string
          id: string
          release_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          release_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          release_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_release_targets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_release_targets_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "package_releases"
            referencedColumns: ["id"]
          },
        ]
      }
      package_releases: {
        Row: {
          automatic_install: boolean
          created_at: string
          id: string
          package_version_id: string
          released_at: string
          released_by: string | null
          status: Database["public"]["Enums"]["release_status"]
          target_mode: Database["public"]["Enums"]["release_target_mode"]
          update_policy: Database["public"]["Enums"]["update_policy"]
        }
        Insert: {
          automatic_install?: boolean
          created_at?: string
          id?: string
          package_version_id: string
          released_at?: string
          released_by?: string | null
          status?: Database["public"]["Enums"]["release_status"]
          target_mode: Database["public"]["Enums"]["release_target_mode"]
          update_policy?: Database["public"]["Enums"]["update_policy"]
        }
        Update: {
          automatic_install?: boolean
          created_at?: string
          id?: string
          package_version_id?: string
          released_at?: string
          released_by?: string | null
          status?: Database["public"]["Enums"]["release_status"]
          target_mode?: Database["public"]["Enums"]["release_target_mode"]
          update_policy?: Database["public"]["Enums"]["update_policy"]
        }
        Relationships: [
          {
            foreignKeyName: "package_releases_package_version_id_fkey"
            columns: ["package_version_id"]
            isOneToOne: false
            referencedRelation: "package_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      package_versions: {
        Row: {
          compatibility_notes: string
          created_at: string
          diagnostic_status: string | null
          id: string
          notes: string
          package_key: string
          released_at: string | null
          version: string
        }
        Insert: {
          compatibility_notes?: string
          created_at?: string
          diagnostic_status?: string | null
          id?: string
          notes?: string
          package_key: string
          released_at?: string | null
          version: string
        }
        Update: {
          compatibility_notes?: string
          created_at?: string
          diagnostic_status?: string | null
          id?: string
          notes?: string
          package_key?: string
          released_at?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_versions_package_key_fkey"
            columns: ["package_key"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["key"]
          },
        ]
      }
      packages: {
        Row: {
          base_package_key: string | null
          category: Database["public"]["Enums"]["package_category"]
          created_at: string
          description: string | null
          is_active: boolean
          key: string
          min_base_version: string | null
          name: string
          type: Database["public"]["Enums"]["package_type"]
          updated_at: string
        }
        Insert: {
          base_package_key?: string | null
          category?: Database["public"]["Enums"]["package_category"]
          created_at?: string
          description?: string | null
          is_active?: boolean
          key: string
          min_base_version?: string | null
          name: string
          type: Database["public"]["Enums"]["package_type"]
          updated_at?: string
        }
        Update: {
          base_package_key?: string | null
          category?: Database["public"]["Enums"]["package_category"]
          created_at?: string
          description?: string | null
          is_active?: boolean
          key?: string
          min_base_version?: string | null
          name?: string
          type?: Database["public"]["Enums"]["package_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_base_package_key_fkey"
            columns: ["base_package_key"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["key"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          code: string
          company_id: string
          created_at: string
          department_id: string | null
          id: string
          reports_to: string | null
          status: Database["public"]["Enums"]["hr_record_status"]
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          department_id?: string | null
          id?: string
          reports_to?: string | null
          status?: Database["public"]["Enums"]["hr_record_status"]
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          department_id?: string | null
          id?: string
          reports_to?: string | null
          status?: Database["public"]["Enums"]["hr_record_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_department_same_company"
            columns: ["company_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      request_records: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          diagnostic_id: string | null
          id: string
          internal_note: string
          linked_package_key: string | null
          linked_package_version: string | null
          priority: Database["public"]["Enums"]["request_priority"]
          request_type: string
          source_email_reference: string
          status: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          diagnostic_id?: string | null
          id?: string
          internal_note?: string
          linked_package_key?: string | null
          linked_package_version?: string | null
          priority?: Database["public"]["Enums"]["request_priority"]
          request_type: string
          source_email_reference: string
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          diagnostic_id?: string | null
          id?: string
          internal_note?: string
          linked_package_key?: string | null
          linked_package_version?: string | null
          priority?: Database["public"]["Enums"]["request_priority"]
          request_type?: string
          source_email_reference?: string
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_records_diagnostic_fk"
            columns: ["diagnostic_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_records_linked_package_key_fkey"
            columns: ["linked_package_key"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_use_company_package: {
        Args: { target_company: string; target_package: string; uid?: string }
        Returns: boolean
      }
      company_has_package: {
        Args: { target_company: string; target_package: string }
        Returns: boolean
      }
      create_package_release: {
        Args: {
          p_automatic_install?: boolean
          p_company_ids?: string[]
          p_target_mode: Database["public"]["Enums"]["release_target_mode"]
          p_version_id: string
        }
        Returns: Json
      }
      create_package_version: {
        Args: {
          p_compatibility_notes?: string
          p_package_key: string
          p_release_notes: string
          p_version: string
        }
        Returns: Json
      }
      create_package_with_version: {
        Args: {
          p_base_package_key?: string
          p_description: string
          p_key: string
          p_name: string
          p_release_notes: string
          p_type: Database["public"]["Enums"]["package_type"]
          p_version: string
        }
        Returns: Json
      }
      has_company_role: {
        Args: {
          target_company: string
          target_role: Database["public"]["Enums"]["company_role"]
          uid?: string
        }
        Returns: boolean
      }
      install_marketplace_extension: {
        Args: { p_package_key: string }
        Returns: Json
      }
      installation_can_transition: {
        Args: {
          from_status: Database["public"]["Enums"]["installation_status"]
          to_status: Database["public"]["Enums"]["installation_status"]
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { target_company: string; uid?: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { uid?: string }; Returns: boolean }
      marketplace_adoption: {
        Args: never
        Returns: {
          distinct_companies: number
          install_count: number
          package_key: string
          package_name: string
        }[]
      }
      onboard_company: {
        Args: {
          p_company_email?: string
          p_company_name: string
          p_phone?: string
          p_slug: string
          p_subdomain: string
          p_user_id: string
        }
        Returns: Json
      }
      platform_audit_log: {
        Args: { p_company_ids?: string[]; p_limit?: number }
        Returns: {
          action: string
          actor: string
          created_at: string
          entity_type: string
          id: string
          target: string
        }[]
      }
      process_package_installation: {
        Args: { p_installation_id: string }
        Returns: Json
      }
      publish_package_release: {
        Args: {
          p_automatic_install?: boolean
          p_company_ids?: string[]
          p_target_mode: Database["public"]["Enums"]["release_target_mode"]
          p_version_id: string
        }
        Returns: Json
      }
      publish_update_to_installers: {
        Args: { p_version_id: string }
        Returns: Json
      }
      recompute_diagnostic_result: {
        Args: { p_report: string }
        Returns: undefined
      }
      request_status_can_transition: {
        Args: {
          from_status: Database["public"]["Enums"]["request_status"]
          to_status: Database["public"]["Enums"]["request_status"]
        }
        Returns: boolean
      }
      retry_package_installation: {
        Args: { p_installation_id: string }
        Returns: Json
      }
      rollback_package_installation: {
        Args: { p_installation_id: string }
        Returns: Json
      }
      system_health: {
        Args: never
        Returns: {
          label: string
          status: string
          value: string
        }[]
      }
      usage_metrics: {
        Args: { p_company_ids?: string[] }
        Returns: {
          action_count: number
          companies_using: number
          module: string
        }[]
      }
      valid_semver: { Args: { p_version: string }; Returns: boolean }
      version_release_blocked: {
        Args: { p_version_id: string }
        Returns: boolean
      }
    }
    Enums: {
      attendance_status: "present" | "late" | "absent"
      company_package_status: "assigned" | "installing" | "installed" | "failed"
      company_role: "company_admin" | "company_user"
      company_status: "active" | "suspended"
      diagnostic_dimension:
        | "frontend"
        | "backend"
        | "database"
        | "security"
        | "dependency"
        | "data_impact"
        | "rollback"
        | "test_evidence"
      diagnostic_status: "PASS" | "WARN" | "FAIL"
      employee_status: "active" | "on_leave" | "terminated"
      employment_type: "full_time" | "part_time" | "contract"
      hr_record_status: "active" | "disabled"
      install_source:
        | "platform_push"
        | "company_marketplace"
        | "private_assignment"
        | "registration_default"
      installation_status:
        | "pending"
        | "installing"
        | "installed"
        | "failed"
        | "retrying"
        | "rolled_back"
      leave_request_status: "pending" | "approved" | "rejected" | "cancelled"
      leave_type: "annual" | "sick" | "unpaid"
      membership_status: "active" | "inactive" | "suspended"
      package_category:
        | "standard_package"
        | "marketplace_extension"
        | "private_standalone"
        | "private_extension"
      package_type:
        | "standard_update"
        | "private_customization"
        | "shared_extension"
        | "bug_fix"
        | "configuration_update"
        | "security_update"
        | "private_extension"
      release_status: "published" | "failed"
      release_target_mode:
        | "all_companies"
        | "selected_companies"
        | "one_company"
      request_priority: "low" | "medium" | "high"
      request_status:
        | "received"
        | "under_review"
        | "approved"
        | "rejected"
        | "in_development"
        | "testing"
        | "ready_for_release"
        | "released"
        | "installed"
        | "closed"
      update_policy: "platform_managed" | "company_managed"
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
      attendance_status: ["present", "late", "absent"],
      company_package_status: ["assigned", "installing", "installed", "failed"],
      company_role: ["company_admin", "company_user"],
      company_status: ["active", "suspended"],
      diagnostic_dimension: [
        "frontend",
        "backend",
        "database",
        "security",
        "dependency",
        "data_impact",
        "rollback",
        "test_evidence",
      ],
      diagnostic_status: ["PASS", "WARN", "FAIL"],
      employee_status: ["active", "on_leave", "terminated"],
      employment_type: ["full_time", "part_time", "contract"],
      hr_record_status: ["active", "disabled"],
      install_source: [
        "platform_push",
        "company_marketplace",
        "private_assignment",
        "registration_default",
      ],
      installation_status: [
        "pending",
        "installing",
        "installed",
        "failed",
        "retrying",
        "rolled_back",
      ],
      leave_request_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: ["annual", "sick", "unpaid"],
      membership_status: ["active", "inactive", "suspended"],
      package_category: [
        "standard_package",
        "marketplace_extension",
        "private_standalone",
        "private_extension",
      ],
      package_type: [
        "standard_update",
        "private_customization",
        "shared_extension",
        "bug_fix",
        "configuration_update",
        "security_update",
        "private_extension",
      ],
      release_status: ["published", "failed"],
      release_target_mode: [
        "all_companies",
        "selected_companies",
        "one_company",
      ],
      request_priority: ["low", "medium", "high"],
      request_status: [
        "received",
        "under_review",
        "approved",
        "rejected",
        "in_development",
        "testing",
        "ready_for_release",
        "released",
        "installed",
        "closed",
      ],
      update_policy: ["platform_managed", "company_managed"],
    },
  },
} as const

