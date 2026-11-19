-- Boldly OS — row-level security.
--
-- Every request runs inside a transaction that does `SET LOCAL ROLE boldly_app`
-- and sets these per-transaction settings (see lib/db/scoped.ts):
--   app.user_id      uuid of the signed-in user
--   app.role         admin | team | client_user
--   app.all_clients  'on' when the user may see every client
--   app.client_ids   '{uuid,...}' clients the user may see otherwise
-- With no settings, boldly_app sees nothing. The connection's own role (table
-- owner) bypasses RLS and is used only by migrations, seeds and auth bootstrap.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'boldly_app') then
    create role boldly_app nologin;
  end if;
end
$$;
grant boldly_app to current_user;

grant usage on schema public, app to boldly_app;
grant select, insert, update, delete
  on users, memberships, clients, client_channels, client_contacts
  to boldly_app;
grant select, insert on activity_log to boldly_app;   -- append-only
-- google_tokens: deliberately no grant.

create or replace function app.current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create or replace function app.current_role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('app.role', true), ''), 'none')
$$;

create or replace function app.is_internal() returns boolean
language sql stable as $$
  select app.current_role() in ('admin', 'team')
$$;

create or replace function app.is_admin() returns boolean
language sql stable as $$
  select app.current_role() = 'admin'
$$;

create or replace function app.can_access_client(cid uuid) returns boolean
language sql stable as $$
  select cid is not null and (
    coalesce(current_setting('app.all_clients', true), 'off') = 'on'
    or cid = any (coalesce(nullif(current_setting('app.client_ids', true), ''), '{}')::uuid[])
  )
$$;

grant execute on all functions in schema app to boldly_app;

-- clients ---------------------------------------------------------------
alter table clients enable row level security;
create policy clients_select on clients for select
  using (app.can_access_client(id));
create policy clients_insert on clients for insert
  with check (app.is_admin());
create policy clients_update on clients for update
  using (app.is_internal() and app.can_access_client(id))
  with check (app.is_internal() and app.can_access_client(id));
create policy clients_delete on clients for delete
  using (app.is_admin() and app.can_access_client(id));

-- client_channels / client_contacts ---------------------------------------
alter table client_channels enable row level security;
create policy client_channels_select on client_channels for select
  using (app.can_access_client(client_id));
create policy client_channels_write on client_channels for all
  using (app.is_internal() and app.can_access_client(client_id))
  with check (app.is_internal() and app.can_access_client(client_id));

alter table client_contacts enable row level security;
create policy client_contacts_select on client_contacts for select
  using (app.can_access_client(client_id));
create policy client_contacts_write on client_contacts for all
  using (app.is_internal() and app.can_access_client(client_id))
  with check (app.is_internal() and app.can_access_client(client_id));

-- activity_log (internal only for now; the portal will get a filtered view) --
alter table activity_log enable row level security;
create policy activity_select on activity_log for select
  using (app.is_internal() and (client_id is null or app.can_access_client(client_id)));
create policy activity_insert on activity_log for insert
  with check (
    actor_id = app.current_user_id()
    and (
      (client_id is null and app.is_internal())
      or app.can_access_client(client_id)
    )
  );

-- users / memberships -----------------------------------------------------
alter table users enable row level security;
create policy users_select on users for select
  using (app.is_internal() or id = app.current_user_id());
create policy users_admin_write on users for all
  using (app.is_admin()) with check (app.is_admin());

alter table memberships enable row level security;
create policy memberships_select on memberships for select
  using (app.is_internal() or user_id = app.current_user_id());
create policy memberships_admin_write on memberships for all
  using (app.is_admin()) with check (app.is_admin());
