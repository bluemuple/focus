-- =============================================================
-- Phase 2 — language column migration
--
-- Adds a `language` column to the per-language Supabase tables so the
-- same account can hold separate progress for English ('en') and
-- Japanese ('ja'). All existing rows are backfilled with 'en' (the
-- only language supported until now), preserving every user's
-- current lessons / word states / phrases.
--
-- Run this once in Supabase SQL Editor before flipping the client
-- code over to Phase 2 query patterns. Idempotent — safe to re-run.
--
-- NOTE: streak / money / mastered counts are stored in
-- auth.users.user_metadata (NOT a regular table), so they don't need
-- a SQL migration — the client already namespaces those metadata
-- keys per language (e.g. `eng_money` vs `eng_ja_money`).
-- =============================================================

-- 1) lessons --------------------------------------------------------
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS lessons_user_language_idx
  ON public.lessons (user_id, language);

-- 2) word_states ----------------------------------------------------
-- Old unique key was (user_id, word). Same word can now legitimately
-- exist in two languages for the same user (e.g. "live" in English vs
-- "ライブ" in Japanese), so the unique key becomes (user_id, language,
-- word). We DROP the old constraint and add the new one.
ALTER TABLE public.word_states
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'word_states_user_id_word_key'
      AND conrelid = 'public.word_states'::regclass
  ) THEN
    ALTER TABLE public.word_states DROP CONSTRAINT word_states_user_id_word_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS word_states_user_lang_word_uniq
  ON public.word_states (user_id, language, word);

-- 3) phrases (saved-phrase list, IF the table exists in your project)
-- Phrases are currently stored only in localStorage in this app, so
-- this block is a NO-OP for most installs. It's kept here so that if
-- you migrate phrases to a Supabase table later, the language column
-- exists from day one.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='phrases') THEN
    EXECUTE 'ALTER TABLE public.phrases
             ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT ''en''';
    EXECUTE 'CREATE INDEX IF NOT EXISTS phrases_user_language_idx
             ON public.phrases (user_id, language)';
  END IF;
END $$;

-- 4) stories (if table exists) --------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='stories') THEN
    EXECUTE 'ALTER TABLE public.stories
             ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT ''en''';
    EXECUTE 'CREATE INDEX IF NOT EXISTS stories_user_language_idx
             ON public.stories (user_id, language)';
  END IF;
END $$;
