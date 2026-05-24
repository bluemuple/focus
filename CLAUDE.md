# CLAUDE.md — 새 대화에서 가장 먼저 읽어야 할 파일

이 문서는 **새 Claude Code 대화** 가 이 프로젝트를 이어받을 때 첫 번째로 읽어야 할 운영 매뉴얼입니다. 코드를 만지기 전에 PROJECT_NOTES.md, TODO.md 도 함께 읽어주세요.

---

## 1. 프로젝트의 목적

### 사이트 전체
`/Users/moonleon/Documents/Homepage/focus/` 는 **moonleon**(개인 개발자/학부모/교사) 가 운영하는 자녀 학습용 정적 웹사이트의 루트입니다. GitHub Pages (`bluemuple.github.io`) 에 배포됩니다.

여러 sub-app 이 같은 도메인 아래 폴더로 나뉘어 있습니다:

| 경로 | 용도 |
|---|---|
| `edu/` | **WordCatch (Ako)** — 영어 읽기 학습 (이 대화의 메인 작업 폴더) |
| `english/` | 영어 단어/문장 학습 (별개 앱, 일부 기능을 edu 가 참고) |
| `animals/` | 동물 백과 / 동물 친구 |
| `phonics/` | 파닉스 학습 |
| `maths/` | 수학 (Mental Subtraction 등) |
| `virtual/` | "The Space" 가상 공간 |
| `audio/`, `images/` | 공통 에셋 |

이 대화에서 작업한 거의 모든 것은 **`edu/`** 폴더 안입니다.

### `edu/` (WordCatch / Ako) — 핵심 앱
- **대상 사용자**: 한국어가 모국어인 영어 학습 초·중급 어린이 (대략 만 7–11세, 사용자 본인의 자녀 + 교실 학생 약 5–10명)
- **목적**: 영어 본문을 한 단어 한 단어 탭하며 한글 뜻을 즉시 보고, 자기 페이스로 단어를 학습 + 발음 녹음 + 만화 / 팝송 형태로 다양하게 읽기
- **교사용** 별도 페이지에서 lesson 만들기 / 학생 학습 인사이트 / 시각화 메시지 답장 / 동물 보상 시스템 관리
- **현재 운영 상태**: Production. 실제 학생들이 매일 씀.

### SDT (Self-Determination Theory) 디자인 철학
- 외재적 보상(코인·동물·시간)을 **초기에 자주, 시간이 갈수록 자동으로 옅게** (reward fade)
- 게임 시간을 읽기의 *대가* 가 아니라 *읽고 난 후의 휴식* 으로 reframing
- 동물 출현은 **단어 클릭(색 변경) 40% 이상** 되었을 때만 발동 → "그냥 다음 페이지 넘기기" 패턴 방지

---

## 2. Claude 가 코드를 수정할 때 반드시 지켜야 할 규칙

### 절대 규칙
1. **사용자가 명시적으로 요청한 작업만** 수행. 코드 미화 / 리팩토링 / "겸사겸사" 정리는 금지.
2. **빌드 시스템 없음** — 정적 HTML/CSS/vanilla-JS. `npm install`, `webpack`, 어떤 빌드 단계도 도입 금지.
3. **외부 npm 라이브러리 추가 금지** — 모든 의존성은 CDN script 태그 또는 인라인 코드.
4. **모든 사용자 대상 텍스트는 한국어** 우선 (영어 학습 본문은 영어). 친근한 어린이 톤. 절대로 emoji 를 사용자 요청 없이 추가하지 말 것 (단, 기존 UI 에 emoji 가 이미 있으면 일관성 유지).
5. **db.js 의 `writeResilient` 패턴 유지** — DB 컬럼이 빠져 있을 때 PostgREST 가 PGRST204 를 던지면 빠진 컬럼을 자동으로 제거하고 재시도. 새 컬럼 추가 시 이 패턴이 깨지지 않게 SQL 마이그레이션을 *나중에 실행* 해도 클라이언트가 안 깨짐.
6. **localStorage 키는 절대 바꾸지 말 것** — 학생들의 기존 진행 상태가 keyed 됨. `wc.session.v1`, `wc.headCollapsed.v1`, `wc.hideEncounters.v1` 등.
7. **수정 후 반드시 캐시 버전 업** — `?v=foo-1` → `?v=foo-2`. 그렇지 않으면 GitHub Pages 의 CDN 캐시 때문에 학생 브라우저가 옛 코드를 계속 로드.
8. **`node --check`** 로 JS 문법 검증 후 응답. CSS 도 brace balance 정도는 확인.
9. **로컬 dev 서버 없음** — 변경은 git push → GitHub Pages 가 자동 배포. 사용자가 직접 hard refresh 해서 테스트.

