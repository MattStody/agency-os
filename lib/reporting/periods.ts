/**
 * Report periods are calendar months, identified by "YYYY-MM". Everything is
 * computed in UTC so a report never shifts by a day depending on where the
 * server runs.
 */
export interface Period {
  /** "YYYY-MM" */
  key: string;
  /** First day of the month, YYYY-MM-DD. Also the `period` key for commentary. */
  start: string;
  /** Last day of the month, YYYY-MM-DD. */
  end: string;
  /** e.g. "August 2026" */
  label: string;
}

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isPeriodKey(value: string | undefined | null): value is string {
  return typeof value === "string" && MONTH_KEY.test(value);
}

export function parsePeriod(key: string): Period {
  if (!isPeriodKey(key)) {
    throw new Error(`Invalid period "${key}" — expected YYYY-MM.`);
  }
  const [year, month] = key.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    key,
    start: iso(start),
    end: iso(end),
    label: start.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

/** The month before `period` — what every report compares against. */
export function previousPeriod(period: Period): Period {
  const [year, month] = period.key.split("-").map(Number);
  const prev = new Date(Date.UTC(year, month - 2, 1));
  return parsePeriod(periodKeyOf(prev));
}

export function periodKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The most recent complete month — the default report period. */
export function latestClosedPeriod(now: Date = new Date()): Period {
  const firstOfThisMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const lastMonth = new Date(firstOfThisMonth.getTime() - 24 * 60 * 60 * 1000);
  return parsePeriod(periodKeyOf(lastMonth));
}

/** `count` months ending with the latest closed month, newest first. */
export function recentPeriods(count: number, now: Date = new Date()): Period[] {
  const latest = latestClosedPeriod(now);
  const [year, month] = latest.key.split("-").map(Number);
  return Array.from({ length: count }, (_, i) =>
    parsePeriod(periodKeyOf(new Date(Date.UTC(year, month - 1 - i, 1))))
  );
}

/** Inclusive day range, used by the sync job to bound a fetch. */
export function dateRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (
    let d = new Date(`${from}T00:00:00Z`);
    iso(d) <= to;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    days.push(iso(d));
  }
  return days;
}
