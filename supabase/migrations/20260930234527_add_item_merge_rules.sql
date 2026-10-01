-- Item merging: rewrite duplicate products into one, and remember the merge
-- so future imports come in under the chosen name.
--
-- A rule matches an incoming receipt line either by its printed receipt text
-- (most reliable; the printed line rarely changes between trips) or by the
-- brand/generic name/variant the AI came up with (fallback). Match values are
-- stored normalized (lowercase, trimmed) like receipt_items' own fields.

create table public.item_merge_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  match_type text not null check (match_type in ('receipt_text', 'product')),
  match_receipt_text text,
  match_brand text,
  match_generic_name text,
  match_variant text,
  target_item_name text not null,
  target_brand text,
  target_generic_name text,
  target_variant text,
  created_at timestamptz not null default now(),
  check (
    (match_type = 'receipt_text' and match_receipt_text is not null)
    or (match_type = 'product' and (match_brand is not null or match_generic_name is not null))
  ),
  check (target_brand is not null or target_generic_name is not null)
);

-- One rule per thing matched; nulls count as equal
create unique index item_merge_rules_match_key on public.item_merge_rules (
  user_id,
  match_type,
  (coalesce(match_receipt_text, '')),
  (coalesce(match_brand, '')),
  (coalesce(match_generic_name, '')),
  (coalesce(match_variant, ''))
);

alter table public.item_merge_rules enable row level security;

create policy "Users can view their own merge rules"
  on public.item_merge_rules for select
  to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can insert their own merge rules"
  on public.item_merge_rules for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own merge rules"
  on public.item_merge_rules for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own merge rules"
  on public.item_merge_rules for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Merges products into one, all or nothing.
--   sources: [{ brand, generic_name, variant }, ...] products to merge
--   target:  { item_name, brand, generic_name, variant, category? }
--   remember_texts: printed receipt texts to save rules for; null means all
--     of them (callers pass a subset to skip generic lines like "PRODUCE")
-- Rewrites every matching line on the caller's receipts, saves receipt-text
-- and product rules for future imports, and points older rules that led to a
-- merged product at the new target. Returns the number of lines rewritten.
-- Runs as the caller, so RLS still applies on top of the explicit user filter.
create or replace function public.merge_items(
  sources jsonb,
  target jsonb,
  remember_texts text[] default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  uid uuid := auth.uid();
  t_item_name text := nullif(trim(target ->> 'item_name'), '');
  t_brand text := public.normalize_text(nullif(trim(target ->> 'brand'), ''));
  t_generic text := public.normalize_text(nullif(trim(target ->> 'generic_name'), ''));
  t_variant text := public.normalize_text(nullif(trim(target ->> 'variant'), ''));
  t_category text := nullif(trim(target ->> 'category'), '');
  updated_count integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if t_item_name is null then
    raise exception 'An item name is required';
  end if;
  if t_brand is null and t_generic is null then
    raise exception 'A brand or generic name is required';
  end if;
  if jsonb_typeof(sources) is distinct from 'array' or jsonb_array_length(sources) = 0 then
    raise exception 'At least one product to merge is required';
  end if;

  drop table if exists pg_temp.merge_sources, pg_temp.merge_lines;

  create temp table merge_sources on commit drop as
  select distinct
    public.normalize_text(nullif(trim(s.brand), '')) as brand,
    public.normalize_text(nullif(trim(s.generic_name), '')) as generic_name,
    public.normalize_text(nullif(trim(s.variant), '')) as variant
  from jsonb_to_recordset(sources) as s (brand text, generic_name text, variant text);

  create temp table merge_lines on commit drop as
  select ri.id, ri.receipt_text
  from public.receipt_items ri
  join public.receipts r on r.id = ri.receipt_id
  join pg_temp.merge_sources ms
    on ri.brand is not distinct from ms.brand
    and ri.generic_name is not distinct from ms.generic_name
    and ri.variant is not distinct from ms.variant
  where r.user_id = uid;

  -- Older rules that led to a merged product now lead to the new target
  update public.item_merge_rules mr
  set target_item_name = t_item_name,
      target_brand = t_brand,
      target_generic_name = t_generic,
      target_variant = t_variant
  from pg_temp.merge_sources ms
  where mr.user_id = uid
    and mr.target_brand is not distinct from ms.brand
    and mr.target_generic_name is not distinct from ms.generic_name
    and mr.target_variant is not distinct from ms.variant;

  -- Remember each printed line that was part of the merge
  insert into public.item_merge_rules (
    user_id, match_type, match_receipt_text,
    target_item_name, target_brand, target_generic_name, target_variant
  )
  select distinct uid, 'receipt_text', public.normalize_text(ml.receipt_text),
    t_item_name, t_brand, t_generic, t_variant
  from pg_temp.merge_lines ml
  where nullif(trim(ml.receipt_text), '') is not null
    and (
      remember_texts is null
      or public.normalize_text(ml.receipt_text) in (
        select public.normalize_text(rt) from unnest(remember_texts) as rt
      )
    )
  on conflict (
    user_id, match_type,
    (coalesce(match_receipt_text, '')), (coalesce(match_brand, '')),
    (coalesce(match_generic_name, '')), (coalesce(match_variant, ''))
  ) do update set
    target_item_name = excluded.target_item_name,
    target_brand = excluded.target_brand,
    target_generic_name = excluded.target_generic_name,
    target_variant = excluded.target_variant;

  -- Remember each old product name, unless it's the target itself
  insert into public.item_merge_rules (
    user_id, match_type, match_brand, match_generic_name, match_variant,
    target_item_name, target_brand, target_generic_name, target_variant
  )
  select uid, 'product', ms.brand, ms.generic_name, ms.variant,
    t_item_name, t_brand, t_generic, t_variant
  from pg_temp.merge_sources ms
  where (ms.brand is not null or ms.generic_name is not null)
    and not (
      ms.brand is not distinct from t_brand
      and ms.generic_name is not distinct from t_generic
      and ms.variant is not distinct from t_variant
    )
  on conflict (
    user_id, match_type,
    (coalesce(match_receipt_text, '')), (coalesce(match_brand, '')),
    (coalesce(match_generic_name, '')), (coalesce(match_variant, ''))
  ) do update set
    target_item_name = excluded.target_item_name,
    target_brand = excluded.target_brand,
    target_generic_name = excluded.target_generic_name,
    target_variant = excluded.target_variant;

  -- A product rule that now points at itself does nothing; drop it
  delete from public.item_merge_rules mr
  where mr.user_id = uid
    and mr.match_type = 'product'
    and mr.match_brand is not distinct from mr.target_brand
    and mr.match_generic_name is not distinct from mr.target_generic_name
    and mr.match_variant is not distinct from mr.target_variant;

  update public.receipt_items ri
  set item_name = t_item_name,
      brand = t_brand,
      generic_name = t_generic,
      variant = t_variant,
      category = coalesce(t_category, ri.category)
  from pg_temp.merge_lines ml
  where ri.id = ml.id;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$function$;

revoke execute on function public.merge_items(jsonb, jsonb, text[]) from public, anon;
grant execute on function public.merge_items(jsonb, jsonb, text[]) to authenticated;
