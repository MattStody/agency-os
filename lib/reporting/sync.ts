import "server-only";
import { randomUUID } from "crypto";
import { reportingAdminDb } from "./db";
import { normalizeBatch } from "./normalize";
import { fetchRows } from "./supermetrics";
import { latestClosedPeriod, parsePeriod } from "./periods";
import type { ChannelKey } from "./types";

const LAND_CHUNK = 500;

export interface SyncOptions {
  /** Defaults to every active client. */
  clientSlug?: string;
  /** Defaults to the client's active channels. */
  source?: ChannelKey;
  /** Defaults to the latest closed month plus the current month-to-date. */
  from?: string;
  to?: string;
}

export interface SyncTaskResult {
  client: string;
  source: ChannelKey;
  batch_id: string;
  rows_landed: number;
  rows_normalized: number;
  status: "succeeded" | "failed";
  error?: string;
}

export interface SyncResult {
  from: string;
  to: string;
  tasks: SyncTaskResult[];
}

/** Lands raw rows for one client/source under a batch id. */
export async function landRows(
  clientId: number,
  source: ChannelKey,
  rows: Record<string, unknown>[],
  batchId: string
): Promise<number> {
  const db = reportingAdminDb();
  let landed = 0;

  for (let i = 0; i < rows.length; i += LAND_CHUNK) {
    const chunk = rows.slice(i, i + LAND_CHUNK).map((payload) => ({
      batch_id: batchId,
      source,
      client_id: clientId,
      payload: payload as never,
    }));
    const { error } = await db.from("raw_supermetrics").insert(chunk);
    if (error) throw new Error(`Failed to land raw rows: ${error.message}`);
    landed += chunk.length;
  }

  return landed;
}

/**
 * The scheduled job: for every active client-channel, pull the window from
 * Supermetrics, land it raw, then normalize it into the fact table.
 *
 * One task fails, the rest continue — a broken Meta connection shouldn't cost
 * you the night's Google data. Failures are recorded in reporting.sync_runs.
 */
export async function runSync(options: SyncOptions = {}): Promise<SyncResult> {
  const db = reportingAdminDb();
  const { from, to } = resolveWindow(options);

  let clientQuery = db.from("clients").select("id, name, slug").eq("active", true);

  if (options.clientSlug) clientQuery = clientQuery.eq("slug", options.clientSlug);

  const { data: clients, error } = await clientQuery;
  if (error) throw new Error(`Failed to load clients: ${error.message}`);

  const { data: connections, error: connectionError } = await db
    .from("client_channels")
    .select("client_id, channel_id, external_account_id, active")
    .eq("active", true)
    .in("client_id", (clients ?? []).map((client) => client.id));
  if (connectionError) {
    throw new Error(`Failed to load client channels: ${connectionError.message}`);
  }

  const { data: channels, error: channelError } = await db
    .from("channels")
    .select("id, key");
  if (channelError) throw new Error(`Failed to load channels: ${channelError.message}`);
  const channelKeyById = new Map(channels.map((c) => [c.id, c.key as ChannelKey]));

  const tasks: SyncTaskResult[] = [];

  for (const client of clients ?? []) {
    const clientConnections = (connections ?? []).filter(
      (connection) => connection.client_id === client.id
    );

    for (const connection of clientConnections) {
      const source = channelKeyById.get(connection.channel_id);
      if (!source) continue;
      if (options.source && options.source !== source) continue;

      tasks.push(
        await runTask({
          clientId: client.id,
          clientName: client.name,
          source,
          accountId: connection.external_account_id ?? "",
          from,
          to,
        })
      );
    }
  }

  return { from, to, tasks };
}

async function runTask(params: {
  clientId: number;
  clientName: string;
  source: ChannelKey;
  accountId: string;
  from: string;
  to: string;
}): Promise<SyncTaskResult> {
  const db = reportingAdminDb();
  const batchId = randomUUID();

  const { data: run } = await db
    .from("sync_runs")
    .insert({
      batch_id: batchId,
      client_id: params.clientId,
      source: params.source,
      date_from: params.from,
      date_to: params.to,
    })
    .select("id")
    .single();

  const finish = async (patch: Record<string, unknown>) => {
    if (!run) return;
    await db
      .from("sync_runs")
      .update({ ...patch, finished_at: new Date().toISOString() })
      .eq("id", run.id);
  };

  try {
    const rows = await fetchRows({
      source: params.source,
      accountId: params.accountId,
      from: params.from,
      to: params.to,
    });
    const landed = await landRows(params.clientId, params.source, rows, batchId);
    const normalized = await normalizeBatch(batchId);

    await finish({
      status: "succeeded",
      rows_landed: landed,
      rows_normalized: normalized.rowsWritten,
      error: normalized.errors.length ? normalized.errors.slice(0, 20).join("\n") : null,
    });

    return {
      client: params.clientName,
      source: params.source,
      batch_id: batchId,
      rows_landed: landed,
      rows_normalized: normalized.rowsWritten,
      status: "succeeded",
    };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await finish({ status: "failed", error: message });

    return {
      client: params.clientName,
      source: params.source,
      batch_id: batchId,
      rows_landed: 0,
      rows_normalized: 0,
      status: "failed",
      error: message,
    };
  }
}

/**
 * Default window: the latest closed month through today, so a nightly run
 * both finalises last month (late conversions keep landing for weeks) and
 * keeps the current month current.
 */
function resolveWindow(options: SyncOptions): { from: string; to: string } {
  if (options.from && options.to) return { from: options.from, to: options.to };

  const period = parsePeriod(latestClosedPeriod().key);
  return {
    from: options.from ?? period.start,
    to: options.to ?? new Date().toISOString().slice(0, 10),
  };
}
