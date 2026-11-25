-- Pin search_path on the RLS helper functions so a caller can't shadow the
-- tables or functions they reference (Supabase linter 0011).
alter function app.set_updated_at() set search_path = pg_catalog, public;
alter function app.current_user_id() set search_path = pg_catalog, public;
alter function app.current_role() set search_path = pg_catalog, public;
alter function app.is_internal() set search_path = pg_catalog, public;
alter function app.is_admin() set search_path = pg_catalog, public;
alter function app.can_access_client(uuid) set search_path = pg_catalog, public;
alter function app.guard_client_item_update() set search_path = pg_catalog, public;
alter function app.can_see_approval_item(uuid) set search_path = pg_catalog, public;
