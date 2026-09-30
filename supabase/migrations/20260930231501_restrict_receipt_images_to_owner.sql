-- The original rules only checked the bucket and applied to everyone, so
-- anyone (even signed out) could upload or delete any receipt photo.
-- Photos live under <user_id>/, so each user can only touch their own folder.
-- Viewing through public URLs still works: the bucket itself is public.
drop policy "anyone can view receipt images 13hfyy5_0" on storage.objects;
drop policy "users can upload their own receipts 13hfyy5_0" on storage.objects;
drop policy "users can delete their own receipts 13hfyy5_0" on storage.objects;

-- The Storage API also needs select to delete files
create policy "Users can view their own receipt images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'receipt-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own receipt images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'receipt-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own receipt images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'receipt-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
