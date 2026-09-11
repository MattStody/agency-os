import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";

export async function Nav() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          Agency OS
        </Link>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/projects"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Projects
              </Link>
              <Link
                href="/reports"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Reports
              </Link>
              <UserMenu email={user.email ?? ""} />
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
