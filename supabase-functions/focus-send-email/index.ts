// ============================================================================
// Bidoro — transactional email via Twilio SendGrid.
// ----------------------------------------------------------------------------
// Two TEMPLATED kinds only (content is built server-side so a signed-in user
// can't send arbitrary spam — they can only trigger these two messages):
//   • "keyholder-unlock" — tell the trusted PIN holder that an emergency
//        24-hour phone-app-lock (Focus Lock) release was requested.
//   • "trial-billing"    — remind the user their Bidoro PRO free trial converts
//        to a paid plan (mirrors the on-device local notification).
//
// (user) Both kinds are LOCALIZED — the client passes `lang` (the app's current
// language, which follows the phone/system language when set to auto), and the
// email is written in that language (en/ko/zh/ja/es/fr, fallback en). For the
// keyholder email the display name is the user's nickname, or their email when
// no nickname is set (`who`), plus their account email (`account`).
//
// Deploy (RE-RUN after editing this file):
//   supabase functions deploy focus-send-email --no-verify-jwt
// Secrets (set once):
//   supabase secrets set SENDGRID_API_KEY=SG.xxxxx
//   supabase secrets set EMAIL_FROM=noreply@bidoro.app     # a SendGrid-verified sender
//   supabase secrets set EMAIL_FROM_NAME=Bidoro
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// The caller must be signed in — we validate their JWT (auth.getUser) so only a
// real Bidoro account can send, which rate-limits abuse to that account.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "noreply@bidoro.app";
const EMAIL_FROM_NAME = Deno.env.get("EMAIL_FROM_NAME") || "Bidoro";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function isEmail(s: string) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s || ""); }
function esc(s: string) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!)); }

const LANGS = ["en", "ko", "zh", "ja", "es", "fr"];
function pickLang(l: unknown) { const s = String(l ?? "").slice(0, 2).toLowerCase(); return LANGS.includes(s) ? s : "en"; }

