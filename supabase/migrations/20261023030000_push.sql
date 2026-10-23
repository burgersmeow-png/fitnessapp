-- Push notifications between coaches and clients. Each phone registers an Expo push token.
-- Only you can see or remove your tokens; the helper server reads them (service_role) to send
-- an alert, and only after checking the sender really is the other side of a coaching pair.

create table public.push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[.+\]$'),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "own tokens" on public.push_tokens for select to authenticated using (user_id = (select auth.uid()));
create policy "remove own token" on public.push_tokens for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_tokens from anon;
revoke insert, update on public.push_tokens from authenticated;

-- Registers this phone's token for you. Signing in on a phone someone else used hands its
-- token to the new account, so alerts follow whoever is signed in.
create function public.claim_push_token(t text) returns void
language sql security definer set search_path = '' as $$
  insert into public.push_tokens (token, user_id) values (t, auth.uid())
  on conflict (token) do update set user_id = auth.uid(), updated_at = now();
$$;
revoke execute on function public.claim_push_token(text) from public, anon;
grant execute on function public.claim_push_token(text) to authenticated;
