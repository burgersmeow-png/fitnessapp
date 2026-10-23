-- Cloud backup of the training log. One row per account, holding the whole log as JSON so a
-- new phone can restore it. Progress photos are never included. Only the owner can read or
-- write their backup, and deleting the account deletes it.

create table public.backups (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (pg_column_size(data) < 20000000),
  summary jsonb not null check (pg_column_size(summary) < 4000),
  updated_at timestamptz not null default now()
);

alter table public.backups enable row level security;

create policy "read own backup" on public.backups for select to authenticated using (user_id = (select auth.uid()));
create policy "create own backup" on public.backups for insert to authenticated with check (user_id = (select auth.uid()));
create policy "replace own backup" on public.backups for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own backup" on public.backups for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.backups from anon;
