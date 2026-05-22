-- =============================================================
-- One-time migration: wc-lesson-images Storage bucket
--
-- Comic lessons attach many panel images. Previously every image
-- was a base64 data URL embedded in wc_lessons.images (jsonb) —
-- which bloats the row so every lesson fetch downloads ALL panels
-- before anything renders. This bucket holds the binary images
-- instead; the lesson row keeps only a small public URL per image.
--
-- The teacher dashboard (teacher.js) uploads new panel images here
-- on save; the lesson renderer loads them from the public URL.
-- Old lessons that still carry inline data URLs keep working —
-- the renderer falls back to data_url when no url is present.
--
-- Safe to re-run.
-- =============================================================

-- Public bucket — panel images are classroom content, not secrets,
-- and public objects get CDN caching + work with <img> directly.
insert into storage.buckets (id, name, public)
values ('wc-lesson-images', 'wc-lesson-images', true)
on conflict (id) do update set public = true;

-- Phase-1 permissive policies scoped to this bucket (matches the
-- permissive RLS on every wc_* table — Phase 7 will tighten once
-- login codes issue real JWTs). Public read is implied by the
-- bucket being public, but an explicit SELECT policy keeps the
-- intent clear.
drop policy if exists wc_lesson_images_read on storage.objects;
create policy wc_lesson_images_read on storage.objects
  for select using (bucket_id = 'wc-lesson-images');

drop policy if exists wc_lesson_images_insert on storage.objects;
create policy wc_lesson_images_insert on storage.objects
  for insert with check (bucket_id = 'wc-lesson-images');

drop policy if exists wc_lesson_images_update on storage.objects;
create policy wc_lesson_images_update on storage.objects
  for update using (bucket_id = 'wc-lesson-images')
  with check (bucket_id = 'wc-lesson-images');
