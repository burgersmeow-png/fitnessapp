-- Challenge leaderboards: each person's progress in their current challenge, visible to
-- accepted friends only. One row per person; the phone keeps it up to date.

create table public.challenge_entries (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  -- The encoded challenge (same as the ?c= link), so friends in the same one can be matched.
  challenge_key text not null check (challenge_key ~ '^[A-Za-z0-9_-]{4,200}$'),
  title text not null check (char_length(title) between 1 and 32),
  sessions int not null check (sessions between 1 and 100),
  days int not null check (days between 3 and 100),
  start_day date not null,
  done int not null default 0 check (done between 0 and sessions),
  updated_at timestamptz not null default now()
);
create index challenge_entries_key on public.challenge_entries (challenge_key);

alter table public.challenge_entries enable row level security;

create policy "own and friends' challenge entries" on public.challenge_entries for select to authenticated
  using (user_id = (select auth.uid()) or public.are_friends((select auth.uid()), user_id));
create policy "own challenge entry insert" on public.challenge_entries for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own challenge entry update" on public.challenge_entries for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own challenge entry delete" on public.challenge_entries for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.challenge_entries from anon;
