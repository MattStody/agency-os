"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "./actions";

export function GoogleSignInButton({ nextPath }: { nextPath?: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      className="h-11 w-full gap-3"
      disabled={isPending}
      onClick={() => startTransition(() => signInWithGoogle(nextPath))}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
        <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" opacity=".95" />
        <path fill="#fff" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" opacity=".8" />
        <path fill="#fff" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" opacity=".65" />
        <path fill="#fff" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6Z" opacity=".5" />
      </svg>
      {isPending ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
