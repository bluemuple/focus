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
  // Colloquial nominalizers — when ん / の attach to a merged verb
  // chain (動けない**ん**だ, 行く**の**です), they're not real nouns;
  // they're a particle-like explanatory marker. Absorb them into the
  // verb so 動けないんだ reads as ONE word, not three chips.
  const COLLOQUIAL_NOMINALIZER = new Set(['ん', 'の']);
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
      // Colloquial の-equivalent ん appearing after a verb / merged
      // chain (動けない + ん + だ, 行く + の + です).
      const isColloqNomin = tk.pos === '名詞' &&
                            tk.pos_detail_1 === '非自立' &&
                            COLLOQUIAL_NOMINALIZER.has(tk.surface_form || '');
      const lastIsVerbish = last &&
        (last.pos === '動詞' || last.pos === '形容詞' || last._merged);
      // 形容動詞語幹 (好き, 元気, 静か, 大切) — pos is 名詞 but it
      // behaves like an adjective when followed by 助動詞 だ / でし
      // / です. Treat as verbish for merge purposes so 好きでした
      // becomes ONE chip.
      const lastIsAdjNounStem = last && last.pos === '名詞' &&
                                last.pos_detail_1 === '形容動詞語幹';
      const lastIsTeMerged = last && last._merged && last._absorbedTe;
      // 形容詞 連用 (まるく, 大きく, 強く) + 動詞 (する, なる) →
      // adverbial use of an adjective modifying a verb that follows.
      // Merge into one token so まるくした / 大きくなった / 強くなる
      // read as one word in TTS and select as one chip.
      const lastIsAdjAdverbForm = last && last.pos === '形容詞' &&
                                  /く$/.test(last.surface_form || '');
      const isVerbAfterAdjAdverb = tk.pos === '動詞' && lastIsAdjAdverbForm;
      const shouldMerge =
        (isAux || isVerbSuffix) && (lastIsVerbish || lastIsAdjNounStem) ||
        isTeConn && lastIsVerbish ||
        isTeAuxVerb && lastIsTeMerged ||
        isColloqNomin && (lastIsVerbish || (last && last._merged)) ||
        isVerbAfterAdjAdverb;
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

  // Kuromoji + IPADIC's Viterbi analyzer fails on long all-hiragana
  // stretches (no kanji to anchor word boundaries) — it sometimes
  // emits a single 18+ char 名詞 token covering an entire phrase like
  //   "むところのはるかかなたにいたんだから"
  // which makes everything downstream (chunker, ruby alignment, click
  // selection) treat it as ONE word. Best-effort recovery: scan such
  // suspicious tokens for common particle substrings (の/に/が/を/で/
  // から/まで) and split at those positions, emitting alternating
  // 名詞 / 助詞 synthesized tokens.
  //
  // Imperfect: words like 「もの」 contain a "の" that's NOT a particle
  // and would mis-split. But the input only ever reaches this code
  // path when kuromoji has ALREADY failed to find proper boundaries,
  // so over-splitting beats one-giant-token in practice.
  const _SUSPICIOUS_KANA_RE = /^[ぁ-ん]+$/;
  // Conservative particle list — only split on patterns that are
  // overwhelmingly particles (rare inside words). Excluded:
  //   と, や, か (often inside words: ところ, はや, なか)
  //   へ        (often word-final or part of compounds)
  //   は, も    (frequent in word middles: はじめ, ものすごい)
  // Multi-char checked first (longest match wins).
  const _PARTICLE_PATTERNS = [
    'から', 'まで', 'のに', 'けど', 'けれど',
    'が', 'を', 'に', 'で', 'の',
  ];
  function _splitGiantKanaNouns(tokens) {
    const out = [];
    for (const tk of tokens) {
      const s = tk.surface_form || '';
      if (tk.pos !== '名詞' || s.length <= 5 || !_SUSPICIOUS_KANA_RE.test(s)) {
        out.push(tk);
        continue;
      }
      // Walk the surface, splitting at particle boundaries.
      const parts = [];
      let buf = '';
      let i = 0;
      while (i < s.length) {
        let matched = '';
        for (const p of _PARTICLE_PATTERNS) {
          if (s.substring(i, i + p.length) === p && buf.length > 0) {
            matched = p;
            break;
          }
        }
        if (matched) {
          parts.push({ text: buf, isParticle: false });
          parts.push({ text: matched, isParticle: true });
          buf = '';
          i += matched.length;
        } else {
          buf += s[i];
          i++;
        }
      }
      if (buf) parts.push({ text: buf, isParticle: false });
      // No splits found → keep original token.
      if (parts.length <= 1) { out.push(tk); continue; }
      // Emit synthesized tokens. Mark with `_synthesized` so callers
      // can debug / treat them more cautiously if needed.
      for (const p of parts) {
        if (!p.text) continue;
        out.push({
          surface_form:   p.text,
          pos:            p.isParticle ? '助詞' : '名詞',
          pos_detail_1:   p.isParticle ? '格助詞' : '一般',
          pos_detail_2:   '*',
          pos_detail_3:   '*',
          conjugated_type:'*',
          conjugated_form:'*',
          basic_form:     p.text,
          reading:        p.text,
          pronunciation:  p.text,
          _synthesized:   true,
        });
      }
    }
    return out;
  }

  // Cleans raw kuromoji tokens through the standard pipeline (split
  // giant kana nouns → fix contextual readings → strip inline-furigana
  // duplicates → merge auxiliaries) and returns the pre-merged result.
  function processTokens(rawTokens) {
    return _mergeAuxiliaries(
      _stripDuplicateReadings(
        _fixContextualReadings(
          _splitGiantKanaNouns(rawTokens)
        )
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
  // loop). The STEM (segment 0) stays uncolored; only the inflection
  // tail gets cycle-colored.
  //
  // The `ruby` parameter is now ignored at the body level — body
  // chips render plain (no furigana). We keep the parameter for
  // API stability and use the same `ruby` data in the popup chunk-
  // explanation row, where chunks are re-rendered all-hiragana with
  // kanji-readings underlined.
  function renderTokens(tokens, _unusedRuby) {
    const merged = processTokens(tokens);
    const out = [];
    for (const tk of merged) {
      const surface = tk.surface_form || '';
      if (!_isWordToken(tk)) {
        out.push('<span class="w punct">' + _escapeHtml(surface) + '</span>');
        continue;
      }
      const inner = _renderTokenInner(tk);
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

  // Render the inner HTML for one merged token. Body chips render
  // PLAIN BLACK TEXT — no furigana, no inflection coloring. Per spec
  // the body should look uniform; the inflection-suffix color cycle
  // is reserved for the SELECTED-WORD display in the popup / sidebar
  // (handled by renderWordWithInflectionHTML in lesson.html, which
  // reads `data-segments` off the chip we emit here).
  function _renderTokenInner(tk /*, rubySegs, tokenStart, tokenEnd */) {
    return _escapeHtml(tk.surface_form || '');
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
  // Beginner-friendly bunsetsu chunking. Modeled on the user's
  // reference for the 動物の森のケーキ story:
  //
  //   ある森に、/ うさぎと熊とりすが / 住んでいました。
  //   ある朝、/ うさぎが / 言いました。
  //   熊は、/ 甘いはちみつを / 持ってきました。
  //   りすは、/ 森で見つけた / 木の実を / 持ってきました。
  //   うさぎは、/ 大きな人参を / 持ってきました。
  //   熊も、/ りすも、/ 狐も、/ うさぎも、/ とても幸せな気持ちに / なりました。
  //
  // Rules pieced together from those examples:
  //   • 連体詞 / 接頭詞 / 副詞 are ALL bound modifiers → glue to the
  //     next content word (ある森, お名前, とても幸せ, にっこり笑って).
  //   • 形容動詞語幹 + 助動詞「な」 + 名詞 stays as one chunk
  //     (元気な人, 幸せな気持ち).
  //   • Coordinator particles と / や / か connect coordinated nouns
  //     (うさぎと熊とりすが — one chunk).
  //   • Topic / case particles は も が を に で ends a chunk (the
  //     next content word starts a new one). Punctuation always ends
  //     a chunk.
  //   • Te-form connector + 보조동사 chains stay merged inside ONE
  //     verb token by _mergeAuxiliaries (持ってきました, 住んでいました),
  //     so the chunker sees them as a single content word already.
  //   • Final 7-char collapse for very short sentences (subject /
  //     predicate split when the whole thing fits in two breaths).
  function chunkSentenceJa(sentence) {
    const raw = String(sentence || '');
    if (!raw.trim()) return [];
    if (!_tokenizer) return null;            // caller should ensure ready()
    const tokens = _mergeAuxiliaries(_stripDuplicateReadings(_fixContextualReadings(_splitGiantKanaNouns(_tokenizer.tokenize(raw)))));
    const chunks = [];
    let cur = null;
    let wordIdx = -1;       // index across non-punct tokens only
    let pendingModifier = null;
    // Cross-iteration "bind into the next content word" hints. Set at
    // end of each iter based on the token just attached; consumed at
    // the start of the next isContent decision.
    let lastWasListConnector = false;  // と / や / か (coordinated nouns)
    let lastWasLinkingAux    = false;  // 助動詞 「な」 (幸せな気持ち)
    let lastWasNoLinker      = false;  // 助詞 「の」 (木の実)
    let lastParticleSurface  = '';     // surface of last 助詞 attached
    let lastWasAdjective     = false;  // 형용사 (甘いはちみつ)
    let lastWasAdjNounStem   = false;  // 名詞,形容動詞語幹 (はるか,
                                       // 元気) used as 連体修飾 directly
                                       // attached to a following 名詞:
                                       // はるかかなた, 静か森
    for (let ti = 0; ti < tokens.length; ti++) {
      const tk   = tokens[ti];
      const next = tokens[ti + 1];
      const isWord = _isWordToken(tk);
      if (isWord) wordIdx++;
      // BOUND MODIFIERS — these don't start a chunk; they attach to
      // the FOLLOWING content word.
      //   • 連体詞    — ある, この, その
      //   • 接頭詞    — お, ご
      //   • 副詞      — とても, にっこり, もっと
      //   • 形容詞 連用 — 小さく, 大きく (functions as adverb here)
      //   • 名詞,副詞可能 — 毎週, 今日, 一緒 (time / manner adverbials)
      const isAdjAdverbForm = isWord && tk.pos === '形容詞' &&
                              /く$/.test(tk.surface_form || '');
      const isAdverbialNoun = isWord && tk.pos === '名詞' &&
                              tk.pos_detail_1 === '副詞可能';
      // Verbs that DOUBLE as 連体詞 (a-certain modifier) — kuromoji
      // sometimes tags these as 動詞 even when they're actually
      // modifying the next noun:
      //   ある日, ある夜, ある朝, ある人, ある時 (a-certain day/night/…)
      //   いわゆる + noun (so-called X)
      const ADNOMINAL_VERB_SURFACES = new Set([
        'ある', 'あらゆる', 'いわゆる', 'たいした',
      ]);
      const isVerbAsAdnominal = isWord && tk.pos === '動詞' &&
                                ADNOMINAL_VERB_SURFACES.has(tk.surface_form || '') &&
                                next && next.pos === '名詞';
      // 副詞 binding is CONDITIONAL — only when the adverb modifies a
      // small phrase that completes inside the next 1-2 tokens:
      //   • 副詞 + 形容動詞語幹 (とても幸せ → 名詞 modifier)
      //   • 副詞 + 動詞 ending in て/で (にっこり笑って → te-form chain)
      // When the adverb is sentence-initial / modifies a predicate
      // (なにせひとは, もっとおいしい), it stands alone — its chunk
      // boundary signals "rhythmic pause" rather than tight binding.
      const isAdverb = isWord && tk.pos === '副詞';
      const nextIsAdjNounStem = next && next.pos === '名詞' &&
                                next.pos_detail_1 === '形容動詞語幹';
      const nextIsTeVerb = next && next.pos === '動詞' &&
                           /[てで]$/.test(next.surface_form || '');
      const isAdverbBound = isAdverb && (nextIsAdjNounStem || nextIsTeVerb);
      const isBoundModifier = isWord && (
        tk.pos === '連体詞' || tk.pos === '接頭詞' ||
        isAdverbBound ||
        isAdjAdverbForm || isAdverbialNoun || isVerbAsAdnominal
      );
      // SUFFIX-LIKE — these don't start a chunk either; they ATTACH
      // to the running chunk, like particles.
      //   • 接尾    — 〜たち, 〜じゅう, 〜さん
      //   • 名詞,非自立 — こと, もの, ところ (nominalizers)
      const isSuffix = isWord && (
        tk.pos_detail_1 === '接尾' ||
        (tk.pos === '名詞' && tk.pos_detail_1 === '非自立')
      );
      const isContent = isWord && !isBoundModifier && !isSuffix && (
        tk.pos === '名詞' || tk.pos === '動詞' ||
        tk.pos === '形容詞' || tk.pos === '形容動詞' ||
        tk.pos === '副詞' || tk.pos === '感動詞'
      );
      const isListConnector = isWord && tk.pos === '助詞' && (
        tk.surface_form === 'と' ||
        tk.surface_form === 'や' ||
        tk.surface_form === 'か'
      );
      if (isBoundModifier) {
        if (!pendingModifier) {
          // A new bound-modifier phrase signals the start of a new
          // chunk → close any running chunk first (otherwise "は"
          // would absorb the next phrase: 動物たちは + 毎週 would
          // glue together).
          if (cur) { chunks.push(cur); cur = null; }
          pendingModifier = { text: tk.surface_form, idxStart: wordIdx, idxEnd: wordIdx };
        } else {
          pendingModifier.text += tk.surface_form;
          pendingModifier.idxEnd = wordIdx;
        }
        continue;
      }
      if (isContent) {
        // SUBORDINATE-CLAUSE / RELATIVE-CLAUSE binding for 動詞:
        // 名詞 + 助詞 + 動詞 stays together in ONE chunk when the
        // verb continues into another clause (forming a subordinate
        // unit) rather than acting as the final predicate. Heuristics
        // (we can't always confirm without GPT-level analysis):
        //   • verb surface ends in て / で (te-form) — subordinate
        //     to the next clause (材料を混ぜて、ケーキを焼きました)
        //   • next token is 接続助詞 と / ば / たら / ても (subordinate
        //     conjunction — みんなで食べると、もっとおいしい)
        //   • next token is a 名詞 (relative clause modifying it —
        //     森で見つけた木の実)
        // Otherwise the verb is a terminal predicate → split before
        // it (ケーキを焼きました — ケーキを / 焼きました).
        // Subordinate-clause binding gated to NON-TOPIC particles —
        // topic markers は/も signal a phrase boundary in user's
        // chunking style (ぼくも / 食べても), while case markers
        // が/を/に/で/から/へ/まで pull the next verb into the same
        // clause (みんなで食べると、).
        const lastWasNonTopicParticle = !!lastParticleSurface &&
          lastParticleSurface !== 'は' &&
          lastParticleSurface !== 'も';
        // Some 接続助詞 connect TWO complete clauses rather than binding
        // a subordinate clause to a head — they should NOT pull the
        // verb into the preceding particle phrase. から / ので / のに
        // / けど typically sit at the END of a clause and join the
        // result/reason: 「いたんだから」 stands alone, doesn't glue
        // back to 「はるかかなたに」.
        const STANDALONE_CONNECTOR = new Set(['から', 'ので', 'のに', 'けど', 'けれど', 'けれども']);
        const nextIsStandaloneConnector = next && next.pos === '助詞' &&
          STANDALONE_CONNECTOR.has(next.surface_form || '');
        const verbContinuesClause =
          tk.pos === '動詞' && lastWasNonTopicParticle && cur &&
          !nextIsStandaloneConnector && (
            /[てで]$/.test(tk.surface_form || '') ||
            (next && next.pos === '助詞' && next.pos_detail_1 === '接続助詞') ||
            (next && next.pos === '名詞')
          );
        if (lastWasListConnector && cur) {
          cur.text += tk.surface_form;
          cur.indices[1] = wordIdx;
        } else if (lastWasLinkingAux && cur && tk.pos === '名詞') {
          // 形容動詞 + な + 名詞 (元気な人, 幸せな気持ち)
          cur.text += tk.surface_form;
          cur.indices[1] = wordIdx;
        } else if (lastWasAdjNounStem && cur && tk.pos === '名詞') {
          // 形容動詞語幹 + 名詞 directly, NO な (はるかかなた, 静か森)
          cur.text += tk.surface_form;
          cur.indices[1] = wordIdx;
        } else if (lastWasNoLinker && cur && tk.pos === '名詞' &&
                   tk.pos_detail_1 !== '形容動詞語幹') {
          // 名詞 + の + 名詞 (genitive — 木の実, 森の中). 例외:
          // の 다음이 形容動詞語幹 (はるか, 静か, 元気)이면 새 phrase
          // 시작이라 binding하지 않음 (ところの / はるかかなた).
          cur.text += tk.surface_form;
          cur.indices[1] = wordIdx;
        } else if (lastWasAdjective && cur && tk.pos === '名詞') {
          // 形容詞 + 名詞 (i-adjective + noun — 甘いはちみつ, 大きい家)
          cur.text += tk.surface_form;
          cur.indices[1] = wordIdx;
        } else if (verbContinuesClause) {
          cur.text += tk.surface_form;
          cur.indices[1] = wordIdx;
        } else {
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
        }
      } else if (cur && isWord) {
        cur.text += tk.surface_form;
        cur.indices[1] = wordIdx;
      } else if (pendingModifier && isWord) {
        // No running chunk but a pending modifier exists — particles
        // / suffixes attach to the modifier phrase. When a 助詞
        // closes the modifier (毎週いっしょ + に → 毎週いっしょに),
        // emit it as its own chunk so the next content word starts
        // fresh instead of being glued onto the modifier.
        pendingModifier.text += tk.surface_form;
        pendingModifier.idxEnd = wordIdx;
        if (tk.pos === '助詞') {
          chunks.push({
            text: pendingModifier.text,
            indices: [pendingModifier.idxStart, wordIdx],
          });
          pendingModifier = null;
        }
      } else if (!isWord) {
        if (cur) { chunks.push(cur); cur = null; }
        if (pendingModifier) {
          chunks.push({
            text: pendingModifier.text,
            indices: [pendingModifier.idxStart, pendingModifier.idxEnd],
          });
          pendingModifier = null;
        }
      }
      // Update look-back flags. Each requires `cur` to still exist —
      // a punct-closed chunk shouldn't leak its trailing-particle
      // hint into the next chunk.
      lastWasListConnector = !!cur && isListConnector;
      lastWasLinkingAux    = !!cur && tk.pos === '助動詞' && tk.surface_form === 'な';
      lastWasNoLinker      = !!cur && tk.pos === '助詞'   && tk.surface_form === 'の';
      lastParticleSurface  = (!!cur && tk.pos === '助詞') ? (tk.surface_form || '') : '';
      lastWasAdjective     = !!cur && tk.pos === '形容詞';
      lastWasAdjNounStem   = !!cur && tk.pos === '名詞' && tk.pos_detail_1 === '形容動詞語幹';
    }
    if (cur) chunks.push(cur);
    if (pendingModifier) {
      chunks.push({
        text: pendingModifier.text,
        indices: [pendingModifier.idxStart, pendingModifier.idxEnd],
      });
    }

    // SHORT-SENTENCE COLLAPSE: ≤ 7 visual chars and >2 chunks → fold
    // everything except the predicate into one "subject side" chunk.
    // Matches how a beginner reads a tiny sentence: SUBJECT | VERB.
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

  // Convert ruby segments → all-hiragana HTML with kanji-readings
  // underlined. Used by the popup's chunk-explanation row to show
  // 「お<u>なまえ</u>は<u>なん</u>ですか。」 from the input segments
  // [{t:"お",r:""},{t:"名前",r:"なまえ"},…]. Original kana stays plain
  // so a learner can visually distinguish "kanji-derived hiragana"
  // (underlined) from "natively hiragana" (plain).
  function rubyToHiraganaWithUnderlines(ruby) {
    if (!Array.isArray(ruby)) return '';
    let html = '';
    for (const seg of ruby) {
      const t = (seg && seg.t) || '';
      const r = (seg && seg.r) || '';
      if (r) html += '<u>' + _escapeHtml(r) + '</u>';
      else   html += _escapeHtml(t);
    }
    return html;
  }

  // Synchronous kuromoji-only version of the above — used as the
  // instant initial render for the chunk-explanation row while the
  // GPT furigana fetch is in flight. Less accurate for context-
  // dependent readings (何ですか reads as なに here, GPT would say
  // なん) but ALWAYS kanji-free, so it satisfies the spec's "no
  // kanji in the chunk row" rule even before the network round-trip.
  function toHiraganaWithUnderlinesSync(text) {
    const s = String(text || '');
    if (!s) return '';
    if (!_tokenizer) return _escapeHtml(s);   // builder not ready yet
    const tokens = _tokenizer.tokenize(s);
    let html = '';
    for (const tk of tokens) {
      const surf = tk.surface_form || '';
      const reading = tk.reading ? katakanaToHiragana(tk.reading) : '';
      if (!_hasKanji(surf) || !reading || reading === surf) {
        html += _escapeHtml(surf);
        continue;
      }
      const segs = _buildFurigana(surf, reading);
      let alignmentFailed = false;
      let buf = '';
      for (const seg of segs) {
        if (seg.kanji) {
          if (!seg.reading) { alignmentFailed = true; break; }
          buf += '<u>' + _escapeHtml(seg.reading) + '</u>';
        } else {
          buf += _escapeHtml(seg.kana || '');
        }
      }
      html += alignmentFailed
        ? '<u>' + _escapeHtml(reading) + '</u>'
        : buf;
    }
    return html;
  }

  window.JPT = {
    ready,
    tokenize,
    tokenizeSync,
    processTokens,
    surfaceOf,
    renderTokens,
    getFurigana,
    rubyToHiraganaWithUnderlines,
    toHiraganaWithUnderlinesSync,
    katakanaToHiragana,
    splitSentencesJa,
    chunkSentenceJa,
    setProgressHandler,
  };
})();
