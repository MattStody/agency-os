# Adding a module

Every tool in Boldly OS is a module: a folder in `modules/`, a manifest in the registry, and routes
under `app/(shell)/`. The shell (nav, permissions, client switcher, placeholder pages) comes free.

## 1. Scaffold

```bash
# An internal tool, not tied to one client → /tools/utm-builder
npm run new:module -- utm-builder --name "UTM builder"

# A client-scoped module under the client switcher → /c/<client>/brand-kit
npm run new:module -- brand-kit --name "Brand kit" --scope client

# Just a nav stub ("Soon") for now
npm run new:module -- media-planner --name "Media planner" --planned
```

Options: `--scope client|global` (default global), `--section tools|admin|workspace`,
`--permission <perm>` (default `tools.use` for global, `clients.view` for client).

This creates `modules/<id>/manifest.ts`, `modules/<id>/page.tsx`, a one-line route file, and registers
the module in `modules/registry.ts`. New modules start as `status: "beta"` (badge in the nav); flip
to `"live"` when ready.

## 2. Choose a scope

| | `scope: "client"` | `scope: "global"` |
|---|---|---|
| URL | `/c/[client]/<id>` | `/tools/<id>` or `/admin/<id>` |
| Nav section | Client workspace | Internal tools / Admin |
| Who sees it | Anyone with `requires`, incl. client users later | Internal staff only |
| Data | **Must** be scoped by `client_id` | May span clients (still via `withAccess`) |

Rule of thumb: if the data belongs to a client, it's a client module.

## 3. Data: tables + RLS

Add a migration `db/migrations/NNNN_<module>.sql`:

```sql
create table utm_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  url text not null,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index utm_links_client_idx on utm_links (client_id);

grant select, insert, update, delete on utm_links to boldly_app;
alter table utm_links enable row level security;
create policy utm_links_select on utm_links for select
  using (app.can_access_client(client_id));
create policy utm_links_write on utm_links for all
  using (app.is_internal() and app.can_access_client(client_id))
  with check (app.is_internal() and app.can_access_client(client_id));
```

Every table with client data gets `client_id`, a grant to `boldly_app`, and RLS. No exceptions.
Mirror the tables in `modules/<id>/schema.ts` (see `modules/approvals/schema.ts`).

## 4. Logic: a service, not queries in pages

Follow `modules/core/service.ts`:

```ts
export async function listLinks(db: Db, access: Access, clientId: string) {
  assertCan(access, "tools.use");
  assertClientAccess(access, clientId);
  return withAccess(db, access, (tx) =>
    tx.select().from(utmLinks).where(eq(utmLinks.clientId, clientId))
  );
}
```

- Check permissions first, then run inside `withAccess()`.
- Write with `logActivity(tx, access, {...})` in the same transaction for anything worth auditing.
- Server actions (`modules/<id>/actions.ts`, `"use server"`) parse `FormData`, call the service,
  `revalidatePath`, and return `ActionState` via `toActionError`.

## 5. Permissions

Reuse an existing permission where it fits (`tools.use` for most internal tools). If a module needs
its own, add it to `PERMISSIONS` and the role map in `lib/permissions/index.ts`.

## 6. Tests

Add `tests/<id>.db.test.ts` using `createTestDb()` and `demoAccess()` from `tests/helpers/db.ts`.
At minimum: a client user / restricted team member can't see another client's rows, even with raw SQL.

## Checklist

- [ ] Manifest registered, sensible `requires`
- [ ] Tables have `client_id` + RLS + grant (if client data)
- [ ] All reads/writes through a service using `withAccess`
- [ ] Mutations log activity
- [ ] Scoping test
- [ ] `npm run check` passes
