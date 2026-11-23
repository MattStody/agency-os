"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { initialActionState, type ActionState } from "@/lib/actions";
import { cn } from "@/lib/utils";
import type { AdCopy, ApprovalType } from "@/modules/approvals/schema";
import { CTA_OPTIONS, TYPE_LABELS } from "@/modules/approvals/validation";

export function ItemForm({
  action,
  initial,
  copyEditable = true,
  submitLabel,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  initial?: {
    type: ApprovalType;
    title: string;
    description: string | null;
    dueAt: string | null;
    sourceRef: string | null;
    copy: AdCopy;
  };
  copyEditable?: boolean;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, initialActionState);
  const [type, setType] = useState<ApprovalType>(initial?.type ?? "meta_ad");
  const copy = initial?.copy ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {!initial ? (
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">What needs approval?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["meta_ad", "clip"] as const).map((t) => (
              <label
                key={t}
                className={cn(
                  "cursor-pointer rounded-lg border bg-white px-4 py-3 transition",
                  type === t ? "border-brand-ink ring-1 ring-brand-ink" : "hover:border-brand-sage"
                )}
              >
                <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                <span className="block text-sm font-medium text-brand-ink">{TYPE_LABELS[t]}</span>
                <span className="block text-xs text-muted-foreground">
                  {t === "meta_ad" ? "Image, video or carousel with ad copy" : "A video clip or reel, e.g. from Riverside"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <input type="hidden" name="type" value={type} />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Title" htmlFor="title" className="sm:col-span-2">
          <Input id="title" name="title" required defaultValue={initial?.title} placeholder={type === "clip" ? "e.g. Episode 4 — clip 2" : "e.g. Spring offer — feed ad"} />
        </Field>
        <Field label="Needed by" htmlFor="dueAt">
          <Input id="dueAt" name="dueAt" type="date" defaultValue={initial?.dueAt ?? ""} />
        </Field>
        <Field
          label={type === "clip" ? "Source (Riverside link, episode)" : "Source (Meta ad / ad set)"}
          htmlFor="sourceRef"
        >
          <Input id="sourceRef" name="sourceRef" defaultValue={initial?.sourceRef ?? ""} />
        </Field>
        <Field label="Notes for reviewers" htmlFor="description" className="sm:col-span-2">
          <Textarea id="description" name="description" rows={2} defaultValue={initial?.description ?? ""} />
        </Field>
      </div>

      {type === "meta_ad" && copyEditable && (
        <fieldset className="space-y-4 rounded-lg border bg-brand-paper/40 p-4">
          <legend className="px-1 text-[13px] font-medium">Ad copy</legend>
          <Field label="Primary text" htmlFor="primaryText">
            <Textarea id="primaryText" name="primaryText" rows={3} defaultValue={copy.primaryText ?? ""} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Headline" htmlFor="headline">
              <Input id="headline" name="headline" defaultValue={copy.headline ?? ""} />
            </Field>
            <Field label="Description" htmlFor="copyDescription">
              <Input id="copyDescription" name="copyDescription" defaultValue={copy.description ?? ""} />
            </Field>
            <Field label="Call to action" htmlFor="cta">
              <Select id="cta" name="cta" defaultValue={copy.cta ?? "Learn more"}>
                {CTA_OPTIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Destination URL" htmlFor="url">
              <Input id="url" name="url" type="url" placeholder="https://" defaultValue={copy.url ?? ""} />
            </Field>
          </div>
        </fieldset>
      )}
      {type === "meta_ad" && !copyEditable && (
        <p className="text-xs text-muted-foreground">Ad copy is locked once a version is sent. Start a new version to change it.</p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
