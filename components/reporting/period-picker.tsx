"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { parsePeriod } from "@/lib/reporting/periods";

/** Month selector — navigates to the same report at a different period. */
export function PeriodPicker({
  slug,
  periods,
  selected,
}: {
  slug: string;
  periods: string[];
  selected: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Period</span>
      <select
        className="h-9 rounded-md border bg-background px-2 text-sm disabled:opacity-60"
        value={selected}
        disabled={isPending}
        onChange={(event) => {
          const period = event.target.value;
          startTransition(() => {
            router.push(`/reports/${slug}?period=${period}`);
          });
        }}
      >
        {periods.map((period) => (
          <option key={period} value={period}>
            {parsePeriod(period).label}
          </option>
        ))}
      </select>
    </label>
  );
}
