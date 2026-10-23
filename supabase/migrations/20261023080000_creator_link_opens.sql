-- How many times each creator's link was opened, per day, so their dashboard can show opens next to
-- sign-ups. Counted by the helper server when the landing page loads with ?code=...; one per
-- visitor per code every 30 minutes. Only the server (service role) reads or writes it.
create table public.creator_link_opens (
  code text not null references public.creator_codes (code) on update cascade on delete cascade,
  day date not null,
  opens integer not null default 0 check (opens >= 0),
  primary key (code, day)
);

alter table public.creator_link_opens enable row level security;
revoke all on public.creator_link_opens from anon, authenticated;

create function public.count_link_open(p_code text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.creator_link_opens (code, day, opens)
  values (p_code, (now() at time zone 'utc')::date, 1)
  on conflict (code, day) do update set opens = public.creator_link_opens.opens + 1;
$$;

revoke all on function public.count_link_open(text) from public, anon, authenticated;
grant execute on function public.count_link_open(text) to service_role;
