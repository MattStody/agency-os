"use client";

import { useState, useTransition } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionState } from "@/lib/actions";

/** Runs a bound server action on click, with optional confirm and inline error. */
export function ActionButton({
  action,
  confirm,
  children,
  pendingLabel,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: () => Promise<ActionState>;
  confirm?: string;
  pendingLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <Button
        type="button"
        disabled={pending || props.disabled}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            const res = await action();
            if (res?.error) setError(res.error);
          });
        }}
        {...props}
      >
        {pending ? pendingLabel ?? "Working…" : children}
      </Button>
      {error && <span className="mt-1 text-xs text-destructive">{error}</span>}
    </span>
  );
}
