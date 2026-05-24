# PROJECT_NOTES.md — 지금까지의 작업 기록 + 컨텍스트

## 1. 한 줄 요약

`edu/` 폴더의 **WordCatch (Ako)** 영어 학습 앱을 long-running 으로 만들어온 대화. SDT (Self-Determination Theory) 기반 보상 시스템, 모바일 UX 전면 개편, 한국어 사이드바, 녹음 + 만화 + 팝송 모드, 교사 대시보드 — 거의 모든 영역에 걸친 개선이 단일 대화 안에서 진행됨.

---

## 2. 핵심 기능 (현재 모두 구현 완료, 운영 중)

### A. 학생 페이지

#### 로그인 (`index.html` + `auth.js`)
- 이름 picker + 4자리 코드 → `wc_users.login_code` lookup → `wc.session.v1` 캐시
- 교사는 같은 로그인 흐름, role='teacher' 면 teacher.html 로

#### 홈 / 라이브러리 (`home.html`)
- **Reading 라이브러리** — 책꽂이 뷰
  - 데스크탑: flex-wrap, 카드 너비 160px 고정, 모든 커버 같은 너비, 높이는 이미지 비율대로 (가변), 카드 바닥 정렬 (`align-items: flex-end`)
  - 모바일: 2열 grid (auto `1fr 1fr`), 좌우 여백 균등
  - 각 커버 위에 **단어 클릭 진행 게이지** 오버레이 (cover 너비의 90%, 바닥에서 10% 위치) — student 가 이 레슨에서 콘텐츠 단어 중 몇 % 를 색칠했는지
  - 모든 커버 같은 너비, 높이는 이미지 비율대로 가변, 아랫변 정렬, 윗변은 다를 수 있음
  - 흰색 letterbox 여백 없음 (`object-fit: unset`, natural 비율)
- 상단 우측 user chip
  - 데스크탑: 이름 · 💰 잔액 · ⏰ 시간 · | · Sign out
  - 모바일: 이름 · ➜] (sign out icon) 만 (1줄)
- 💰 / ⏰ chip → popup (잔액 + 7일 그래프 + spend 폼)
- Maths / Pets / Space / Phonics / Animals navi (`hideXxx` 클래스 토글로 숨김 가능)

#### 레슨 페이지 (`lesson.html` + `js/lesson.js` ~4200줄)

**3가지 모드:**
1. **paginated text** — 본문을 페이지 단위로 분할, 한 페이지씩 표시 (디폴트)
2. **single sentence** — 한 문장만 크게 표시 (`📜 1 Sentence` 토글)
3. **continuous scroll** — 모든 페이지를 세로로 stack (`⬇` 토글; 만화/송은 기본 ON)

**3가지 콘텐츠 타입:** `mode` 컬럼
- `text` — 일반 글 (markdown / rich-text)
- `comic` — 만화 (이미지 + 말풍선 텍스트 오버레이)
- `song` — 팝송 (가사 + mp3 + 문장별 구간)

**툴바 (`.wc-lesson-head`)** — 제목 옆 ⌃ 버튼으로 접기/펼치기 (모바일 디폴트 접힘)
- `⏺ Record` — 녹음 모드 토글
- `📜 1 Sentence` — single mode
- `🔊 Play chunk` — 단어 탭 시 청크 TTS
- `Aa` — 폰트 크기/줄간격 컨트롤 (A−/A+/↕−/↕+)
- `👓 Read Better` — OpenDyslexic 폰트
- `🐾 on/off` — 동물 만남 ON/OFF (per-session)
- `🌐 Kor Bar / Eng Bar` — 사이드바 언어 모드
- `⬇` — continuous scroll 토글

**Body** — 모든 단어가 `.w` span 으로 토큰화됨, 클릭 시 색 레벨 1~5 + 사이드바 카드 표시.
- 색: 0/null = 하늘색 (unmarked), 1~4 = 진하기 단계, 5 = 마스터 (배경 없음), -1 = 무시 (회색)

**하단 바 (`.wc-lesson-bar`)** — 데스크탑: ▶ play · ‹‹ page-prev · ‹ word-prev · counter · › word-next · ›› page-next
모바일에서는 hidden (`.wc-mobsh-bar` 가 대체)

