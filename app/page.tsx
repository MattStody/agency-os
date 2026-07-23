import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/projects");
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Agency OS</h1>
      <p className="max-w-md text-muted-foreground">
        Manage your projects and their linked Google Drive files in one
        place.
      </p>
      <Button asChild size="lg">
        <Link href="/login">Get started</Link>
      </Button>
    </div>
  );
}
