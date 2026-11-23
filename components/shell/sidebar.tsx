"use client";

import { Bell, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { ClientSwitcher, type SwitcherClient } from "./client-switcher";
import { UserMenu } from "./user-menu";

export interface NavItem {
  id: string;
  name: string;
  path: string;
  scope: "client" | "global";
  status: "live" | "beta" | "planned";
  icon: ReactNode;
}

export interface SidebarProps {
  clients: SwitcherClient[];
  fallbackSlug: string | null;
  sections: { label: string; items: NavItem[] }[];
  user: { name: string | null; email: string; roleLabel: string };
  unread: number;
}

export function Sidebar(props: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-brand-ink px-4 md:hidden">
        <Link href="/" aria-label="Boldly OS home">
          <Logo />
        </Link>
        <span className="flex items-center gap-1">
        <NotificationBell unread={props.unread} />
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-2 text-brand-paper hover:bg-white/10"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        </span>
      </div>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-brand-ink text-brand-paper transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarBody {...props} pathname={pathname} />
      </aside>
      {open && (
        <div className="fixed inset-0 z-30 bg-brand-ink/40 md:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}
    </>
  );
}

function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative rounded-md p-2 text-brand-sage outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-brand-periwinkle"
    >
      <Bell className="h-[18px] w-[18px]" />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-periwinkle px-1 text-[10px] font-semibold text-brand-ink">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

function SidebarBody({ clients, fallbackSlug, sections, user, pathname, unread }: SidebarProps & { pathname: string }) {
  const routeSlug = pathname.match(/^\/c\/([^/]+)/)?.[1] ?? null;
  const knownFallback = clients.some((c) => c.slug === fallbackSlug) ? fallbackSlug : null;
  const slug = routeSlug ?? knownFallback ?? clients[0]?.slug ?? null;

  const hrefFor = (item: NavItem) =>
    item.scope === "client" ? (slug ? `/c/${slug}${item.path ? `/${item.path}` : ""}` : null) : `/${item.path}`;

  const isActive = (href: string | null, item: NavItem) => {
    if (!href) return false;
    if (item.scope === "client" && item.path === "") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between pl-5 pr-3">
        <Link href="/" aria-label="Boldly OS home" className="rounded outline-none focus-visible:ring-2 focus-visible:ring-brand-periwinkle">
          <Logo />
        </Link>
        <NotificationBell unread={unread} />
      </div>
      <div className="px-3 pb-2">
        <ClientSwitcher clients={clients} currentSlug={slug} />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
        {sections
          .filter((s) => s.items.length > 0)
          .map((section) => (
            <div key={section.label}>
              <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-brand-sage/80">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const href = hrefFor(item);
                  const active = isActive(href, item);
                  const inner = (
                    <>
                      <span className={cn("shrink-0 [&>svg]:h-[17px] [&>svg]:w-[17px]", active ? "text-brand-mint" : "text-brand-sage")}>
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.name}</span>
                      {item.status === "planned" && (
                        <span className="rounded-full border border-white/15 px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-brand-sage">
                          Soon
                        </span>
                      )}
                      {item.status === "beta" && (
                        <span className="rounded-full bg-brand-lavender/20 px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-brand-lavender">
                          Beta
                        </span>
                      )}
                    </>
                  );
                  const cls = cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] outline-none transition focus-visible:ring-2 focus-visible:ring-brand-periwinkle",
                    active ? "bg-white/10 font-medium text-white" : "text-brand-mist/85 hover:bg-white/[0.06] hover:text-white",
                    item.status === "planned" && !active && "text-brand-mist/55"
                  );
                  return (
                    <li key={item.id}>
                      {href ? (
                        <Link href={href} className={cls} aria-current={active ? "page" : undefined}>
                          {inner}
                        </Link>
                      ) : (
                        <span className={cn(cls, "cursor-not-allowed opacity-50")} title="Select a client first">
                          {inner}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <UserMenu {...user} />
      </div>
    </>
  );
}
