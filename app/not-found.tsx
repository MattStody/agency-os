import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo tone="dark" />
      <h1 className="mt-10 font-serif text-4xl text-brand-ink">Not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This page doesn&rsquo;t exist, or you don&rsquo;t have access to it.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to Boldly OS</Link>
      </Button>
    </div>
  );
}
