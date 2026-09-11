import "server-only";
import type { Json } from "@/lib/supabase/types";
import { reportingAdminDb } from "./db";
import { mapRow, MappingError } from "./mappers";
import type { ChannelKey, FactRow } from "./types";

const UPSERT_CHUNK = 500;

export interface NormalizeResult {
  rowsRead: number;
  rowsWritten: number;
  skipped: number;
  errors: string[];
  /** Dates touched, so callers know what window to roll up. */
  from: string | null;
  to: string | null;
}

export async function channelIdByKey(): Promise<Map<ChannelKey, number>> {
  const db = reportingAdminDb();
  const { data, error } = await db.from("channels").select("id, key");
  if (error) throw new Error(`Failed to load channels: ${error.message}`);
  return new Map(data.map((c) => [c.key as ChannelKey, c.id]));
}

/**
 * raw_supermetrics → ad_performance_daily.
 *
 * Idempotent by construction: the fact table's primary key is
 * (client_id, channel_id, date, campaign), so replaying a batch overwrites
 * rather than duplicates. Raw rows are marked `normalized_at` once written,
 * and account totals are rebuilt for the window that changed.
 */
export async function normalizeBatch(batchId: string): Promise<NormalizeResult> {
  const db = reportingAdminDb();
  const result: NormalizeResult = {
    rowsRead: 0,
    rowsWritten: 0,
    skipped: 0,
    errors: [],
    from: null,
    to: null,
  };

  const { data: rawRows, error } = await db
    .from("raw_supermetrics")
    .select("id, source, client_id, payload")
    .eq("batch_id", batchId)
    .is("normalized_at", null);

  if (error) throw new Error(`Failed to read raw rows: ${error.message}`);
  if (!rawRows?.length) return result;

  result.rowsRead = rawRows.length;
  const channels = await channelIdByKey();

  // (client_id, channel_id, date, campaign) → row, so duplicate raw rows for
  // the same grain collapse instead of fighting each other in the upsert.
  const facts = new Map<string, FactRow>();
  const touched = new Map<string, { clientId: number; channelId: number; dates: string[] }>();
  const normalizedIds: number[] = [];

  for (const raw of rawRows) {
    const channelId = channels.get(raw.source as ChannelKey);
    if (!channelId) {
      result.skipped += 1;
      result.errors.push(`Unknown source "${raw.source}" (raw row ${raw.id})`);
      continue;
    }

    try {
      const mapped = mapRow(raw.source as ChannelKey, raw.payload as Record<string, unknown>);
      const key = `${raw.client_id}|${channelId}|${mapped.date}|${mapped.campaign}`;
      facts.set(key, {
        client_id: raw.client_id,
        channel_id: channelId,
        date: mapped.date,
        campaign: mapped.campaign,
        spend: mapped.spend,
        impressions: Math.round(mapped.impressions),
        clicks: Math.round(mapped.clicks),
        conversions: mapped.conversions,
        metrics: mapped.metrics,
      });

      const windowKey = `${raw.client_id}|${channelId}`;
      const window = touched.get(windowKey) ?? {
        clientId: raw.client_id,
        channelId,
        dates: [],
      };
      window.dates.push(mapped.date);
      touched.set(windowKey, window);
      normalizedIds.push(raw.id);
    } catch (cause) {
      result.skipped += 1;
      result.errors.push(
        cause instanceof MappingError
          ? `${cause.message} (raw row ${raw.id})`
          : `Failed to map raw row ${raw.id}: ${(cause as Error).message}`
      );
    }
  }

  const rows = [...facts.values()];
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    const { error: upsertError } = await db
      .from("ad_performance_daily")
      .upsert(
        chunk.map((row) => ({ ...row, metrics: row.metrics as Json })),
        { onConflict: "client_id,channel_id,date,campaign" }
      );
    if (upsertError) {
      throw new Error(`Failed to upsert performance rows: ${upsertError.message}`);
    }
    result.rowsWritten += chunk.length;
  }

  // Derive the '(account)' totals for every window this batch touched.
  for (const { clientId, channelId, dates } of touched.values()) {
    const sorted = [...dates].sort();
    const from = sorted[0];
    const to = sorted[sorted.length - 1];
    result.from = result.from && result.from < from ? result.from : from;
    result.to = result.to && result.to > to ? result.to : to;

    const { error: rollupError } = await db.rpc("rebuild_account_totals", {
      p_client_id: clientId,
      p_channel_id: channelId,
      p_from: from,
      p_to: to,
    });
    if (rollupError) {
      throw new Error(`Failed to rebuild account totals: ${rollupError.message}`);
    }
  }

  for (let i = 0; i < normalizedIds.length; i += UPSERT_CHUNK) {
    const { error: markError } = await db
      .from("raw_supermetrics")
      .update({ normalized_at: new Date().toISOString() })
      .in("id", normalizedIds.slice(i, i + UPSERT_CHUNK));
    if (markError) {
      throw new Error(`Failed to mark raw rows normalized: ${markError.message}`);
    }
  }

  return result;
}
