-- A secret per creator for their private dashboard (site/creator.html). The helper server checks
-- it; the app and the public never see it. To send a creator their link, run:
--   select code, 'https://<your site>/creator.html#code=' || code || '&token=' || stats_token from creator_codes;
-- To revoke a link, give that creator a new token:
--   update creator_codes set stats_token = replace(gen_random_uuid()::text, '-', '') where code = 'ALEX10';

alter table public.creator_codes
  add column stats_token text not null default replace(gen_random_uuid()::text, '-', '') unique
  check (stats_token ~ '^[a-f0-9]{32}$');
