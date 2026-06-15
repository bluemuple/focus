// ============================================================================
// Bidoro — Google Calendar two-way sync (B2: push new + pull)
// ----------------------------------------------------------------------------
// Supabase Edge Function (Deno). Deploy:
//   supabase functions deploy gcal-sync --no-verify-jwt
// Secrets (same as gcal-oauth): GCAL_CLIENT_ID, GCAL_CLIENT_SECRET.
//
// POST body (JSON):
//   { uid: string, events: [{ id, name, startMs, endMs, gcalId? }] }
// Response:
//   { ok, mapped: { <appId>: <gcalId> }, pulled: [{ gcalId, name, startMs, endMs }] }
//
// What it does, per call:
//   1. refresh the access token from the stored refresh_token
//   2. PUSH: app events WITHOUT a gcalId → insert into Google → return {appId: gcalId}
//            app events WITH a gcalId    → PATCH (keep Google copy in sync with edits)
//   3. PULL: list Google events in a window → return them (app dedups by gcalId)
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID    = Deno.env.get("GCAL_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("GCAL_CLIENT_SECRET") || "";
const CAL = "primary";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function getAccessToken(sb: any, uid: string): Promise<string | null> {
  const { data } = await sb.from("focus_gcal_tokens")
    .select("refresh_token, access_token, token_expiry").eq("user_id", uid).maybeSingle();
  if (!data || !data.refresh_token) return null;
  // Reuse a still-valid access token (60s safety margin).
  if (data.access_token && data.token_expiry && (new Date(data.token_expiry).getTime() - Date.now()) > 60000) {
    return data.access_token;
  }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: data.refresh_token, grant_type: "refresh_token",
    }),
  });
  const t = await r.json();
  if (!r.ok || !t.access_token) return null;
  await sb.from("focus_gcal_tokens").update({
    access_token: t.access_token,
    token_expiry: new Date(Date.now() + (Number(t.expires_in) || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", uid);
  return t.access_token;
}

const gEventBody = (e: any) => ({
  summary: String(e.name || "(no title)"),
  start: { dateTime: new Date(Number(e.startMs)).toISOString() },
  end:   { dateTime: new Date(Number(e.endMs)).toISOString() },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const uid = String(body.uid || "");
    const events: any[] = Array.isArray(body.events) ? body.events : [];
    if (!uid) return json({ ok: false, error: "missing uid" }, 400);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const token = await getAccessToken(sb, uid);
    if (!token) return json({ ok: false, error: "not_connected" }, 200);
    const auth = { Authorization: "Bearer " + token, "Content-Type": "application/json" };
    const apiBase = "https://www.googleapis.com/calendar/v3/calendars/" + CAL + "/events";

    // ---- PUSH ----
    const mapped: Record<string, string> = {};
    for (const e of events) {
      if (!e || !e.startMs || !e.endMs) continue;
      try {
        if (e.gcalId) {
          await fetch(apiBase + "/" + encodeURIComponent(e.gcalId), {
            method: "PATCH", headers: auth, body: JSON.stringify(gEventBody(e)),
          });
        } else {
          const r = await fetch(apiBase, { method: "POST", headers: auth, body: JSON.stringify(gEventBody(e)) });
          const g = await r.json();
          if (r.ok && g.id && e.id) mapped[e.id] = g.id;
        }
      } catch (_) { /* skip one bad event, keep going */ }
    }

    // ---- PULL (window: 60 days back … 400 days ahead) ----
    const timeMin = new Date(Date.now() - 60 * 864e5).toISOString();
    const timeMax = new Date(Date.now() + 400 * 864e5).toISOString();
    const listUrl = apiBase + "?singleEvents=true&orderBy=startTime&maxResults=2500"
      + "&timeMin=" + encodeURIComponent(timeMin) + "&timeMax=" + encodeURIComponent(timeMax);
    const pulled: any[] = [];
    try {
      const lr = await fetch(listUrl, { headers: { Authorization: "Bearer " + token } });
      const lj = await lr.json();
      for (const it of (lj.items || [])) {
        if (it.status === "cancelled") continue;
        const s = it.start && (it.start.dateTime || (it.start.date ? it.start.date + "T00:00:00" : null));
        const en = it.end && (it.end.dateTime || (it.end.date ? it.end.date + "T00:00:00" : null));
        if (!s || !en) continue;
        pulled.push({ gcalId: it.id, name: it.summary || "(no title)", startMs: Date.parse(s), endMs: Date.parse(en) });
      }
    } catch (_) { /* pull failed → return what we have */ }

    return json({ ok: true, mapped, pulled });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
