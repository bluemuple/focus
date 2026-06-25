// ============================================================================
// Bidoro — self-service account deletion (App Store guideline 5.1.1(v))
// ----------------------------------------------------------------------------
// A SIGNED-IN user deletes THEIR OWN account + all their data, entirely in-app.
// Deploy:
//   supabase functions deploy focus-delete-account --no-verify-jwt
// (we verify the caller's JWT ourselves via auth.getUser so we can also run the
//  service-role deletions in the same call.)
//
// The client calls this with the user's access token in the Authorization
// header. We resolve the user id from that token, wipe every table keyed to the
// user, then delete the auth record. Nothing is gated behind an admin token —
// the token IS the authorization (you can only delete yourself).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ ok: false, error: "missing auth token" }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Resolve (and validate) the caller from their own access token.
    const { data: userData, error: userErr } = await sb.auth.getUser(jwt);
    const uid = userData?.user?.id;
    if (userErr || !uid) return json({ ok: false, error: "invalid or expired token" }, 401);

    // Wipe every per-user row. Best-effort per table so one missing table can't
    // block the rest; the auth delete at the end is what makes the account gone.
    const del = async (table: string, col: string) => {
      try { await sb.from(table).delete().eq(col, uid); } catch (_) { /* ignore */ }
    };
    await del("focus_sessions", "user_id");
    await del("user_settings", "user_id");
    await del("focus_profiles", "user_id");
    await del("focus_shared_memos", "user_id");
    await del("focus_memo_comments", "user_id");
    await del("focus_friendships", "user_a");
    await del("focus_friendships", "user_b");

    // Finally remove the auth account itself.
    const { error: delErr } = await sb.auth.admin.deleteUser(uid);
    if (delErr) return json({ ok: false, error: delErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
