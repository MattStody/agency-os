import "server-only";
import { reportingDb } from "./db";
import { evaluateFormula, FormulaError } from "./formula";
import { parsePeriod, previousPeriod } from "./periods";
import type {
  BaseMetrics,
  ClientBrand,
  MetricDefinition,
  MetricFormat,
  ReportChannel,
  ReportData,
  ReportingClient,
  ReportKpi,
} from "./types";

const EMPTY: BaseMetrics = { spend: 0, impressions: 0, clicks: 0, conversions: 0 };

export async function listClients(): Promise<ReportingClient[]> {
  const { data, error } = await reportingDb()
    .from("clients")
    .select("id, name, slug, brand")
    .eq("active", true)
    .order("name");

  if (error) throw new Error(`Failed to load clients: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    brand: (row.brand ?? {}) as ClientBrand,
  }));
}

export async function getClientBySlug(slug: string): Promise<ReportingClient | null> {
  const { data, error } = await reportingDb()
    .from("clients")
    .select("id, name, slug, brand")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to load client: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    brand: (data.brand ?? {}) as ClientBrand,
  };
}

async function loadMetricDefinitions(): Promise<MetricDefinition[]> {
  const { data, error } = await reportingDb()
    .from("metric_definitions")
    .select("*")
    .order("sort_order");

  if (error) throw new Error(`Failed to load metric definitions: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    format: row.format as MetricFormat,
  }));
}

/**
 * Produces the report's data contract from the normalized store. Every number
 * on a report comes through here, so a metric means the same thing on every
 * client's report — that's the whole point of metric_definitions.
 */
export async function buildReport(
  client: ReportingClient,
  periodKey: string
): Promise<ReportData> {
  const period = parsePeriod(periodKey);
  const compare = previousPeriod(period);

  const { data: rollup, error } = await reportingDb().rpc("report_rollup", {
    p_client_id: client.id,
    p_start: period.start,
    p_end: period.end,
    p_prev_start: compare.start,
    p_prev_end: compare.end,
  });

  if (error) throw new Error(`Failed to build report: ${error.message}`);

  const rows = (rollup ?? []).map((row) => ({
    ...row,
    spend: Number(row.spend),
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
    conversions: Number(row.conversions),
  }));

  const current = rows.filter((row) => row.bucket === "current");
  const previous = rows.filter((row) => row.bucket === "previous");
  const previousByChannel = new Map(previous.map((row) => [row.channel_key, row]));

  const totals = sumMetrics(current);
  const prevTotals = sumMetrics(previous);

  const definitions = await loadMetricDefinitions();
  const kpis: ReportKpi[] = definitions
    .filter((definition) => definition.is_kpi)
    .map((definition) => ({
      label: definition.label,
      value: safeEvaluate(definition, totals),
      prev: safeEvaluate(definition, prevTotals),
      format: definition.format,
      lower_is_better: definition.lower_is_better || undefined,
    }));

  const channels: ReportChannel[] = current
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => {
      const prev = previousByChannel.get(row.channel_key);
      return {
        name: row.channel_label,
        cls: row.channel_cls,
        spend: row.spend,
        clicks: row.clicks,
        conversions: row.conversions,
        prev: prev
          ? {
              spend: prev.spend,
              impressions: prev.impressions,
              clicks: prev.clicks,
              conversions: prev.conversions,
            }
          : undefined,
      };
    });

  return {
    client: client.name,
    subtitle: client.brand.subtitle ?? "Paid media performance",
    period_label: period.label,
    compare_label: `vs. ${compare.label}`,
    kpis,
    channels,
  };
}

export interface CampaignRow extends BaseMetrics {
  channel: string;
  cls: string;
  campaign: string;
}

/**
 * Campaign-grain detail for the report body. Read straight off the fact table
 * (the '(account)' rows are excluded so nothing double-counts).
 */
export async function loadCampaignDetail(
  clientId: number,
  periodKey: string,
  limit = 25
): Promise<CampaignRow[]> {
  const period = parsePeriod(periodKey);

  const { data, error } = await reportingDb()
    .from("ad_performance_daily")
    .select("channel_id, campaign, spend, impressions, clicks, conversions")
    .eq("client_id", clientId)
    .gte("date", period.start)
    .lte("date", period.end)
    .neq("campaign", "(account)");

  if (error) throw new Error(`Failed to load campaign detail: ${error.message}`);

  const { data: channels, error: channelError } = await reportingDb()
    .from("channels")
    .select("id, label, cls");
  if (channelError) throw new Error(`Failed to load channels: ${channelError.message}`);
  const channelById = new Map(channels.map((c) => [c.id, c]));

  const byCampaign = new Map<string, CampaignRow>();
  for (const row of data ?? []) {
    const channel = channelById.get(row.channel_id);
    const key = `${row.channel_id}|${row.campaign}`;
    const existing =
      byCampaign.get(key) ??
      ({
        channel: channel?.label ?? "Unknown",
        cls: channel?.cls ?? "neutral",
        campaign: row.campaign,
        ...EMPTY,
      } satisfies CampaignRow);

    existing.spend += Number(row.spend);
    existing.impressions += Number(row.impressions);
    existing.clicks += Number(row.clicks);
    existing.conversions += Number(row.conversions);
    byCampaign.set(key, existing);
  }

  return [...byCampaign.values()]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);
}

/** Months this client actually has data for, newest first. */
export async function availablePeriods(clientId: number): Promise<string[]> {
  const { data, error } = await reportingDb()
    .from("ad_performance_daily")
    .select("date")
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .limit(2000);

  if (error) throw new Error(`Failed to load available periods: ${error.message}`);

  const months = new Set((data ?? []).map((row) => row.date.slice(0, 7)));
  return [...months].sort().reverse();
}

function sumMetrics(rows: BaseMetrics[]): BaseMetrics {
  return rows.reduce<BaseMetrics>(
    (total, row) => ({
      spend: total.spend + row.spend,
      impressions: total.impressions + row.impressions,
      clicks: total.clicks + row.clicks,
      conversions: total.conversions + row.conversions,
    }),
    { ...EMPTY }
  );
}

/** A bad formula shouldn't take the whole report down — the KPI just reads "—". */
function safeEvaluate(definition: MetricDefinition, metrics: BaseMetrics): number | null {
  try {
    return evaluateFormula(definition.formula, metrics);
  } catch (cause) {
    if (cause instanceof FormulaError) {
      console.error(`Invalid metric definition "${definition.key}": ${cause.message}`);
      return null;
    }
    throw cause;
  }
}
