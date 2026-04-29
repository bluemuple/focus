# Project Handoff — Concentration Focus Website

A reusable prompt recipe for rebuilding (or adapting) this kind of focus-tracking website.

---

## What This Project Is

A single-file HTML/CSS/JavaScript website that helps a person focus by combining:

- An Eisenhower Matrix for organizing tasks
- A Pomodoro timer (25-min work + 5-min break, with a 15-min long break every 4 rounds)
- A vertical time gauge that shows the day like a calendar
- A focus-score system based on environment and body state
- Cloud sync across devices using Supabase (email + password login)
- Daily and weekly statistics

Everything lives in one `index.html` file and is hosted free on GitHub Pages.

---

## How to Reuse These Prompts

Copy the prompts below in order. Replace text in `[brackets]` with your own values. Each step builds on the previous one. You can skip steps you don't need.

---

### Step 1 — First build from a written spec

> Build a website from the attached PDF spec. Make a single `index.html` file with all HTML, CSS, and JavaScript inside. It must work on free GitHub Pages with no backend. Make the layout responsive for phone, tablet, and desktop. Use `localStorage` to save user data between visits.

**Tip**: Attach a clear PDF or write a bullet list of features. The clearer the spec, the closer the first version will be to what you want.

---

### Step 2 — Replace placeholder graphics with real images

> I uploaded the images `[image0.png … image6.png]`. Use them in the page. Each image stands for a score range:
>
> - 0–27 → image 0
> - 28–36 → image 1
> - 37–45 → image 2
> - 46–54 → image 3
> - 55–63 → image 4
> - 64–72 → image 5
> - 73–100 → image 6
>
> If an image fails to load, fall back to the inline SVG so the page never breaks.

---

### Step 3 — Adjust the design of a specific component

> Make the [vertical time gauge / score bar / matrix] look like the attached screenshot. Specifically:
>
> - Top of gauge: 30 minutes before the start time set on the setup page
> - Bottom of gauge: 12 hours after the top
> - Hour grid lines and hour labels (like a calendar)
> - A red horizontal line for the current time, with a rounded badge showing `HH:MM`
> - When a task is running, paint a colored band with the task name inside
> - Click any colored band to open a popup that lets me edit start and end time

**Tip**: Attach a screenshot or describe the look in detail. Mention exact colors, sizes, and behaviors.

---

### Step 4 — Make the matrix interactive

> On the setup page matrix:
>
> - Pressing Enter inside a task input adds a new empty task and moves the cursor there
> - Pressing Backspace inside an empty task deletes that row and moves the cursor to the end of the previous row
> - Each task row has a `≡` drag handle on the right; drag and drop to reorder tasks within the same quadrant
> - On phone, add a toggle button that enlarges the cells and lets me swipe sideways to reach the right cells

---

### Step 5 — Add the Pomodoro timer behavior

> When I tap a task on the focus page:
>
> - A 25-minute Work countdown starts. The label says "Work".
> - When it hits 0, a 5-minute Good Break automatically starts. The label says "Good Break".
> - Every 4th break is 15 minutes and the label says "Sweet Long Break".
> - Tap the same task again to stop early.
> - The full work + break is recorded as one entry in the activity log and as one colored band on the time gauge.

---

### Step 6 — Add scoring with formulas

> Add an Internal score and an External score. Both range from 0 to 100.
>
> - Default base = `100 − (sum of max possible scores from all options + sliders)`
> - Selecting a chip adds its score
> - Sleep slider (0–10, but caps at 7 if the value is over 9) and Emotional Wellness slider each contribute ×3
> - Clamp the final score between -100 and 100
> - Show a colored gradient bar with a marker; pixel-art images change at score thresholds (0–27, 28–36, …, 73–100)
> - Below the bar, show an overall message: "Go home or sleep" / "Take a 5min break" / "Do something good and try to get on track" / "You're almost in the zone" / "You're amazing"

---

### Step 7 — Mobile fixes

> On phone view (`max-width: 700px`):
>
> - Make the top bar compact: hide subtitles, replace the navigation buttons with single-character icons (gear, play, list)
> - Disable horizontal page scrolling. Only allow vertical scrolling.
> - Make sure inner panels stay inside the outer panel (no overflow)
> - In the matrix, push the "Important / Not Important" labels to the very left so the cells get more width

---

### Step 8 — Cloud sync with Supabase

> Add cross-device sync using Supabase.
>
> 1. Create a `user_settings` table and a `focus_sessions` table with permissive Row Level Security policies (anonymous read/insert/update/delete).
> 2. On every change (tasks, motivational quotes, factors, time goals, focus scores), push to `user_settings` (debounced 800ms).
> 3. On every focus session finish, push to `focus_sessions`.
> 4. On page load, pull from both tables and update the UI.
> 5. Use a `last-write-wins` strategy with an `updated_at` timestamp.
>
> Hard-code the Project URL and anon public key in the JavaScript so users don't have to enter them each time. The anon key is safe to publish.

