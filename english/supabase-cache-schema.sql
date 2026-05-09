-- =============================================================
-- Cloud-shared GPT cache tables
--
-- One-time setup: run this in the Supabase SQL Editor.
-- Idempotent — safe to re-run; CREATE … IF NOT EXISTS is used and
-- existing data is preserved.
--
-- Purpose:
--   The Edge Functions `chunk-gpt` and `word-info-gpt` consult these
--   tables BEFORE calling OpenAI. If a row exists for the same
--   sentence (chunk-gpt) or the same lowercased word (word-info-gpt),
--   the cached output is returned and the GPT call is skipped — every
--   user/device shares the cache, so a sentence/word seen by anyone
--   in the past costs zero GPT credits for everyone after.
--
-- Security:
--   The Edge Functions write using the SUPABASE_SERVICE_ROLE_KEY
--   (server-side only, never exposed to clients). Clients NEVER read
--   or write these tables directly — they go through the Edge
--   Functions. RLS is enabled and DENIES all client access by default;
--   service-role bypasses RLS automatically.
-- =============================================================

-- 1) Chunk cache — keyed by SHA-256 prefix of the normalized sentence.
CREATE TABLE IF NOT EXISTS public.chunk_gpt_cache (
  sentence_hash TEXT PRIMARY KEY,
  chunks        JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Word-info cache — keyed by lowercased word (sentence-independent
--    schema; see word-info-gpt/index.ts).
CREATE TABLE IF NOT EXISTS public.word_info_gpt_cache (
  cache_key  TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Furigana cache — keyed by SHA-256 prefix of the JP sentence.
--    Stores GPT-generated ruby annotations (kanji → contextual reading)
--    so 何ですか reads as なん, 今日 as きょう, etc. The lesson page
--    pre-fetches these for every body line on first JP entry; later
--    loads pull from this cache and pay zero GPT calls.
CREATE TABLE IF NOT EXISTS public.furigana_gpt_cache (
  sentence_hash TEXT PRIMARY KEY,
  ruby          JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: lock these tables down. Service-role (used by Edge Functions)
-- bypasses RLS automatically; clients with anon/authenticated keys get
-- nothing — which is what we want, since the Edge Functions are the
-- only intended writers and readers of this cache layer.
ALTER TABLE public.chunk_gpt_cache       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_info_gpt_cache   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.furigana_gpt_cache    ENABLE ROW LEVEL SECURITY;

-- (No policies = deny by default for non-service-role roles.)

-- Optional housekeeping helpers — uncomment to enable:
--
-- (a) created_at index, in case you want to expire old rows manually.
-- CREATE INDEX IF NOT EXISTS chunk_gpt_cache_created_at_idx
--   ON public.chunk_gpt_cache (created_at);
-- CREATE INDEX IF NOT EXISTS word_info_gpt_cache_created_at_idx
--   ON public.word_info_gpt_cache (created_at);
--
-- (b) Periodic prune (drop rows older than 90 days). Run from a
--     scheduled function or psql cron, never inline:
-- DELETE FROM public.chunk_gpt_cache       WHERE created_at < NOW() - INTERVAL '90 days';
-- DELETE FROM public.word_info_gpt_cache   WHERE created_at < NOW() - INTERVAL '90 days';
