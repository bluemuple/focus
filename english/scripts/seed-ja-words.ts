// =============================================================
// scripts/seed-ja-words.ts
//
// Pre-populates the cloud `word_info_gpt_cache` table with common
// Japanese vocabulary so users hit the cache instead of paying for
// GPT calls one-by-one.
//
// Usage (Deno):
//   export SUPABASE_URL=https://YOURPROJECT.supabase.co
//   export SUPABASE_ANON=sb_publishable_...
//   deno run --allow-net --allow-env --allow-read \
//     scripts/seed-ja-words.ts scripts/ja-words.txt
//
// The Edge Function handles the cache itself — this script just
// fires a POST per word. Words already in cache are skipped server-
// side (no GPT cost), so re-running this is safe.
// =============================================================

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")  || "";
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON") || "";

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("Set SUPABASE_URL and SUPABASE_ANON env vars first.");
  Deno.exit(1);
}

const inputPath = Deno.args[0];
if (!inputPath) {
  console.error("Usage: deno run ... seed-ja-words.ts <words-file.txt>");
  Deno.exit(1);
}

const text = await Deno.readTextFile(inputPath);
const words = Array.from(new Set(
  text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
));

console.log(`Seeding ${words.length} JP words → ${SUPABASE_URL}`);

const FN_URL = SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/word-info-gpt";
const headers = {
  "Content-Type": "application/json",
  "Authorization": "Bearer " + SUPABASE_ANON,
  "apikey": SUPABASE_ANON,
};

let done = 0;
let failed = 0;

async function seedOne(word: string) {
  try {
    const r = await fetch(FN_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ word, lang: "ja" }),
    });
    if (!r.ok) {
      console.error(`  ✗ ${word}  HTTP ${r.status}`);
      failed++;
      return;
    }
    const j = await r.json();
    if (j.error) {
      console.error(`  ✗ ${word}  ${j.error}`);
      failed++;
      return;
    }
    done++;
    if (done % 25 === 0 || done === words.length) {
      const pct = Math.round((done * 100) / words.length);
      console.log(`  [${done}/${words.length}] (${pct}%) ${word}`);
    }
  } catch (e) {
    console.error(`  ✗ ${word}  ${(e as Error).message}`);
    failed++;
  }
}

// Concurrency: 4 in flight at a time to stay well under OpenAI's
// 500 RPM limit and Supabase's per-function rate limit. Add a 200 ms
// delay between batches as further safety.
const CONCURRENCY = 4;
const DELAY_MS    = 200;

for (let i = 0; i < words.length; i += CONCURRENCY) {
  const batch = words.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(seedOne));
  if (i + CONCURRENCY < words.length) {
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
}

console.log(`\nDone. Cached: ${done}, failed: ${failed}`);
if (failed > 0) {
  console.log("(Failed words are logged above. Re-run the script to retry — already-cached words skip GPT automatically.)");
}
