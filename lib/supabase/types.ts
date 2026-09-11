import type { ReportingSchema } from "./reporting-types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          drive_folder_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          drive_folder_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          drive_folder_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      google_tokens: {
        Row: {
          user_id: string;
          access_token: string;
          refresh_token: string | null;
          scope: string | null;
          token_type: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          access_token: string;
          refresh_token?: string | null;
          scope?: string | null;
          token_type?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          access_token?: string;
          refresh_token?: string | null;
          scope?: string | null;
          token_type?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
  reporting: ReportingSchema;
}

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type GoogleTokenRow = Database["public"]["Tables"]["google_tokens"]["Row"];

export type ReportingClientRow =
  Database["reporting"]["Tables"]["clients"]["Row"];
export type ChannelRow = Database["reporting"]["Tables"]["channels"]["Row"];
export type AdPerformanceRow =
  Database["reporting"]["Tables"]["ad_performance_daily"]["Row"];
export type MetricDefinitionRow =
  Database["reporting"]["Tables"]["metric_definitions"]["Row"];
export type CommentaryRow = Database["reporting"]["Tables"]["commentary"]["Row"];
