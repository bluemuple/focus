// =============================================================
//   Story client — calls the Supabase Edge Function `story-gpt`
//   to ask GPT-4o-mini for a tiny mini-lesson built around 3
//   mastered vocabulary words. Sends `lang` ('en' | 'ja') so the
//   server picks the right prompt: EN mode → English mini-lesson,
//   JP mode → Japanese mini-lesson.
//
//   Public API (window.Story):
//     • generate(words, opts?)  → { title, body, words }
//
//   On any failure (no Supabase config, network error, GPT 5xx,
//   bad JSON), the call rejects and the caller can fall back to
//   the local STORY_TEMPLATES in index.html.
// =============================================================
(function () {
  function supabaseUrl(path) {
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg || !cfg.url || !cfg.anon) throw new Error('Supabase not configured');
    return {
      url: cfg.url.replace(/\/+$/, '') + path,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + cfg.anon,
        'apikey':        cfg.anon,
      },
    };
  }

  // generate(words, opts):
  //   words : array of 3 mastered words to weave into the story.
  //   opts  : { level: 'easy' | 'medium' }   (default 'easy')
  // Returns: { title, body, words }  on success, or rejects on error.
  // The active learning language is auto-detected from DB.getLang()
  // so callers don't have to thread it through.
  async function generate(words, opts) {
    if (!Array.isArray(words) || words.length < 1) {
      throw new Error('words[] required');
    }
    const level = (opts && opts.level) || 'easy';
    const lang  = (window.DB && window.DB.getLang && window.DB.getLang()) || 'en';
    const { url, headers } = supabaseUrl('/functions/v1/story-gpt');
    const r = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify({ words, level, lang }),
    });
    if (!r.ok) {
      // Surface the body on dev so we can debug 401/5xx quickly.
      let detail = '';
      try { detail = (await r.text()).slice(0, 200); } catch (e) {}
      throw new Error('story-gpt ' + r.status + (detail ? ': ' + detail : ''));
    }
    const j = await r.json();
    if (!j || j.error) throw new Error('story-gpt: ' + (j && j.error));
    if (!j.title || !j.body) throw new Error('story-gpt: empty payload');
    return { title: String(j.title), body: String(j.body), words: words.slice() };
  }

  window.Story = { generate };
})();
