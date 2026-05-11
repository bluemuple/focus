// =============================================================
//   Supabase Edge Function: tts-google
//
//   Proxies Google Cloud Text-to-Speech with the en-NZ-Wavenet-A
//   voice (the WordCatch default — NZ accent, friendly tone).
//   Voice is overridable per call, but defaults to NZ.
//
//   Cloud cache: identical (text, voice, rate) tuples cache in
//   `wc_tts_cache` (audio stored as base64 — fine for short
//   sentences; longer lessons we'd push to Storage instead).
//   First user pays Google's cents, everyone else gets it free.
//
//   Deploy:
//     1. Edge Functions → New function → name "tts-google"
//     2. Paste this whole file as the body
//     3. Secret GOOGLE_CLOUD_API_KEY (Cloud TTS API enabled)
//     4. SQL once:
//        create table if not exists wc_tts_cache (
//          cache_key text primary key,
//          audio_base64 text not null,
//          created_at timestamptz default now()
//        );
//        alter table wc_tts_cache enable row level security;
//        create policy wc_tts_cache_dev on wc_tts_cache for all using (true) with check (true);
//
//   Request:  { text: "The kiwi waddled home.", voice?: "en-NZ-Wavenet-A",
//               rate?: 1.0 }
//   Response: { audio_base64: "<mp3 data>" }
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

async function cacheKey(text: string, voice: string, rate: number): Promise<string> {
  const norm = voice + ":" + rate.toFixed(2) + ":::" + text.normalize("NFKC").trim();
  const buf = new TextEncoder().encode(norm);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function readCache(key: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/wc_tts_cache?cache_key=eq.${encodeURIComponent(key)}&select=audio_base64`;
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr?.[0]?.audio_base64 || null;
  } catch { return null; }
}
async function writeCache(key: string, b64: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/wc_tts_cache`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ cache_key: key, audio_base64: b64 }),
    });
  } catch {}
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body  = await req.json();
    const text  = String(body?.text  || "").trim();
    const voice = String(body?.voice || "en-NZ-Wavenet-A");
    const rate  = Number(body?.rate  || 1.0);
    if (!text) return json({ error: "text required" }, 400);

    const ck = await cacheKey(text, voice, rate);
    const cached = await readCache(ck);
    if (cached) return json({ audio_base64: cached, cached: true });

    const apiKey = Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!apiKey) return json({ error: "GOOGLE_CLOUD_API_KEY not set" }, 500);

    const r = await fetch(`${TTS_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "en-NZ", name: voice },
        audioConfig: { audioEncoding: "MP3", speakingRate: rate },
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return json({ error: "Google TTS " + r.status, detail: txt.slice(0, 400) }, 502);
    }
    const j = await r.json();
    const b64 = String(j?.audioContent || "");
    if (!b64) return json({ error: "empty audio" }, 502);

    writeCache(ck, b64);
    return json({ audio_base64: b64 });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
