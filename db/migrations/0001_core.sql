-- Boldly OS — core schema.
-- Enumerated values are text + CHECK constraints (not Postgres enums) so new
-- values can be added by a later migration without enum gymnastics.

create schema if not exists app;

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- People who can sign in: Boldly staff now, client users in phase 2.
create table users (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique,                 -- Supabase auth.users.id, linked on first sign-in
  email           text not null unique check (email = lower(email)),
  name            text,
  title           text,
  avatar_url      text,
  is_active       boolean not null default true,
  last_sign_in_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table clients (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null,
  legal_name  text,
  website     text,
  industry    text,
  city        text,
  status      text not null default 'active'
              check (status in ('prospect', 'active', 'paused', 'archived')),
  services    text[] not null default '{}',
  timezone    text not null default 'America/Toronto',
  currency    text not null default 'CAD',
  notes       text,
  crm_ref     text,                            -- id of the matching record in the CRM, if any
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Who can see what. client_id NULL = every client (internal roles only).
create table memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  client_id   uuid references clients (id) on delete cascade,
  role        text not null check (role in ('admin', 'team', 'client_user')),
  created_at  timestamptz not null default now(),
  constraint client_user_needs_client check (role <> 'client_user' or client_id is not null)
);
create unique index memberships_user_client_uidx
  on memberships (user_id, coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index memberships_client_idx on memberships (client_id);

-- Ad accounts / properties per channel. Used by Approvals and (later) Reporting.
create table client_channels (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references clients (id) on delete cascade,
  channel             text not null
                      check (channel in ('google_ads', 'meta', 'ga4', 'linkedin', 'tiktok', 'youtube', 'other')),
  external_account_id text not null,
  label               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (client_id, channel, external_account_id)
);
create index client_channels_client_idx on client_channels (client_id);

create table client_contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients (id) on delete cascade,
  name        text not null,
  email       text check (email is null or email = lower(email)),
  phone       text,
  title       text,
  is_primary  boolean not null default false,
  is_approver boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index client_contacts_client_idx on client_contacts (client_id);

-- Append-only audit trail. client_id NULL = a global (non-client) event.
create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients (id) on delete cascade,
  actor_id    uuid references users (id) on delete set null,
  module      text not null,
  action      text not null,
  entity_type text,
  entity_id   text,
  summary     text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index activity_log_client_created_idx on activity_log (client_id, created_at desc);
create index activity_log_created_idx on activity_log (created_at desc);

-- Google OAuth tokens. Server-only: the app role gets no grant on this table.
create table google_tokens (
  user_id       uuid primary key references users (id) on delete cascade,
  access_token  text not null,
  refresh_token text,
  scope         text,
  token_type    text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger users_updated_at before update on users
  for each row execute function app.set_updated_at();
create trigger clients_updated_at before update on clients
  for each row execute function app.set_updated_at();
create trigger client_channels_updated_at before update on client_channels
  for each row execute function app.set_updated_at();
create trigger client_contacts_updated_at before update on client_contacts
  for each row execute function app.set_updated_at();
create trigger google_tokens_updated_at before update on google_tokens
  for each row execute function app.set_updated_at();
