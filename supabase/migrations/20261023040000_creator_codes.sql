-- Creator codes for influencer promotion. Each creator gets a code (e.g. ALEX10) that followers
-- enter during first-run setup. A referral is one app install that used a code; it's marked
-- active once that install finishes a workout, so creators can be paid for real users.
-- Neither table is visible to the app directly: the helper server (service_role) checks codes
-- and records referrals, so no one can list codes or read other people's installs.

create table public.creator_codes (
  code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  creator_name text not null check (length(creator_name) between 1 and 60),
  -- Shown to followers after they enter the code, e.g. "Alex's 12-week plan is ready for you."
  welcome text check (length(welcome) <= 200),
  -- Reserved for a future perk (e.g. 'free-month') if the app adds a paid tier.
  perk text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.referrals (
  install_id text primary key check (install_id ~ '^[a-z0-9-]{16,64}$'),
  code text not null references public.creator_codes (code) on update cascade,
  created_at timestamptz not null default now(),
  -- First finished workout: the difference between a download and a user.
  active_at timestamptz
);
create index referrals_code on public.referrals (code);

alter table public.creator_codes enable row level security;
alter table public.referrals enable row level security;
revoke all on public.creator_codes, public.referrals from anon, authenticated;

-- Sign-ups and active users per creator, for paying them. Run in the Supabase SQL editor:
--   select * from creator_stats;
create view public.creator_stats with (security_invoker = true) as
select
  c.code,
  c.creator_name,
  count(r.install_id) as signups,
  count(r.active_at) as active_users,
  count(r.install_id) filter (where r.created_at > now() - interval '7 days') as signups_last_7_days
from public.creator_codes c
left join public.referrals r on r.code = c.code
group by c.code, c.creator_name
order by signups desc;
revoke all on public.creator_stats from anon, authenticated;
