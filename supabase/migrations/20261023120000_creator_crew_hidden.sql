-- Lets a creator take a nickname off their crew leaderboard from the dashboard. A hidden follower
-- stays hidden if they rejoin under the same install.
alter table public.creator_crew add column hidden boolean not null default false;
