"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { ActionButton } from "@/components/forms/action-button";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/input";
import { initialActionState, type ActionState } from "@/lib/actions";
import type { ClientContact } from "@/lib/db/schema";

type FormAction = (s: ActionState, fd: FormData) => Promise<ActionState>;

function ContactFields({ contact, idPrefix }: { contact?: ClientContact; idPrefix: string }) {
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor={id("name")}>
          <Input id={id("name")} name="name" required defaultValue={contact?.name} />
        </Field>
        <Field label="Title" htmlFor={id("title")}>
          <Input id={id("title")} name="title" defaultValue={contact?.title ?? ""} />
        </Field>
        <Field label="Email" htmlFor={id("email")}>
          <Input id={id("email")} name="email" type="email" defaultValue={contact?.email ?? ""} />
        </Field>
        <Field label="Phone" htmlFor={id("phone")}>
          <Input id={id("phone")} name="phone" type="tel" defaultValue={contact?.phone ?? ""} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isPrimary" defaultChecked={contact?.isPrimary} className="accent-brand-ink" /> Primary contact
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isApprover" defaultChecked={contact?.isApprover} className="accent-brand-ink" /> Can approve work
        </label>
      </div>
    </>
  );
}

function EditContact({ contact, action, removeAction }: { contact: ClientContact; action: FormAction; removeAction: () => Promise<ActionState> }) {
  const [state, formAction] = useFormState(action, initialActionState);
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:hidden">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium text-brand-ink">
            {contact.name}
            {contact.isPrimary && <Badge variant="mint">Primary</Badge>}
            {contact.isApprover && <Badge variant="lavender">Approver</Badge>}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[contact.title, contact.email].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="text-xs text-brand-sea group-open:hidden">Edit</span>
        <span className="hidden text-xs text-muted-foreground group-open:inline">Close</span>
      </summary>
      <form action={formAction} className="space-y-4 border-t bg-brand-paper/40 px-4 py-4">
        <ContactFields contact={contact} idPrefix={contact.id} />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SubmitButton size="sm">Save contact</SubmitButton>
            <FormMessage state={state} />
          </div>
          <ActionButton variant="ghost" size="sm" action={removeAction} confirm={`Remove ${contact.name}?`} pendingLabel="Removing…">
            Remove
          </ActionButton>
        </div>
      </form>
    </details>
  );
}

export function ContactsEditor({
  contacts,
  addAction,
  updateActions,
  removeActions,
}: {
  contacts: ClientContact[];
  addAction: FormAction;
  updateActions: Record<string, FormAction>;
  removeActions: Record<string, () => Promise<ActionState>>;
}) {
  const [state, formAction] = useFormState(addAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-6">
      <div className="divide-y rounded-lg border">
        {contacts.length === 0 && <p className="p-4 text-sm text-muted-foreground">No contacts yet.</p>}
        {contacts.map((c) => (
          <EditContact key={c.id} contact={c} action={updateActions[c.id]} removeAction={removeActions[c.id]} />
        ))}
      </div>
      <form ref={formRef} action={formAction} className="space-y-4">
        <p className="text-[13px] font-medium">Add a contact</p>
        <ContactFields idPrefix="new-contact" />
        <div className="flex items-center gap-3">
          <SubmitButton variant="outline" pendingLabel="Adding…">
            Add contact
          </SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>
    </div>
  );
}
