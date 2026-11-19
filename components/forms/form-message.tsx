import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/actions";

export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (!state.error && !state.success) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        state.error ? "bg-destructive/10 text-destructive" : "bg-brand-mint/30 text-brand-ink",
        className
      )}
    >
      {state.error ?? state.success}
    </p>
  );
}
