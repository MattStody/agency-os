/**
 * Types for the `reporting` schema (supabase/migrations/0003_reporting.sql).
 * Kept separate from types.ts so the CRM schema and the reporting schema can
 * be regenerated independently.
 */
import type { Json } from "./types";

export interface ReportingSchema {
  Tables: {
    clients: {
      Row: {
        id: number;
        crm_project_id: string | null;
        name: string;
        slug: string;
        brand: Json;
        active: boolean;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: number;
        crm_project_id?: string | null;
        name: string;
        slug: string;
        brand?: Json;
        active?: boolean;
        created_at?: string;
        updated_at?: string;
      };
      Update: {
        id?: number;
        crm_project_id?: string | null;
        name?: string;
        slug?: string;
        brand?: Json;
        active?: boolean;
        created_at?: string;
        updated_at?: string;
      };
      Relationships: [];
    };
    channels: {
      Row: { id: number; key: string; label: string; cls: string; sort_order: number };
      Insert: { id?: number; key: string; label: string; cls?: string; sort_order?: number };
      Update: { id?: number; key?: string; label?: string; cls?: string; sort_order?: number };
      Relationships: [];
    };
    client_channels: {
      Row: {
        client_id: number;
        channel_id: number;
        external_account_id: string | null;
        active: boolean;
      };
      Insert: {
        client_id: number;
        channel_id: number;
        external_account_id?: string | null;
        active?: boolean;
      };
      Update: {
        client_id?: number;
        channel_id?: number;
        external_account_id?: string | null;
        active?: boolean;
      };
      Relationships: [];
    };
    ad_performance_daily: {
      Row: {
        client_id: number;
        channel_id: number;
        date: string;
        campaign: string;
        spend: number;
        impressions: number;
        clicks: number;
        conversions: number;
        metrics: Json;
        loaded_at: string;
      };
      Insert: {
        client_id: number;
        channel_id: number;
        date: string;
        campaign?: string;
        spend?: number;
        impressions?: number;
        clicks?: number;
        conversions?: number;
        metrics?: Json;
        loaded_at?: string;
      };
      Update: {
        client_id?: number;
        channel_id?: number;
        date?: string;
        campaign?: string;
        spend?: number;
        impressions?: number;
        clicks?: number;
        conversions?: number;
        metrics?: Json;
        loaded_at?: string;
      };
      Relationships: [];
    };
    metric_definitions: {
      Row: {
        key: string;
        label: string;
        formula: string;
        lower_is_better: boolean;
        format: string;
        is_kpi: boolean;
        sort_order: number;
      };
      Insert: {
        key: string;
        label: string;
        formula: string;
        lower_is_better?: boolean;
        format?: string;
        is_kpi?: boolean;
        sort_order?: number;
      };
      Update: {
        key?: string;
        label?: string;
        formula?: string;
        lower_is_better?: boolean;
        format?: string;
        is_kpi?: boolean;
        sort_order?: number;
      };
      Relationships: [];
    };
    commentary: {
      Row: {
        client_id: number;
        period: string;
        section: string;
        body: string | null;
        ai_draft: string | null;
        updated_by: string | null;
        updated_at: string;
      };
      Insert: {
        client_id: number;
        period: string;
        section: string;
        body?: string | null;
        ai_draft?: string | null;
        updated_by?: string | null;
        updated_at?: string;
      };
      Update: {
        client_id?: number;
        period?: string;
        section?: string;
        body?: string | null;
        ai_draft?: string | null;
        updated_by?: string | null;
        updated_at?: string;
      };
      Relationships: [];
    };
    raw_supermetrics: {
      Row: {
        id: number;
        batch_id: string;
        source: string;
        client_id: number;
        payload: Json;
        synced_at: string;
        normalized_at: string | null;
      };
      Insert: {
        id?: number;
        batch_id: string;
        source: string;
        client_id: number;
        payload: Json;
        synced_at?: string;
        normalized_at?: string | null;
      };
      Update: {
        id?: number;
        batch_id?: string;
        source?: string;
        client_id?: number;
        payload?: Json;
        synced_at?: string;
        normalized_at?: string | null;
      };
      Relationships: [];
    };
    sync_runs: {
      Row: {
        id: number;
        batch_id: string;
        client_id: number | null;
        source: string | null;
        status: string;
        date_from: string | null;
        date_to: string | null;
        rows_landed: number;
        rows_normalized: number;
        error: string | null;
        started_at: string;
        finished_at: string | null;
      };
      Insert: {
        id?: number;
        batch_id: string;
        client_id?: number | null;
        source?: string | null;
        status?: string;
        date_from?: string | null;
        date_to?: string | null;
        rows_landed?: number;
        rows_normalized?: number;
        error?: string | null;
        started_at?: string;
        finished_at?: string | null;
      };
      Update: {
        id?: number;
        batch_id?: string;
        client_id?: number | null;
        source?: string | null;
        status?: string;
        date_from?: string | null;
        date_to?: string | null;
        rows_landed?: number;
        rows_normalized?: number;
        error?: string | null;
        started_at?: string;
        finished_at?: string | null;
      };
      Relationships: [];
    };
  };
  Views: Record<string, never>;
  Functions: {
    rebuild_account_totals: {
      Args: {
        p_client_id: number;
        p_channel_id: number;
        p_from: string;
        p_to: string;
      };
      Returns: number;
    };
    report_rollup: {
      Args: {
        p_client_id: number;
        p_start: string;
        p_end: string;
        p_prev_start: string;
        p_prev_end: string;
      };
      Returns: {
        bucket: string;
        channel_key: string;
        channel_label: string;
        channel_cls: string;
        sort_order: number;
        spend: number;
        impressions: number;
        clicks: number;
        conversions: number;
      }[];
    };
  };
}
