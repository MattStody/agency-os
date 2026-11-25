-- Boldly OS never uses Supabase's auto-generated Data API (PostgREST). Supabase
-- grants its `anon` / `authenticated` roles access to public tables by default;
-- RLS already returns nothing to them, but we revoke the grants outright as
-- defence in depth. No-op on plain Postgres (roles don't exist).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'revoke all on all sequences in schema public from anon, authenticated';
    execute 'revoke all on all functions in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on sequences from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on functions from anon, authenticated';
  end if;
end
$$;

-- The migrations ledger has no client data, but keep it private too.
alter table public._migrations enable row level security;