**모바일 bottom-sheet (`.wc-mobsh`)**
- 항상 화면 하단 풀폭 직사각형 8버튼 바: ▶TTS · ‹ · 1 2 3 4 ✓ · ›
- 단어 선택 시 그 위에 시트가 슬라이드 업 — 3 페이지 캐러셀 (뜻 → 더보기 → 메시지)
- JS-driven carousel (scroll-snap 아님) — 페이지 별 자연 높이로 bottom-anchored, 슬라이드 시 height 도 부드럽게 보간
- 무한 루프: 좌 스와이프 0→1→2→0..., 우 0→2→1→0...
- 단어 선택 시 본문(`.wc-shell`) 위로 push-up (단어가 시트 바로 위에 위치). 시트 닫으면 원위치 복귀

**iPhone 스타일 페이지 swipe (모바일)**
- 본문 어디든 손가락으로 좌/우 swipe → 페이지 넘김
- `WCLesson.renderPageHtml(pi)` 가 이웃 페이지 HTML 을 상태 swap 으로 snapshot 해서 clone 으로 옆에 배치
- 손가락 따라 body + clone translateX 동시 이동
- threshold (25% or flick) 넘으면 commit → `swipeCommitPage` 가 DOM 교체 + transform reset (transition off + reflow 로 fast-forward 글리치 픽스 됨)
- 빠른 연속 스와이프 시 race condition → `flushPending` 으로 직전 cleanup 즉시 실행 후 새 swipe 시작

#### 사이드바 / 단어 카드 (`sidebar.js`)
- **Kor Bar 모드 (디폴트)**: 청크 (`.wc-kor-chunk`), 단어 + IPA + 🔊, image, 한글 뜻 (`info.ko`), 더보기 (단어가족/비슷한/반대말), 따라말하기, 메시지 폼
- **Eng Bar 모드**: 영어 정의, IPA, examples, bullets (Example/Say it/Word family/Similar/Opposite), "Use it" ghost-frame practice form
- 레벨 picker 0..5 + 🗑 무시 (바닥 고정)
- 메시지 → `wc_visualization_messages` → 교사 messages 탭

#### 녹음 (`.wc-rec-bar`)
- 각 문장 옆에 🔊 (TTS) + ⏺ (record) 버튼
- ⏺ → MediaRecorder API → Supabase Storage (`recordings/` folder) → `wc_recordings` 행
- 한 페이지 모든 문장 녹음 완료 → 재생-올 버튼이 하늘색→**연두색** 으로 변함
- 연두색 → 누름 → 페이지 모든 녹음 sequential 재생 → 끝나면 강제 인카운터 (`WCEncounter.runForPage`) → 동물/룰렛 → "내가 가장 잘 말한 단어나 표현은 뭐야? 녹음하면서 어려웠던 단어도 적어줘." 메시지 popup → text + recording URLs `viz.send`

#### 프로필 (`profile.html` + `profile.js`)
- 좌측 세로 박스: 28레벨 이미지 (`images/lesson-levels/level-NN.png`) 채움
- 우측: 이름 / 시간 (`time_entries` sum) / 돈 (`money` cents → `$X.XX`) / XP 게이지 + 다음 레벨까지 / 격려 문구 (random from `flags.encouragements`, 비어있으면 한글 기본 5개)
- 28레벨 XP 커브: `xpAtLevel(L) = round(8 * (L-1)^2)` — Lv 2=8, Lv 10=648, Lv 28=5832

### B. 교사 페이지 (`teacher.html` + `js/teacher.js` ~4600줄)

5개 탭:
1. **Students** — 학생 목록 + 진행 (`📖 Np · 강도 X` chip)
2. **Lessons** — 레슨 CRUD
   - 만들기 폼: 제목, **Cover image**, 본문(rich-text + 이미지 삽입), mp3, word-images, word-meanings, animal set, gift quota, headings-new-page 등
   - 만든 레슨 row: cover thumb + title + edit / hide / 5개의 prewarm 버튼 (🔥 chunks · 🎵 sentence audio · 🎶 chunk audio · 🇰🇷 Kor Bar · 📝 quiz) + per-lesson toggles (default play chunk, default animals)
   - **Add image** 단일 → corner picker, **다수 선택 시** 파일명 alphabetical 정렬 + corner picker **한 번만** → 모두 같은 위치 일괄 삽입
   - **comic 모드 + bubbles** → 🗨 Bubbles 버튼 → bubble editor
3. **Insights** — 클래스 통계, word-state 분포 차트
4. **Messages** — `wc_visualization_messages` 인박스 (pending / answered)
   - 메시지에 `recording_urls` 있으면 inline `<audio controls>` N개 + "🎙️ 녹음 메시지" 친화 라벨
   - Reply: text + sticker (동물 gift) + 💰 quick buttons ($0.50/$1/$1.50/$2 + free cents) + ⏰ quick buttons (1/2/3분 + free 분)
