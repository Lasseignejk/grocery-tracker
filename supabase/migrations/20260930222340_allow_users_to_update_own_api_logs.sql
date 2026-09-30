-- Merging receipts moves the pieces' logs onto the combined receipt so
-- their parse costs aren't lost when the pieces are deleted
create policy "Users can update their own API logs"
  on public.api_logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
