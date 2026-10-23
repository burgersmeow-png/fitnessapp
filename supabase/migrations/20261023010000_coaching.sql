-- Trainer mode: coaches, their clients, assigned workouts and messages.
-- A client joins a coach with the coach's private invite code and can leave at any time.
-- A client has at most one coach. Ending the relationship hides its assignments and messages from both.

create table public.coach_codes (
  coach uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);

create table public.coaching (
  coach uuid not null references public.profiles (id) on delete cascade,
  client uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coach, client),
  check (coach <> client)
);

create function public.is_coach_of(c uuid, cl uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coaching where coach = c and client = cl);
$$;

-- Sessions shared with friends, or with the coach only (when friend sharing is off).
alter table public.posts add column visibility text not null default 'friends' check (visibility in ('friends', 'coach'));
drop policy "friends' posts" on public.posts;
create policy "friends' and clients' posts" on public.posts for select to authenticated
  using (
    user_id = (select auth.uid())
    or (visibility = 'friends' and public.are_friends((select auth.uid()), user_id))
    or public.is_coach_of((select auth.uid()), user_id)
  );

create table public.assignments (
  id bigint generated always as identity primary key,
  coach uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  client uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  note text not null default '' check (char_length(note) <= 1000),
  -- [{ exerciseId, sets, reps, weightKg | null }]
  plan jsonb not null check (jsonb_typeof(plan) = 'array' and jsonb_array_length(plan) between 1 and 20),
  scheduled_for date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index assignments_client on public.assignments (client, scheduled_for desc);

create table public.messages (
  id bigint generated always as identity primary key,
  coach uuid not null references public.profiles (id) on delete cascade,
  client uuid not null references public.profiles (id) on delete cascade,
  sender uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_pair on public.messages (coach, client, created_at);

alter table public.coach_codes enable row level security;
alter table public.coaching enable row level security;
alter table public.assignments enable row level security;
alter table public.messages enable row level security;

-- Only the coach sees their own code; clients use it through join_coach().
create policy "own code" on public.coach_codes for select to authenticated using (coach = (select auth.uid()));

create policy "my coaching" on public.coaching for select to authenticated using ((select auth.uid()) in (coach, client));
create policy "end coaching" on public.coaching for delete to authenticated using ((select auth.uid()) in (coach, client));

create policy "my assignments" on public.assignments for select to authenticated
  using ((select auth.uid()) in (coach, client) and public.is_coach_of(coach, client));
create policy "coach assigns" on public.assignments for insert to authenticated
  with check (coach = (select auth.uid()) and public.is_coach_of(coach, client));
create policy "coach removes" on public.assignments for delete to authenticated using (coach = (select auth.uid()));
create policy "client completes" on public.assignments for update to authenticated
  using (client = (select auth.uid())) with check (client = (select auth.uid()));
-- Completing may change completed_at and nothing else.
revoke update on public.assignments from authenticated, anon;
grant update (completed_at) on public.assignments to authenticated;

create policy "pair messages" on public.messages for select to authenticated
  using ((select auth.uid()) in (coach, client) and public.is_coach_of(coach, client));
create policy "send message" on public.messages for insert to authenticated
  with check (sender = (select auth.uid()) and sender in (coach, client) and public.is_coach_of(coach, client));

revoke all on public.coach_codes, public.coaching, public.assignments, public.messages from anon;

-- Turns on coach mode: returns the coach's invite code, creating one the first time.
create function public.coach_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  c text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select code into c from public.coach_codes where coach = auth.uid();
  while c is null loop
    -- No 0/O or 1/I, so a code read aloud can't be misheard.
    c := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
    begin
      insert into public.coach_codes (coach, code) values (auth.uid(), c);
    exception when unique_violation then
      c := null;
    end;
  end loop;
  return c;
end;
$$;

-- A client joins the coach who owns `invite`. Returns the coach's id.
create function public.join_coach(invite text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select coach into c from public.coach_codes where code = upper(btrim(invite));
  if c is null then raise exception 'unknown code' using errcode = 'P0002'; end if;
  if c = auth.uid() then raise exception 'own code' using errcode = '22023'; end if;
  insert into public.coaching (coach, client) values (c, auth.uid());
  return c;
end;
$$;

revoke execute on function public.coach_code(), public.join_coach(text) from public, anon;
grant execute on function public.coach_code(), public.join_coach(text) to authenticated;
