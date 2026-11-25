-- Boldly OS — Approvals module.
--
-- An item (a Meta ad or a video clip/reel) has one or more versions; each
-- version has assets (images/videos in storage) and, for ads, copy. Lifecycle:
--   draft ──send──▶ pending ──decide──▶ approved | changes_requested
--     ▲                                         │
--     └──────────── new version ◀───────────────┘          (any) ──▶ archived
-- Client users never see drafts or internal-only comments.
-- client_id is denormalised onto every table so RLS is a simple check.

create table approval_items (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references clients (id) on delete cascade,
  type               text not null check (type in ('meta_ad', 'clip')),
  title              text not null,
  description        text,
  status             text not null default 'draft'
                     check (status in ('draft', 'pending', 'changes_requested', 'approved', 'archived')),
  due_at             date,
  source_ref         text,              -- Meta ad ID, Riverside link, etc.
  current_version_id uuid,              -- FK added below (circular)
  created_by         uuid references users (id) on delete set null,
  decided_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index approval_items_client_status_idx on approval_items (client_id, status);
create index approval_items_status_due_idx on approval_items (status, due_at);

create table approval_versions (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references approval_items (id) on delete cascade,
  client_id   uuid not null references clients (id) on delete cascade,
  version_no  int not null check (version_no > 0),
  notes       text,                     -- what changed in this version
  copy        jsonb not null default '{}'::jsonb,  -- ad copy: primaryText, headline, description, cta, url
  created_by  uuid references users (id) on delete set null,
  sent_at     timestamptz,
  sent_by     uuid references users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (item_id, version_no)
);
create index approval_versions_item_idx on approval_versions (item_id);

alter table approval_items
  add constraint approval_items_current_version_fk
  foreign key (current_version_id) references approval_versions (id) on delete set null
  deferrable initially deferred;  -- item ↔ version are created in one transaction

create table approval_assets (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references approval_versions (id) on delete cascade,
  item_id       uuid not null references approval_items (id) on delete cascade,
  client_id     uuid not null references clients (id) on delete cascade,
  kind          text not null check (kind in ('image', 'video')),
  storage_key   text not null unique,
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes >= 0),
  original_name text,
  width         int,
  height        int,
  duration_s    numeric(10, 3),
  sort_order    int not null default 0,
  created_by    uuid references users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index approval_assets_version_idx on approval_assets (version_id, sort_order);

create table approval_comments (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references approval_items (id) on delete cascade,
  version_id  uuid not null references approval_versions (id) on delete cascade,
  client_id   uuid not null references clients (id) on delete cascade,
  author_id   uuid references users (id) on delete set null,
  body        text not null check (length(body) between 1 and 5000),
  timecode_s  numeric(10, 3) check (timecode_s is null or timecode_s >= 0),
  is_internal boolean not null default false,   -- Boldly-only note, hidden from client users
  resolved_at timestamptz,
  resolved_by uuid references users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index approval_comments_item_idx on approval_comments (item_id, created_at);

-- Append-only decision history.
create table approval_decisions (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references approval_items (id) on delete cascade,
  version_id     uuid not null references approval_versions (id) on delete cascade,
  client_id      uuid not null references clients (id) on delete cascade,
  user_id        uuid references users (id) on delete set null,
  decision       text not null check (decision in ('approved', 'changes_requested')),
  note           text,
  on_behalf_of   text,                  -- set when Boldly records a decision for a client contact
  created_at     timestamptz not null default now()
);
create index approval_decisions_item_idx on approval_decisions (item_id, created_at);

create trigger approval_items_updated_at before update on approval_items
  for each row execute function app.set_updated_at();

-- Client users may only move an item's status (approve / request changes);
-- every other column is Boldly's to edit.
create or replace function app.guard_client_item_update() returns trigger
language plpgsql as $$
begin
  if app.current_role() = 'client_user'
     and (to_jsonb(new) - array['status', 'decided_at', 'updated_at'])
         is distinct from (to_jsonb(old) - array['status', 'decided_at', 'updated_at']) then
    raise exception 'client users may only change approval status' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger approval_items_client_guard before update on approval_items
  for each row execute function app.guard_client_item_update();

-- Visibility helper: internal users see every item they can access; client
-- users see non-draft items of their own clients.
create or replace function app.can_see_approval_item(iid uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from approval_items i
    where i.id = iid
      and app.can_access_client(i.client_id)
      and (app.is_internal() or i.status <> 'draft')
  )
$$;

-- Display info for people shown on shared threads. Client users can't read
-- the users table (RLS), but they do need to see who commented/decided.
-- Exposes name + staff flag only — never email.
create or replace function app.display_name(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(name, split_part(email, '@', 1)) from users where id = uid
$$;

create or replace function app.is_staff(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where user_id = uid and role in ('admin', 'team'))
$$;

grant execute on all functions in schema app to boldly_app;
grant select, insert, update on approval_items, approval_versions to boldly_app;
grant select, insert, delete on approval_assets to boldly_app;
grant select, insert, update on approval_comments to boldly_app;
grant select, insert on approval_decisions to boldly_app;

-- approval_items -----------------------------------------------------------
alter table approval_items enable row level security;
create policy approval_items_select on approval_items for select
  using (app.can_access_client(client_id) and (app.is_internal() or status <> 'draft'));
create policy approval_items_insert on approval_items for insert
  with check (app.is_internal() and app.can_access_client(client_id));
create policy approval_items_update_internal on approval_items for update
  using (app.is_internal() and app.can_access_client(client_id))
  with check (app.is_internal() and app.can_access_client(client_id));
-- Clients: only a pending item, and only to a decision.
create policy approval_items_update_client on approval_items for update
  using (app.current_role() = 'client_user' and app.can_access_client(client_id) and status = 'pending')
  with check (app.can_access_client(client_id) and status in ('approved', 'changes_requested'));

-- approval_versions --------------------------------------------------------
alter table approval_versions enable row level security;
create policy approval_versions_select on approval_versions for select
  using (app.can_access_client(client_id) and app.can_see_approval_item(item_id));
create policy approval_versions_write on approval_versions for all
  using (app.is_internal() and app.can_access_client(client_id))
  with check (app.is_internal() and app.can_access_client(client_id));

-- approval_assets ----------------------------------------------------------
alter table approval_assets enable row level security;
create policy approval_assets_select on approval_assets for select
  using (app.can_access_client(client_id) and app.can_see_approval_item(item_id));
create policy approval_assets_write on approval_assets for all
  using (app.is_internal() and app.can_access_client(client_id))
  with check (app.is_internal() and app.can_access_client(client_id));

-- approval_comments --------------------------------------------------------
alter table approval_comments enable row level security;
create policy approval_comments_select on approval_comments for select
  using (
    app.can_access_client(client_id)
    and app.can_see_approval_item(item_id)
    and (app.is_internal() or not is_internal)
  );
create policy approval_comments_insert on approval_comments for insert
  with check (
    author_id = app.current_user_id()
    and app.can_access_client(client_id)
    and app.can_see_approval_item(item_id)
    and (app.is_internal() or not is_internal)
  );
create policy approval_comments_update on approval_comments for update
  using (app.is_internal() and app.can_access_client(client_id))
  with check (app.is_internal() and app.can_access_client(client_id));

-- approval_decisions -------------------------------------------------------
alter table approval_decisions enable row level security;
create policy approval_decisions_select on approval_decisions for select
  using (app.can_access_client(client_id) and app.can_see_approval_item(item_id));
create policy approval_decisions_insert on approval_decisions for insert
  with check (
    user_id = app.current_user_id()
    and app.can_access_client(client_id)
    and app.can_see_approval_item(item_id)
  );