5. **Settings**
   - `hide_features` 토글들 (학생 home 네비 숨김, 동물 / 메시지 / 코멘트 비활성화 등)
   - **Start with Animals [On]/[Off]** 토글 버튼 (단순 체크박스 아님 — wc-mini-toggle)
   - 페이지 당 동물 퀴즈 (`quizEveryNPages` 1~20)
   - **🌱 Reward fade preset** (off / slow / normal / fast) + 일일 휴식 분 (`dailyRestMinutes`, default 20)
   - 💝 격려 문구 (textarea, 한 줄 하나)

#### Bubble 에디터 (`teacher.js` 의 speech-bubble 모달)
- 만화 panel 이미지 위에 말풍선 박스 (rect / circle) 그림 → 안에 dialogue text
- 클릭 → flood-fill 로 말풍선 자동 감지 → 박스 fitted
- **+ Add rectangle / + Add circle** 버튼: 클릭 → 버튼 active state (`wc-be-armed` 녹색) + cursor crosshair → 다음 stage 클릭이 그 모양으로 박스 생성
- 박스 드래그(이동), 코너 핸들로 resize, × 로 삭제
- 자동 OCR (wc-ocr edge fn)

#### 오디오 보정 (audio correction popup, song mode 용)
- mp3 → waveform 표시 → 문장별 start/end 정렬
- **⚡ 빨리** 토글 (디폴트 ON) — 모든 문장의 start/end 동시에 + 번호 배지
- **확대/축소** [−][+] 버튼 — 1× ~ 8× zoom, peaks 재샘플링, 가로 스크롤, 검은 playhead 자동 따라가기
- 키보드: SPACE 재생/정지 · Z 처음부터 · ← 시작(녹색) · → 끝(빨강, 빨리모드 시 다음 문장 자동) · Enter 다음 · `,` -2초 · `.` +2초
- 검은 playhead 세로선 항상 표시 (paused 시도), 드래그로 scrub
- 번호 배지(①②③..) 좌우 드래그로 start/end 미세 조정
- ✨ Auto-align (wc-align edge fn)

### C. SDT 기반 보상 시스템

#### 1) 동물 만남 (`encounter.js`)
- `wc:page-advanced` 이벤트 → 카운터 증가 → quizEveryNPages 도달 → 게이트 통과 시 `runEncounter`
- **40% 단어 색칠 게이트** (`PAGE_COLOR_THRESHOLD = 0.4`): 떠난 페이지의 unique 단어 중 40% 이상이 wordLevels Map 에 있어야 동물 발동. 미달이면 counter 보존 (다음 페이지 advance 시 다시 체크)
- 동물 퀴즈 통과 → 동물 잡힘 → 룰렛 회전 → 시간/돈/XP 보상
- `WCEncounter.runForPage(stats)` — 페이지 전체 녹음 후 호출되는 강제 인카운터 (게이트 우회)

#### 2) Reward fade
- `WCDB.rewardIntensity(totalPages, flags)` → `1 - totalPages/span` clamp [0.25, 1.0]
- span: off=0(no fade), slow=600, normal=300, fast=150
- `WCLesson.rewardIntensity` 가 quiz 빈도 (`max(baseN, baseN/intensity)`), 단어-mark 코인 (`Math.random() < intensity`), 룰렛 등장률 모두 조절
- intensity 낮아질수록 wheel 등장 ↓ + 매일 휴식 시간 (`dailyRestMinutes × (1-intensity)`) 자동 보충

#### 3) 시간 reframing
- "earn currency, spend it" → "**열심히 읽고 받은 쉬는 시간**" — 자율감 강조
- 메시지 popup 에 rationale 문장 ("열심히 읽은 뒤엔 쉬는 게 좋아요 — 언제 쉴지는 네가 정해요")

#### 4) XP / Level
- `levels.js` 의 28레벨 quadratic 커브
- `animalLevelFor(catcherLvl) = min(10, catcherLvl)` — 동물 set 의 ceiling 캡 (한 set 에 10마리)
- 레벨업 시 popup (encounter.js) — 새 level 이미지 + XP 게이지

#### 5) 돈 / 시간 ledger
- `wc_money_entries`, `wc_time_entries` — earn / spend 양방향 행
- 페이지 popup 의 7일 그래프 + spend 폼

