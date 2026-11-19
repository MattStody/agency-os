import { inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getAccess } from "@/lib/auth/session";
import { isDemoLoginEnabled } from "@/lib/auth/demo";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_IDS, demoUsers } from "@/db/seed/data";
import { ROLE_LABELS } from "@/lib/permissions";
import { signInAsDemoUser } from "./actions";
import { GoogleSignInButton } from "./google-sign-in-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  if (await getAccess()) redirect(searchParams.next ?? "/");

  const demoEnabled = isDemoLoginEnabled();
  let demoChoices: typeof demoUsers = [];
  if (demoEnabled) {
    const present = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, Object.values(DEMO_IDS.users)));
    const ids = new Set(present.map((p) => p.id));
    demoChoices = demoUsers.filter((u) => ids.has(u.id));
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-ink p-12 md:flex md:flex-col md:justify-between">
        <Logo className="relative z-10" />
        <div className="relative z-10 max-w-md">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-brand-mint">
            Boldly Media · Hamilton, ON
          </p>
          <h1 className="font-serif text-[44px] font-normal leading-[1.05] text-brand-paper">
            One home for how we <em className="text-brand-mint">grow</em> our clients.
          </h1>
        </div>
        <p className="relative z-10 text-xs text-brand-sage">Internal use only.</p>
        <svg aria-hidden className="absolute -right-24 -top-24 h-[520px] w-[520px] opacity-[0.12]" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="98" fill="none" stroke="#A9E0D6" strokeWidth="0.6" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="#7F9BF2" strokeWidth="0.6" />
          <circle cx="100" cy="100" r="42" fill="none" stroke="#C7C0F6" strokeWidth="0.6" />
        </svg>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 md:hidden">
            <Logo tone="dark" />
          </div>
          <h2 className="font-serif text-3xl font-medium text-brand-ink">Sign in</h2>
          <p className="mt-2 text-sm text-muted-foreground">Use your Boldly Google Workspace account.</p>

          {searchParams.error && (
            <p role="alert" className="mt-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {searchParams.error}
            </p>
          )}

          <div className="mt-8">
            {isSupabaseConfigured() ? (
              <GoogleSignInButton nextPath={searchParams.next} />
            ) : (
              <p className="rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                Google sign-in isn&rsquo;t configured here. Set the Supabase variables in <code>.env.local</code>.
              </p>
            )}
          </div>

          {demoEnabled && demoChoices.length > 0 && (
            <div className="mt-10">
              <div className="mb-3 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> Demo accounts <span className="h-px flex-1 bg-border" />
              </div>
              <ul className="space-y-2">
                {demoChoices.map((u) => (
                  <li key={u.id}>
                    <form action={signInAsDemoUser}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="next" value={searchParams.next ?? "/"} />
                      <button
                        type="submit"
                        className="flex w-full items-center justify-between rounded-lg border bg-white px-4 py-3 text-left transition hover:border-brand-sage hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span>
                          <span className="block text-sm font-medium text-brand-ink">{u.name}</span>
                          <span className="block text-xs text-muted-foreground">{u.title}</span>
                        </span>
                        <span className="text-xs font-medium text-brand-sea">{ROLE_LABELS[u.role]}</span>
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Demo sign-in is on because <code>DEMO_LOGIN=true</code>. It&rsquo;s always off in production.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
