// =============================================================
//   Supabase Edge Function: wc-align   (WordCatch only)
//
//   Aligns a lesson's mp3 to its sentences. Runs Google Cloud
//   Speech-to-Text (long-running, with word time offsets) on the
//   audio, then LCS-aligns the recognised words to the lesson's
//   known sentences — yielding a {start,end} for each sentence.
//   The teacher's Audio-sync editor calls this for its "Auto-align"
//   button; the result pre-fills the per-sentence time inputs, which
//   the teacher then proofreads / nudges.
//
//   ⚠️  DEPLOY NAME MUST BE "wc-align". The `wc-` prefix scopes it
//      to WordCatch in the shared Supabase project.
//
//   Honest limits: speech recognition of sung lyrics (over backing
//   music) is far less reliable than spoken text — expect to hand-
//   correct song alignments. Very long / high-bitrate mp3s can also
//   exceed the inline request size; those return a clear error and
//   the teacher falls back to the manual editor.
//
//   Cloud cache: identical (audio, sentences) inputs cache in
//   `wc_align_cache` — re-opening the editor is free.
//
//   Deploy:
//     1. Edge Functions → New function → name "wc-align"
//     2. Paste this whole file as the body
//     3. Secret: reuses GOOGLE_TTS_KEY (set for wc-tts-google), or
//        GOOGLE_CLOUD_API_KEY. The Cloud Speech-to-Text API must be
//        ENABLED in that GCP project.
//     4. SQL once — run edu/supabase-add-audio-align.sql.
//
//   Request:  { lines: string[], audio_url?: string,
//               audio_base64?: string }   (one of audio_* required)
//   Response: { segments: ({start:number,end:number}|null)[] }
//             — one entry per input line, null where unaligned.
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const STT_LONGRUN = "https://speech.googleapis.com/v1/speech:longrunningrecognize";
const STT_OP_BASE = "https://speech.googleapis.com/v1/operations/";

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d))
    .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