### 캐시 버전 규약
- 의미 있는 짧은 라벨 + 카운터: `?v=mobsh-2`, `?v=wave-zoom-1`, `?v=color40-1`
- 같은 작업 안에서 여러 파일을 동시에 바꾸면 모두 같은 버전 라벨로 통일하는 게 좋음 (단, 일관성보다 정확성이 우선)
- 4개 페이지 모두 styles.css 를 로드: `lesson.html`, `home.html`, `teacher.html`, `profile.html` — CSS 버전은 4개 다 함께 올려야 함

### 코딩 스타일
- **Vanilla JS, IIFE 패턴, `const`/`let` 우선, `var` 금지**
- **명시적 `;` 사용**
- **JSDoc 또는 인라인 주석으로 "왜" 를 설명** — "무엇" 은 코드가 말해 줌, "왜" 는 사람이 말해야 함
- **사용자 노출 텍스트는 한국어** (코드 주석은 영어 OK)
- 함수가 100줄 넘어가도 OK — 이 프로젝트는 file-per-feature 구조라 lesson.js 가 4200줄, teacher.js 가 4600줄. 분리하지 말 것.

### 디자인 / UI 원칙
- **어린이 친화** — 라운드 코너, 부드러운 그림자, 큰 탭 타겟 (≥36px)
- **녹색 accent** = 또박또박 한국 학습앱 톤. `--tobok-accent: #3aa776`
- **모바일 first** for student-facing pages (lesson, home, profile)
- **PC first** for teacher.html (선생님은 데스크탑에서 lesson 만듦)
- **iPhone home-screen 스타일 페이지 스와이프** — lesson 본문은 좌우로 손가락 따라 넘김 (`touch-action: pan-y` 로 브라우저 가로 제스처 가로채기 차단)
- **검은 emoji icon 사용 금지** — 인라인 SVG (currentColor 사용) 가 표준

---

## 3. 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프론트엔드 | 정적 HTML5 + 인라인/외부 CSS + vanilla JS (ES2017+) |
| 빌드 | **없음** (no bundler, no transpile) |
| 백엔드 | Supabase (PostgreSQL + PostgREST + Storage + Edge Functions) |
| 인증 | 자체 4자리 코드 (Supabase Auth 안 씀) — `wc_users.login_code` |
| Edge Functions | Deno + TypeScript (Supabase에 배포) |
| TTS | Google Cloud TTS via `wc-tts-google` Edge Function + Web Speech API fallback |
| LLM | OpenAI (chunk 분석 / 한국어 번역 / OCR 등) via Edge Functions |
| 호스팅 | GitHub Pages (`bluemuple.github.io`) |
| 폰트 | 시스템 sans-serif + Lexend (Read Better) + OpenDyslexic (난독증 모드, self-hosted .otf) |

### Supabase 프로젝트
- URL: `https://sbatsnivlrlywpfytlio.supabase.co` (← `edu/js/supabase-config.js`)
- 모든 테이블 prefix: **`wc_`** (WordCatch). 다른 sub-app 과 같은 프로젝트를 공유함.
- 스토리지 버킷: `wc-lesson-images` (covers/, panels/, audio/, recordings/)