// ---- keyholder-unlock copy (n = display name, already inserted by the caller) ----
const KH: Record<string, any> = {
  en: {
    subject: (n: string) => `[Bidoro] ${n} requested to unlock their phone app lock`,
    l1: (n: string) => `${n} requested an emergency unlock for their phone app lock in Bidoro.`,
    l2: `Their blocked apps will not unlock immediately.`,
    l3: (n: string) => `The phone app lock will be released automatically in 24 hours unless ${n} cancels the request.`,
    l4: (n: string) => `You're receiving this because ${n} chose you as their trusted person and you hold their unlock PIN.`,
    details: `Request details`, name: `Name`, account: `Account`, lockType: `Lock type`, lockVal: `Phone app lock`, unlockTime: `Unlock time`, unlockVal: `In 24 hours`,
  },
  ko: {
    subject: (n: string) => `[Bidoro] ${n}님이 폰 앱 잠금 해제를 요청했어요`,
    l1: (n: string) => `${n}님이 Bidoro에서 폰 앱 잠금의 긴급 해제를 요청했습니다.`,
    l2: `차단된 앱은 즉시 풀리지 않습니다.`,
    l3: (n: string) => `${n}님이 요청을 취소하지 않으면 24시간 뒤 폰 앱 잠금이 자동으로 해제됩니다.`,
    l4: (n: string) => `${n}님이 신뢰하는 사람으로 당신을 선택했고 당신이 해제 PIN을 가지고 있어 이 메일을 받았습니다.`,
    details: `요청 정보`, name: `이름`, account: `계정`, lockType: `잠금 종류`, lockVal: `폰 앱 잠금`, unlockTime: `해제 시각`, unlockVal: `24시간 후`,
  },
  zh: {
    subject: (n: string) => `[Bidoro] ${n} 请求解锁手机应用锁`,
    l1: (n: string) => `${n} 在 Bidoro 中请求紧急解锁手机应用锁。`,
    l2: `被屏蔽的应用不会立即解锁。`,
    l3: (n: string) => `除非 ${n} 取消请求，手机应用锁将在 24 小时后自动解除。`,
    l4: (n: string) => `您收到此邮件是因为 ${n} 选择您作为其信任的人，并且您持有其解锁 PIN。`,
    details: `请求详情`, name: `姓名`, account: `账号`, lockType: `锁定类型`, lockVal: `手机应用锁`, unlockTime: `解锁时间`, unlockVal: `24 小时后`,
  },
  ja: {
    subject: (n: string) => `[Bidoro] ${n} さんがスマホアプリロックの解除をリクエストしました`,
    l1: (n: string) => `${n} さんが Bidoro でスマホアプリロックの緊急解除をリクエストしました。`,
    l2: `ブロック中のアプリはすぐには解除されません。`,
    l3: (n: string) => `${n} さんがリクエストをキャンセルしない限り、24時間後にスマホアプリロックが自動的に解除されます。`,
    l4: (n: string) => `${n} さんが信頼できる人としてあなたを選び、解除PINを預けているため、このメールが届いています。`,
    details: `リクエスト詳細`, name: `名前`, account: `アカウント`, lockType: `ロックの種類`, lockVal: `スマホアプリロック`, unlockTime: `解除時刻`, unlockVal: `24時間後`,
  },
  es: {
    subject: (n: string) => `[Bidoro] ${n} solicitó desbloquear el bloqueo de apps del teléfono`,
    l1: (n: string) => `${n} solicitó un desbloqueo de emergencia del bloqueo de apps de su teléfono en Bidoro.`,
    l2: `Las apps bloqueadas no se desbloquearán de inmediato.`,
    l3: (n: string) => `El bloqueo se liberará automáticamente en 24 horas, a menos que ${n} cancele la solicitud.`,
    l4: (n: string) => `Recibes esto porque ${n} te eligió como su persona de confianza y tú tienes su PIN de desbloqueo.`,
    details: `Detalles de la solicitud`, name: `Nombre`, account: `Cuenta`, lockType: `Tipo de bloqueo`, lockVal: `Bloqueo de apps del teléfono`, unlockTime: `Hora de desbloqueo`, unlockVal: `En 24 horas`,
  },
  fr: {
    subject: (n: string) => `[Bidoro] ${n} a demandé à déverrouiller le verrou des applis du téléphone`,
    l1: (n: string) => `${n} a demandé un déverrouillage d'urgence du verrou des applis de son téléphone dans Bidoro.`,
    l2: `Les applis bloquées ne seront pas déverrouillées immédiatement.`,
    l3: (n: string) => `Le verrou sera automatiquement levé dans 24 heures, sauf si ${n} annule la demande.`,
    l4: (n: string) => `Vous recevez ceci car ${n} vous a choisi comme personne de confiance et vous détenez son code de déverrouillage.`,
    details: `Détails de la demande`, name: `Nom`, account: `Compte`, lockType: `Type de verrou`, lockVal: `Verrou des applis du téléphone`, unlockTime: `Heure de déverrouillage`, unlockVal: `Dans 24 heures`,
  },
};

// ---- trial-billing copy (d = optional formatted date string) ----
const TB: Record<string, any> = {
  en: { subject: `Bidoro PRO — your free trial is ending soon`, body: (d: string) => `Thanks for trying Bidoro PRO! Your free trial converts to a paid subscription${d ? ` on ${d}` : " soon"}. You can manage or cancel anytime in iOS Settings › Apple Account › Subscriptions.` },
  ko: { subject: `Bidoro PRO — 무료 체험이 곧 종료돼요`, body: (d: string) => `Bidoro PRO를 사용해 주셔서 감사합니다! 무료 체험이${d ? ` ${d}에` : " 곧"} 유료 구독으로 전환됩니다. iOS 설정 › Apple 계정 › 구독 에서 언제든 관리·해지할 수 있어요.` },
  zh: { subject: `Bidoro PRO — 您的免费试用即将结束`, body: (d: string) => `感谢体验 Bidoro PRO！您的免费试用将${d ? `于 ${d}` : "很快"}转为付费订阅。您可随时在 iOS 设置 › Apple 账户 › 订阅 中管理或取消。` },
  ja: { subject: `Bidoro PRO — 無料トライアルがまもなく終了します`, body: (d: string) => `Bidoro PRO をお試しいただきありがとうございます！無料トライアルは${d ? ` ${d} に` : "まもなく"}有料サブスクリプションへ移行します。iOS 設定 › Apple アカウント › サブスクリプション からいつでも管理・解約できます。` },
  es: { subject: `Bidoro PRO — tu prueba gratuita está por terminar`, body: (d: string) => `¡Gracias por probar Bidoro PRO! Tu prueba gratuita se convertirá en una suscripción de pago${d ? ` el ${d}` : " pronto"}. Puedes gestionarla o cancelarla cuando quieras en Ajustes de iOS › Apple Account › Suscripciones.` },
  fr: { subject: `Bidoro PRO — votre essai gratuit se termine bientôt`, body: (d: string) => `Merci d'essayer Bidoro PRO ! Votre essai gratuit deviendra un abonnement payant${d ? ` le ${d}` : " bientôt"}. Vous pouvez le gérer ou l'annuler à tout moment dans Réglages iOS › Compte Apple › Abonnements.` },
};

