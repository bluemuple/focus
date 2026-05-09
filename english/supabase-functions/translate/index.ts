// =============================================================
//   Supabase Edge Function: translate
//
//   DeepL 무료 API 프록시. 단일 또는 배치 + context 지원.
//   ↓↓↓ 클라우드 캐시 추가 (translate_deepl_cache) ↓↓↓
//   같은 (text, context, source, target) 튜플은 한 번 받으면 모든
//   사용자/디바이스가 공유. EN 레슨 페이지 단어 클릭의 1차 엔진이라
//   여기 캐시가 가장 큰 비용 절감 효과.
//
//   Body 형식 (변경 없음):
//     { text: string,    context?: string }   // 단일
//     { texts: string[], context?: string }   // 배치
//
//   응답 (변경 없음):
//     { translation: string }
//     { translations: string[] }
//
//   환경 변수:
//     DEEPL_KEY                  (필수, 기존)
//     SUPABASE_URL               (자동 주입)
//     SUPABASE_SERVICE_ROLE_KEY  (자동 주입)
// =============================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// ---------- 캐시 헬퍼 ----------
// 키 = SHA-256 prefix of "<source>:<target>:<context>:::<text>"
async function cacheKey(text: string, context: string, source: string, target: string): Promise<string> {
  const norm = source + ':' + target + ':' + (context || '').normalize('NFKC').trim()
             + ':::' + text.normalize('NFKC').trim();
  const buf = new TextEncoder().encode(norm);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

// 배치 read — 한 번의 PostgREST 호출로 여러 키 동시 조회.
async function readCacheMany(keys: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !keys.length) return map;
  try {
    const list = keys.map(k => `"${k.replace(/"/g, '\\"')}"`).join(',');
    const url = `${SUPABASE_URL}/rest/v1/translate_deepl_cache`
              + `?cache_key=in.(${encodeURIComponent(list)})&select=cache_key,translation`;
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      },
    });
    if (!r.ok) return map;
    const arr = await r.json();
    for (const row of (Array.isArray(arr) ? arr : [])) {
      if (row?.cache_key && row?.translation) map.set(row.cache_key, row.translation);
    }
  } catch {}
  return map;
}

// 배치 write — fire-and-forget. 실패해도 다음 호출이 한 번 더 DeepL 칠 뿐.
async function writeCacheMany(rows: { cache_key: string; translation: string }[]): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !rows.length) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/translate_deepl_cache`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    });
  } catch {}
}

// ---------- 메인 핸들러 ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const target  = (body.target || 'KO').toString();
  const source  = (body.source || 'EN').toString();
  const context = body.context ? String(body.context) : '';

  // 단일 vs 배치 — 기존 로직 그대로.
  const isBatch = Array.isArray(body.texts);
  const items: string[] = isBatch
    ? body.texts.map((s: any) => String(s || '').trim()).filter(Boolean)
    : (body.text ? [String(body.text).trim()].filter(Boolean) : []);

  if (!items.length) {
    return new Response(JSON.stringify({ error: 'no text' }), {
      status: 400, headers: { ...CORS, 'content-type': 'application/json' },
    });
  }

  // ---------- 캐시 체크 ----------
  // 모든 입력에 대해 키 계산 → 한 번의 PostgREST 호출로 일괄 조회.
  const keys = await Promise.all(items.map(t => cacheKey(t, context, source, target)));
  const cached = await readCacheMany(keys);

  // 미스만 골라서 DeepL에 한 번에 보냄. 풀 cache hit이면 DeepL 호출
  // 자체가 일어나지 않음.
  const out: string[] = new Array(items.length).fill('');
  const missIdx: number[] = [];
  const missTexts: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const hit = cached.get(keys[i]);
    if (hit) { out[i] = hit; continue; }
    missIdx.push(i);
    missTexts.push(items[i]);
  }

  if (missTexts.length) {
    const key = Deno.env.get('DEEPL_KEY');
    if (!key) {
      return new Response(JSON.stringify({ error: 'DEEPL_KEY not set' }), {
        status: 500, headers: { ...CORS, 'content-type': 'application/json' },
      });
    }

    // ---- DeepL 호출 부분: 기존과 동일 (JSON body, free endpoint) ----
    const r = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        text: missTexts,
        source_lang: source,
        target_lang: target,
        ...(context ? { context } : {}),
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return new Response(JSON.stringify({ error: 'deepl ' + r.status, detail: errText }), {
        status: 502, headers: { ...CORS, 'content-type': 'application/json' },
      });
    }
    const j = await r.json();
    const fresh: string[] = (j.translations || []).map((t: any) => String(t?.text || ''));

    // 결과를 원래 순서대로 out 배열에 끼워넣고, 캐시에 적재.
    const rows: { cache_key: string; translation: string }[] = [];
    for (let k = 0; k < missIdx.length; k++) {
      const i = missIdx[k];
      const tr = fresh[k] || '';
      out[i] = tr;
      if (tr) rows.push({ cache_key: keys[i], translation: tr });
    }
    // Fire-and-forget upsert. 응답 지연 없음.
    writeCacheMany(rows);
  }

  // ---- 응답 형식: 기존과 동일 ----
  const payload = isBatch
    ? { translations: out }
    : { translation: out[0] || '' };

  return new Response(JSON.stringify(payload), {
    headers: { ...CORS, 'content-type': 'application/json' },
  });
});