---

## 4. 폴더 / 파일 구조 (edu/ 기준)

```
edu/
├── index.html             — 로그인 (4자리 코드)
├── home.html              — 학생 홈 (Reading 라이브러리 + Maths/Pets/Space 등 네비)
├── lesson.html            — 레슨 페이지 (단어 학습 / 본문 표시 / 사이드바)
├── profile.html           — 학생 프로필 (이름, 시간, $, XP, 격려 문구)
├── teacher.html           — 교사 대시보드 (Students, Lessons, Insights, Messages, Settings)
├── back-to-basic.html, practice.html, race.html, race2.html, practice2.html
│   — 보조 학습 페이지 (수학 / 기초 학습)
├── OpenDyslexic-Regular.otf  — 난독증 친화 폰트
│
├── css/
│   └── styles.css         — 모든 페이지 공용 스타일 (~4640줄)
│
├── js/
│   ├── supabase-config.js — Supabase URL + anon key (절대 수정 금지 — env-level)
│   ├── auth.js            — WCAuth (login/logout/session)
│   ├── db.js              — WCDB (PostgREST wrapper, 모든 wc_* 테이블)
│   ├── assets.js          — 동물 sprite / set 정의
│   ├── levels.js          — XP → level 환산 (28단계)
│   ├── tts.js             — WCTTS (Google TTS 호출)
│   ├── wc-korbar.js       — 한국어 청크 분석 helper (edge fn 호출)
│   ├── word-info.js       — 영어 단어 사전 정보 (edge fn 호출)
│   ├── chunks.js          — sentence → chunk 분해 prefetch
│   ├── word-popup.js      — (legacy) 단어 popup
│   ├── lesson.js          — 레슨 페이지 컨트롤러 (★ 4208줄, 최대)
│   ├── sidebar.js         — 데스크탑 사이드바 (단어 카드 / 메시지 / 답장)
│   ├── quiz.js            — 한국어 MCQ / Unscramble / 독해 퀴즈 + 룰렛
│   ├── encounter.js       — 동물 만남 (페이지 advance → 퀴즈 트리거 + 40% 게이트)
│   ├── teacher.js         — 교사 대시보드 (★ 4635줄, 최대)
│   ├── profile.js         — 프로필 페이지 렌더
│   ├── fitting-room.js    — 캐릭터 아바타 커스터마이즈
│   ├── practice.js, practice2.js, race.js, race2.js, back-to-basic.js
│
├── images/
│   ├── lesson-levels/     — level-01.png ~ level-28.png (28장)
│   ├── levels/            — 동물 아이콘 (1~10)
│   ├── animals/           — 동물 sprite
│   ├── profile-portraits/ — (현재 거의 미사용, level 이미지로 대체)
│   └── incentives/
│
├── supabase-add-*.sql     — DB 마이그레이션 (alphabetical 순으로 약 25개)
├── supabase-schema.sql    — 초기 스키마
├── supabase-bootstrap.sql — 시드 데이터
│
└── supabase-functions/    — Deno 엣지 함수 (각 폴더는 supabase deploy 단위)
    ├── wc-korbar-gpt/     — 청크 → 한국어 번역
    ├── wc-word-info-gpt/  — 영어 단어 → 사전 카드
    ├── wc-ocr/            — 만화 말풍선 OCR
    ├── wc-align/          — mp3 ↔ 가사 자동 정렬
    ├── wc-tts-google/     — Google TTS proxy
    ├── wc-animal-wiki-gpt/— 동물 백과 카드 생성
    └── quiz-gpt/          — Korean MCQ 생성
```

### 주요 페이지의 진입점
- 학생: `index.html → home.html → lesson.html → (sidebar 단어 카드)`
- 교사: `index.html → teacher.html (탭: Students / Lessons / Insights / Messages / Settings)`

---

## 5. 데이터베이스 — 주요 wc_ 테이블