function wrapHtml(inner: string) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#1f2937">${inner}<p style="color:#6b7280;margin-top:14px">— Bidoro</p></div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!SENDGRID_API_KEY) return json({ ok: false, error: "email not configured" }, 503);

    // The token IS the authorization — must be a real signed-in Bidoro user.
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ ok: false, error: "missing auth token" }, 401);
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData } = await sb.auth.getUser(jwt);
    if (!userData?.user?.id) return json({ ok: false, error: "invalid token" }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const to = String((body as any).to || "").trim();
    const kind = String((body as any).kind || "");
    const lang = pickLang((body as any).lang);
    if (!isEmail(to)) return json({ ok: false, error: "bad recipient" }, 400);

    let subject = "", text = "", html = "";
    if (kind === "keyholder-unlock") {
      const t = KH[lang] || KH.en;
      // Display name = nickname, or the account email when no nickname (client already resolves `who`).
      const nameRaw = String((body as any).who || "Someone you trust");
      const acctRaw = String((body as any).account || "");
      const n = esc(nameRaw), acc = esc(acctRaw);
      subject = t.subject(nameRaw);
      text = [
        t.l1(nameRaw), "",
        t.l2, t.l3(nameRaw), "",
        t.l4(nameRaw), "",
        t.details,
        `${t.name}: ${nameRaw}`,
        `${t.account}: ${acctRaw}`,
        `${t.lockType}: ${t.lockVal}`,
        `${t.unlockTime}: ${t.unlockVal}`,
        "", "— Bidoro",
      ].join("\n");
      html = wrapHtml(
        `<p>${t.l1(`<b>${n}</b>`)}</p>` +
        `<p>${esc(t.l2)}<br>${t.l3(`<b>${n}</b>`)}</p>` +
        `<p>${t.l4(`<b>${n}</b>`)}</p>` +
        `<p style="margin:16px 0 4px;font-weight:700">${esc(t.details)}</p>` +
        `<p style="margin:0;color:#374151">` +
        `${esc(t.name)}: <b>${n}</b><br>` +
        `${esc(t.account)}: ${acc}<br>` +
        `${esc(t.lockType)}: ${esc(t.lockVal)}<br>` +
        `${esc(t.unlockTime)}: ${esc(t.unlockVal)}</p>`
      );
    } else if (kind === "trial-billing") {
      const t = TB[lang] || TB.en;
      const date = String((body as any).date || "");
      subject = t.subject;
      text = t.body(date) + `\n\n— Bidoro`;
      html = wrapHtml(`<p>${t.body(esc(date))}</p>`);
    } else {
      return json({ ok: false, error: "unknown kind" }, 400);
    }

    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "Authorization": `Bearer ${SENDGRID_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: EMAIL_FROM, name: EMAIL_FROM_NAME },
        subject,
        content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }],
      }),
    });
    if (resp.status >= 200 && resp.status < 300) return json({ ok: true });
    return json({ ok: false, error: "send failed", detail: (await resp.text()).slice(0, 300) }, 502);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
