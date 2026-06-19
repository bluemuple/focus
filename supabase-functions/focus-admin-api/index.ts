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
          .select("id, memo_id, author_client_id, user_id, text, hearted, reported, is_ai, created_at").in("memo_id", ids).order("created_at", { ascending: true });
        comments = data || [];
      }
      const { data: controls } = await sb.from("focus_admin_controls").select("client_id, no_share, no_comment, admin_message");
      const { data: userMessages } = await sb.from("focus_user_messages").select("id, client_id, message, created_at").order("created_at", { ascending: false }).limit(500);
      // Resolve emails for SIGNED-UP sharers AND repliers (service role → auth.users).
      const uids = [...new Set([
        ...(memos || []).map((m: any) => m.user_id),
        ...comments.map((c: any) => c.user_id),
      ].filter(Boolean))];
      const emailByUid: Record<string, string> = {};
      for (const uid of uids) {
        try { const { data } = await sb.auth.admin.getUserById(uid as string); if (data?.user?.email) emailByUid[uid as string] = data.user.email; } catch (_) { /* ignore */ }
      }
      (memos || []).forEach((m: any) => { m.email = m.user_id ? (emailByUid[m.user_id] || null) : null; });
      comments.forEach((c: any) => { c.email = c.user_id ? (emailByUid[c.user_id] || null) : null; });
      return json({ ok: true, memos: memos || [], comments, controls: controls || [], userMessages: userMessages || [] });
    }
    if (action === "users") {
      // Member list: every registered auth user + their Bidoro profile (nickname / friend code).
      const perPage = 1000;
      const authUsers: any[] = [];
      for (let page = 1; page <= 50; page++) {
        const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
        if (error || !data || !data.users || !data.users.length) break;
        authUsers.push(...data.users);
        if (data.users.length < perPage) break;
      }
      const { data: profiles } = await sb.from("focus_profiles")
        .select("user_id, friend_code, nickname, avatar, focusing, updated_at");
      const pByUid: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { if (p.user_id) pByUid[p.user_id] = p; });
      // Friend counts per user (accepted friendships) so the admin can see who's connected.
      const friendCount: Record<string, number> = {};
      const { data: fr } = await sb.from("focus_friendships").select("user_a, user_b, status");
      (fr || []).forEach((f: any) => {
        if (f.status && f.status !== "accepted") return;
        if (f.user_a) friendCount[f.user_a] = (friendCount[f.user_a] || 0) + 1;
        if (f.user_b) friendCount[f.user_b] = (friendCount[f.user_b] || 0) + 1;
      });
      const users = authUsers.map((u: any) => {
        const p = pByUid[u.id] || {};
        return {
          id: u.id,
          email: u.email || null,
          created_at: u.created_at || null,
          last_sign_in_at: u.last_sign_in_at || null,
          nickname: p.nickname || null,
          friend_code: p.friend_code || null,
          avatar: p.avatar || null,
          focusing: !!p.focusing,
          friends: friendCount[u.id] || 0,
        };
      });
      users.sort((a, b2) => String(b2.created_at || "").localeCompare(String(a.created_at || "")));
      return json({ ok: true, users });
    }
    if (action === "deleteMemo")    { await sb.from("focus_shared_memos").delete().eq("id", b.id);     return json({ ok: true }); }
    if (action === "deleteComment") { await sb.from("focus_memo_comments").delete().eq("id", b.id);    return json({ ok: true }); }
    if (action === "addComment") {
      // Admin replies to a shared note. Inserted as a NORMAL user reply (is_ai
      // false, a random anonymous client id) so it looks exactly like any other
      // user's reply on the user's screen.
      const memoId = b.memo_id;
      const text = String(b.text || "").trim().slice(0, 1000);
      if (memoId == null || !text) return json({ ok: false, error: "memo_id + text required" }, 400);
      await sb.from("focus_memo_comments").insert({
        memo_id: memoId, text,
        author_client_id: "c-" + Math.random().toString(36).slice(2, 10),
        is_ai: false, hearted: false, reported: false,
      });
      return json({ ok: true });
    }
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
    if (action === "getSettings") {
      const { data } = await sb.from("focus_admin_settings").select("ai_enabled, ai_reply_after_minutes, subs_max_lines").eq("id", 1).maybeSingle();
      return json({ ok: true, settings: data || { ai_enabled: true, ai_reply_after_minutes: 1440, subs_max_lines: 10 } });
    }
    if (action === "setSettings") {
      // PARTIAL upsert — only the fields present in the request are written, so the
      // AI tab and the Subscriptions tab don't overwrite each other's settings.
      const row: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
      if (b.ai_enabled !== undefined) row.ai_enabled = b.ai_enabled !== false;
      if (b.ai_reply_after_minutes !== undefined) row.ai_reply_after_minutes = Math.max(0, Math.min(1051200, parseInt(String(b.ai_reply_after_minutes), 10) || 1440));
      if (b.subs_max_lines !== undefined) row.subs_max_lines = Math.max(1, Math.min(100, parseInt(String(b.subs_max_lines), 10) || 10));
      await sb.from("focus_admin_settings").upsert(row, { onConflict: "id" });
      return json({ ok: true });
    }
    // ---- Subscriptions: topic lists + user-submitted lists ----
    if (action === "subsList") {
      const { data } = await sb.from("focus_subscription_lists")
        .select("id, kind, name, lines, author_name, client_id, approved, subscribe_count, created_at")
        .order("created_at", { ascending: false }).limit(2000);
      return json({ ok: true, lists: data || [] });
    }
    if (action === "subsPublishTopic") {
      // Admin publishes (or replaces) a TOPIC list — upsert by (kind='topic', name).
      const name = String(b.name || "").trim().slice(0, 60);
      const lines = Array.isArray(b.lines)
        ? b.lines.map((x: any) => String(x).slice(0, 300)).map((s: string) => s.trim()).filter(Boolean).slice(0, 200) : [];
      if (!name || !lines.length) return json({ ok: false, error: "name + lines required" }, 400);
      const { data: existing } = await sb.from("focus_subscription_lists")
        .select("id").eq("kind", "topic").eq("name", name).maybeSingle();
      if (existing?.id) await sb.from("focus_subscription_lists").update({ lines, approved: true }).eq("id", existing.id);
      else await sb.from("focus_subscription_lists").insert({ kind: "topic", name, lines, approved: true });
      return json({ ok: true });
    }
    if (action === "subsApprove") {
      if (b.id == null) return json({ ok: false, error: "id required" }, 400);
      const patch: Record<string, unknown> = { approved: true };
      if (b.author_name) patch.author_name = String(b.author_name).slice(0, 60);
      await sb.from("focus_subscription_lists").update(patch).eq("id", b.id);
      return json({ ok: true });
    }
    if (action === "subsDelete") {
      if (b.id == null) return json({ ok: false, error: "id required" }, 400);
      await sb.from("focus_subscription_lists").delete().eq("id", b.id);
      return json({ ok: true });
    }
    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
