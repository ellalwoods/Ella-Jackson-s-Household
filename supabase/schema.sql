-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- The last statement prints your household key. Your link is:
--   https://<your-github-username>.github.io/<repo-name>/#<key>

-- The whole household (budget, recipes, meal plan, cupboard, chores) as one JSON document.
-- `secret` is the key at the end of the link; `version` goes up on every save so two
-- phones can't silently overwrite each other.
create table if not exists public.household (
  id text primary key,
  secret text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  data jsonb,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

-- No policies: the table can't be read or written directly with the public key.
-- The two functions below are the only way in, and both require the secret.
alter table public.household enable row level security;

create or replace function public.get_household(p_key text)
returns table (data jsonb, version integer)
language sql
stable
security definer
set search_path = ''
as $$
  select h.data, h.version from public.household h where h.secret = p_key;
$$;

-- Returns the new version, or null if someone else saved first (or the key is wrong).
create or replace function public.save_household(p_key text, p_data jsonb, p_expected integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.household h
     set data = p_data, version = h.version + 1, updated_at = now()
   where h.secret = p_key and h.version = p_expected
  returning h.version;
$$;

revoke all on function public.get_household(text) from public;
revoke all on function public.save_household(text, jsonb, integer) from public;
grant execute on function public.get_household(text) to anon, authenticated;
grant execute on function public.save_household(text, jsonb, integer) to anon, authenticated;

insert into public.household (id) values ('home') on conflict do nothing;

select secret as household_key from public.household where id = 'home';
