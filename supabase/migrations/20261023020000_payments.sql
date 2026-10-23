-- Paid coaching. Coaches set a monthly price and get paid through Stripe Connect; clients
-- subscribe on Stripe's checkout page. Payment state is written only by the helper server
-- (with the service_role key, which never ships in the app), so nobody can mark themselves paid.

create table public.coach_payouts (
  coach uuid primary key references public.profiles (id) on delete cascade,
  stripe_account text unique,
  charges_enabled boolean not null default false,
  price_cents integer check (price_cents is null or price_cents between 100 and 100000),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  updated_at timestamptz not null default now()
);

alter table public.coach_payouts enable row level security;

-- A coach sees and prices their own row; the Stripe columns are the server's.
create policy "own payouts" on public.coach_payouts for select to authenticated using (coach = (select auth.uid()));
create policy "add own price" on public.coach_payouts for insert to authenticated with check (coach = (select auth.uid()));
create policy "change own price" on public.coach_payouts for update to authenticated
  using (coach = (select auth.uid())) with check (coach = (select auth.uid()));
revoke all on public.coach_payouts from anon, authenticated;
grant select on public.coach_payouts to authenticated;
-- coach is in the update grant only so an upsert works; the policy keeps it your own id.
grant insert (coach, price_cents, currency), update (coach, price_cents, currency) on public.coach_payouts to authenticated;

-- Subscription state per client. There is no update policy for app users, so only the server writes it.
alter table public.coaching
  add column paid_status text not null default 'none' check (paid_status in ('none', 'active', 'past_due', 'canceled')),
  add column paid_until timestamptz,
  add column cancels_at_period_end boolean not null default false,
  add column stripe_subscription text unique;

-- What your coach charges, if anything, and whether they can take payments yet.
create function public.my_coach_offer() returns table (price_cents integer, currency text, ready boolean)
language sql stable security definer set search_path = '' as $$
  select p.price_cents, p.currency, p.charges_enabled
  from public.coaching c join public.coach_payouts p on p.coach = c.coach
  where c.client = auth.uid();
$$;
revoke execute on function public.my_coach_offer() from public, anon;
grant execute on function public.my_coach_offer() to authenticated;
