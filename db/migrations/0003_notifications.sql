-- Boldly OS — in-app notifications (+ email outbox).
-- Any module can notify a user. Rows are written inside the actor's
-- withAccess() transaction; emails are sent afterwards by the delivery job
-- (lib/notifications/deliver.ts), which claims rows with email_status='pending'.

create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,  -- recipient
  client_id    uuid references clients (id) on delete cascade,
  actor_id     uuid references users (id) on delete set null,
  module       text not null,
  type         text not null,
  title        text not null,
  body         text,
  link         text,                                                   -- app-relative path
  entity_type  text,
  entity_id    text,
  read_at      timestamptz,
  email_status text check (email_status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  email_error  text,
  emailed_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index notifications_user_unread_idx on notifications (user_id, created_at desc) where read_at is null;
create index notifications_user_idx on notifications (user_id, created_at desc);
create index notifications_email_pending_idx on notifications (created_at) where email_status = 'pending';

grant select, insert, update on notifications to boldly_app;
alter table notifications enable row level security;

-- Recipients see and mark-read only their own notifications.
create policy notifications_select on notifications for select
  using (user_id = app.current_user_id());
create policy notifications_update on notifications for update
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());
-- Anyone may notify others about something they can see (their own client, or global if internal).
create policy notifications_insert on notifications for insert
  with check (
    actor_id = app.current_user_id()
    and ((client_id is null and app.is_internal()) or app.can_access_client(client_id))
  );
