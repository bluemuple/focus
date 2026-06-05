// ============================================================================
// Bidoro — AI auto-reply for lonely shared memos
// ----------------------------------------------------------------------------
// Supabase Edge Function (Deno). Deploy:
//   supabase functions deploy focus-memo-ai-reply
// Secrets it needs (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
//
// What it does: finds shared memos that are at least ~1 day old and still have
// NO reply, then writes ONE warm, human-sounding reply (<= 200 chars) via GPT and
// inserts it as a comment with is_ai = true. The client surfaces AI replies
// IDENTICALLY to human ones ("A friend left a memo.") — only the owner's admin
// page (shared.html) reveals the `ai` tag.
//
// Trigger it on a schedule — e.g. a Supabase cron (pg_cron → net.http_post) or an
// external cron hitting this function's URL once or twice a day.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const MAX_PER_RUN = 12; // cap GPT calls per invocation

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function gptReply(memo: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.9,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "You are a kind stranger replying to a short anonymous note someone shared in a focus app. " +
              "Reply in the SAME language as the note. Be warm, specific, and human — like a real person who " +
              "happened to read it. 1-2 short sentences, under 200 characters. No emojis unless the note has one. " +
              "Never mention being an AI, an assistant, or a model. Just be a friend.",
          },
          { role: "user", content: memo },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const txt = (data?.choices?.[0]?.message?.content || "").trim();
    return txt ? txt.slice(0, 200) : null;
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Candidate memos: older than a day.
    const { data: memos, error: mErr } = await sb
      .from("focus_shared_memos")
      .select("id, text, created_at")
      .lt("created_at", dayAgo)
      .order("created_at", { ascending: true })
      .limit(120);
    if (mErr) throw mErr;

    // Which of them already have a comment?
    const ids = (memos || []).map((m: any) => m.id);
    const replied = new Set<number>();
    if (ids.length) {
      const { data: cs } = await sb
        .from("focus_memo_comments")
        .select("memo_id")
        .in("memo_id", ids);
      (cs || []).forEach((c: any) => replied.add(c.memo_id));
    }

    const lonely = (memos || []).filter((m: any) => !replied.has(m.id)).slice(0, MAX_PER_RUN);
    let written = 0;
    for (const m of lonely) {
      const reply = await gptReply(String(m.text || ""));
      if (!reply) continue;
      const { error: iErr } = await sb.from("focus_memo_comments").insert({
        memo_id: m.id,
        author_client_id: "ai",
        text: reply,
        is_ai: true,
      });
      if (!iErr) written++;
    }

    return new Response(JSON.stringify({ ok: true, candidates: lonely.length, written }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
