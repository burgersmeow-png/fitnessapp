-- Social: profiles, friends, a feed of workouts, high-fives and comments.
-- Privacy: you see posts only from accepted friends (and your own). Every table has row level security.

create extension if not exists citext;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.friendships (
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- One friendship per pair, whoever asked first.
create unique index friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));

create table public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- The phone's own id for the workout, so a retried upload never posts twice.
  client_id text not null check (char_length(client_id) <= 64),
  kind text not null check (kind in ('workout', 'cardio')),
  title text not null check (char_length(title) <= 80),
  body jsonb not null check (pg_column_size(body) < 8000),
  happened_at timestamptz not null check (happened_at < now() + interval '1 day'),
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index posts_feed on public.posts (user_id, happened_at desc);

create table public.high_fives (
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index comments_post on public.comments (post_id, created_at);

-- Security definer so policies on posts can check friendships without recursing through its policies.
create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.posts enable row level security;
alter table public.high_fives enable row level security;
alter table public.comments enable row level security;

-- Profiles are findable by username for signed-in people only.
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "my friendships" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester, addressee));
create policy "send request" on public.friendships for insert to authenticated
  with check (requester = (select auth.uid()) and status = 'pending');
create policy "accept request" on public.friendships for update to authenticated
  using (addressee = (select auth.uid())) with check (addressee = (select auth.uid()) and status = 'accepted');
create policy "remove friendship" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));
-- Accepting may change the status and nothing else.
revoke update on public.friendships from authenticated, anon;
grant update (status) on public.friendships to authenticated;

create policy "friends' posts" on public.posts for select to authenticated
  using (user_id = (select auth.uid()) or public.are_friends((select auth.uid()), user_id));
create policy "own posts insert" on public.posts for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own posts delete" on public.posts for delete to authenticated using (user_id = (select auth.uid()));

-- The post subqueries run under the posts policy, so these follow the post's visibility.
create policy "high-fives on visible posts" on public.high_fives for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "give high-five" on public.high_fives for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy "take back high-five" on public.high_fives for delete to authenticated using (user_id = (select auth.uid()));

create policy "comments on visible posts" on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "comment" on public.comments for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy "delete own comment or on own post" on public.comments for delete to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid())));

revoke all on public.profiles, public.friendships, public.posts, public.high_fives, public.comments from anon;

-- App Store rule: people who can create an account must be able to delete it in the app.
create function public.delete_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
