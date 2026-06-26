-- Car Pre-Vetting Tool — car photos
--
-- Photos are stored in a PRIVATE Supabase Storage bucket `car-photos`, one folder
-- per user (`<userId>/<uuid>/<file>`), enforced by storage.objects RLS so a user
-- can only read/write their own folder — consistent with the per-user data
-- isolation in 0005. The app serves time-limited signed URLs; nothing is public.
-- This migration records the schema column; the bucket + storage policies are
-- created via the Supabase MCP (storage.buckets + storage.objects policies):
--
--   insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
--     values ('car-photos','car-photos', false, 5242880,
--             array['image/jpeg','image/png','image/webp','image/gif']);
--   -- select/insert/update/delete policies on storage.objects, each:
--   --   bucket_id = 'car-photos'
--   --   and (storage.foldername(name))[1] = (auth.uid())::text

-- The car carries the ordered list of storage object paths (first = thumbnail).
alter table public.cars
  add column if not exists photos text[] not null default '{}';
