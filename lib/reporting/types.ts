/** Channel keys are the fixed vocabulary seeded in reporting.channels. */
export type ChannelKey =
  | "google_ads"
  | "meta_ads"
  | "ga4"
  | "gsc"
  | "call_tracking";

/** The four cross-channel metrics that are first-class columns on the fact table. */
export interface BaseMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

/** One normalized row, ready to upsert into reporting.ad_performance_daily. */
export interface FactRow extends BaseMetrics {
  client_id: number;
  channel_id: number;
  date: string; // YYYY-MM-DD
  campaign: string;
  metrics: Record<string, unknown>;
}

export interface ReportingClient {
  id: number;
  name: string;
  slug: string;
  brand: ClientBrand;
}

export interface ClientBrand {
  logo_url?: string;
  primary_color?: string;
  subtitle?: string;
}

export interface MetricDefinition {
  key: string;
  label: string;
  formula: string;
  lower_is_better: boolean;
  format: MetricFormat;
  is_kpi: boolean;
  sort_order: number;
}

export type MetricFormat = "money" | "int" | "number" | "percent";

/**
 * The report's data contract. The branded template consumes exactly this
 * object — Phase 0's job is to make Postgres return it.
 */
export interface ReportData {
  client: string;
  subtitle: string;
  period_label: string;
  compare_label: string;
  kpis: ReportKpi[];
  channels: ReportChannel[];
}

export interface ReportKpi {
  label: string;
  value: number | null;
  prev: number | null;
  format: MetricFormat;
  lower_is_better?: boolean;
}

export interface ReportChannel {
  name: string;
  cls: string;
  spend: number;
  clicks: number;
  conversions: number;
  prev?: BaseMetrics;
}

/** A row as returned by reporting.report_rollup(). */
export interface RollupRow {
  bucket: "current" | "previous";
  channel_key: ChannelKey;
  channel_label: string;
  channel_cls: string;
  sort_order: number;
  spend: number | string;
  impressions: number | string;
  clicks: number | string;
  conversions: number | string;
}
