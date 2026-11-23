"use server";

// Thin server actions for Approvals: parse input → service → flush email → revalidate.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toActionError, type ActionState } from "@/lib/actions";
import { requireAccess } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { flushEmailsSoon } from "@/lib/notifications/deliver";
import type { UploadTarget } from "@/lib/storage/types";
import * as svc from "./service";
import type { ApprovalType } from "./schema";
import type { RegisterAssetInput, UploadRequest } from "./validation";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

function copyFromForm(fd: FormData) {
  return {
    primaryText: str(fd, "primaryText"),
    headline: str(fd, "headline"),
    description: str(fd, "copyDescription"),
    cta: str(fd, "cta"),
    url: str(fd, "url"),
  };
}

const itemPath = (slug: string, itemId: string) => `/c/${slug}/approvals/${itemId}`;

function revalidateItem(slug: string, itemId?: string) {
  revalidatePath(`/c/${slug}/approvals`);
  if (itemId) revalidatePath(itemPath(slug, itemId));
  revalidatePath("/tools/approvals");
}

export async function createItemAction(clientId: string, slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const access = await requireAccess();
    const type = str(fd, "type") as ApprovalType;
    const item = await svc.createItem(getDb(), access, clientId, {
      type,
      title: str(fd, "title"),
      description: str(fd, "description"),
      dueAt: str(fd, "dueAt"),
      sourceRef: str(fd, "sourceRef"),
      copy: type === "meta_ad" ? copyFromForm(fd) : undefined,
    });
    id = item.id;
  } catch (e) {
    return toActionError(e);
  }
  revalidateItem(slug);
  redirect(itemPath(slug, id));
}

export async function updateItemAction(
  clientId: string,
  slug: string,
  itemId: string,
  _: ActionState,
  fd: FormData
): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.updateItem(getDb(), access, clientId, itemId, {
      title: str(fd, "title"),
      description: str(fd, "description"),
      dueAt: str(fd, "dueAt"),
      sourceRef: str(fd, "sourceRef"),
      copy: fd.has("headline") ? copyFromForm(fd) : undefined,
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidateItem(slug, itemId);
  redirect(itemPath(slug, itemId));
}

export async function createUploadAction(
  clientId: string,
  itemId: string,
  file: UploadRequest
): Promise<{ key: string; target: UploadTarget } | { error: string }> {
  try {
    const access = await requireAccess();
    return await svc.createAssetUpload(getDb(), access, clientId, itemId, file);
  } catch (e) {
    return { error: toActionError(e).error ?? "Upload failed." };
  }
}

export async function registerAssetAction(
  clientId: string,
  slug: string,
  itemId: string,
  input: RegisterAssetInput
): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.registerAsset(getDb(), access, clientId, itemId, input);
  } catch (e) {
    return toActionError(e);
  }
  revalidateItem(slug, itemId);
  return { success: "Uploaded." };
}

export async function removeAssetAction(clientId: string, slug: string, itemId: string, assetId: string): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.removeAsset(getDb(), access, clientId, itemId, assetId);
  } catch (e) {
    return toActionError(e);
  }
  revalidateItem(slug, itemId);
  return {};
}

export async function sendForApprovalAction(
  clientId: string,
  slug: string,
  itemId: string,
  _: ActionState,
  fd: FormData
): Promise<ActionState> {
  let notified = 0;
  try {
    const access = await requireAccess();
    ({ notified } = await svc.sendForApproval(getDb(), access, clientId, itemId, { message: str(fd, "message") }));
  } catch (e) {
    return toActionError(e);
  }
  await flushEmailsSoon(getDb());
  revalidateItem(slug, itemId);
  return {
    success: notified
      ? `Sent. ${notified} client reviewer${notified === 1 ? "" : "s"} notified.`
      : "Sent. No client portal users yet — share it with them directly or record their decision here.",
  };
}

export async function decideAction(
  clientId: string,
  slug: string,
  itemId: string,
  _: ActionState,
  fd: FormData
): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const onBehalfOf = str(fd, "onBehalfOf") === "__other" ? str(fd, "onBehalfOfOther") : str(fd, "onBehalfOf");
    await svc.decide(getDb(), access, clientId, itemId, {
      decision: str(fd, "decision") as "approved" | "changes_requested",
      note: str(fd, "note"),
      onBehalfOf,
    });
  } catch (e) {
    return toActionError(e);
  }
  await flushEmailsSoon(getDb());
  revalidateItem(slug, itemId);
  return { success: "Decision recorded." };
}

export async function createVersionAction(
  clientId: string,
  slug: string,
  itemId: string,
  _: ActionState,
  fd: FormData
): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.createVersion(getDb(), access, clientId, itemId, { notes: str(fd, "notes") });
  } catch (e) {
    return toActionError(e);
  }
  revalidateItem(slug, itemId);
  redirect(itemPath(slug, itemId));
}

export async function addCommentAction(
  clientId: string,
  slug: string,
  itemId: string,
  _: ActionState,
  fd: FormData
): Promise<ActionState> {
  try {
    const access = await requireAccess();
    const tc = str(fd, "timecodeS");
    await svc.addComment(getDb(), access, clientId, itemId, {
      body: str(fd, "body"),
      timecodeS: tc ? Number(tc) : null,
      isInternal: fd.get("isInternal") === "on",
      versionId: str(fd, "versionId") || undefined,
    });
  } catch (e) {
    return toActionError(e);
  }
  await flushEmailsSoon(getDb());
  revalidateItem(slug, itemId);
  return { success: "Comment posted." };
}

export async function resolveCommentAction(
  clientId: string,
  slug: string,
  itemId: string,
  commentId: string,
  resolved: boolean
): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.setCommentResolved(getDb(), access, clientId, itemId, commentId, resolved);
  } catch (e) {
    return toActionError(e);
  }
  revalidateItem(slug, itemId);
  return {};
}

export async function setArchivedAction(
  clientId: string,
  slug: string,
  itemId: string,
  archived: boolean
): Promise<ActionState> {
  try {
    const access = await requireAccess();
    await svc.setArchived(getDb(), access, clientId, itemId, archived);
  } catch (e) {
    return toActionError(e);
  }
  revalidateItem(slug, itemId);
  return {};
}
