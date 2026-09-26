-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Then replace the two example emails at the bottom with Ella's and Jackson's real ones.

-- Who is allowed to see and edit the household.
create table if not exists public.household_members (
  email text primary key
);

-- The whole household (budget, recipes, meal plan, cupboard, chores) as one JSON document.
-- `version` goes up on every save so two phones can't silently overwrite each other.
create table if not exists public.household (
  id text primary key,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create or replace function public.is_household_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where lower(m.email) = lower(auth.jwt() ->> 'email')
  );
$$;

alter table public.household_members enable row level security;
alter table public.household enable row level security;

drop policy if exists "members read household" on public.household;
drop policy if exists "members create household" on public.household;
drop policy if exists "members update household" on public.household;

create policy "members read household" on public.household
  for select to authenticated using (public.is_household_member());
create policy "members create household" on public.household
  for insert to authenticated with check (public.is_household_member());
create policy "members update household" on public.household
  for update to authenticated using (public.is_household_member()) with check (public.is_household_member());

-- Live updates between devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'household'
  ) then
    alter publication supabase_realtime add table public.household;
  end if;
end $$;

insert into public.household_members (email) values
  ('ella@example.com'),
  ('jackson@example.com')
on conflict do nothing;
