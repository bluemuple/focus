// =============================================================
//   Supabase Edge Function: wc-animal-image-2nd   (Ako only)
//
//   Returns the URL of the SECOND Google Image search result for
//   the animal. Cached in wc_animal_wiki.secondary_image_url so
//   we only call the Google Custom Search API once per animal.
//
//   POST body:
//     {
//       animal_id:   string  // required, cache key
//       animal_name: string  // required, search query
//       force:       boolean // optional — bypass cache, refetch
//     }
//
//   Response:
//     { image_url: "https://...jpg", cached: true|false }
//
//   Deploy:
//     1. Edge Functions → New function → name "wc-animal-image-2nd"
//     2. Paste this file as index.ts
//     3. Add secrets:
//          GOOGLE_API_KEY  (Google Cloud API key with Custom
//                           Search API enabled)
//          GOOGLE_CSE_ID   (Custom Search Engine ID — create at
//                           programmablesearchengine.google.com,
//                           enable "Search the entire web" + "Image search")
//     4. SQL once: focus/edu/supabase-add-animal-wiki-image.sql
//
//   If the secrets are missing, the function returns
//   {image_url: null, configured: false} so the client can
//   gracefully omit the image instead of failing.
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function readCache(animal_id: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  try {
    const u = `${SUPABASE_URL}/rest/v1/wc_animal_wiki?animal_id=eq.${encodeURIComponent(animal_id)}&select=secondary_image_url`;
    const r = await fetch(u, {
      headers: { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr?.[0]?.secondary_image_url || null;
  } catch { return null; }
}

async function writeCache(animal_id: string, image_url: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/wc_animal_wiki?on_conflict=animal_id`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      // animal_id is the conflict key; content + source_title are
      // NOT NULL but accept empty strings. The wiki digest function
      // is the one that fills those; we only touch the image field.
      // To avoid clobbering an existing row, we PATCH instead.
      body: JSON.stringify({
        animal_id,
        secondary_image_url: image_url,
        content: "",
        source_title: "",
      }),
    });
    // If the row already existed with content/source_title, the
    // INSERT above tried to overwrite them with empty strings. Use
    // a follow-up PATCH to make sure we only update the image.
    await fetch(`${SUPABASE_URL}/rest/v1/wc_animal_wiki?animal_id=eq.${encodeURIComponent(animal_id)}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ secondary_image_url: image_url }),
    });
  } catch {}
}

async function fetchSecondImageFromGoogle(query: string): Promise<string | null> {
  const apiKey = Deno.env.get("GOOGLE_API_KEY") || "";
  const cseId  = Deno.env.get("GOOGLE_CSE_ID")  || "";
  if (!apiKey || !cseId) return null;
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.search = new URLSearchParams({
    key:        apiKey,
    cx:         cseId,
    q:          query,
    searchType: "image",
    num:        "3",       // ask for 3, we want index 1 (the 2nd)
    safe:       "active",  // safe-search for kids
  }).toString();
  const r = await fetch(url.toString());
  if (!r.ok) return null;
  const j: any = await r.json();
  const items: any[] = Array.isArray(j?.items) ? j.items : [];
  if (items.length < 2) return items[0]?.link || null;
  return items[1]?.link || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const animal_id   = String(body?.animal_id   || "").trim();
    const animal_name = String(body?.animal_name || "").trim();
    const force       = !!body?.force;
    if (!animal_id || !animal_name) return json({ error: "animal_id + animal_name required" }, 400);

    if (!force) {
      const cached = await readCache(animal_id);
      if (cached) return json({ image_url: cached, cached: true });
    }

    const apiKey = Deno.env.get("GOOGLE_API_KEY") || "";
    const cseId  = Deno.env.get("GOOGLE_CSE_ID")  || "";
    if (!apiKey || !cseId) {
      return json({ image_url: null, cached: false, configured: false,
        error: "GOOGLE_API_KEY / GOOGLE_CSE_ID not set" }, 200);
    }

    const url = await fetchSecondImageFromGoogle(animal_name + " animal");
    if (!url) return json({ image_url: null, cached: false, configured: true,
      error: "google returned no image" }, 200);

    await writeCache(animal_id, url);
    return json({ image_url: url, cached: false });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
