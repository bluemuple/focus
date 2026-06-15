// ============================================================================
// Bidoro — Google Calendar OAuth broker (B1: connect)
// ----------------------------------------------------------------------------
// Supabase Edge Function (Deno). Deploy:
//   supabase functions deploy gcal-oauth --no-verify-jwt
// (Must be --no-verify-jwt: the /start + /callback routes are hit directly in
//  the browser during the Google consent redirect, with no apikey header.)
//
// Secrets you set (Client ID is public, secret is NOT — never put it in code):
//   supabase secrets set GCAL_CLIENT_ID="309943684001-bvnv59jfpsbdrindld2s28v2dla07kfe.apps.googleusercontent.com"
//   supabase secrets set GCAL_CLIENT_SECRET="<your client secret>"
//   (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected.)
//
// Routes (path suffix after the function name):
//   /gcal-oauth/start?uid=<bidoroUserId>   → 302 to Google consent
//   /gcal-oauth/callback?code=&state=<uid> → exchange code, store tokens, show "done"
//   /gcal-oauth/status?uid=<bidoroUserId>  → { connected: bool }  (JSON; app polls this)
//
// Token table: focus_gcal_tokens (see supabase-gcal-tokens.sql). Service role.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID    = Deno.env.get("GCAL_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GCAL_CLIENT_SECRET") || "";
// Redirect goes to OUR OWNED domain (required for Google app verification): bidoro.app hosts a
// tiny forwarder (gcal-callback.html) that bounces the ?code back to THIS function's /callback.
// Override with the GCAL_REDIRECT secret if the domain ever changes.
const REDIRECT_URI = Deno.env.get("GCAL_REDIRECT") || "https://bidoro.app/gcal-callback.html";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const html = (b: string, status = 200) =>
  new Response(b, { status, headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  // route = the last path segment (start / callback / status)
  const route = url.pathname.split("/").filter(Boolean).pop() || "";

  // ---- /start → redirect the browser to Google's consent screen ----
  if (route === "start") {
    const uid = url.searchParams.get("uid") || "";
    if (!uid) return json({ ok: false, error: "missing uid" }, 400);
    if (!CLIENT_ID) return json({ ok: false, error: "GCAL_CLIENT_ID not set" }, 500);
    const g = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    g.searchParams.set("client_id", CLIENT_ID);
    g.searchParams.set("redirect_uri", REDIRECT_URI);
    g.searchParams.set("response_type", "code");
    g.searchParams.set("scope", SCOPE);
    g.searchParams.set("access_type", "offline");   // → refresh_token
    g.searchParams.set("prompt", "consent");        // force refresh_token even on re-link
    g.searchParams.set("include_granted_scopes", "true");
    g.searchParams.set("state", uid);
    return Response.redirect(g.toString(), 302);
  }

  // ---- /callback → exchange the code for tokens, store them ----
  if (route === "callback") {
    const code = url.searchParams.get("code") || "";
    const uid  = url.searchParams.get("state") || "";
    const err  = url.searchParams.get("error") || "";
    if (err) return html(donePage("Connection cancelled.", false));
    if (!code || !uid) return html(donePage("Invalid request.", false));
    if (!CLIENT_SECRET || !CLIENT_ID) return html(donePage("Server needs GCAL_CLIENT_SECRET set.", false));
    try {
      const tokRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI, grant_type: "authorization_code",
        }),
      });
      const tok = await tokRes.json();
      if (!tokRes.ok || !tok.access_token) {
        return html(donePage("Token exchange failed: " + (tok.error_description || tok.error || tokRes.status), false));
      }
      const sb = createClient(SUPABASE_URL, SERVICE_KEY);
      const row: Record<string, unknown> = {
        user_id: uid,
        access_token: tok.access_token,
        token_expiry: new Date(Date.now() + (Number(tok.expires_in) || 3600) * 1000).toISOString(),
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // refresh_token only comes back on the FIRST consent (or with prompt=consent);
      // never overwrite a stored one with null.
      if (tok.refresh_token) row.refresh_token = tok.refresh_token;
      const { error } = await sb.from("focus_gcal_tokens").upsert(row, { onConflict: "user_id" });
      if (error) return html(donePage("Save failed: " + error.message, false));
      return html(donePage("Google Calendar connected!", true));
    } catch (e) {
      return html(donePage("Error: " + (e instanceof Error ? e.message : String(e)), false));
    }
  }

  // ---- /status → { connected } (does a token row exist for this uid?) ----
  if (route === "status") {
    const uid = url.searchParams.get("uid") || "";
    if (!uid) return json({ connected: false });
    try {
      const sb = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data } = await sb.from("focus_gcal_tokens")
        .select("user_id, refresh_token").eq("user_id", uid).maybeSingle();
      return json({ connected: !!(data && data.refresh_token) });
    } catch (_) {
      return json({ connected: false });
    }
  }

  return json({ ok: false, error: "unknown route" }, 404);
});

function donePage(msg: string, ok: boolean): string {
  // ASCII-only so it can never mojibake regardless of how the host serves the charset.
  const color = ok ? "#16a34a" : "#dc2626";
  const mark = ok ? "&#x2705;" : "&#x26A0;&#xFE0F;";   // ✅ / ⚠️ via HTML entities (no raw multibyte)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bidoro - Google Calendar</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;
font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#111827">
<div style="text-align:center;padding:28px 24px;max-width:360px">
<div style="font-size:40px;margin-bottom:10px">${mark}</div>
<div style="font-size:18px;font-weight:800;color:${color};margin-bottom:8px">${msg}</div>
<div style="font-size:14px;color:#6b7280">You can close this tab and return to Bidoro.</div>
</div></body></html>`;
}
