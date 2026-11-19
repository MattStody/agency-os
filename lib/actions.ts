// Shared shape + error mapping for server actions used with useFormState.
import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/permissions";

export interface ActionState {
  error?: string;
  success?: string;
}

export const initialActionState: ActionState = {};

function pgMessage(e: unknown): string | undefined {
  const cause = (e as { cause?: { code?: string; constraint?: string } })?.cause;
  if (cause?.code === "23505") {
    if (cause.constraint?.includes("slug")) return "That URL slug is already taken.";
    if (cause.constraint?.includes("email")) return "That email is already in use.";
    if (cause.constraint?.includes("client_channels")) return "That account is already connected.";
    return "That already exists.";
  }
  return undefined;
}

/** redirect()/notFound() throw special errors that Next must receive untouched. */
function isNextControlFlow(e: unknown): boolean {
  const digest = (e as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND");
}

export function toActionError(e: unknown): ActionState {
  if (isNextControlFlow(e)) throw e;
  if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Check the form and try again." };
  if (e instanceof ForbiddenError) return { error: e.message };
  const pg = pgMessage(e);
  if (pg) return { error: pg };
  if (e instanceof Error && e.name === "NotFoundError") return { error: e.message };
  if (e instanceof Error && !e.message.startsWith("Failed query")) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}