### D. 한국어 청크 시스템 (`wc-korbar-gpt`)
- sentence → 3-7개 청크로 분할 + 각 청크의 한글 뜻 + situation (언제 써?) + **parts** (per-piece EN:KO 매핑)
- 캐시: `wc_korbar_cache` 테이블
- 사이드바에 표시 + 단어 탭 시 chunk underline 으로 본문에 표시

---

## 3. 중요한 의사결정 (앞으로 바꾸지 마세요)

| 결정 | 근거 |
|---|---|
| 빌드 시스템 없음 | 학교 PC / 폰에서 즉시 동작, deployment 단순, 디버깅 쉬움 |
| Supabase 단일 프로젝트 + 테이블 prefix | 비용 절감, 하나의 RLS 정책 관리 |
| `writeResilient` (PGRST204 → drop column → retry) | 클라이언트가 SQL 마이그레이션 *후* 배포돼도 안 깨짐. 사용자가 SQL 실행 늦어도 OK |
| 자체 4자리 코드 로그인 | 학생용 — 이메일 없는 어린이. 보안은 Phase 7 (edge fn + rate limit) 에서 강화 예정 |
| 모든 wc_* 테이블 select=* | 작은 row, 클라이언트가 알아서 사용 |
| iPhone-style swipe = 자체 JS | scroll-snap 으로는 height interpolation + loop 안 됨 |
| Reward fade 디폴트 = OFF | 기존 클래스 동작 보존 (intensity = 1, 변화 없음). 교사가 명시적으로 켜야 발동 |
| 동물 40% 게이트 | "그냥 페이지 넘기기" 패턴 차단. 읽기 활동을 강제 (SDT 의 capability/competence) |
| 모바일 lesson box 고정 높이 | `100dvh` 기준 + safe-area 보정. iOS 주소표시줄 따라 동적 |
| 검은 playhead 세로선 always-visible | paused 상태에서도 위치 알 수 있어야 함 |

---

## 4. 이미 해결한 문제 (재발 시 참고)

| 증상 | 원인 | 해결 |
|---|---|---|
| 모바일 첫 swipe 가 20px 에서 멈춤 | 브라우저가 horizontal pan 가로채기 | `body.wc-lesson-layout .wc-lesson-text { touch-action: pan-y }` |
| 페이지 넘긴 후 텍스트 좌로 살짝 튐 | cleanup 의 transition / transform reset 순서 | `commitAndCleanup`: 새 콘텐츠 mount → `transition:none` → `transform:''` → reflow → restore transition |
| 매 6번째 swipe stall | 직전 swipe의 setTimeout cleanup race | `flushPending()` — 새 onTouchStart 가 직전 cleanup 즉시 실행 |
| swipe clone 의 텍스트 크기가 real body 와 다름 | `#lessonBody` ID 선택자가 clone 에 안 잡힘 | CSS 27개 occurrences 모두 `.wc-lesson-text` 클래스 선택자로 sed 변경 |
| 모바일 박스가 바 뒤로 넘어감 | `100vh` 는 iOS 주소표시줄 보이는 동안 너무 큼 | `height: calc(100dvh - 69px - safe-area)` |
| 모바일 박스 컨텐츠 위/아래 흰 여백 | 박스가 viewport 전체 fill | 고정 height + `overflow:hidden`, scroll-mode 토글 시 내부만 scroll |
| 빠른 더블 탭 시 zoom | iOS 더블탭 zoom | viewport `maximum-scale=1, user-scalable=no` + `touch-action: manipulation` |
| 시트 바닥에 살짝 보임 | 닫혀도 border/shadow 가 1px slab 으로 그려짐 | `display: none !important; visibility: hidden` (open 시 `!important` 로 override) |
| 청크 KO 가 비어있는 첫 페이지 | renderKorChunkSection 가 chunk 없으면 빈 상태 | meaning page 가 chunk + word card 같이 표시하므로 chunk 없어도 한글 뜻 보임 |
| Edge 녹음 무음 | Chromium MediaRecorder duration=Infinity + mic 입력 0 | `preparedRecordingAudio()` 로 duration 픽스. 진짜 무음은 시스템 mic 문제였음 (코드 문제 아님) |
| New lesson starts with Animals OFF 토글 무력화 | 학생 localStorage 가 stale '1' 들고 있음 | init 에서 localStorage 안 보고 class 토글이 무조건 source of truth |
| Lesson save 400 | 새 컬럼 (default_scroll 등) 모르는 DB | `writeResilient` 가 PGRST204 보고 빠진 컬럼 제거 후 재시도 |
| 만화 lesson 에서 "퀴즈를 만들 수 없어요" | `quizSentences` 가 bubble 문장 무시 | bubble 문장도 scope 에 포함하도록 수정 |

