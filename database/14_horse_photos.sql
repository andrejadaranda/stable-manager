-- =============================================================
-- 14_horse_photos.sql
-- Adds a single photo per horse. Storage handled by Supabase Storage
-- in a per-stable folder structure.
-- =============================================================

-- ---------------- Column ----------------
alter table horses
  add column if not exists photo_url text;

comment on column horses.photo_url is
  'Public URL of the cover photo. Files live in the horse-photos Storage bucket under stable_id/horse_id/<filename>.';

-- =============================================================
-- Storage bucket — must be created in Supabase Studio (Dashboard
-- ▸ Storage ▸ Create bucket) before applying these policies.
-- Bucket name:  horse-photos
-- Public:       NO (we serve via signed URLs from the app)
--
-- Then run the policies below to grant scoped access.
-- =============================================================

-- Path convention enforced by the app:
--   <stable_id>/<horse_id>/<uuid>.<ext>
--
-- These policies inspect the path's first segment (the stable_id) and
-- match it against the caller's stable. Defense-in-depth: even if app
-- code uploads to the wrong path, RLS blocks the write.

-- Read: any active member of the stable that owns the file.
create policy "horse_photos_read_member"
  on storage.objects for select
  using (
    bucket_id = 'horse-photos'
    and (storage.foldername(name))[1]::uuid = current_stable_id()
  );

-- Write: staff only.
create policy "horse_photos_write_staff"
  on storage.objects for insert
  with check (
    bucket_id = 'horse-photos'
    and (storage.foldername(name))[1]::uuid = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  );

create policy "horse_photos_update_staff"
  on storage.objects for update
  using (
    bucket_id = 'horse-photos'
    and (storage.foldername(name))[1]::uuid = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  )
  with check (
    bucket_id = 'horse-photos'
    and (storage.foldername(name))[1]::uuid = current_stable_id()
  );

create policy "horse_photos_delete_staff"
  on storage.objects for delete
  using (
    bucket_id = 'horse-photos'
    and (storage.foldername(name))[1]::uuid = current_stable_id()
    and current_user_role() in ('owner', 'employee')
  );
