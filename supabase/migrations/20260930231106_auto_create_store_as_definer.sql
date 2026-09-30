-- Store inserts are admin-only now, but this trigger has to add a store the
-- first time any user saves a receipt from it, so it runs as the owner.
-- The empty search_path keeps that from being hijacked; names are qualified.
create or replace function public.auto_create_store()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.store_name is not null then
    insert into public.stores (name, normalized_name)
    values (new.store_name, public.normalize_store_name(new.store_name))
    on conflict (normalized_name) do nothing;
  end if;

  return new;
end;
$function$;

revoke execute on function public.auto_create_store() from public, anon, authenticated;
