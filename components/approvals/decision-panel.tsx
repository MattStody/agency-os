"use client";

import { Check, Send } from "lucide-react";
import { useState } from "react";
import { useFormState } from "react-dom";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { initialActionState, type ActionState } from "@/lib/actions";

type FormAction = (s: ActionState, fd: FormData) => Promise<ActionState>;

/** Approve / request changes. Internal users record it on behalf of a client contact. */
export function DecisionForm({
  action,
  approvers,
  internal,
}: {
  action: FormAction;
  approvers: { name: string; title: string | null }[];
  internal: boolean;
}) {
  const [mode, setMode] = useState<"approved" | "changes_requested" | null>(null);
  const [behalf, setBehalf] = useState(approvers[0]?.name ?? "__other");
  const [state, formAction] = useFormState(action, initialActionState);

  if (state.success) return <FormMessage state={state} />;

  if (!mode) {
    return (
      <div className="space-y-3">
        {internal && (
          <p className="text-xs text-muted-foreground">Heard back by email or phone? Record the client&rsquo;s decision here.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setMode("approved")} className="gap-1.5">
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button variant="outline" onClick={() => setMode("changes_requested")}>
            Request changes
          </Button>
        </div>
      </div>
    );
  }

  const changes = mode === "changes_requested";
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="decision" value={mode} />
      {internal && (
        <Field label="Decision from" htmlFor="onBehalfOf">
          <Select id="onBehalfOf" name="onBehalfOf" value={behalf} onChange={(e) => setBehalf(e.target.value)}>
            {approvers.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name}
                {a.title ? ` — ${a.title}` : ""}
              </option>
            ))}
            <option value="__other">Someone else…</option>
          </Select>
          {behalf === "__other" && <Input name="onBehalfOfOther" required placeholder="Name" className="mt-2" />}
        </Field>
      )}
      <Field label={changes ? "What needs to change?" : "Note (optional)"} htmlFor="note">
        <Textarea id="note" name="note" rows={3} required={changes} autoFocus />
      </Field>
      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Saving…">
          {changes ? "Request changes" : "Approve"}
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setMode(null)}>
          Cancel
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function SendForm({ action, disabledReason }: { action: FormAction; disabledReason?: string | null }) {
  const [state, formAction] = useFormState(action, initialActionState);
  if (state.success) return <FormMessage state={state} />;
  return (
    <form action={formAction} className="space-y-3">
      <Field label="Message to the client (optional)" htmlFor="message">
        <Textarea id="message" name="message" rows={2} placeholder="Anything they should know before reviewing…" />
      </Field>
      {disabledReason && <p className="text-xs text-amber-800">{disabledReason}</p>}
      <SubmitButton className="w-full gap-1.5" disabled={!!disabledReason} pendingLabel="Sending…">
        <Send className="h-4 w-4" /> Send for approval
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function NewVersionForm({ action, nextNo }: { action: FormAction; nextNo: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(action, initialActionState);
  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        Start version {nextNo}
      </Button>
    );
  }
  return (
    <form action={formAction} className="space-y-3">
      <Field label={`What changed in version ${nextNo}?`} htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} placeholder="e.g. Trimmed the intro, added captions" />
      </Field>
      <div className="flex gap-2">
        <SubmitButton pendingLabel="Creating…">Create draft</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
