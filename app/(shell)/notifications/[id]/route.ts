// Click-through: mark the notification read, then go to what it's about.
import { NextResponse, type NextRequest } from "next/server";
import { getAccess } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { markRead } from "@/lib/notifications";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await getAccess();
  if (!access) return NextResponse.redirect(new URL("/login", req.url));
  const n = /^[0-9a-f-]{36}$/i.test(params.id) ? await markRead(getDb(), access, params.id) : null;
  const target = n?.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : "/notifications";
  return NextResponse.redirect(new URL(target, req.url));
}