---

## 5. 아직 조심해야 할 문제

1. **모바일 시트의 carousel** — `WCKorBar.fetchWord`/`fetchChunk` 결과를 캐시하지 않음. 같은 단어 재선택 시 매번 fetch. cache 추가 시 invalidation 정책 필요 (word level 바뀌면? 청크는 영구?)
2. **`writeResilient` silent drop** — 새 컬럼 추가했는데 SQL 마이그레이션 안 돌리면 데이터가 그냥 안 저장됨. 의심스러우면 Supabase dashboard 에서 `select column_name from information_schema.columns where table_name='wc_xxx'` 확인.
3. **컬렉터레벨 vs 동물레벨** — `WCLevels.levelForXp(xp)` = catcher level (1~28), `WCLevels.animalLevelFor(catcherLvl) = min(10, catcherLvl)` = 동물 set 내 위치. 둘을 혼동 금지.
4. **TTS 캐싱** — `wc_tts_cache` 행에 sentence/chunk 별 mp3 URL. prewarm 안 누르면 첫 student 가 매번 wc-tts-google 호출하느라 느림.
5. **iPhone Safari 의 PWA 모드 / standalone** — 미테스트. `100dvh` 동작은 검증 필요할 수 있음.
6. **녹음 → Storage 업로드 실패** 시 silent — try/catch 로 삼킴. console.warn 만. 학생이 모를 수 있음.
7. **bubble editor 가 OCR 결과를 즉시 입력** — 잘못된 OCR 이면 학생이 보는 dialogue 가 틀림. 교사가 reviewer 역할.
8. **lesson body 의 [[IMG:N]] 마커가 텍스트 인덱스로 위치 결정** — 본문 편집 시 마커 위치가 바뀌면 이미지 위치도 함께 이동. 텍스트 끝에 마커가 남아 있으면 페이지 break 마커와 혼동될 수 있음.

---

## 6. 사용자가 명시적으로 요청했던 핵심 요구사항 (지키기)

1. "**모든 사용자 텍스트는 어린이 친화적 한국어**" — 명령형 / 영어 잘 안 씀 / emoji 신중하게
2. "**돈 시스템은 달러로**" (cents 저장, `$X.XX` 표시). 잔액 / 보상 / 답장 quick 버튼 모두 $0.50/$1/$1.50/$2
3. "**시간은 휴식**" — "시간 모으기 → 게임 시간 사기" 가 아니라 "**열심히 읽고 받은 쉬는 시간**"
4. "**lesson box 는 항상 같은 자리, 같은 크기**" (모바일) — `100dvh - 69px - safe-area`, 좌우 5px / 아래 12px 균등 여백
5. "**전체 페이지 세로 스크롤 금지**" (모바일) — `html, body { overflow: hidden }`
6. "**라이브러리 커버는 모든 너비 같고 높이 가변, 아랫변 정렬, 흰색 letterbox 0**"
7. "**iPhone home-screen 스타일 스와이프**" — 핑거 트래킹, 중간 멈춤, 놓으면 commit/rollback
8. "**텍스트 큰 네모 아랫부분 여백 없게**" — content-fit, padding-bottom: 0
9. "**모바일 첫 화면 툴바 버튼 모두 숨기기**" — `headCollapsed = true` 모바일 디폴트 강제 override
10. "**단어 선택 시 한글 뜻 즉시 표시**" + "**시트 옆으로 넘기면 다른 사이드바 기능들 차례로**" — bottom sheet 3 페이지 캐러셀
11. "**동물은 단어 40% 이상 색칠해야 발동**"
12. "**Speech bubble: 버튼 누르고 → 그 다음 클릭 시 그 위치에 모양 생성**" (pick-then-click)
13. "**Add image 여러 개: 파일명 alphabetical 정렬 + 코너 선택 한 번**"
14. "**오디오 보정 ⚡ 빨리 모드 디폴트 ON**" — 한 번 재생으로 모든 문장 정렬

---

## 7. 디자인 방향

