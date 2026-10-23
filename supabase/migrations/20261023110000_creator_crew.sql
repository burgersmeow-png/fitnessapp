-- "Alex's crew": a weekly leaderboard of a creator's followers who opt in with a nickname (no
-- account needed). One row per install, holding this week's training days. Only the helper server
-- (service role) reads or writes it; followers see nicknames and counts, never install ids.
create table public.creator_crew (
  install_id text primary key references public.referrals (install_id) on delete cascade,
  code text not null references public.creator_codes (code) on update cascade on delete cascade,
  nickname text not null check (nickname ~ '^[A-Za-z0-9][A-Za-z0-9 ._-]{1,19}$'),
  week date not null,
  days integer not null default 0 check (days between 0 and 7),
  updated_at timestamptz not null default now()
);
create index creator_crew_board on public.creator_crew (code, week, days desc);

alter table public.creator_crew enable row level security;
revoke all on public.creator_crew from anon, authenticated;
