"use client";

import { useEffect } from "react";
import { LAST_CLIENT_COOKIE } from "@/lib/auth/constants";

/** Remembers the last client viewed so global pages keep the switcher on it. */
export function RememberClient({ slug }: { slug: string }) {
  useEffect(() => {
    document.cookie = `${LAST_CLIENT_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`;
  }, [slug]);
  return null;
}