---

### Step 9 — Email and password login

> Add Supabase Auth. When the page loads:
>
> - If the user has a saved session, hide the login UI and pull data automatically
> - If not, show a centered modal popup with email + password + Sign in / Sign up buttons
> - Stay logged in across page refreshes
> - Tag every database row with the authenticated user's UUID so each user only sees their own data

---

### Step 10 — Login modal that introduces the app

> In the login popup, show three short feature titles (no descriptions on screen). When I hover or tap each title, show a tooltip that explains the feature. Add an "In detail" link that opens a longer manual modal. Make sure everything fits without scrolling.

---

### Step 11 — Statistics page with weekly view

> Add two views on the statistics page:
>
> - **List view**: every session grouped by date, with scores, completed tasks, percentage done, and a small vertical gauge of the session
> - **Weekly view**: 7 columns (Mon–Sun), with a shared y-axis showing hours. Each day shows that day's colored task bands. Add ← and → buttons to move between weeks.
>
> Add an "Erase all data" button that wipes both local and cloud data with a confirmation prompt.

---

### Step 12 — Quality-of-life buttons

> Add small helper buttons on the setup page:
>
> - "Now" button next to Starting Date & Time → fills in the current date and time
> - "+30m" and "+1h" buttons next to "I'll get things done by" and "I'm going to sleep at" → adds 30 min or 1 hour to the existing target (cumulative)
> - Small `×` reset button next to each label to clear that field

---

## Common Tips That Help

1. **Always attach a screenshot or a PDF**. It saves a lot of back-and-forth.
2. **Specify the device**. Say "on phone" or "on desktop" when the behavior differs.
3. **Be precise about numbers**. Say "30 minutes before the start time", not "a bit before".
4. **Test after each big change**. Don't stack 10 changes into one prompt — debug one at a time.
5. **Ask for the SQL or schema**. When using Supabase, ask the assistant to give you the exact `CREATE TABLE` statements to paste into the SQL Editor.
6. **Keep the anon key public**. Supabase anon keys are designed to be safely embedded in client code; do not paste the `service_role` key anywhere public.
7. **Hard refresh after every deploy**. Use Cmd + Shift + R (Mac) or Ctrl + Shift + R (Windows) to skip browser cache.

---

## How to Hand This Off to a New Assistant

If you want to start over or adapt this for a different topic, paste the following kickoff prompt:

> I want to build a single-file `index.html` website (HTML + CSS + JavaScript inside one file) that runs on free GitHub Pages. Use `localStorage` for offline storage and Supabase (URL + anon key + email auth) for cross-device sync. The website is for `[your topic — e.g., habit tracking, study planning]`. Here are the features I want, one at a time. After each feature, give me the updated full file and the SQL I need to run on Supabase.
>
> Feature 1: `[describe]`
> Feature 2: `[describe]`
> …

Then send each feature one at a time, with screenshots if possible.

---

## File Layout (so you can copy this project)

```
your-repo/
├── index.html      ← all code lives here
├── external0.png   ← optional images for the External score
├── external1.png
├── …
├── external6.png
├── internal0.png   ← optional images for the Internal score
├── …
└── internal6.png
```

Push to GitHub, enable Pages on the repo, done.

---

## Supabase Setup Cheat Sheet

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Authentication → Sign In / Providers → Email → turn off "Confirm email" (so sign-up is instant).
3. SQL Editor → run this once:

```sql
create table if not exists focus_sessions (
  id bigserial primary key,
  user_id text not null,
  date text not null,
  timestamp bigint not null,
  ext_score int,
  int_score int,
  tasks_total int,
  tasks_done int,
  completed_tasks jsonb,
  pct int,
  session_start_ms bigint,
  segments jsonb,
  created_at timestamptz default now()
);
alter table focus_sessions enable row level security;
create policy "anon read"   on focus_sessions for select using (true);
create policy "anon insert" on focus_sessions for insert with check (true);
create policy "anon delete" on focus_sessions for delete using (true);

create table if not exists user_settings (
  user_id text primary key,
  motivational_lines text,
  ext_others jsonb,
  int_others jsonb,
  tasks jsonb,
  time_goals jsonb,
  ext_factors jsonb,
  int_factors jsonb,
  updated_at timestamptz default now()
);
alter table user_settings enable row level security;
create policy "anon read s"   on user_settings for select using (true);
create policy "anon insert s" on user_settings for insert with check (true);
create policy "anon update s" on user_settings for update using (true);
create policy "anon delete s" on user_settings for delete using (true);
```

4. Project Settings → API → copy the Project URL and the `anon public` key.
5. Paste them into the `SUPABASE_DEFAULT_URL` and `SUPABASE_DEFAULT_KEY` constants near the top of the JavaScript section in `index.html`.
6. Push to GitHub, hard refresh the site.

---

That's it. With these prompts and this cheat sheet, you can rebuild the same site or adapt it for any other project that needs cross-device sync, an interactive timeline, or a scoring system.
