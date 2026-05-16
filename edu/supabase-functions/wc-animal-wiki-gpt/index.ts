// =============================================================
//   Supabase Edge Function: wc-animal-wiki-gpt   (Ako only)
//
//   Generates a Year-4-friendly digest of a Wikipedia article
//   about an animal. Result is cached in `wc_animal_wiki` keyed
//   by `animal_id` so each animal only burns one GPT call ever
//   (Prewarm + lazy-on-first-open both write the same row).
//
//   POST body:
//     {
//       animal_id:   string  // required — cache key
//       wiki_title:  string  // optional, defaults to animal_name
//       animal_name: string  // required
//       force:       boolean // optional — bypass cache, regenerate
//     }
//
//   Response:
//     { html: "<h4>…</h4><p>…</p>…",
//       generated_at: "2026-05-17T…",
//       cached: true|false,
//       wiki_title: "Kiwi (bird)" }
//
//   Deploy:
//     1. Edge Functions → New function → name "wc-animal-wiki-gpt"
//     2. Paste this file as index.ts
//     3. Secret OPENAI_API_KEY (shared with other GPT functions)
//     4. SQL once: focus/edu/supabase-add-animal-wiki.sql
// =============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const SYSTEM_PROMPT = [
  "You write friendly, easy-read animal pages for New Zealand Year-4",
  "students (ages 8–9) who find reading hard. Use NZ English spelling",
  "(colour, harbour, organise, behaviour, neighbour). Keep sentences",
  "short — mostly under 10 words. Use the simple present tense. Use",
  "easy Year-4 words. Stay friendly and curious, never lecture.",
  "",
  "Given a Wikipedia article about an animal, you must:",
  "",
  "  1) Pick EXACTLY 6 sections that children will find interesting.",
  "     Lean toward these topics (in this order if all are available):",
  "       • Appearance / what it looks like",
  "       • Habitat / where it lives",
  "       • Family & lifestyle / how it lives day-to-day",
  "       • Food / what it eats / hunting",
  "       • Babies / young / how it grows up",
  "       • Fun behaviour, special skill, or amazing fact",
  "",
  "  2) Each section:",
  "       • ≤ 100 words",
  "       • Short sentences, mostly under 10 words",
  "       • NZ English, simple present tense, Year-4 vocabulary",
  "       • Bold any NEW key vocabulary word the first time it",
  "         appears (use <strong>word</strong>).",
  "",
  "  3) After the 6 sections, list which Wikipedia topics you LEFT",
  "     OUT and one short reason for each (too technical / not",
  "     interesting for kids / too sad / etc.).",
  "",
  "OUTPUT FORMAT — strict HTML fragment, no <html>/<head>/<body>:",
  "",
  "  <h4>1. Appearance</h4>",
  "  <p>…</p>",
  "  <h4>2. Habitat</h4>",
  "  <p>…</p>",
  "  …  (six total)",
  "  <h4>What we skipped</h4>",
  "  <ul>",
  "    <li><strong>topic</strong> — short reason</li>",
  "    …",
  "  </ul>",
  "",
  "Return ONLY that HTML fragment — no Markdown fences, no extra text.",
].join("\n");

async function fetchWikipediaPlainText(title: string): Promise<{ text: string; resolvedTitle: string }> {
  // 1) Resolve the canonical title (handles redirects, encoding).
  //    Use the action API "query" with prop=extracts, explaintext=true.
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action:      "query",
    prop:        "extracts",
    explaintext: "true",
    redirects:   "1",
    format:      "json",
    titles:      title,
    origin:      "*",
  }).toString();
  const r = await fetch(url.toString(), {
    headers: { "User-Agent": "Ako/1.0 (NZ classroom)" },
  });
  if (!r.ok) throw new Error("wikipedia " + r.status);
  const j: any = await r.json();
  const pages = j?.query?.pages || {};
  const pageId = Object.keys(pages)[0];
  if (!pageId || pageId === "-1") throw new Error("page not found");
  const page = pages[pageId];
  const text = String(page?.extract || "");
  // Cap at ~12k chars so the GPT prompt stays under ~3500 tokens.
  // The early sections (which contain the kid-friendly material)
  // come first, so chopping the tail is acceptable.
  const trimmed = text.length > 12000 ? text.slice(0, 12000) + "\n[…]" : text;
  return { text: trimmed, resolvedTitle: String(page?.title || title) };
}

async function readCache(animal_id: string): Promise<any | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return null;
  try {
    const u = `${SUPABASE_URL}/rest/v1/wc_animal_wiki?animal_id=eq.${encodeURIComponent(animal_id)}&select=content,source_title,generated_at`;
    const r = await fetch(u, {
      headers: { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` },
    });
    if (!r.ok) return null;
    const arr = await r.json();
    return arr?.[0] || null;
  } catch { return null; }
}

async function writeCache(animal_id: string, content: string, source_title: string): Promise<void> {
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
      body: JSON.stringify({
        animal_id, content, source_title,
        generated_at: new Date().toISOString(),
      }),
    });
  } catch {}
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const animal_id   = String(body?.animal_id || "").trim();
    const animal_name = String(body?.animal_name || "").trim();
    const wiki_title  = String(body?.wiki_title || animal_name || "").trim();
    const force       = !!body?.force;
    if (!animal_id || !wiki_title) return json({ error: "animal_id + wiki_title (or animal_name) required" }, 400);

    if (!force) {
      const cached = await readCache(animal_id);
      if (cached) return json({
        html:          cached.content,
        generated_at:  cached.generated_at,
        wiki_title:    cached.source_title,
        cached:        true,
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY not set" }, 500);

    const article = await fetchWikipediaPlainText(wiki_title);
    if (!article.text.trim()) return json({ error: "wikipedia returned empty article" }, 502);

    const userPrompt = [
      `ANIMAL: ${animal_name || article.resolvedTitle}`,
      `WIKIPEDIA TITLE: ${article.resolvedTitle}`,
      "",
      "ARTICLE TEXT:",
      article.text,
    ].join("\n");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: userPrompt },
        ],
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return json({ error: "openai " + r.status, detail: detail.slice(0, 400) }, 502);
    }
    const oj: any = await r.json();
    let html = String(oj?.choices?.[0]?.message?.content || "").trim();
    // Strip accidental Markdown fences if GPT wrapped output.
    html = html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();
    if (!html) return json({ error: "openai returned empty" }, 502);

    await writeCache(animal_id, html, article.resolvedTitle);

    return json({
      html,
      generated_at: new Date().toISOString(),
      wiki_title:   article.resolvedTitle,
      cached:       false,
    });
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
