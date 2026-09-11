import type { BaseMetrics, ChannelKey } from "./types";

/**
 * The one place each source's quirks get reconciled.
 *
 * Supermetrics does NOT hand back matching shapes: column names, conversion
 * semantics and date formats all differ per source, and change if someone
 * edits the query's selected fields. So every field is looked up through an
 * alias list, and anything source-specific goes into `metrics` (jsonb) rather
 * than forcing a migration.
 */

export interface MappedRow extends BaseMetrics {
  date: string; // YYYY-MM-DD
  campaign: string;
  metrics: Record<string, unknown>;
}

export class MappingError extends Error {}

type RawRow = Record<string, unknown>;

/** Supermetrics headers arrive as "Campaign name", "Cost", "Amount spent (USD)", ... */
function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // drop currency/unit suffixes
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function indexRow(row: RawRow): Map<string, unknown> {
  const index = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    index.set(normalizeKey(key), value);
  }
  return index;
}

function pick(index: Map<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    const value = index.get(alias);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

/** "1,234.56", "$1,234.56", 1234.56 → 1234.56. Unparseable → 0. */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Accepts YYYY-MM-DD, YYYYMMDD, MM/DD/YYYY and ISO timestamps. */
export function toDate(value: unknown, source: string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value ?? "").trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (slash) {
    const [, month, day, year] = slash;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  throw new MappingError(`Unrecognized date "${raw}" from ${source}.`);
}

/**
 * Meta reports conversions as an `actions` array of { action_type, value }.
 * What counts as "our unified action" is a business decision — this is the
 * default set; per-client overrides belong in metric_definitions (Phase 2+).
 */
const META_CONVERSION_ACTIONS = new Set([
  "lead",
  "purchase",
  "complete_registration",
  "contact",
  "submit_application",
  "schedule",
  "offsite_conversion.fb_pixel_lead",
  "offsite_conversion.fb_pixel_purchase",
]);

function metaConversions(index: Map<string, unknown>): number {
  const direct = pick(index, ["conversions", "results", "leads"]);
  if (direct !== undefined) return toNumber(direct);

  const actions = pick(index, ["actions"]);
  const list =
    typeof actions === "string"
      ? safeParseArray(actions)
      : Array.isArray(actions)
        ? actions
        : [];

  return list.reduce((total: number, action: unknown) => {
    if (!action || typeof action !== "object") return total;
    const { action_type: type, value } = action as Record<string, unknown>;
    if (typeof type !== "string" || !META_CONVERSION_ACTIONS.has(type)) return total;
    return total + toNumber(value);
  }, 0);
}

function safeParseArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Everything not mapped to a first-class column, minus the noise. */
function extras(index: Map<string, unknown>, consumed: string[]): Record<string, unknown> {
  const skip = new Set([...consumed, "actions", "account_name", "account_id", "currency"]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of index) {
    if (skip.has(key) || value === undefined || value === null || value === "") continue;
    out[key] = typeof value === "string" ? toNumber(value) || value : value;
  }
  return out;
}

type Mapper = (row: RawRow) => MappedRow;

const DATE_ALIASES = ["date", "date_start", "day", "date_day"];
const CAMPAIGN_ALIASES = ["campaign", "campaign_name", "campaignname"];

const googleAds: Mapper = (row) => {
  const index = indexRow(row);
  const consumed = [
    ...DATE_ALIASES,
    ...CAMPAIGN_ALIASES,
    "cost",
    "spend",
    "impressions",
    "clicks",
    "conversions",
    "conv",
  ];
  return {
    date: toDate(pick(index, DATE_ALIASES), "google_ads"),
    campaign: String(pick(index, CAMPAIGN_ALIASES) ?? "(not set)"),
    spend: toNumber(pick(index, ["cost", "spend"])),
    impressions: toNumber(pick(index, ["impressions"])),
    clicks: toNumber(pick(index, ["clicks"])),
    conversions: toNumber(pick(index, ["conversions", "conv"])),
    metrics: extras(index, consumed),
  };
};

const metaAds: Mapper = (row) => {
  const index = indexRow(row);
  const consumed = [
    ...DATE_ALIASES,
    ...CAMPAIGN_ALIASES,
    "date_stop",
    "spend",
    "amount_spent",
    "cost",
    "impressions",
    "inline_link_clicks",
    "link_clicks",
    "clicks",
    "conversions",
    "results",
    "leads",
  ];
  return {
    date: toDate(pick(index, DATE_ALIASES), "meta_ads"),
    campaign: String(pick(index, CAMPAIGN_ALIASES) ?? "(not set)"),
    spend: toNumber(pick(index, ["spend", "amount_spent", "cost"])),
    impressions: toNumber(pick(index, ["impressions"])),
    // Meta's "clicks" counts every click on the ad; link clicks are the
    // comparable number to Google's clicks, so prefer them when present.
    clicks: toNumber(pick(index, ["inline_link_clicks", "link_clicks", "clicks"])),
    conversions: metaConversions(index),
    metrics: extras(index, consumed),
  };
};

/** Generic fallback: only the four base columns, everything else to jsonb. */
const passthrough: Mapper = (row) => {
  const index = indexRow(row);
  return {
    date: toDate(pick(index, DATE_ALIASES), "unknown"),
    campaign: String(pick(index, CAMPAIGN_ALIASES) ?? "(account)"),
    spend: toNumber(pick(index, ["spend", "cost"])),
    impressions: toNumber(pick(index, ["impressions"])),
    clicks: toNumber(pick(index, ["clicks", "sessions"])),
    conversions: toNumber(pick(index, ["conversions", "goal_completions", "calls"])),
    metrics: extras(index, [...DATE_ALIASES, ...CAMPAIGN_ALIASES]),
  };
};

const MAPPERS: Partial<Record<ChannelKey, Mapper>> = {
  google_ads: googleAds,
  meta_ads: metaAds,
};

export function mapRow(source: ChannelKey, row: RawRow): MappedRow {
  return (MAPPERS[source] ?? passthrough)(row);
}
