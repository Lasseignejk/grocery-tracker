-- The lowercasing trigger called normalize_text() unqualified, so it broke
-- when fired from a function with an empty search_path (like merge_items).
-- Qualify the call and pin the trigger's own search_path.
create or replace function public.normalize_item_fields()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.brand is not null then
    new.brand = public.normalize_text(new.brand);
  end if;

  if new.generic_name is not null then
    new.generic_name = public.normalize_text(new.generic_name);
  end if;

  if new.variant is not null then
    new.variant = public.normalize_text(new.variant);
  end if;

  return new;
end;
$function$;
