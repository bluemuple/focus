// =============================================================
//   Japanese tokenizer + furigana helper.
//
//   Lazy-loads kuromoji.js (~700 kB gzip) + IPADIC dictionary
//   (~13 MB raw, ~5 MB gzip; cached by the browser after first
//   load) the FIRST time Japanese text needs to be tokenized.
//   English-only sessions never pay this cost.
//
//   Public surface (window.JPT):
//     • ready(): Promise<tokenizer>            — resolves when
//       kuromoji finished building. Subsequent calls return the
//       same cached promise.
//     • tokenize(text): Promise<Token[]>       — same shape as
//       kuromoji's own .tokenize() output (surface_form,
//       basic_form, reading, pos, etc.).
//     • renderTokens(tokens): string           — renders an HTML
//       string of <span class="w"> chips, with <ruby> furigana
//       above any token that contains kanji and whose reading
//       differs from its surface form.
//     • katakanaToHiragana(s)                  — utility.
//     • splitSentencesJa(text): string[]       — sentence-
//       segmentation for JP body text (uses 。！？ as breaks).
// =============================================================
(() => {
  // CDN — kuromoji 0.1.2 ships its dictionary alongside the lib.
  const KUROMOJI_SCRIPT = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.min.js';
  const KUROMOJI_DICT   = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/';

  let _readyPromise = null;
  let _tokenizer = null;

  // BELT-AND-SUSPENDERS FIX for the kuromoji 0.1.2 path.join bug.
  // The prototype patch (further down) is the clean fix, but in
  // some minified builds the loader's `loadArrayBuffer` is hidden
  // behind a non-enumerable closure — the prototype walk doesn't
  // catch it, the XHR fires with a broken `https:/cdn...` URL, and
  // the browser resolves it as scheme-relative → 404.
  //
  // This wraps `XMLHttpRequest.prototype.open` SITE-WIDE and rewrites
  // any URL matching the broken kuromoji-CDN patterns BEFORE the
  // request goes out. The wrap is idempotent and only touches URLs
  // that match jsdelivr's kuromoji path, so it's harmless for all
  // other XHRs the page makes.
  function _patchXhrOpen() {
    if (_patchXhrOpen._done) return;
    _patchXhrOpen._done = true;
    try {
      const origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        let fixed = String(url == null ? '' : url);
        // Only rewrite URLs that look like jsdelivr's kuromoji dict
        // (or the script itself). Avoid touching unrelated XHRs.
        if (/cdn\.jsdelivr\.net\/npm\/kuromoji/.test(fixed)) {
          // Case A: `https:/cdn...` (single slash from path.join).
          fixed = fixed.replace(/^(https?):\/(?!\/)/, '$1://');
          // Case B: `/cdn.jsdelivr.net/...` (protocol stripped).
          if (/^\/cdn\.jsdelivr\.net\//.test(fixed)) {
            fixed = 'https:' + fixed;
          }
          // Case C: `cdn.jsdelivr.net/...` (no protocol or slash) —
          // would resolve as page-relative.
          if (/^cdn\.jsdelivr\.net\//.test(fixed)) {
            fixed = 'https://' + fixed;
          }
          // Case D: already mis-resolved → `https://<origin>/cdn.jsdelivr.net/...`.
          // Strip the origin and reset to https://cdn.jsdelivr.net/...
          fixed = fixed.replace(
            /^https?:\/\/[^/]+\/(cdn\.jsdelivr\.net\/)/,
            'https://$1'
          );
        }
        // Forward through with the fixed URL plus any remaining
        // arguments (async, user, password) untouched.
        const args = Array.prototype.slice.call(arguments);
        args[1] = fixed;
        return origOpen.apply(this, args);
      };
    } catch (e) {
      console.warn('[jp-tokenizer] XHR open patch failed', e);
    }
  }
  _patchXhrOpen();

  function _loadScript() {
    if (window.kuromoji) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = KUROMOJI_SCRIPT;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = (e) => reject(new Error('kuromoji script load failed'));
      document.head.appendChild(s);
    });
  }

  // KNOWN BUG WORKAROUND for kuromoji.js@0.1.2 ----------
  // The bundled `path.join` (browserify shim) collapses `https://`
  // into `https:/` (single slash), so a dicPath like
  // 'https://cdn.jsdelivr.net/...' becomes
  // 'https:/cdn.jsdelivr.net/...' inside the loader, which the
  // browser then resolves as a RELATIVE path against the current
  // origin → 404 "https://bluemuple.github.io/cdn.jsdelivr.net/...".
  //
  // Fix: monkey-patch the BrowserDictionaryLoader's loadArrayBuffer
  // to re-insert the missing slash before issuing the XHR. We do
  // this on the prototype so every dict file (12 of them) gets
  // repaired without any per-call wiring.
  //
  // ALSO: the patch surfaces a progress callback (set via
  // setProgressHandler) so the loading splash can show a "n/12"
  // counter as each dict file completes.
  let _progressHandler = null;
  let _progressDone = 0;
  let _progressTotal = 12;          // kuromoji dict file count
  function setProgressHandler(fn) { _progressHandler = fn; }
  function _patchKuromojiLoader() {
    if (!window.kuromoji || _patchKuromojiLoader._done) return;
    _patchKuromojiLoader._done = true;
    try {
      // Build a throwaway builder to grab the loader instance,
      // then patch its prototype.
      const tmp = window.kuromoji.builder({ dicPath: KUROMOJI_DICT });
      const loader = tmp && tmp.loader;
      if (!loader) return;
      const proto = Object.getPrototypeOf(loader);
      if (!proto || typeof proto.loadArrayBuffer !== 'function') return;
      const original = proto.loadArrayBuffer;
      proto.loadArrayBuffer = function(url, callback) {
        let fixed = String(url);
        // Case A: `https:/cdn...` (one slash, browserify path.join
        // collapsed `://` → `:/`). The browser resolves this as
        // scheme-relative against the current authority → 404 at
        // /cdn.jsdelivr.net/...
        fixed = fixed.replace(/^(https?):\/(?!\/)/, '$1://');
        // Case B: `/cdn.jsdelivr.net/...` (protocol stripped fully) —
        // some path normalizers do this. Re-prepend `https:`.
        if (/^\/cdn\.jsdelivr\.net\//.test(fixed)) {
          fixed = 'https:' + fixed;
        }
        // Case C: `cdn.jsdelivr.net/...` (no protocol, no leading
        // slash) — relative-resolves to current page. Re-prepend
        // `https://`.
        if (/^cdn\.jsdelivr\.net\//.test(fixed)) {
          fixed = 'https://' + fixed;
        }
        return original.call(this, fixed, function(err, buf) {
          // Fire the progress callback whenever a file finishes
          // (success or error — kuromoji aborts the build on error
          // anyway, but we tick so the UI isn't stuck).
          _progressDone++;
          try {
            if (typeof _progressHandler === 'function') {
              _progressHandler(_progressDone, _progressTotal);
            }
          } catch (e) {}
          callback(err, buf);
        });
      };
    } catch (e) {
      console.warn('[jp-tokenizer] loader patch failed', e);
    }
  }

  function ready() {
    if (_readyPromise) return _readyPromise;
    // Reset progress counter for a fresh build attempt.
    _progressDone = 0;
    _readyPromise = (async () => {
      await _loadScript();
      _patchKuromojiLoader();
      return new Promise((resolve, reject) => {
        window.kuromoji.builder({ dicPath: KUROMOJI_DICT })
          .build((err, tokenizer) => {
            if (err) return reject(err);
            _tokenizer = tokenizer;
            resolve(tokenizer);
          });
      });
    })().catch((e) => {
      // Reset so a transient failure (offline first load) doesn't
      // permanently disable JP tokenization for the session.
      _readyPromise = null;
      throw e;
    });
    return _readyPromise;
  }

  async function tokenize(text) {
    const tk = await ready();
    return tk.tokenize(String(text || ''));
  }

  // Sync tokenize — returns tokens immediately if the tokenizer is
  // already built, else null. Used by the lesson renderer to handle
  // pagination reflow: paginateByHeight rebuilds paragraph text by
  // concatenating .w textContent (no newlines preserved), so the
  // line-level token cache misses and we need to re-tokenize the
  // reflowed string on the spot. Once `ready()` has resolved once,
  // this is just a wrapper over the cached tokenizer.
  function tokenizeSync(text) {
    if (!_tokenizer) return null;
    return _tokenizer.tokenize(String(text || ''));
  }

  // Katakana (U+30A1..U+30F6) → Hiragana (U+3041..U+3096) is a
  // straight 0x60 offset shift. Anything outside that range
  // (punctuation, kanji, etc.) passes through unchanged.
  function katakanaToHiragana(s) {
    return String(s || '').replace(/[ァ-ヶ]/g, c =>
      String.fromCharCode(c.charCodeAt(0) - 0x60)
    );
  }

  function _hasKanji(s) {
    return /[一-鿿㐀-䶿豈-﫿]/.test(s || '');
  }

  function _escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // Whether a token represents a "selectable word" (vs pure
  // whitespace / punctuation). kuromoji tags pos="記号" for symbols.
  function _isWordToken(tk) {
    const s = tk.surface_form || '';
    if (!s.trim()) return false;
    if (tk.pos === '記号') return false;
    // Single-char punctuation that slipped through (rare).
    if (/^[\s。、！？!?…・「」『』（）()\[\]【】〜\-—\.,]+$/.test(s)) return false;
    return true;
  }

  function _isKanjiChar(c) {
    return /[一-鿿㐀-䶿豈-﫿]/.test(c);
  }

  // Per-character furigana alignment. Walks `surface` and `reading`
  // in lockstep — kana surface chars consume the same kana from the
  // reading, and kanji runs consume the slice of reading up to (but
  // not including) the next matching kana of the surface.
  //   buildFurigana("食べる", "たべる")
  //     → [{kanji:"食", reading:"た"}, {kana:"べる"}]
  //   buildFurigana("学校", "がっこう")
  //     → [{kanji:"学校", reading:"がっこう"}]
  //   buildFurigana("食べました", "たべました")
  //     → [{kanji:"食", reading:"た"}, {kana:"べました"}]
  // Returns an array of segments. Pure-kana surfaces yield one
  // {kana} segment; pure-kanji yield one {kanji, reading}.
  function _buildFurigana(surface, reading) {
    const out = [];
    let si = 0;
    let ri = 0;
    while (si < surface.length) {
      if (_isKanjiChar(surface[si])) {
        // Eat the kanji run.
        let runEnd = si;
        while (runEnd < surface.length && _isKanjiChar(surface[runEnd])) runEnd++;
        const kanjiRun = surface.slice(si, runEnd);
        // Reading for this run = slice of `reading` up to the next
        // matching kana char in the surface (or end of reading).
        let readEnd;
        if (runEnd < surface.length) {
          const nextKana = surface[runEnd];
          readEnd = reading.indexOf(nextKana, ri);
          if (readEnd < 0) readEnd = reading.length;
        } else {
          readEnd = reading.length;
        }
        out.push({ kanji: kanjiRun, reading: reading.slice(ri, readEnd) });
        si = runEnd;
        ri = readEnd;
      } else {
        // Same kana char — copy through. Run as long as we keep
        // matching to coalesce adjacent kana chars in one segment.
        let runEnd = si;
        while (runEnd < surface.length && !_isKanjiChar(surface[runEnd])) runEnd++;
        const kanaRun = surface.slice(si, runEnd);
        out.push({ kana: kanaRun });
        // Reading should consume the same kana — advance `ri` by run length.
        ri = Math.min(reading.length, ri + kanaRun.length);
        si = runEnd;
      }
    }
    return out;
  }

  // (Removed: _renderWordInner. The unified `_renderTokenInner`
  //  further down replaces it — same kanji-ruby + kana-plain layout
  //  but with optional GPT ruby overlay AND inflection color cycling.)

  // Post-process kuromoji output — fold auxiliary verbs (助動詞) and
  // adjacent verb-suffix tokens into the preceding 動詞/形容詞 token
  // so 食べました reads as ONE selectable word instead of three.
  // Particles (助詞) stay separate — learners often want to look up
  // particles independently.
  // Specifically merges: 助動詞 (たい/た/ます/ません/ない/etc.),
  //                       接尾 verbs (動詞,接尾 → 過ぎる etc.).
  // Override readings for kanji that take a different on-yomi/kun-yomi
  // depending on context — kuromoji + IPADIC always picks ONE reading
  // per dictionary entry, so common alternatives need a post-pass fix.
  //
  // 何 (kuromoji default: ナニ) — but reads as ナン before:
  //   • です / だ / でしょう / じゃ / で (copula forms)
  //   • の (genitive linker — 何の本)
  //   • counters: 人/時/分/秒/日/月/年/回/個/枚/本/冊/匹/階/番/才/歳/度
  //     (何人 = なんにん, 何時 = なんじ, …)
  // This list covers ~95% of real "なん" cases without false positives;
  // the rare miss falls back to the kuromoji default なに which is
  // still a valid reading.
  function _fixContextualReadings(tokens) {
    const NAN_BEFORE_RE = /^(です|だ|でしょ|でし|じゃ|で|の|人|時|分|秒|日|月|年|回|個|枚|本|冊|匹|階|番|才|歳|度)/;
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (tk.surface_form === '何' && tk.reading) {
        const next = tokens[i + 1];
        const nextSurf = (next && next.surface_form) || '';
        // Explicit inline annotation 何 + なん — author specified the
        // reading directly. Adopt it as the authoritative reading and
        // drop the duplicate, regardless of how kuromoji tagged なん
        // (which could be 名詞/連体詞/助動詞 across IPADIC versions —
        // _stripDuplicateReadings's pos check might miss it).
        if (nextSurf === 'なん') {
          tk.reading = 'ナン';
          tk.pronunciation = 'ナン';
          out.push(tk);
          i++;                                     // consume the なん
          continue;
        }
        // Contextual override (no inline annotation): 何 followed by
        // copula / の / counter → reads as ナン. Reading flips here;
        // any inline kana matching the new reading will then be picked
        // up by _stripDuplicateReadings' Case-1 exact-match branch.
        if (NAN_BEFORE_RE.test(nextSurf)) {
          tk.reading = 'ナン';
          tk.pronunciation = 'ナン';
        }
      }
      out.push(tk);
    }
    return out;
  }

  // Strip "inline-furigana" duplicates: when a kanji-bearing token is
  // immediately followed by hiragana tokens that form an inline
  // reading annotation, drop them so only the <ruby> furigana shows.
  //
  // Two sub-cases:
  //   1. EXACT match — concatenated hiragana run equals the kanji's
  //      kuromoji reading (e.g. 名前 reading なまえ + inline なまえ).
  //      Just strip the duplicates; reading is already correct.
  //   2. PURE-KANJI override — kanji surface is all-kanji (no kana
  //      mixed in) and the inline hiragana run doesn't match
  //      kuromoji's default reading. Treat the inline kana as the
  //      author's intended reading (e.g. 何なん — kuromoji says なに,
  //      but the source clearly wants なん). Override the token's
  //      reading with the inline kana and strip it.
  //
  // Stops the lookahead at:
  //   • Particles (助詞) — always.
  //   • MULTI-CHARACTER auxiliaries (助動詞 with surface length ≥ 2) —
  //     these are real grammatical particles like です / ます / だっ.
  //     SINGLE-CHAR 助動詞 like な, た, ら are usually kuromoji
  //     tokenization artifacts (it splits unknown kana runs into
  //     1-char tokens with shaky POS tags) and should NOT block our
  //     lookahead — otherwise inline annotations like 名前なまえ get
  //     missed because kuromoji tags the leading な as 助動詞.
  //   • Suffixes (接尾) like たち in 子供たち — these are real plural
  //     markers, not inline readings.
  // Non-noun POS like フィラー (filler — kuromoji's catch-all for kana
  // it can't analyze) flows through, which is exactly what we want for
  // accumulating inline-reading runs.
  //
  // Multi-char known auxiliary safeguard: even if accum looks like an
  // inline annotation by length, refuse to override when it equals
  // (or starts with) a known copula/aux form — protects against e.g.
  // 何 + です where my length-relaxed lookahead might otherwise
  // accidentally absorb です as 何's "reading".
  const AUX_DENY_RE = /^(です|でし|でしょ|でしょう|でした|だ|だっ|でも|である|であり|まし|ます|ません|ない|なかっ|たい|たく|たかっ|られ|れる|せる|させ|なら|ば)$/;
  function _stripDuplicateReadings(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      out.push(tk);
      const surf = tk.surface_form || '';
      if (!_hasKanji(surf)) continue;
      // Accumulate the following pure-hiragana run.
      let accum = '';
      let consumed = 0;
      let j = i + 1;
      while (j < tokens.length) {
        const next = tokens[j];
        const nextSurf = next.surface_form || '';
        if (!/^[ぁ-ん]+$/.test(nextSurf)) break;
        if (next.pos === '助詞') break;
        if (next.pos === '助動詞' && nextSurf.length >= 2) break;
        if (next.pos_detail_1 === '接尾') break;
        accum += nextSurf;
        consumed++;
        j++;
        if (accum.length >= 8) break;              // safety cap
      }
      if (consumed === 0) continue;
      const rd = tk.reading ? katakanaToHiragana(tk.reading) : '';
      const isPureKanji = /^[一-鿿㐀-䶿豈-﫿]+$/.test(surf);
      if (rd && accum === rd) {
        // Case 1: exact match — strip without touching reading.
        i += consumed;
      } else if (
        isPureKanji &&
        accum.length >= 2 &&
        accum.length <= surf.length * 3 &&    // sanity: reading per
                                              // kanji ≤ 3 kana (covers
                                              // 学校→がっこう, あい→愛
                                              // etc.; rejects absorbing
                                              // 「もりでみつけた…」 as
                                              // 森's reading)
        !AUX_DENY_RE.test(accum)
      ) {
        // Case 2: override reading with inline kana, then strip.
        // Length ≥ 2 + ≤ kanji×3 + AUX_DENY guard:
        //   • Single-char accum like で is too ambiguous (could be 助詞)
        //   • Long accum (e.g. 11 chars after a single-kanji 森) is
        //     almost certainly a separate word run, NOT an inline
        //     reading annotation — overriding here would corrupt the
        //     ruby (a long fake reading rendered above one kanji).
        //   • Known aux forms like です would falsely absorb.
        // _fixContextualReadings handles the legit contextual readings
        // for cases this guard rejects.
        const kata = accum.replace(/[ぁ-ん]/g, c =>
          String.fromCharCode(c.charCodeAt(0) + 0x60)
        );
        tk.reading = kata;
        tk.pronunciation = kata;
        i += consumed;
      }
      // Else: mixed kanji+kana surface with non-matching hiragana run,
      // or accum too short / matches a real auxiliary — leave the
      // tokens alone.
    }
    return out;
  }

  // Also stores `_segments` — the list of original surface chunks
  // before merging — so the renderer can color each suffix piece
  // independently (見せ + ませ + ん + でし + た → multi-tone).
  //
  // EXTENDED merge for compound verb forms — beyond plain
  // 動詞 + 助動詞, we also absorb:
  //   • Te-form connectors (助詞,接続助詞 て/で) into the preceding
  //     verb. Without this, 持って / 住んで break into two chips at
  //     the て/で boundary.
  //   • Auxiliary verbs after a te-form merge (いる, ある, くる,
  //     おく, しまう, みる, やる, あげる, くれる, もらう). These
  //     attach to the verb as semantic "doing/being" markers and are
  //     read as one inflection unit by learners (持ってきました,
  //     住んでいました, etc.).
  // The merged chip's lemma stays the LEAD verb's basic_form so
  // word_states keys off the dictionary form (持つ, 住む).
  const TE_AUX_VERBS = new Set([
    'いる','ある','くる','行く','来る','おく','置く','しまう',
    'みる','見る','やる','あげる','くれる','もらう',
  ]);
  function _mergeAuxiliaries(tokens) {
    const out = [];
    for (const tk of tokens) {
      const last = out[out.length - 1];
      const isAux        = tk.pos === '助動詞';
      const isVerbSuffix = tk.pos === '動詞' && tk.pos_detail_1 === '接尾';
      const isTeConn     = tk.pos === '助詞' &&
                           tk.pos_detail_1 === '接続助詞' &&
                           (tk.surface_form === 'て' || tk.surface_form === 'で');
      const isTeAuxVerb  = tk.pos === '動詞' &&
                           TE_AUX_VERBS.has(tk.basic_form || '');
      const lastIsVerbish = last &&
        (last.pos === '動詞' || last.pos === '形容詞' || last._merged);
      const lastIsTeMerged = last && last._merged && last._absorbedTe;
      const shouldMerge =
        (isAux || isVerbSuffix) && lastIsVerbish ||
        isTeConn && lastIsVerbish ||
        isTeAuxVerb && lastIsTeMerged;
      if (shouldMerge) {
        last.surface_form  = (last.surface_form  || '') + (tk.surface_form  || '');
        last.reading       = (last.reading       || '') + (tk.reading       || '');
        last.pronunciation = (last.pronunciation || '') + (tk.pronunciation || '');
        last._merged = true;
        if (isTeConn || isTeAuxVerb) last._absorbedTe = true;
        last._segments.push(tk.surface_form || '');
        continue;
      }
      // Clone so we don't mutate kuromoji's internal cache.
      const cloned = Object.assign({}, tk);
      cloned._segments = [tk.surface_form || ''];
      out.push(cloned);
    }
    return out;
  }

  // Cleans raw kuromoji tokens through the standard pipeline (fix
  // contextual readings → strip inline-furigana duplicates → merge
  // auxiliaries) and returns the pre-merged result. Exposed because
  // the lesson page needs the cleaned surface as a CACHE KEY for the
  // GPT-furigana lookup (so the same line tokenized at preload time
  // and again at paginate-reflow time both hit the same ruby entry).
  function processTokens(rawTokens) {
    return _mergeAuxiliaries(
      _stripDuplicateReadings(
        _fixContextualReadings(rawTokens)
      )
    );
  }
  // Cleaned-surface string from processed tokens — concatenation of
  // surface_forms. Used as the cache key for furigana lookup.
  function surfaceOf(processedTokens) {
    let s = '';
    for (const t of processedTokens || []) s += (t.surface_form || '');
    return s;
  }

  // Render an HTML string of .w / .w.punct chips from kuromoji tokens.
  // Word tokens carry a `data-word` (the BASIC FORM / lemma so 食べた /
  // 食べる / 食べて share one word_states entry) and the surface text,
  // wrapped in <ruby> over any kanji segment.
  //
  // `tokens` is the raw kuromoji output — processTokens() runs
  // internally so callers don't have to remember the order.
  //
  // `ruby` (optional) is the GPT-furigana annotation array
  // ({t, r}[]) keyed at sentence level. When supplied, kanji readings
  // come from `ruby` (in-context, accurate) instead of kuromoji's
  // single-entry default. Concatenated `t` values must equal the
  // cleaned surface; otherwise we fall back to the kuromoji-only path
  // for that whole sentence.
  //
  // INFLECTION COLORING — for merged tokens (verb + auxiliary chains
  // like 持ってきました, 住んでいました), each post-stem `_segment`
  // gets a cycling color class (.hl-infl → .hl-infl-2 → .hl-infl-3 →
  // loop). The kanji STEM stays uncolored under its <ruby>; only the
  // kana inflection tail gets cycle-colored, so a learner instantly
  // sees where one inflection ends and the next begins.
  function renderTokens(tokens, ruby) {
    const merged = processTokens(tokens);
    const useRuby = Array.isArray(ruby) && ruby.length &&
                    _rubyMatchesSurface(ruby, surfaceOf(merged));
    const rubySegs = useRuby ? _indexRubySegs(ruby) : null;
    const out = [];
    let tokenStart = 0;
    for (const tk of merged) {
      const surface = tk.surface_form || '';
      const tokenEnd = tokenStart + surface.length;
      if (!_isWordToken(tk)) {
        out.push('<span class="w punct">' + _escapeHtml(surface) + '</span>');
        tokenStart = tokenEnd;
        continue;
      }
      const inner = _renderTokenInner(tk, rubySegs, tokenStart, tokenEnd);
      const lemma = (tk.basic_form && tk.basic_form !== '*') ? tk.basic_form : surface;
      const tkSegs = tk._segments || [surface];
      const segsAttr = _escapeHtml(JSON.stringify(tkSegs));
      out.push(
        '<span class="w" data-word="' + _escapeHtml(lemma) +
        '" data-surface="' + _escapeHtml(surface) +
        '" data-segments="' + segsAttr + '">' +
        (inner || _escapeHtml(surface)) +
        '</span>'
      );
      tokenStart = tokenEnd;
    }
    return out.join('');
  }

  // Position-bookkeeping check: does the ruby annotation cover EXACTLY
  // the cleaned surface? We don't render with stale / mis-cached ruby
  // — better to fall back to kuromoji readings than show misaligned
  // furigana over the wrong characters.
  function _rubyMatchesSurface(ruby, surface) {
    let s = '';
    for (const seg of ruby) s += (seg && seg.t) || '';
    return s === surface;
  }

  // Pre-index sentence-level ruby segments with absolute char ranges.
  function _indexRubySegs(ruby) {
    const segs = [];
    let pos = 0;
    for (const r of ruby) {
      const text = (r && r.t) || '';
      const reading = (r && r.r) || '';
      segs.push({ start: pos, end: pos + text.length, text, reading });
      pos += text.length;
    }
    return segs;
  }

  // Per-char map: which kuromoji `_segment` does each surface char
  // belong to? Used to apply cycling color classes (segment 0 = stem,
  // uncolored; segments 1..N = inflections, color-cycled).
  function _segmentIndexMap(tk) {
    const surface = tk.surface_form || '';
    const tkSegs = tk._segments || [surface];
    const map = new Array(surface.length);
    let pp = 0;
    for (let s = 0; s < tkSegs.length; s++) {
      const len = tkSegs[s].length;
      for (let p = 0; p < len; p++) {
        if (pp < surface.length) map[pp++] = s;
      }
    }
    while (pp < surface.length) map[pp++] = 0;
    return map;
  }

  // Render the inner HTML for one merged token. Either GPT ruby
  // (rubySegs != null) or kuromoji's per-token reading drives the
  // <ruby> placement; in BOTH paths the post-stem kana gets the
  // inflection color cycle.
  const _INFL_PALETTE = ['hl-infl', 'hl-infl-2', 'hl-infl-3'];
  function _renderTokenInner(tk, rubySegs, tokenStart, tokenEnd) {
    const surface = tk.surface_form || '';
    const segMap = _segmentIndexMap(tk);

    if (rubySegs) {
      // GPT-ruby path: walk overlapping ruby segments. Kanji segments
      // (with reading) become <ruby>; non-kanji segments get the
      // plain-text colorize pass.
      let html = '';
      for (const seg of rubySegs) {
        if (seg.end <= tokenStart) continue;
        if (seg.start >= tokenEnd) break;
        const fullyInside = (seg.start >= tokenStart && seg.end <= tokenEnd);
        const localStart = Math.max(seg.start, tokenStart) - tokenStart;
        const localEnd   = Math.min(seg.end,   tokenEnd)   - tokenStart;
        if (seg.reading && fullyInside) {
          // Kanji segment with contextual reading. Stem rendering —
          // not colored, even if technically inside an inflection
          // _segment (the kanji "anchor" reads cleaner without color).
          html += '<ruby>' +
                  _escapeHtml(seg.text) +
                  '<rt>' + _escapeHtml(seg.reading) + '</rt></ruby>';
        } else {
          // Non-kanji or partial overlap — plain text with color cycle.
          html += _colorizeRun(surface, localStart, localEnd, segMap);
        }
      }
      return html;
    }

    // Kuromoji-only fallback — use kuromoji's per-token reading via
    // _buildFurigana to lay <ruby> over kanji runs. Kana runs go
    // through the same color-cycling pass.
    const reading = katakanaToHiragana(tk.reading || '');
    if (!_hasKanji(surface) || !reading || reading === surface) {
      return _colorizeRun(surface, 0, surface.length, segMap);
    }
    const fSegs = _buildFurigana(surface, reading);
    let html = '';
    let charPos = 0;
    let alignmentFailed = false;
    for (const fs of fSegs) {
      if (fs.kanji) {
        if (!fs.reading) { alignmentFailed = true; break; }
        html += '<ruby>' + _escapeHtml(fs.kanji) +
                '<rt>' + _escapeHtml(fs.reading) + '</rt></ruby>';
        charPos += fs.kanji.length;
      } else {
        const kanaText = fs.kana || '';
        html += _colorizeRun(surface, charPos, charPos + kanaText.length, segMap);
        charPos += kanaText.length;
      }
    }
    if (alignmentFailed) {
      // Fallback: whole-token ruby + plain colorized surface.
      return '<ruby>' + _escapeHtml(surface) +
             '<rt>' + _escapeHtml(reading) + '</rt></ruby>';
    }
    return html;
  }

  // Colorize a [startPos, endPos) slice of `surface` based on the
  // per-char `segMap`. Segment 0 (stem) → uncolored; segments 1..N →
  // cycling color classes. Adjacent same-class chars are coalesced
  // into one <span> to keep the DOM compact.
  function _colorizeRun(surface, startPos, endPos, segMap) {
    let html = '';
    let bufClass = null;
    let buf = '';
    const flush = () => {
      if (!buf) return;
      if (bufClass) html += '<span class="' + bufClass + '">' + _escapeHtml(buf) + '</span>';
      else          html += _escapeHtml(buf);
      buf = '';
    };
    for (let p = startPos; p < endPos; p++) {
      const segIdx = (segMap && segMap[p]) || 0;
      const cls = segIdx >= 1 ? _INFL_PALETTE[(segIdx - 1) % _INFL_PALETTE.length] : null;
      if (cls !== bufClass) {
        flush();
        bufClass = cls;
      }
      buf += surface[p];
    }
    flush();
    return html;
  }

  // Fetch GPT-generated furigana for one sentence via the
  // `furigana-gpt` Edge Function. Returns the ruby array on success,
  // null on any error / missing config / network failure (caller
  // falls back to kuromoji readings). Idempotent at the server side
  // — repeat calls hit the Supabase cache and pay zero GPT credits.
  async function getFurigana(sentence) {
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg || !cfg.url || !cfg.anon) return null;
    const trimmed = String(sentence || '').trim();
    if (!trimmed) return null;
    try {
      const url = cfg.url.replace(/\/+$/, '') + '/functions/v1/furigana-gpt';
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + cfg.anon,
          'apikey':        cfg.anon,
        },
        body: JSON.stringify({ sentence: trimmed }),
      });
      if (!r.ok) return null;
      const data = await r.json();
      return Array.isArray(data && data.ruby) ? data.ruby : null;
    } catch (e) {
      return null;
    }
  }

  // Sentence segmentation for Japanese — split on 。！？ keeping the
  // terminator with its sentence. Falls back to the whole input as
  // one sentence when there's no terminator.
  function splitSentencesJa(text) {
    const s = String(text || '');
    if (!s.trim()) return [];
    const re = /[^。！？!?]+[。！？!?]+|[^。！？!?]+$/g;
    const out = (s.match(re) || []).map(x => x.trim()).filter(Boolean);
    return out.length ? out : [s.trim()];
  }

  // Phrase chunker for Japanese, replacing the chunk-gpt path that's
  // English-grammar specific. Uses kuromoji output (post-merged for
  // auxiliaries) and groups tokens into bunsetsu-like phrases:
  //   • A new chunk starts on each "content" token (名詞 / 動詞 /
  //     形容詞 / 形容動詞 / 副詞 / 連体詞).
  //   • Trailing 助詞 / 助動詞 / 接続助詞 attach to the preceding
  //     chunk (this is the standard Japanese reading unit — a
  //     content word + its particles is what learners process as
  //     ONE meaning unit).
  //
  // Returns an array shaped like the chunk-gpt output:
  //   [{ text, indices: [start, end] }]
  // where `indices` are 0-based positions in the WHITESPACE-IGNORING
  // word stream — i.e. counting only `_isWordToken` tokens, mirroring
  // chunk-gpt's "ignoring punctuation" convention. The lesson page
  // then highlights the .w children at those indices.
  function chunkSentenceJa(sentence) {
    const raw = String(sentence || '');
    if (!raw.trim()) return [];
    if (!_tokenizer) return null;            // caller should ensure ready()
    const tokens = _mergeAuxiliaries(_stripDuplicateReadings(_fixContextualReadings(_tokenizer.tokenize(raw))));
    const chunks = [];
    let cur = null;
    let wordIdx = -1;       // index across non-punct tokens only
    let pendingModifier = null;   // 連体詞 / 接頭詞 awaiting a head noun
    for (const tk of tokens) {
      const isWord = _isWordToken(tk);
      if (isWord) wordIdx++;
      // 連体詞 (ある, この, etc.) and 接頭詞 (お, ご, etc.) are bound
      // modifiers — they always attach to the FOLLOWING content word.
      // Treat them as "pending" rather than starting their own chunk.
      const isBoundModifier = isWord && (
        tk.pos === '連体詞' || tk.pos === '接頭詞'
      );
      const isContent = isWord && !isBoundModifier && (
        tk.pos === '名詞' || tk.pos === '動詞' ||
        tk.pos === '形容詞' || tk.pos === '形容動詞' ||
        tk.pos === '副詞' || tk.pos === '感動詞'
      );
      if (isBoundModifier) {
        // Buffer the modifier — its char positions will join the next
        // content chunk's range.
        if (!pendingModifier) {
          pendingModifier = { text: tk.surface_form, idxStart: wordIdx };
        } else {
          pendingModifier.text += tk.surface_form;
        }
        continue;
      }
      if (isContent) {
        // Close the previous chunk and start a new one.
        if (cur) chunks.push(cur);
        if (pendingModifier) {
          cur = {
            text: pendingModifier.text + tk.surface_form,
            indices: [pendingModifier.idxStart, wordIdx],
          };
          pendingModifier = null;
        } else {
          cur = { text: tk.surface_form, indices: [wordIdx, wordIdx] };
        }
      } else if (cur && isWord) {
        // Attach particle / auxiliary / unknown to the running chunk.
        cur.text += tk.surface_form;
        cur.indices[1] = wordIdx;
      } else if (!isWord) {
        // Punctuation closes the current chunk (don't include the
        // punct in the chunk text — matches chunk-gpt convention).
        if (cur) {
          chunks.push(cur);
          cur = null;
        }
        // A modifier orphaned at sentence boundary becomes its own
        // chunk so its char positions still get tracked.
        if (pendingModifier) {
          chunks.push({
            text: pendingModifier.text,
            indices: [pendingModifier.idxStart, pendingModifier.idxStart],
          });
          pendingModifier = null;
        }
      }
    }
    if (cur) chunks.push(cur);
    if (pendingModifier) {
      chunks.push({
        text: pendingModifier.text,
        indices: [pendingModifier.idxStart, pendingModifier.idxStart],
      });
    }

    // SHORT-SENTENCE COLLAPSE: when the whole sentence is ≤ 7 visual
    // chars (kanji + kana combined, ignoring punctuation), the user
    // wants just a 주부/술부 split — i.e. everything except the final
    // verb/predicate folded into a single "subject side" chunk. This
    // matches how a learner reads a tiny sentence: SUBJECT | VERB.
    // Longer sentences keep the bunsetsu-level granularity above so
    // adverbial / time / place phrases each stand on their own.
    const visibleLen = chunks.reduce((n, c) => n + c.text.length, 0);
    if (visibleLen <= 7 && chunks.length > 2) {
      const last = chunks[chunks.length - 1];
      const headText = chunks.slice(0, -1).map(c => c.text).join('');
      const headStart = chunks[0].indices[0];
      const headEnd   = chunks[chunks.length - 2].indices[1];
      return [
        { text: headText, indices: [headStart, headEnd] },
        last,
      ];
    }
    return chunks;
  }

  window.JPT = {
    ready,
    tokenize,
    tokenizeSync,
    processTokens,
    surfaceOf,
    renderTokens,
    getFurigana,
    katakanaToHiragana,
    splitSentencesJa,
    chunkSentenceJa,
    setProgressHandler,
  };
})();
