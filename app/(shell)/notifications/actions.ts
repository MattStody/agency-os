"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/actions";
import { requireAccess } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { markAllRead } from "@/lib/notifications";

export async function markAllReadAction(): Promise<ActionState> {
  const access = await requireAccess();
  await markAllRead(getDb(), access);
  revalidatePath("/", "layout");
  return {};
}