| 테이블 | 용도 |
|---|---|
| `wc_users` | 학생 + 교사 한 row. `role` 'student' \| 'teacher'. `xp`, `money` (cents), `total_pages_read` |
| `wc_classes` | 클래스 (선생님 하나가 여러 학생을 묶음). `hide_features` JSONB 에 모든 토글 (`hideStudentLessonUpload`, `rewardFade`, `dailyRestMinutes`, `quizEveryNPages`, `lessonsAnimalsDefaultOff`, `encouragements`, `hideXxx` 네비 토글 등) |
| `wc_lessons` | 레슨 본문 + 메타. `body` (text/HTML/markdown), `images` (JSONB), `mode` ('text' \| 'comic' \| 'song'), `default_animals`, `audio_url`, `audio_segments`, `cover_image_url` |
| `wc_word_states` | 학생-단어 등급. `level` (-1 ignore, 0 unmarked, 1..5 mastery) |
| `wc_student_pets` | 잡은 동물 (animal_set + animal_index + level) |
| `wc_visualization_messages` | 학생→교사 메시지. `recording_urls` (text[]), `gift_money`, `gift_minutes`, `gift_animal_set/index`, `teacher_response` |
| `wc_encounter_counters` | 클래스 분석용 카운터 |
| `wc_money_entries`, `wc_time_entries` | 돈 / 시간 ledger (earn / spend 행) |
| `wc_recordings` | 학생 녹음 메타 (Storage URL + sentence text 매핑) |
| `wc_korbar_cache`, `wc_lesson_progress`, `wc_animal_hearts`, `wc_animal_comments`, `wc_animal_contributions` | 캐시 + 보조 |

### Edge Functions (Deno)
- `wc-korbar-gpt` — sentence → chunks + ko meaning + situation + parts(EN:KO)
- `wc-word-info-gpt` — word → definition + IPA + examples + word_family / similar / opposite + use_it frame + lemma
- `wc-ocr` — image bytes → bubble text (만화 말풍선 자동 OCR)
- `wc-align` — mp3 + lyrics → sentence start/end times (자동 정렬)
- `wc-tts-google` — Google Cloud TTS proxy (sentence/chunk 캐싱)
- `wc-animal-wiki-gpt` — 동물 백과 카드 생성

배포: `supabase functions deploy <name>` (사용자가 수동 실행)

---

## 6. 절대 삭제 / 변경 금지

다음 기능들은 학생 / 교사가 매일 의존하므로 절대로 제거하거나 동작 방식을 바꾸지 마세요. 변경이 필요하면 **반드시 사용자에게 명시적으로 확인** 받을 것.

1. **`wc.session.v1` localStorage 키** — 로그인 세션 캐시. 키 이름 바꾸면 전체 학생 강제 로그아웃.
2. **`WCDB.writeResilient`** 패턴 — DB 컬럼이 빠져도 lesson.create / lesson.update 가 죽지 않게 보호.
3. **`WCLesson.setWordLevel`** 시그니처 — sidebar.js / 모바일 bottom-sheet / 키보드 nav 모두 의존.
4. **이벤트 버스** `wc:word-selected` / `wc:word-deselected` / `wc:chunk-focused` / `wc:level-up` / `wc:page-advanced` / `wc:counter-changed` / `wc:word-message-sent` / `wc:encounter-end` — sidebar / encounter / quiz / mobile sheet 모두 이걸로 통신.
5. **animal 보상 시스템** — 1) 페이지 advance 트리거, 2) `quizEveryNPages` 게이트, 3) **40% 단어 색칠** 게이트 (이게 메인 SDT 메커니즘), 4) 쿨다운, 5) 동물 퀴즈 → 잡으면 룰렛 → 시간/돈/XP 보상. 5단계 모두 유지.
6. **녹음 → viz_message 흐름** — 한 페이지 모든 문장 녹음 → 재생 올 버튼 연두색 → 누르면 sequential 재생 → 퀴즈 → 동물/룰렛 → 메시지 팝업 ("녹음하면서 어려웠던 단어 적어줘"). 교사는 messages 탭에서 audio controls 로 들음.
7. **iPhone 스타일 swipe 페이지 넘김 (모바일)** — `body.wc-lesson-text { touch-action: pan-y }` + JS 가 가로 swipe 가로채기. 이게 깨지면 모바일 페이지 nav 가 망가짐.
8. **Reward fade** — `rewardIntensity()` 가 quiz frequency / coin 확률 / 룰렛 등장률을 모두 조절. 단순화 금지.

