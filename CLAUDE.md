# Boldly OS — working notes

Internal OS for Boldly Media. Read README.md and docs/MODULES.md first.

## Non-negotiables
- **Client isolation.** All user-facing DB access goes through `withAccess(db, access, fn)`
  (lib/db/scoped.ts). Never query with `getDb()` directly from a page/action, except auth bootstrap.
- Every table holding client data: `client_id` column, grant to `boldly_app`, RLS policies using
  `app.can_access_client(client_id)`. Migrations in `db/migrations/` are the source of truth; mirror in
  `lib/db/schema.ts` (core) or `modules/<id>/schema.ts` (module tables, e.g. approvals).
- Business logic lives in `modules/<id>/service.ts` (permission check → withAccess → logActivity).
  Pages and server actions stay thin.
- Secrets only via env vars. No real client data or personal emails in seeds/tests.
- Files: `getStorage()` (lib/storage) — private bucket, signed URLs only, keys under `clients/<clientId>/…`.
- Notify users with `notify(tx, access, …)` inside the transaction; actions then call `flushEmailsSoon()`.
- New tools are modules: `npm run new:module -- <id> --name "…" [--scope client]`.

## UI
Executive, uncluttered. Brand tokens in tailwind.config.ts (`brand.*`), serif headings (Newsreader),
Inter body, off-white `#F3F1EA` page background, white cards. Reuse components in components/ui,
components/shell (PageHeader, SectionTitle, EmptyState) and components/forms.

## Verify
`npm run check` (typecheck, lint, Vitest incl. RLS tests on PGlite). Local DB: `npm run db:reset`.
