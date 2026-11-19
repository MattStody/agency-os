"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { signOut } from "@/app/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ name, email, roleLabel }: { name: string | null; email: string; roleLabel: string }) {
  const [, start] = useTransition();
  const display = name ?? email;
  const initials = display
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left outline-none transition hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-brand-periwinkle">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-lavender text-xs font-semibold text-brand-ink">
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-brand-paper">{display}</span>
          <span className="block truncate text-xs text-brand-sage">{roleLabel}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-[240px]">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={() => start(() => signOut())}>
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
