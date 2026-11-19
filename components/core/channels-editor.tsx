"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { ActionButton } from "@/components/forms/action-button";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, Input, Select } from "@/components/ui/input";
import { initialActionState, type ActionState } from "@/lib/actions";
import type { ClientChannel } from "@/lib/db/schema";
import { CHANNEL_LABELS } from "@/modules/core/validation";

const PLACEHOLDERS: Partial<Record<ClientChannel["channel"], string>> = {
  google_ads: "123-456-7890",
  meta: "act_1234567890",
  ga4: "properties/123456789",
};

export function ChannelsEditor({
  channels,
  addAction,
  removeActions,
}: {
  channels: ClientChannel[];
  addAction: (s: ActionState, fd: FormData) => Promise<ActionState>;
  removeActions: Record<string, () => Promise<ActionState>>;
}) {
  const [state, formAction] = useFormState(addAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-6">
      <ul className="divide-y rounded-lg border">
        {channels.length === 0 && <li className="p-4 text-sm text-muted-foreground">No accounts yet.</li>}
        {channels.map((ch) => (
          <li key={ch.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-brand-ink">
                {CHANNEL_LABELS[ch.channel]} {ch.label && <span className="font-normal text-muted-foreground">· {ch.label}</span>}
              </p>
              <p className="font-mono text-xs text-brand-sea">{ch.externalAccountId}</p>
            </div>
            <ActionButton
              variant="ghost"
              size="sm"
              action={removeActions[ch.id]}
              confirm={`Remove ${CHANNEL_LABELS[ch.channel]} account ${ch.externalAccountId}?`}
              pendingLabel="Removing…"
            >
              Remove
            </ActionButton>
          </li>
        ))}
      </ul>

      <form ref={formRef} action={formAction} className="grid items-end gap-3 sm:grid-cols-[160px_1fr_1fr_auto]">
        <Field label="Channel" htmlFor="channel">
          <Select id="channel" name="channel" defaultValue="google_ads">
            {Object.entries(CHANNEL_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Account / property ID" htmlFor="externalAccountId">
          <Input id="externalAccountId" name="externalAccountId" required placeholder={PLACEHOLDERS.google_ads} />
        </Field>
        <Field label="Label" htmlFor="label">
          <Input id="label" name="label" placeholder="Optional" />
        </Field>
        <SubmitButton variant="outline" pendingLabel="Adding…">
          Add account
        </SubmitButton>
        <FormMessage state={state} className="sm:col-span-4" />
      </form>
    </div>
  );
}