async function readCache(key: string): Promise<unknown[] | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/wc_align_cache?cache_key=eq.${encodeURIComponent(key)}&select=segments`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` } });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr?.[0] ? arr[0].segments : null;
  } catch { return null; }
}
async function writeCache(key: string, segments: unknown): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/wc_align_cache`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ cache_key: key, segments }),
    });
  } catch {}
}

// STT word time offsets are Durations — REST returns "1.200s", but
// tolerate the {seconds,nanos} object shape too.
function durToSec(t: unknown): number {
  if (t == null) return 0;
  if (typeof t === "string") return parseFloat(t.replace("s", "")) || 0;
  if (typeof t === "object") {
    const o = t as { seconds?: unknown; nanos?: unknown };
    return Number(o.seconds || 0) + Number(o.nanos || 0) / 1e9;
  }
  return Number(t) || 0;
}
function normWord(w: string): string {
  return String(w || "").toLowerCase().replace(/[^a-z0-9']/g, "");
}
function abToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// Longest-common-subsequence word match → [lessonIdx, sttIdx] pairs.
// Falls back to a cheap forward-greedy match when the DP table would
// be huge (very long lesson + transcript).
function alignWords(a: string[], b: string[]): [number, number][] {
  const n = a.length, m = b.length;
  if (!n || !m) return [];
  if (n * m > 6_000_000) {
    const out: [number, number][] = [];
    let j = 0;
    for (let i = 0; i < n; i++) {
      let k = j;
      while (k < m && b[k] !== a[i]) k++;
      if (k < m) { out.push([i, k]); j = k + 1; }
    }
    return out;
  }
  const dp: Int32Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: [number, number][] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const lines: string[] = Array.isArray(body?.lines)
      ? body.lines.map((x: unknown) => String(x || "")) : [];
    if (!lines.length) return json({ error: "lines required" }, 400);

    let audioB64 = String(body?.audio_base64 || "");
    const audioUrl = String(body?.audio_url || "");
    if (audioB64.startsWith("data:")) {
      const c = audioB64.indexOf(",");
      if (c >= 0) audioB64 = audioB64.slice(c + 1);
    }

    const ref = audioUrl || ("b64len:" + audioB64.length);
    const ck = await sha256Hex(ref + "\n" + lines.join("␟"));
    const cached = await readCache(ck);
    if (cached) return json({ segments: cached, cached: true });

    // Resolve the audio to inline base64 (STT can't fetch an https URL).
    if (!audioB64 && audioUrl) {
      const ar = await fetch(audioUrl);
      if (!ar.ok) return json({ error: "could not fetch audio_url " + ar.status }, 502);
      audioB64 = abToB64(await ar.arrayBuffer());
    }
    if (!audioB64) return json({ error: "audio_base64 or audio_url required" }, 400);

    const apiKey = Deno.env.get("GOOGLE_TTS_KEY")
                 || Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!apiKey) return json({ error: "GOOGLE_TTS_KEY / GOOGLE_CLOUD_API_KEY not set" }, 500);

    // Kick off long-running recognition (handles short audio too).
    const startR = await fetch(`${STT_LONGRUN}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          encoding: "MP3",
          languageCode: "en-US",
          enableWordTimeOffsets: true,
          enableAutomaticPunctuation: false,
          model: "latest_long",
        },
        audio: { content: audioB64 },
      }),
    });
    if (!startR.ok) {
      const t = await startR.text().catch(() => "");
      return json({ error: "Google STT " + startR.status, detail: t.slice(0, 400) }, 502);
    }
    const opName = String((await startR.json())?.name || "");
    if (!opName) return json({ error: "no operation name returned" }, 502);

    // Poll the operation until done — cap the wait so the function
    // always returns (the teacher can retry, or sync by hand).
    let opJ: { done?: boolean; error?: { message?: string }; response?: { results?: unknown[] } } | null = null;
    for (let i = 0; i < 26; i++) {
      await new Promise((res) => setTimeout(res, i === 0 ? 3000 : 5000));
      const pr = await fetch(`${STT_OP_BASE}${encodeURIComponent(opName)}?key=${apiKey}`);
      if (!pr.ok) continue;
      opJ = await pr.json();
      if (opJ?.done) break;
    }
    if (!opJ || !opJ.done) return json({ error: "alignment_timeout" }, 504);
    if (opJ.error) return json({ error: "STT: " + (opJ.error.message || "unknown") }, 502);

    // Flatten recognised words with their timings.
    const sttWords: { w: string; start: number; end: number }[] = [];
    for (const res of (opJ.response?.results || []) as Array<{ alternatives?: Array<{ words?: Array<{ word?: string; startTime?: unknown; endTime?: unknown }> }> }>) {
      for (const w of (res?.alternatives?.[0]?.words || [])) {
        const nw = normWord(String(w.word || ""));
        if (nw) sttWords.push({ w: nw, start: durToSec(w.startTime), end: durToSec(w.endTime) });
      }
    }
    if (!sttWords.length) {
      return json({ segments: lines.map(() => null), note: "no_speech_recognised" });
    }

    // Lesson words, each tagged with its line.
    const lessonWords: { w: string; line: number }[] = [];
    lines.forEach((ln, li) => {
      (ln.match(/[A-Za-z0-9']+/g) || []).forEach((tok) => {
        const nw = normWord(tok);
        if (nw) lessonWords.push({ w: nw, line: li });
      });
    });

    const pairs = alignWords(lessonWords.map((x) => x.w), sttWords.map((x) => x.w));

    // Each line's span = min start / max end of its anchored words.
    const segs: ({ start: number; end: number } | null)[] = lines.map(() => null);
    for (const [ai, bi] of pairs) {
      const li = lessonWords[ai].line;
      const st = sttWords[bi].start, en = sttWords[bi].end;
      const cur = segs[li];
      if (!cur) segs[li] = { start: st, end: en };
      else { cur.start = Math.min(cur.start, st); cur.end = Math.max(cur.end, en); }
    }
    // Round to 0.1s — that's all the teacher editor needs.
    const rounded = segs.map((s) => s
      ? { start: Math.round(s.start * 10) / 10, end: Math.round(s.end * 10) / 10 }
      : null);

    writeCache(ck, rounded);
    return json({ segments: rounded });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
