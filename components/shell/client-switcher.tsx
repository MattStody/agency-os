"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface SwitcherClient {
  slug: string;
  name: string;
}

export function ClientSwitcher({
  clients,
  currentSlug,
}: {
  clients: SwitcherClient[];
  currentSlug: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const current = clients.find((c) => c.slug === currentSlug);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;
  }, [clients, query]);

  function go(slug: string) {
    // Keep the user in the same module when switching clients (/c/a/approvals → /c/b/approvals).
    const match = pathname.match(/^\/c\/[^/]+\/([^/]+)/);
    router.push(match ? `/c/${slug}/${match[1]}` : `/c/${slug}`);
  }

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger
        className="group flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-left outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-periwinkle"
        aria-label="Switch client"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-mint text-[12px] font-semibold text-brand-ink">
          {current ? initials(current.name) : "—"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-brand-sage">Client</span>
          <span className="block truncate text-sm font-medium text-brand-paper">
            {current?.name ?? "Select a client"}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-brand-sage" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[264px] p-1">
        {clients.length > 6 && (
          <div className="flex items-center gap-2 border-b px-2 pb-1.5 pt-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Find a client…"
              className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Clients
        </DropdownMenuLabel>
        {filtered.map((c) => (
          <DropdownMenuItem key={c.slug} onSelect={() => go(c.slug)} className="gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-brand-mist text-[11px] font-semibold text-brand-ink">
              {initials(c.name)}
            </span>
            <span className="flex-1 truncate">{c.name}</span>
            <Check className={cn("h-4 w-4", c.slug === currentSlug ? "opacity-100" : "opacity-0")} />
          </DropdownMenuItem>
        ))}
        {filtered.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">No matches.</p>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/admin/clients")} className="text-muted-foreground">
          All clients
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
