import type { MetricFormat } from "./types";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const wholeMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
});

export function formatMetric(value: number | null, format: MetricFormat): string {
  if (value === null || !Number.isFinite(value)) return "—";

  switch (format) {
    case "money":
      return Math.abs(value) >= 1000 ? wholeMoney.format(value) : money.format(value);
    case "int":
      return int.format(value);
    case "percent":
      return percent.format(value);
    default:
      return decimal.format(value);
  }
}

export interface Delta {
  /** Signed fractional change, e.g. 0.12 for +12%. Null when there's no baseline. */
  ratio: number | null;
  label: string;
  /** Whether the change is good for this metric, given lower_is_better. */
  direction: "up" | "down" | "flat";
  tone: "positive" | "negative" | "neutral";
}

export function computeDelta(
  value: number | null,
  prev: number | null,
  lowerIsBetter = false
): Delta {
  if (value === null || prev === null || prev === 0) {
    return { ratio: null, label: "—", direction: "flat", tone: "neutral" };
  }

  const ratio = (value - prev) / Math.abs(prev);
  const direction = ratio > 0.0001 ? "up" : ratio < -0.0001 ? "down" : "flat";
  const improved = lowerIsBetter ? direction === "down" : direction === "up";

  return {
    ratio,
    label: `${ratio > 0 ? "+" : ""}${percent.format(ratio)}`,
    direction,
    tone: direction === "flat" ? "neutral" : improved ? "positive" : "negative",
  };
}