---

## 7. 새 대화에서 Claude 가 먼저 확인해야 할 파일 (순서대로)

1. **`CLAUDE.md`** (이 파일) — 규칙 + 구조 파악
2. **`PROJECT_NOTES.md`** — 지금까지 구현한 것, 의사결정, 주의사항
3. **`TODO.md`** — 다음에 할 일
4. **`edu/js/db.js`** — 데이터 모델 + 모든 wc_* 테이블 API 한눈에 (660줄, 핵심)
5. **`edu/js/lesson.js`** 상단 (1~200줄) — `window.WCLesson` exports 가 다른 파일의 인터페이스 계약
6. **`edu/lesson.html`** — 인라인 JS 영역 (lesson 페이지의 모바일 bottom-sheet + 페이지 swipe manager 가 여기 있음)
7. **`edu/css/styles.css`** — 가장 큰 CSS (4640줄). 새 스타일 추가 시 기존 클래스명 충돌 확인 필수
8. **`edu/js/teacher.js`** — 교사 대시보드 (작업 시에만)

작업 영역에 따라 추가로:
- 사이드바 / 단어 카드: `js/sidebar.js`
- 동물 퀴즈 / 보상: `js/encounter.js`, `js/quiz.js`
- 한국어 청크: `js/wc-korbar.js` + `supabase-functions/wc-korbar-gpt/index.ts`
- 녹음 관련: `js/lesson.js` 의 record-bar 섹션 + `wc_recordings` SQL

---

## 8. 로컬 실행 / 디버깅

### 로컬 dev 서버 없음 — 두 가지 옵션
1. **Live 테스트**: `git push` → GitHub Pages 가 자동 배포 → 사용자가 폰/PC 에서 hard refresh (Cmd+Shift+R) 해서 확인.
2. **VS Code Live Server 같은 정적 서버** 로 `focus/` 폴더 띄우면 됨. Supabase 는 외부 prod 인스턴스를 그대로 씀.

### 자주 쓰는 검증 명령
```bash
# JS 문법 체크 (사용자가 push 하기 전 필수)
node --check /Users/moonleon/Documents/Homepage/focus/edu/js/lesson.js

# 모든 js 검증
for f in /Users/moonleon/Documents/Homepage/focus/edu/js/*.js; do node --check "$f" || echo "FAIL: $f"; done

# 최근 git log
git -C /Users/moonleon/Documents/Homepage/focus log --oneline -20
```

### 자주 발생하는 함정
- **캐시 버전 안 올림** → 학생 브라우저가 옛 코드 계속 로드. 모든 변경 후 `?v=xxx` 카운터 +1.
- **localStorage 미반영** → 학생들이 옛 preference (e.g. `wc.headCollapsed.v1`) 를 들고 있을 수 있음. 새 기본값 적용 시 페이지 init 에서 강제 override 고려.
- **iOS Safari `100vh`** → 주소표시줄 때문에 viewport 크기가 동적. 모바일 풀스크린은 `100dvh` 우선 + `100vh` fallback.
- **`writeResilient` 의 silent column drop** → 새 컬럼 추가하고 SQL 마이그레이션 실행 안 하면 그 컬럼이 INSERT/UPDATE 페이로드에서 그냥 사라짐. 데이터가 안 저장돼서 디버깅 어려움.
