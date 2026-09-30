-- Long receipts photographed in several parts: image_url stays the first
-- (thumbnail) photo, the rest go here in order
alter table public.receipts
  add column additional_image_urls text[] not null default '{}';
