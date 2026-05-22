// =============================================================
//   Supabase Edge Function: wc-ocr   (WordCatch only)
//
//   Recognises the text inside a cropped comic speech-bubble image
//   using Google Cloud Vision (DOCUMENT_TEXT_DETECTION). The teacher
//   dashboard's bubble editor (teacher.js) calls this after the
//   teacher clicks a bubble — the returned text pre-fills the
//   dialogue box so they only proofread instead of transcribing.
//
//   ⚠️  DEPLOY NAME MUST BE "wc-ocr". The `wc-` prefix scopes it to
//      WordCatch inside the shared Supabase project.
//
//   Cloud cache: identical crops cache in `wc_ocr_cache` keyed by a
//   SHA-256 of the image bytes — first detect pays Google's cents,
//   re-opening the lesson is free.
//
//   Deploy:
//     1. Edge Functions → New function → name "wc-ocr"
//     2. Paste this whole file as the body
//     3. Secret: reuses GOOGLE_TTS_KEY (already set for wc-tts-google),
//        or set GOOGLE_CLOUD_API_KEY. The Cloud Vision API must be
//        ENABLED in that GCP project (separate from the TTS API).
//     4. SQL once — run edu/supabase-add-comic-ocr.sql.
//
//   Request:  { image_base64: "<base64 JPEG/PNG, NO data: prefix>" }
//   Response: { text: "WHAT IS GOING ON?", cached?: true }
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

async function cacheKey(imageB64: string): Promise<string> {
  const buf = new TextEncoder().encode(imageB64);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 48);
}

async function readCache(key: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/wc_ocr_cache?cache_key=eq.${encodeURIComponent(key)}&select=text`;
    const r = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    // A cached empty string is a valid result (Vision found nothing) —
    // distinguish "row exists, text empty" from "no row".
    return arr?.[0] ? String(arr[0].text ?? "") : null;
  } catch { return null; }
}
async function writeCache(key: string, text: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/wc_ocr_cache`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ cache_key: key, text }),
    });
  } catch {}
}

// Comics letter their dialogue across several short lines; Vision
// returns those with newlines. Flatten to one space-joined string so
// the lesson tokeniser reads it as flowing prose.
function flatten(raw: string): string {
  return String(raw || "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    let imageB64 = String(body?.image_base64 || "").trim();
    // Tolerate a full `data:image/...;base64,xxxx` URL — strip the prefix.
    const comma = imageB64.indexOf(",");
    if (imageB64.startsWith("data:") && comma >= 0) imageB64 = imageB64.slice(comma + 1);
    if (!imageB64) return json({ error: "image_base64 required" }, 400);

    const ck = await cacheKey(imageB64);
    const cached = await readCache(ck);
    if (cached !== null) return json({ text: cached, cached: true });

    const apiKey = Deno.env.get("GOOGLE_TTS_KEY")
                 || Deno.env.get("GOOGLE_CLOUD_API_KEY");
    if (!apiKey) return json({ error: "GOOGLE_TTS_KEY / GOOGLE_CLOUD_API_KEY not set" }, 500);

    const r = await fetch(`${VISION_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: imageB64 },
          // DOCUMENT_TEXT_DETECTION handles the dense, multi-line
          // lettering of comic bubbles better than plain TEXT_DETECTION.
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["en"] },
        }],
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return json({ error: "Google Vision " + r.status, detail: txt.slice(0, 400) }, 502);
    }
    const j = await r.json();
    const resp = j?.responses?.[0] || {};
    if (resp.error) {
      return json({ error: "Vision: " + (resp.error.message || "unknown") }, 502);
    }
    const raw = resp?.fullTextAnnotation?.text
             ?? resp?.textAnnotations?.[0]?.description
             ?? "";
    const text = flatten(raw);

    writeCache(ck, text);     // fire-and-forget; caches empty results too
    return json({ text });
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
