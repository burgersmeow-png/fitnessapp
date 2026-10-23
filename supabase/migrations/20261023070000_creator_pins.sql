-- What a creator pins to their public page (the landing page with ?code=...): up to 6 workout,
-- plan or challenge links, set from their private dashboard through the helper server. Each pin is
-- {"kind": "w" | "p" | "c", "payload": "<the link's base64url data>", "title": "..."}.
alter table public.creator_codes
  add column pins jsonb not null default '[]'::jsonb
  check (jsonb_typeof(pins) = 'array' and jsonb_array_length(pins) <= 6);
