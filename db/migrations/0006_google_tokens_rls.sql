-- google_tokens is only ever touched by the owner connection (which bypasses
-- RLS). Enabling RLS with no policies makes any other role see nothing.
alter table google_tokens enable row level security;
