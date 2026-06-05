// ============================================================================
// Bidoro — admin API (real security for the moderation page)
// ----------------------------------------------------------------------------
// Supabase Edge Function (Deno). Deploy:
//   supabase functions deploy focus-admin-api --no-verify-jwt
// (or in the dashboard, turn "Verify JWT" OFF for this function)
//
// Secrets:
//   ADMIN_TOKEN  → a long random string YOU choose; the admin page must send it.
//   (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected.)
//
// Why: the anon key is public, so the old admin page (anon key + a hardcoded
// passphrase) couldn't really stop anyone from blocking users / deleting / etc.
// This function does every privileged action with the SERVICE ROLE (bypasses
// RLS) but ONLY after checking ADMIN_TOKEN — so the powers are gated by a secret
// that never leaves the server. Pair it with supabase-admin-controls.sql, which
// REVOKES those writes from anon so they can ONLY happen through here.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_TOKEN = Deno.env.get("ADMIN_TOKEN") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const token = String((body as any).token || req.headers.get("x-admin-token") || "");
    if (!ADMIN_TOKEN || token.length < 8 || token !== ADMIN_TOKEN) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const action = String((body as any).action || "");
    const b = body as any;

    if (action === "list") {
      const { data: memos } = await sb.from("focus_shared_memos")
        .select("id, client_id, text, emoji, created_at, max_viewers, user_id").order("created_at", { ascending: false }).limit(1000);
      const ids = (memos || []).map((m: any) => m.id);
      let comments: any[] = [];
      if (ids.length) {
        const { data } = await sb.from("focus_memo_comments")
          .select("id, memo_id, text, hearted, reported, is_ai, created_at").in("memo_id", ids).order("created_at", { ascending: true });
        comments = data || [];
      }
      const { data: controls } = await sb.from("focus_admin_controls").select("client_id, no_share, no_comment, admin_message");
      // Resolve emails for SIGNED-UP sharers (service role can read auth.users).
      const uids = [...new Set((memos || []).map((m: any) => m.user_id).filter(Boolean))];
      const emailByUid: Record<string, string> = {};
      for (const uid of uids) {
        try { const { data } = await sb.auth.admin.getUserById(uid as string); if (data?.user?.email) emailByUid[uid as string] = data.user.email; } catch (_) { /* ignore */ }
      }
      (memos || []).forEach((m: any) => { m.email = m.user_id ? (emailByUid[m.user_id] || null) : null; });
      return json({ ok: true, memos: memos || [], comments, controls: controls || [] });
    }
    if (action === "deleteMemo")    { await sb.from("focus_shared_memos").delete().eq("id", b.id);     return json({ ok: true }); }
    if (action === "deleteComment") { await sb.from("focus_memo_comments").delete().eq("id", b.id);    return json({ ok: true }); }
    if (action === "setMaxViewers") { await sb.from("focus_shared_memos").update({ max_viewers: (b.max_viewers ?? null) }).eq("id", b.id); return json({ ok: true }); }
    if (action === "setControl") {
      const row = {
        client_id: String(b.client_id || ""),
        no_share: !!b.no_share,
        no_comment: !!b.no_comment,
        admin_message: (b.admin_message ? String(b.admin_message).slice(0, 200) : null),
        updated_at: new Date().toISOString(),
      };
      if (!row.client_id) return json({ ok: false, error: "client_id required" }, 400);
      await sb.from("focus_admin_controls").upsert(row, { onConflict: "client_id" });
      return json({ ok: true });
    }
    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
