import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listClients } from "@/lib/reporting/report";
import { latestClosedPeriod } from "@/lib/reporting/periods";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/reports");
  }

  const period = latestClosedPeriod();
  let clients: Awaited<ReturnType<typeof listClients>> = [];
  let error: string | null = null;

  try {
    clients = await listClients();
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Client performance, built from the normalized reporting store. Latest
          closed month: {period.label}.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>Failed to load clients: {error}</p>
          <p className="mt-1 text-xs">
            If this mentions the schema, add <code>reporting</code> to Supabase →
            Project Settings → API → Exposed schemas.
          </p>
        </div>
      )}

      {!error && clients.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No reporting clients yet. Add rows to <code>reporting.clients</code> and{" "}
          <code>reporting.client_channels</code>, then run the sync.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <Link key={client.id} href={`/reports/${client.slug}?period=${period.key}`}>
            <Card className="h-full transition-colors hover:border-foreground/20">
              <CardHeader>
                <CardTitle className="text-base">{client.name}</CardTitle>
                <CardDescription>
                  {client.brand.subtitle ?? "Paid media performance"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  View {period.label} report →
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
