-- Baseline: the schema as it existed before migrations were tracked in this
-- repo. It was created through the Supabase dashboard and reconstructed on
-- 2026-09-30 from the live database, minus the changes in the later
-- migrations. The hosted project already has all of this, so mark it as
-- applied there instead of running it:
--   supabase migration repair --status applied 20251030000000

create extension if not exists "uuid-ossp" with schema extensions;

-- Tables -------------------------------------------------------------------

create table public.receipts (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid references auth.users (id) on delete cascade,
  store_name text,
  purchase_date date,
  total_amount numeric(10, 2),
  image_url text,
  raw_text text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table public.receipt_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  receipt_id uuid references public.receipts (id) on delete cascade,
  item_name text not null,
  quantity numeric(10, 2),
  unit_price numeric(10, 2),
  total_price numeric(10, 2),
  was_on_sale boolean default false,
  category text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  brand text,
  generic_name text,
  variant text,
  receipt_text text,
  size text,
  unit text
);

create table public.stores (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  normalized_name text not null unique,
  logo_url text,
  color text default '#3b82f6'::text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.admin_users (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid unique references auth.users (id) on delete cascade,
  created_at timestamptz default now()
);

create table public.api_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid references auth.users (id) on delete cascade,
  receipt_id uuid references public.receipts (id) on delete cascade,
  model text default 'gpt-4o'::text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  response_text text,
  finish_reason text,
  was_truncated boolean default false,
  items_parsed integer,
  parsing_successful boolean,
  error_message text,
  estimated_cost numeric(10, 6),
  created_at timestamptz default now(),
  items_enhanced integer default 0
);

-- Indexes ------------------------------------------------------------------

create index idx_receipt_items_brand on public.receipt_items using btree (brand);
create index idx_receipt_items_generic_name on public.receipt_items using btree (generic_name);
create index idx_receipt_items_size on public.receipt_items using btree (size);
create index idx_receipt_items_unit on public.receipt_items using btree (unit);
create index idx_receipt_items_variant on public.receipt_items using btree (variant);
create index idx_stores_name on public.stores using btree (name);
create index idx_stores_normalized_name on public.stores using btree (normalized_name);
create index idx_api_logs_created_at on public.api_logs using btree (created_at desc);
create index idx_api_logs_receipt_id on public.api_logs using btree (receipt_id);
create index idx_api_logs_user_id on public.api_logs using btree (user_id);

-- Functions and triggers ---------------------------------------------------

create or replace function public.normalize_text(text_input text)
returns text
language plpgsql
immutable
as $function$
begin
  return lower(trim(text_input));
end;
$function$;

create or replace function public.normalize_store_name(store_name text)
returns text
language plpgsql
immutable
as $function$
begin
  -- Lowercase, trim whitespace, remove special chars
  return lower(regexp_replace(trim(store_name), '[^a-z0-9\s]', '', 'gi'));
end;
$function$;

create or replace function public.calculate_gpt4o_cost(input_tokens integer, output_tokens integer)
returns numeric
language plpgsql
immutable
as $function$
begin
  return (input_tokens * 0.0000025) + (output_tokens * 0.00001);
end;
$function$;

-- Lowercases brand/generic name/variant so grouping in analytics matches
create or replace function public.normalize_item_fields()
returns trigger
language plpgsql
as $function$
begin
  if new.brand is not null then
    new.brand = normalize_text(new.brand);
  end if;

  if new.generic_name is not null then
    new.generic_name = normalize_text(new.generic_name);
  end if;

  if new.variant is not null then
    new.variant = normalize_text(new.variant);
  end if;

  return new;
end;
$function$;

create trigger normalize_item_fields_trigger
  before insert or update on public.receipt_items
  for each row execute function public.normalize_item_fields();

-- Adds a stores row the first time a store name appears on a receipt
create or replace function public.auto_create_store()
returns trigger
language plpgsql
as $function$
declare
  normalized text;
begin
  if new.store_name is not null then
    normalized := normalize_store_name(new.store_name);

    -- Insert if doesn't exist, using BOTH name and normalized_name for conflict detection
    insert into stores (name, normalized_name)
    values (new.store_name, normalized)
    on conflict (normalized_name) do nothing;  -- Skip if normalized_name already exists
  end if;

  return new;
end;
$function$;

create trigger auto_create_store_trigger
  after insert or update on public.receipts
  for each row execute function public.auto_create_store();

-- Row level security -------------------------------------------------------

alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.stores enable row level security;
alter table public.admin_users enable row level security;
alter table public.api_logs enable row level security;

create policy "Users can view their own receipts"
  on public.receipts for select
  using (auth.uid() = user_id);
create policy "Users can insert their own receipts"
  on public.receipts for insert
  with check (auth.uid() = user_id);
create policy "Users can update their own receipts"
  on public.receipts for update
  using (auth.uid() = user_id);
create policy "Users can delete their own receipts"
  on public.receipts for delete
  using (auth.uid() = user_id);

create policy "Users can view their own receipt items"
  on public.receipt_items for select
  using (exists (select 1 from public.receipts where receipts.id = receipt_items.receipt_id and receipts.user_id = auth.uid()));
create policy "Users can insert their own receipt items"
  on public.receipt_items for insert
  with check (exists (select 1 from public.receipts where receipts.id = receipt_items.receipt_id and receipts.user_id = auth.uid()));
create policy "Users can update their own receipt items"
  on public.receipt_items for update
  using (exists (select 1 from public.receipts where receipts.id = receipt_items.receipt_id and receipts.user_id = auth.uid()));
create policy "Users can delete their own receipt items"
  on public.receipt_items for delete
  using (exists (select 1 from public.receipts where receipts.id = receipt_items.receipt_id and receipts.user_id = auth.uid()));

create policy "Anyone can view stores"
  on public.stores for select
  to authenticated
  using (true);
create policy "Anyone can insert stores"
  on public.stores for insert
  to authenticated
  with check (true);
create policy "Anyone can update stores"
  on public.stores for update
  to authenticated
  using (true);

create policy "Authenticated users can view admin users"
  on public.admin_users for select
  to authenticated
  using (true);

create policy "Users can view their own API logs"
  on public.api_logs for select
  using (auth.uid() = user_id);
create policy "Users can insert their own API logs"
  on public.api_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Storage ------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('receipt-images', 'receipt-images', true)
on conflict (id) do nothing;

create policy "anyone can view receipt images 13hfyy5_0"
  on storage.objects for select
  using (bucket_id = 'receipt-images'::text);
create policy "users can upload their own receipts 13hfyy5_0"
  on storage.objects for insert
  with check (bucket_id = 'receipt-images'::text);
create policy "users can delete their own receipts 13hfyy5_0"
  on storage.objects for delete
  using (bucket_id = 'receipt-images'::text);
