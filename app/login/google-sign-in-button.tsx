"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "./actions";

export function GoogleSignInButton({ nextPath }: { nextPath?: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="w-full"
      disabled={isPending}
      onClick={() => startTransition(() => signInWithGoogle(nextPath))}
    >
      {isPending ? "Redirecting..." : "Continue with Google"}
    </Button>
  );
}
