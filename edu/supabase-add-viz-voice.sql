-- Add voice note columns to wc_visualization_messages.
-- student_voice_url: the free-form mic recording the student makes inside
--   the post-recording message popup (separate from sentence recordings).
-- teacher_voice_url: the voice note the teacher records when replying.
-- Run once in Supabase Dashboard → SQL Editor.

ALTER TABLE wc_visualization_messages
  ADD COLUMN IF NOT EXISTS student_voice_url text,
  ADD COLUMN IF NOT EXISTS teacher_voice_url text;