- **부드러운 둥근 책장 느낌** — `border-radius: 12-16px`, soft shadow
- **녹색 accent (`#3aa776`) + 따뜻한 노란색 (default cover gradient)**
- **모바일은 풀-bleed**, 데스크탑은 max-width 880px 중앙 정렬
- **emoji 사용 최소화** — 사용 시 의미가 명확한 자리에만 (🐾 동물, 💌 메시지, ⏰ 시간, 💰 돈, ⚡ 빨리, 🌱 페이드, 🔊 TTS, ⏺ 녹음)
- **인라인 SVG > webp/icon font** for 작은 UI 아이콘 (currentColor 자동 매칭)

---

## 8. 새 대화에서 이어받는 Claude 가 반드시 알아야 할 맥락

1. **`lesson.js` 와 `teacher.js` 는 거대함 (4000+줄)** — 분리 시도 금지. `grep` + `Read offset/limit` 으로 필요한 부분만 찾기.
2. **인라인 JS 가 많음** — `lesson.html` 의 모바일 bottom sheet manager / 페이지 swipe manager 는 `<script>` 인라인. 외부 .js 가 아니므로 syntax check 시 인지 필요.
3. **모든 변경은 캐시 버전 업이 필수** — 사용자가 명시적으로 push & test 함. 버전 안 올리면 사용자는 "변경 안 됨" 으로 인식.
4. **사용자는 매우 빠른 iteration** — 한 메시지에 여러 변경 요청, 다음 메시지에 그중 일부 픽스 요청. 모든 요청에 신속 + 정확하게 응답.
5. **사용자는 모바일 (특히 iOS Safari) 에서 실제 테스트** — 데스크탑에서 잘 되어도 iOS에서 안 되면 다시 함. `touch-action`, `dvh`, `safe-area-inset-bottom` 같은 모바일-specific CSS 늘 고려.
6. **사용자는 한국어로 요청, 코드 / 주석은 영어 OK**.
7. **`internal task list` 는 무시 가능** — 실제 진행 상황과 동기화 안 됨. `git log` 와 코드 자체가 source of truth.
8. **이미 만들었던 SQL 마이그레이션은 사용자가 Supabase Dashboard 에서 수동으로 SQL Editor 에 붙여넣어 실행** — automation 없음. 새 SQL 만들 때 안전한 idempotent (`if not exists`) 패턴 필수.
9. **HANDOFF.md 와 MIGRATION-NOTES.md 가 이미 루트에 있음** — 옛 인수인계 문서. 참고는 OK, 내용 충돌 시 이 PROJECT_NOTES.md 가 더 최신.
10. **"내가 요청한 것 중에 덜한 것 있어?"** 라는 질문이 자주 나옴 → 정직하게 미완료 / 부분 완료 항목을 보고. 모르겠으면 "특별히 없습니다" 또는 명시.

---

## 9. 마지막 작업한 굵직한 항목들 (최신순)

- **오디오 보정 zoom (확대/축소)** + 검은 playhead 자동 스크롤 + peaks 재샘플링
- **⚡ 빨리 모드** (default ON) — 모든 문장 동시 + 번호 배지 + 드래그 가능
- 오디오 보정 키바인딩: `,` -2초 / `.` +2초 swap (표준 `<` / `>` 매핑)
- 오디오 보정: → 누르면 끝 위치 설정만 (auto-advance 제거 — 재조정 가능)
- 오디오 보정: 검은 playhead 드래그로 scrub
- 모바일 lesson box `100dvh` + 페이지 세로 스크롤 lock
- 라이브러리: 같은 너비 / 가변 높이 / 아랫변 정렬 / letterbox 0
- 페이지 swipe race-condition fix (`flushPending`)
- swipe clone 텍스트 크기 매칭 (`#lessonBody` → `.wc-lesson-text` 일괄 변경)
- 검은선 + ← / → 동작 변경 (auto-advance 제거)
- 동물 40% 단어 색칠 게이트
- 빈 공간 클릭 시 단어 deselect
- 모바일 더블탭 zoom 방지
- 모바일 push-up (english/lesson.html 메커니즘 참고)
- bottom sheet 3-페이지 캐러셀 (JS-driven, height 보간, 무한 루프)
- Speech bubble pick-then-click
- Add image 일괄 + 정렬
- 레슨 cover image
- 28레벨 XP 시스템 + 레벨 이미지
- Recording → forced encounter → message popup with recording_urls
- 교사 messages 의 inline audio
- SDT reward fade (slow/normal/fast preset)
- 시간 reframing → "쉬는 시간"
- 동물 OFF 토글 → 모든 레슨 기본값 (per-lesson default_animals 무시)
- 만화 / 팝송 lesson mode + bubble editor + 오디오 정렬

(commit log 약 100개 이상의 변경)
