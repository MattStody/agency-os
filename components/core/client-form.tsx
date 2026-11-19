"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { initialActionState, type ActionState } from "@/lib/actions";
import type { Client } from "@/lib/db/schema";
import { SERVICE_OPTIONS } from "@/modules/core/validation";

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export function ClientForm({
  action,
  client,
  canChangeStatus = true,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  client?: Client;
  canChangeStatus?: boolean;
}) {
  const [state, formAction] = useFormState(action, initialActionState);
  const [name, setName] = useState(client?.name ?? "");
  const [slug, setSlug] = useState(client?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(client));
  const services = Array.from(new Set([...SERVICE_OPTIONS, ...(client?.services ?? [])]));

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Client name" htmlFor="name">
          <Input
            id="name"
            name="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(toSlug(e.target.value));
            }}
          />
        </Field>
        <Field label="URL slug" htmlFor="slug" hint={`boldly-os/c/${slug || "client-name"}`}>
          <Input
            id="slug"
            name="slug"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </Field>
        <Field label="Legal name" htmlFor="legalName">
          <Input id="legalName" name="legalName" defaultValue={client?.legalName ?? ""} />
        </Field>
        <Field label="Website" htmlFor="website">
          <Input id="website" name="website" type="url" placeholder="https://" defaultValue={client?.website ?? ""} />
        </Field>
        <Field label="Industry" htmlFor="industry">
          <Input id="industry" name="industry" defaultValue={client?.industry ?? ""} />
        </Field>
        <Field label="City" htmlFor="city">
          <Input id="city" name="city" placeholder="Hamilton, ON" defaultValue={client?.city ?? ""} />
        </Field>
        {canChangeStatus && (
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={client?.status ?? "active"}>
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        )}
        <Field label="CRM reference" htmlFor="crmRef" hint="Optional ID of this client in the CRM.">
          <Input id="crmRef" name="crmRef" defaultValue={client?.crmRef ?? ""} />
        </Field>
      </div>
      {!canChangeStatus && <input type="hidden" name="status" value={client?.status ?? "active"} />}
      <input type="hidden" name="timezone" value={client?.timezone ?? "America/Toronto"} />
      <input type="hidden" name="currency" value={client?.currency ?? "CAD"} />

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">Services</legend>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm has-[:checked]:border-brand-periwinkle has-[:checked]:bg-brand-periwinkle/10"
            >
              <input
                type="checkbox"
                name="services"
                value={s}
                defaultChecked={client?.services.includes(s)}
                className="accent-brand-ink"
              />
              {s}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ""} />
      </Field>

      <div className="flex items-center gap-4">
        <SubmitButton>{client ? "Save changes" : "Create client"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
