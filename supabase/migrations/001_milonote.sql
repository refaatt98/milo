-- MiloNote: everything lives in its own schema so it never touches other apps in the project.
create schema if not exists milonote;
grant usage on schema milonote to anon, authenticated, service_role;

create table if not exists milonote.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'user' check (role in ('user','admin')),
  ui_mode text not null default 'playful' check (ui_mode in ('playful','serious')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Generic row store: every local table row of a user (units, topics, sessions, notes…)
create table if not exists milonote.records (
  user_id uuid not null references auth.users(id) on delete cascade,
  tbl text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, tbl, id)
);
create index if not exists records_user_updated on milonote.records (user_id, updated_at);

create or replace function milonote.is_admin() returns boolean
language sql stable security definer set search_path = milonote, public as $$
  select exists (select 1 from milonote.profiles where id = auth.uid() and role = 'admin')
$$;

-- Creates the caller's profile on first sign-in (e.g. users who signed up elsewhere).
create or replace function milonote.ensure_profile(p_name text default '') returns milonote.profiles
language plpgsql security definer set search_path = milonote, public as $$
declare r milonote.profiles;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into milonote.profiles (id, email, name)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''), coalesce(nullif(p_name,''), split_part(coalesce(auth.jwt() ->> 'email',''),'@',1)))
  on conflict (id) do update set last_seen_at = now()
  returning * into r;
  return r;
end $$;

-- Admin overview: one row per user with real study totals derived from their sessions.
create or replace function milonote.admin_users()
returns table (id uuid, email text, name text, role text, ui_mode text, created_at timestamptz, last_seen_at timestamptz,
               last_sign_in_at timestamptz, study_ms bigint, sessions int, topics_done int, topics_total int, notebooks int, pages int)
language plpgsql stable security definer set search_path = milonote, public, auth as $$
begin
  if not milonote.is_admin() then raise exception 'admins only'; end if;
  return query
  select p.id, p.email, p.name, p.role, p.ui_mode, p.created_at, p.last_seen_at, u.last_sign_in_at,
    coalesce((select sum((r.data->>'duration')::bigint) from milonote.records r where r.user_id=p.id and r.tbl='sessions' and not r.deleted),0)::bigint,
    (select count(*) from milonote.records r where r.user_id=p.id and r.tbl='sessions' and not r.deleted)::int,
    (select count(*) from milonote.records r where r.user_id=p.id and r.tbl='topics' and not r.deleted and (r.data->>'done')::boolean)::int,
    (select count(*) from milonote.records r where r.user_id=p.id and r.tbl='topics' and not r.deleted)::int,
    (select count(*) from milonote.records r where r.user_id=p.id and r.tbl='notebooks' and not r.deleted)::int,
    (select count(*) from milonote.records r where r.user_id=p.id and r.tbl='pages' and not r.deleted)::int
  from milonote.profiles p left join auth.users u on u.id = p.id
  order by p.created_at desc;
end $$;

alter table milonote.profiles enable row level security;
alter table milonote.records enable row level security;

drop policy if exists "own or admin read" on milonote.profiles;
create policy "own or admin read" on milonote.profiles for select to authenticated using (id = auth.uid() or milonote.is_admin());
drop policy if exists "own update" on milonote.profiles;
create policy "own update" on milonote.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own records" on milonote.records;
create policy "own records" on milonote.records for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admin read records" on milonote.records;
create policy "admin read records" on milonote.records for select to authenticated using (milonote.is_admin());

-- Users may change only their name / ui mode / last seen — never their role.
revoke all on milonote.profiles from anon, authenticated;
grant select on milonote.profiles to authenticated;
grant update (name, ui_mode, last_seen_at) on milonote.profiles to authenticated;
grant select, insert, update, delete on milonote.records to authenticated;
grant all on all tables in schema milonote to service_role;
revoke execute on all functions in schema milonote from public, anon;
grant execute on function milonote.is_admin(), milonote.ensure_profile(text), milonote.admin_users() to authenticated;

-- Voice notes
insert into storage.buckets (id, name, public) values ('milonote-audio', 'milonote-audio', false) on conflict (id) do nothing;
drop policy if exists "milonote audio own" on storage.objects;
create policy "milonote audio own" on storage.objects for all to authenticated
  using (bucket_id = 'milonote-audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'milonote-audio' and (storage.foldername(name))[1] = auth.uid()::text);
