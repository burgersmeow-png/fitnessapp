-- Alerts to followers when their creator pins something new. A follower opts in from Today; the
-- app sends its Expo push token with its install id (no account needed). Only the helper server
-- (service role) reads or writes these, like the rest of the creator tables.
alter table public.referrals
  add column push_token text check (push_token ~ '^Expo(nent)?PushToken\[.+\]$');

-- At most one alert per creator every 12 hours, however often they edit their page.
alter table public.creator_codes add column last_alert_at timestamptz;
