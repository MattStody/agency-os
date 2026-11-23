import { Sidebar, type NavItem } from "@/components/shell/sidebar";
import { requireAccess } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/permissions";
import { getDb } from "@/lib/db/client";
import { unreadCount } from "@/lib/notifications";
import { getSwitcherClients, lastClientSlug } from "@/lib/shell";
import { modulesFor, SECTION_LABELS } from "@/modules/registry";
import type { ResolvedModule } from "@/modules/types";

export const dynamic = "force-dynamic";

function toNav(m: ResolvedModule): NavItem {
  const Icon = m.icon;
  return { id: m.id, name: m.name, path: m.path, scope: m.scope, status: m.status, icon: <Icon /> };
}

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const access = await requireAccess();
  const [clients, unread] = await Promise.all([getSwitcherClients(), unreadCount(getDb(), access)]);
  const nav = modulesFor(access);

  return (
    <div className="min-h-screen">
      <Sidebar
        clients={clients.map(({ slug, name }) => ({ slug, name }))}
        fallbackSlug={lastClientSlug()}
        sections={[
          { label: SECTION_LABELS.workspace, items: nav.workspace.map(toNav) },
          { label: SECTION_LABELS.tools, items: nav.tools.map(toNav) },
          { label: SECTION_LABELS.admin, items: nav.admin.map(toNav) },
        ]}
        user={{ name: access.name, email: access.email, roleLabel: ROLE_LABELS[access.role] }}
        unread={unread}
      />
      <main className="md:pl-[264px]">
        <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8 md:py-12">{children}</div>
      </main>
    </div>
  );
}
