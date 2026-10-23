-- Which pinned workouts, plans and challenges followers actually use, for the creator's dashboard.
-- One row per follower per pin (by a hash of the link's data), so repeats don't inflate the count.
-- Only the helper server (service role) reads or writes it.
create table public.creator_pin_uses (
  code text not null references public.creator_codes (code) on update cascade on delete cascade,
  pin_hash text not null check (pin_hash ~ '^[a-f0-9]{64}$'),
  install_id text not null,
  created_at timestamptz not null default now(),
  primary key (code, pin_hash, install_id)
);

alter table public.creator_pin_uses enable row level security;
revoke all on public.creator_pin_uses from anon, authenticated;
