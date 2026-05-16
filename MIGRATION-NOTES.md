# Education → focus/ consolidation (revised)

This pass moves the **phonics** and **animals** apps under `focus/`
and adds a fresh **Maths** entry point (`focus/maths/student.html`)
for the new *Mental Subtraction* topic. The original maths-game app
in `education/` stays exactly where it is — its data, its files,
its Supabase project all untouched.

---

## What lives where now

### Original (untouched)

| App | URL |
|---|---|
| Old maths-game student app | `education/student.html` |
| Old maths-game teacher app | `education/teacher.html` |
| Old maths quizzes (ef1-4, fractions, geometry, …) | `education/*.html` |

These keep talking to their original Supabase project
(`cvqmavezprmhgznvrluq.supabase.co`) and continue to work the
same as before.

### Moved into `focus/`

| Old path | New path |
|---|---|
| `education/phonics.html` | `focus/phonics/index.html` |
| `education/animals.html` | `focus/animals/index.html` |
| `education/animal-detail.html` | `focus/animals/animal-detail.html` |
| `education/animals-admin.html` | `focus/animals/admin.html` |
| `education/animals-data.js` | `focus/animals/animals-data.js` |
| `education/animals/` | `focus/animals/images/` |
| `education/download_animals.sh` | `focus/animals/download_animals.sh` |

### Copied (duplicated) into `focus/maths/`

Selected maths assets were copied so the new WordCatch-integrated
Maths app can reuse them later (badge art, sounds, 2D-shape art,
question banks, JS helpers, PDFs). The originals still live in
`education/` too.

- `focus/maths/Badges/`, `focus/maths/2d/`, `focus/maths/docs/`
- `focus/maths/js/` (db, questions, ef1–4 questions, shapes, tts)
  — **avatar.js removed** (no avatar feature in this app)
- `focus/maths/supabase-config.js`
- `focus/maths/{game,maths-game,fraction_decimal,geometry-quiz,ef[1-4]-practice}.html`
  (kept as reference; not linked from the WordCatch home page)

### New (built fresh this session)

| Path | Purpose |
|---|---|
| `focus/maths/student.html` | The Maths landing page reached from `focus/reading/home.html → Maths`. Currently shows a Mental Subtraction hero + an empty quiz list placeholder. Uses the WordCatch session (`wc.session.v1`) — no separate name picker, no avatar customisation. |

When you send through the spec for the Mental Subtraction quizzes,
the `quizList` placeholder is where the real buttons / Supabase
fetch will plug in.

---

## Reading home page wiring (still in effect)

`focus/reading/home.html` now shows five nav buttons next to the
user chip:

1. **My Pets** → `./profile.html`
2. **The Space** → `../virtual/index.html`
3. **Maths** → `../maths/student.html`  ← new Mental Subtraction page
4. **Phonics** → `../phonics/index.html`
5. **Animals** → `../animals/index.html`

Each is wrapped in `<span class="wc-nav-item">` so a teacher
hide-toggle cleanly removes the link **and** its trailing `|`.

`focus/reading/js/teacher.js` (Settings tab → "🏠 Student home —
navigation buttons") has the matching toggles:

- `hideMyPets`, `hideTheSpace`, `hideMaths`, `hidePhonics`,
  `hideAnimals`

These all write to the existing `wc_classes.hide_features` JSONB
column — **no SQL migration required**.

---

## What's NOT happening (and why)

- **No more account merge.** Earlier I built a badge → coin import
  tool and a `wc_users.maths_badges_migrated_at` SQL migration.
  Both were deleted in this pass because the new direction is to
  keep the maths-game data isolated. WordCatch coins are awarded
  by WordCatch activities only.
- **No avatar editor in `focus/maths`.** The new student.html
  doesn't load `avatar.js`, and the file itself has been removed
  from `focus/maths/js/`.

---

## Untouched in `education/`

These belong to other apps / topics, so they stay put:
`cartoons/`, `coloring/`, `english/`, `face_parts/`, `sounds/`,
`pokemon/`, `index.html` (Focus Companion), `pika.webp`,
`no-profile.png`.

---

## What you'll commit

- `focus/` repo → new files in `focus/maths/`, `focus/phonics/`,
  `focus/animals/`, plus edits to `focus/reading/home.html` and
  `focus/reading/js/teacher.js`.
- `education/` repo → file deletions for the **phonics.html**,
  **animals*.html**, **animals/**, **download_animals.sh** items
  that were moved (the maths files were *restored*, so they show
  as unchanged).
