"use server";

// Server actions for the core module: parse FormData, call the service, revalidate.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toActionError, type ActionState } from "@/lib/actions";
import { requireAccess } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import * as svc from "./service";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

function clientFromForm(fd: FormData) {
  return {
    name: str(fd, "name"),
    slug: str(fd, "slug"),
    legalName: str(fd, "legalName"),
    website: str(fd, "website"),
    industry: str(fd, "industry"),
    city: str(fd, "city"),
    status: (str(fd, "status") || "active") as never,
    services: fd.getAll("services").map(String),
    timezone: str(fd, "timezone") || "America/Toronto",
    currency: str(fd, "currency") || "CAD",
    notes: str(fd, "notes"),
    crmRef: str(fd, "crmRef"),
  };
}

export async function createClientAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let slug: string;
  try {
    const access = await requireAccess();
    const client = await svc.createClient(getDb(), access, clientFromForm(fd));
    slug = client.slug;
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/", "layout");
  redirect(`/c/${slug}/settings?created=1`);
}

export async function updateClientAction(clientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let slug: string;
  try {
    const access = await requireAccess();
    const client = await svc.updateClient(getDb(), access, clientId, clientFromForm(fd));
    slug = client.slug;
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/", "layout");
  // The slug may have changed, so land on the canonical URL.
  redirect(`/c/${slug}/settings?saved=1`);
}

export async function addChannelAction(clientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.addChannel(getDb(), access, clientId, {
      channel: str(fd, "channel") as never,
      externalAccountId: str(fd, "externalAccountId"),
      label: str(fd, "label"),
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/c/[client]", "layout");
  return { success: "Account added." };
}

export async function removeChannelAction(clientId: string, channelId: string): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.removeChannel(getDb(), access, clientId, channelId);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/c/[client]", "layout");
  return {};
}

function contactFromForm(fd: FormData) {
  return {
    name: str(fd, "name"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    title: str(fd, "title"),
    isPrimary: bool(fd, "isPrimary"),
    isApprover: bool(fd, "isApprover"),
  };
}

export async function addContactAction(clientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.addContact(getDb(), access, clientId, contactFromForm(fd));
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/c/[client]", "layout");
  return { success: "Contact added." };
}

export async function updateContactAction(
  clientId: string,
  contactId: string,
  _: ActionState,
  fd: FormData
): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.updateContact(getDb(), access, clientId, contactId, contactFromForm(fd));
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/c/[client]", "layout");
  return { success: "Contact saved." };
}

export async function removeContactAction(clientId: string, contactId: string): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.removeContact(getDb(), access, clientId, contactId);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/c/[client]", "layout");
  return {};
}

export async function inviteTeamMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const user = await svc.inviteTeamMember(getDb(), access, {
      email: str(fd, "email"),
      name: str(fd, "name"),
      title: str(fd, "title"),
      role: (str(fd, "role") || "team") as "admin" | "team",
    });
    revalidatePath("/admin/team");
    return { success: `${user.name ?? user.email} can now sign in with Google.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setTeamRoleAction(userId: string, role: "admin" | "team"): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.setTeamRole(getDb(), access, userId, role);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/admin/team");
  return {};
}

export async function setUserActiveAction(userId: string, isActive: boolean): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.setUserActive(getDb(), access, userId, isActive);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/admin/team");
  return {};
}
