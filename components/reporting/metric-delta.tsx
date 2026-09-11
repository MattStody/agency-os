import { computeDelta } from "@/lib/reporting/format";
import { cn } from "@/lib/utils";

/**
 * Period-over-period change. Colour follows whether the change is *good* for
 * the metric, not whether the number went up — CPA falling is green.
 */
export function MetricDelta({
  value,
  prev,
  lowerIsBetter,
  className,
}: {
  value: number | null;
  prev: number | null;
  lowerIsBetter?: boolean;
  className?: string;
}) {
  const delta = computeDelta(value, prev, lowerIsBetter);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        delta.tone === "positive" && "text-emerald-600",
        delta.tone === "negative" && "text-destructive",
        delta.tone === "neutral" && "text-muted-foreground",
        className
      )}
    >
      {delta.direction !== "flat" && (
        <span aria-hidden>{delta.direction === "up" ? "▲" : "▼"}</span>
      )}
      {delta.label}
    </span>
  );
}
