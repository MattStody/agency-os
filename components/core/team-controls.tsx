"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, Input, Select } from "@/components/ui/input";
import { initialActionState, type ActionState } from "@/lib/actions";

export function RoleSelect({
  role,
  action,
  disabled,
}: {
  role: "admin" | "team";
  action: (role: "admin" | "team") => Promise<ActionState>;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <Select
        aria-label="Role"
        defaultValue={role}
        disabled={disabled || pending}
        className="h-8 w-36 text-[13px]"
        onChange={(e) => {
          const next = e.target.value as "admin" | "team";
          setError(null);
          start(async () => {
            const res = await action(next);
            if (res.error) setError(res.error);
          });
        }}
      >
        <option value="admin">Admin</option>
        <option value="team">Team member</option>
      </Select>
      {error && <span className="mt-1 text-xs text-destructive">{error}</span>}
    </span>
  );
}

export function InviteForm({ action }: { action: (s: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useFormState(action, initialActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Work email" htmlFor="invite-email">
          <Input id="invite-email" name="email" type="email" required />
        </Field>
        <Field label="Name" htmlFor="invite-name">
          <Input id="invite-name" name="name" />
        </Field>
        <Field label="Title" htmlFor="invite-title">
          <Input id="invite-title" name="title" placeholder="Digital Marketing Specialist" />
        </Field>
        <Field label="Role" htmlFor="invite-role">
          <Select id="invite-role" name="role" defaultValue="team">
            <option value="team">Team member</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Adding…">Add to team</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
