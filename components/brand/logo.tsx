import { cn } from "@/lib/utils";

// Placeholder wordmark until the official logo file is supplied.
// To swap: drop the SVG in public/brand/ and render it here.
export function Logo({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span
        className={cn(
          "font-serif text-[22px] font-medium leading-none tracking-tight",
          tone === "light" ? "text-brand-paper" : "text-brand-ink"
        )}
      >
        Boldly
      </span>
      <span
        className={cn(
          "rounded-sm px-1 py-px text-[10px] font-semibold uppercase leading-none tracking-[0.14em]",
          tone === "light" ? "bg-brand-mint/90 text-brand-ink" : "bg-brand-ink text-brand-paper"
        )}
      >
        OS
      </span>
    </span>
  );
}
