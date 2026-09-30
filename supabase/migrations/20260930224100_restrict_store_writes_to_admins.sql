-- Store names, logos and colors are shown site-wide, so only admins may
-- change them (previously any signed-in user could)
drop policy "Anyone can insert stores" on public.stores;
drop policy "Anyone can update stores" on public.stores;

create policy "Admins can insert stores"
  on public.stores for insert
  to authenticated
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create policy "Admins can update stores"
  on public.stores for update
  to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
