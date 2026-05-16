-- =============================================================
--   WordCatch — Supabase schema
--
--   Site: /focus/reading/  (NZ Year 4 English reading site)
--
--   Auth model: NO Supabase auth.users. Students log in with a
--   4-digit code issued by their teacher; teachers also use a
--   4-digit code (issued in setup). The browser stores the
--   resolved wc_users row in localStorage as the "session".
--   All Postgres tables use the Supabase anon key + permissive
--   RLS scoped by the supplied user_id in queries (Phase 1 is
--   permissive; we'll tighten RLS in Phase 7).
--
--   All tables prefix `wc_` (WordCatch) so they coexist with
--   the parent english/JP tables in the same project.
--
--   Run order: this file is idempotent — re-running is safe.
-- =============================================================

-- ---------- Classes (teacher → many students) ----------
create table if not exists wc_classes (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  -- Per-class feature flags. Keys (camelCase): hideStudentLessonUpload,
  -- hideSidebarVisualization, etc. UI reads this on lesson load.
  hide_features   jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- ---------- Users (students + teachers) ----------
create table if not exists wc_users (
  id              uuid primary key default gen_random_uuid(),
  role            text not null check (role in ('student','teacher')),
  real_name       text not null,
  gender          text check (gender in ('boy','girl','other')),
  class_id        uuid references wc_classes(id) on delete set null,
  -- 4-digit code, stored as text (preserve leading zeros). Unique
  -- only among non-null codes — students who haven't been issued a
  -- code yet stay null.
  login_code      text,
  money           integer not null default 0,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz
);
create unique index if not exists wc_users_login_code_uniq
  on wc_users(login_code) where login_code is not null;
create index if not exists wc_users_class_role_idx
  on wc_users(class_id, role);

-- Which animal level the student is currently hunting (1..10).
-- Determines BOTH the click threshold for the next encounter and
-- the difficulty of the catch quiz. Updated by the encounter system
-- (Phase 5) on catch / fail. Defaults to 1 for new students.
alter table wc_users
  add column if not exists encounter_level int not null default 1;

-- teacher_id on the class for "primary teacher" — added after users
-- table exists (cyclic FK). Multiple teachers per class will use a
-- separate join table later.
alter table wc_classes
  add column if not exists teacher_id uuid references wc_users(id) on delete set null;

-- ---------- Lessons ----------
create table if not exists wc_lessons (
  id                    uuid primary key default gen_random_uuid(),
  class_id              uuid references wc_classes(id) on delete cascade,
  created_by            uuid references wc_users(id) on delete set null,
  title                 text not null,
  body                  text not null,
  audio_url             text,
  -- Which animal set this lesson uses for encounters. 'mixed'
  -- pulls from any set; default 'animals' (general animal set).
  animal_set            text not null default 'animals'
                          check (animal_set in ('animals','nz-animals','penguin','mixed')),
  -- How many gift animals the teacher can send via this lesson per
  -- day (default 3). Per-class overridable via class settings later.
  gift_limit_per_day    integer not null default 3,
  created_at            timestamptz not null default now()
);
create index if not exists wc_lessons_class_idx on wc_lessons(class_id);

-- Inline images that float in one of the white card's 4 corners.
-- Each entry: { corner: 'tl'|'tr'|'bl'|'br', data_url: 'data:image/jpeg;base64,…' }.
-- The body text refers to each image via `[[IMG:N]]` tokens; the
-- render layer replaces them with floated <img> elements. Stored
-- as data-URLs (post-downscale typically 30-80 KB each) to avoid
-- a separate Storage bucket — fits comfortably under Postgres's
-- JSONB row limit for a 5-image lesson.
alter table wc_lessons
  add column if not exists images jsonb not null default '[]'::jsonb;

-- Per-word images. When a student taps a word that appears in
-- this array, the matching image is shown in the sidebar word card
-- (above "Often used with"). Words NOT in this array show no image
-- area at all — pure dictionary entry. Each entry:
--   { word: 'kiwi', data_url: 'data:image/jpeg;base64,...' }
alter table wc_lessons
  add column if not exists word_images jsonb not null default '[]'::jsonb;

-- When true, every markdown heading (#, ##, ###) in the body starts
-- a fresh page (a page-break HR is injected before each heading
-- except the very first piece of content). When false (default),
-- headings appear inline within their natural paragraph flow.
alter table wc_lessons
  add column if not exists headings_start_new_page boolean not null default false;

-- ---------- Word states (per-student word level) ----------
-- level: -1 = 무시 (ignored), 0 = unseen, 1..5 = familiarity levels
create table if not exists wc_word_states (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references wc_users(id) on delete cascade,
  word            text not null,
  level           int  not null default 0 check (level between -1 and 5),
  last_clicked_at timestamptz,
  unique (user_id, word)
);
create index if not exists wc_word_states_user_idx on wc_word_states(user_id);

-- ---------- Student pets (caught animals) ----------
create table if not exists wc_student_pets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references wc_users(id) on delete cascade,
  animal_set      text not null check (animal_set in ('animals','nz-animals','penguin')),
  animal_index    int  not null check (animal_index between 0 and 9),
  animal_level    int  not null default 1 check (animal_level between 1 and 10),
  custom_name     text,
  caught_at       timestamptz not null default now()
);
create index if not exists wc_student_pets_user_idx on wc_student_pets(user_id);

-- ---------- Visualization messages (student → teacher → gift back) ----------
create table if not exists wc_visualization_messages (
  id                  uuid primary key default gen_random_uuid(),
  student_id          uuid not null references wc_users(id) on delete cascade,
  lesson_id           uuid references wc_lessons(id) on delete set null,
  word                text,
  prompt              text not null,
  teacher_response    text,
  gift_animal_set     text check (gift_animal_set in ('animals','nz-animals','penguin')),
  gift_animal_index   int  check (gift_animal_index between 0 and 9),
  sent_at             timestamptz not null default now(),
  responded_at        timestamptz
);
create index if not exists wc_viz_student_idx on wc_visualization_messages(student_id, sent_at desc);
create index if not exists wc_viz_lesson_idx  on wc_visualization_messages(lesson_id, sent_at desc);

-- ---------- Quiz cache (server-side question cache for quiz-gpt) ----------
-- Lets every student in the class share the same generated quiz for
-- the same (word, sentence, level, count) tuple. First student pays
-- the OpenAI cost (~$0.001), every other student gets it free.
create table if not exists wc_quiz_cache (
  cache_key  text primary key,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- Word-info cache (Year-3 dictionary entries from word-info-gpt) ----------
-- Same word in the same sentence context shared across all students
-- in the class. First click pays GPT; everyone else gets it free.
create table if not exists wc_word_info_cache (
  cache_key  text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- TTS cache (server-side audio cache for tts-google) ----------
-- Lets identical sentences across all students hit a cached MP3
-- instead of round-tripping to Google Cloud TTS. Cache key is the
-- SHA-256 of "<voice>:<rate>:::<text>"; the audio is stored as base64
-- (fine for sentence-scale clips ~50KB). Multi-paragraph lessons
-- should push to Storage instead — Phase 3 sticks with base64.
create table if not exists wc_tts_cache (
  cache_key    text primary key,
  audio_base64 text not null,
  created_at   timestamptz not null default now()
);

-- ---------- Color-change throttle counters (for animal encounter trigger) ----------
-- Tracks total qualifying upward word-level changes per student per
-- lesson. The encounter probability function uses this counter.
create table if not exists wc_encounter_counters (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references wc_users(id) on delete cascade,
  lesson_id       uuid references wc_lessons(id) on delete cascade,
  count_value     int  not null default 0,
  last_change_at  timestamptz,
  unique (user_id, lesson_id)
);

-- ---------- RLS (Phase 1: permissive — Phase 7 will tighten) ----------
alter table wc_classes                 enable row level security;
alter table wc_users                   enable row level security;
alter table wc_lessons                 enable row level security;
alter table wc_word_states             enable row level security;
alter table wc_student_pets            enable row level security;
alter table wc_visualization_messages  enable row level security;
alter table wc_encounter_counters      enable row level security;
alter table wc_tts_cache               enable row level security;
alter table wc_quiz_cache              enable row level security;
alter table wc_word_info_cache         enable row level security;

-- Phase 1 dev policies: anon role can read+write. Tighten in Phase 7
-- with check_login_code edge function returning a signed JWT and
-- per-row policies keyed on auth.uid().
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'wc_dev_all_classes')                then create policy wc_dev_all_classes                on wc_classes                for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'wc_dev_all_users')                  then create policy wc_dev_all_users                  on wc_users                  for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'wc_dev_all_lessons')                then create policy wc_dev_all_lessons                on wc_lessons                for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'wc_dev_all_word_states')            then create policy wc_dev_all_word_states            on wc_word_states            for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'wc_dev_all_student_pets')           then create policy wc_dev_all_student_pets           on wc_student_pets           for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'wc_dev_all_viz_messages')           then create policy wc_dev_all_viz_messages           on wc_visualization_messages for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'wc_dev_all_encounter_counters')     then create policy wc_dev_all_encounter_counters     on wc_encounter_counters     for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'wc_dev_all_tts_cache')              then create policy wc_dev_all_tts_cache              on wc_tts_cache              for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'wc_dev_all_quiz_cache')             then create policy wc_dev_all_quiz_cache             on wc_quiz_cache             for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where policyname = 'wc_dev_all_word_info_cache')        then create policy wc_dev_all_word_info_cache        on wc_word_info_cache        for all using (true) with check (true); end if;
end $$;
