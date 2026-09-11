import "server-only";
import type { ChannelKey } from "./types";

/**
 * Supermetrics stays the connector layer — we don't write API clients per
 * channel, we ask Supermetrics for rows and land them raw.
 *
 * Everything source-specific (data source id, the fields requested) lives in
 * SOURCE_QUERIES below: that's the single place to tune when a channel's
 * report needs a new column. Whatever comes back is landed verbatim into
 * reporting.raw_supermetrics; mappers.ts is what reconciles the shapes.
 */

export interface FetchParams {
  source: ChannelKey;
  accountId: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export class SupermetricsError extends Error {}

interface SourceQuery {
  /** Supermetrics data source id, e.g. 'AW' (Google Ads), 'FA' (Facebook Ads). */
  ds_id: string;
  fields: string[];
}

const SOURCE_QUERIES: Partial<Record<ChannelKey, SourceQuery>> = {
  google_ads: {
    ds_id: "AW",
    fields: ["date", "campaign", "cost", "impressions", "clicks", "conversions"],
  },
  meta_ads: {
    ds_id: "FA",
    fields: [
      "date",
      "campaign_name",
      "spend",
      "impressions",
      "inline_link_clicks",
      "actions",
    ],
  },
};

const DEFAULT_API_URL = "https://api.supermetrics.com/enterprise/v2/query/data/json";

/**
 * Fetches rows for one client-channel-window. Returns plain objects keyed by
 * the column headers Supermetrics returns.
 *
 * Without SUPERMETRICS_API_KEY this throws rather than silently returning
 * nothing — a sync that quietly lands zero rows is worse than a failed one.
 * For local work, seed the demo data (0004_reporting_seed_demo.sql) or pass
 * rows straight to `landRows()`.
 */
export async function fetchRows(
  params: FetchParams
): Promise<Record<string, unknown>[]> {
  const apiKey = process.env.SUPERMETRICS_API_KEY;
  const teamId = process.env.SUPERMETRICS_TEAM_ID;

  if (!apiKey || !teamId) {
    throw new SupermetricsError(
      "Supermetrics is not configured. Set SUPERMETRICS_API_KEY and SUPERMETRICS_TEAM_ID."
    );
  }

  const query = SOURCE_QUERIES[params.source];
  if (!query) {
    throw new SupermetricsError(
      `No Supermetrics query configured for source "${params.source}".`
    );
  }

  const payload = {
    ds_id: query.ds_id,
    ds_accounts: [params.accountId],
    date_range_type: "custom",
    start_date: params.from,
    end_date: params.to,
    fields: query.fields,
    max_rows: 100_000,
    team_id: teamId,
    api_key: apiKey,
  };

  const url = `${process.env.SUPERMETRICS_API_URL ?? DEFAULT_API_URL}?json=${encodeURIComponent(
    JSON.stringify(payload)
  )}`;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new SupermetricsError(
      `Supermetrics returned ${response.status} for ${params.source}/${params.accountId}: ${await response
        .text()
        .catch(() => "")}`.trim()
    );
  }

  return toObjects(await response.json(), params.source);
}

/**
 * Supermetrics returns `data` as a header row followed by value rows. Some
 * configurations return objects already — handle both so a query change
 * doesn't break the sync.
 */
function toObjects(body: unknown, source: ChannelKey): Record<string, unknown>[] {
  const data = (body as { data?: unknown })?.data;

  if (!Array.isArray(data)) {
    const error = (body as { error?: { message?: string } })?.error;
    throw new SupermetricsError(
      error?.message ?? `Unexpected Supermetrics response shape for ${source}.`
    );
  }
  if (data.length === 0) return [];

  if (!Array.isArray(data[0])) {
    return data as Record<string, unknown>[];
  }

  const [headers, ...rows] = data as unknown[][];
  return rows.map((row) =>
    Object.fromEntries(headers.map((header, i) => [String(header), row[i]]))
  );
}
