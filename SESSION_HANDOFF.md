# Bidoro — Session Handoff (새 세션용 인수인계)

> 이 파일은 **새 Claude Code 세션**이 Bidoro 작업을 이어받기 위한 인수인계 문서입니다.
> 먼저 `CLAUDE.md`(프로젝트 운영 매뉴얼)도 함께 읽으세요. 이 문서는 그 위에 **현재 진행 상황 + 다음 할 일**을 더한 것입니다.
> 작성 시점 기준 `index.html` ≈ 17,930줄. 줄 번호는 편집하면 밀리므로, 아래 **grep 앵커(고유 문자열/함수 시그니처)**로 위치를 다시 찾으세요.

---

## 0. 제일 먼저 (TL;DR)

- **메인 파일**: `/Users/moonleon/Documents/Homepage/focus/index.html` — 단일 파일. 인라인 HTML + CSS + 바닐라 JS. **빌드 시스템 없음. npm 라이브러리 없음.**
- **iOS 래퍼**: `/Users/moonleon/Documents/Homepage/bidoro-ios/` (Capacitor 6).
- **웹/PC/폰은 같은 `focus/` 소스 하나**를 공유. 반응형 분기는 `@media (max-width: 700px)`(폰) 로 구분. iOS만 `ios-shim.js`가 추가 동작.
- **저장 키 절대 변경 금지**: localStorage 메인 키 = `concentration-app-v1`.
- **편집 후 항상 JS 문법 검사**: `node /tmp/extract-js.js index.html && node --check /tmp/idx-block-0.js`
- **미리보기**: `.claude/launch.json`의 `bidoro-focus` (python http.server 8848) + `mcp__Claude_Preview__*` 툴. 폰 프리셋 375×812.
- **다음 할 일**: **§6 PENDING TASK 는 모두 완료됨**(2026-06-01 세션, A1~A6 + B7~B8 구현·미리보기 검증). 상세는 §6 상단 "✅ 완료" 배너 참조. 새 작업이 없으면 §6은 기록용.
- **⚠️ 대기 중 외부 작업(2026-06-01 추가 기능)**: **익명 "Memo for Sharing" 기능**을 구현함(상단바 quote 탭 → 팝업: 내 quotes + 공유 메모. 남의 메모는 상단바에 초록색으로 랜덤 표시). **사용자가 Supabase에서 `focus/supabase-shared-memos.sql` 을 1회 실행해야** 유저 간 공유가 활성화됨. 실행 전에는 graceful degradation(내 quotes·내 메모만 로컬 회전, 에러 없음). 클라 코드: `SB_SHARED_TABLE`, `pushSharedMemoToCloud`/`fetchSharedMemosFromCloud`/`getVisibleSharedMemos`, `openQuoteShareModal`(grep), `refreshMotivation`(카테고리 가중 풀 + `.is-shared` 초록), state `sharedMemo`/`shareClientId`/`sharedMemoRowId`/`hiddenSharedMemos`. 안전장치=길이100자+숨기기+기본 욕설필터(`containsProfanity`).

---

## 1. 프로젝트 개요

**Bidoro** = 뽀모도로 타이머 + 아이젠하워 매트릭스(4분면 할일) 집중 앱. 대상은 스마트폰 등 자극으로 집중이 어려운 현대인 / ADHD 사용자.

- 같은 도메인(`bluemuple.github.io`, GitHub Pages) 아래 여러 sub-app 중 하나가 `focus/` (= Bidoro).
- 핵심 화면 2개: **Focus**(메인), **Statistics**(통계). 상단 탭으로 전환.
- 돈(USD) 메커니즘: q1/q2/q3 작업 중 분당 +$0.01, 작업 완료 시 bid 만큼 +. 물통(bucket)에 물이 차는 시각화.
- "Now focusing on" 카드: 현재 진행 중인 task 이름 + 뽀모도로 링 + 남은 시간 + 돈.
- Time gauge: 세로 시간축에 회색 task 사각형(block)이 그려짐. 뽀모도로 work/break 마다 block 자동 추가.

---

## 2. 절대 지켜야 할 제약 (CLAUDE.md 발췌 + 이 프로젝트 규칙)

1. **사용자가 명시적으로 요청한 것만** 한다. 요청하지 않은 리팩토링/정리/개선 금지.
2. **빌드 시스템 금지, npm 라이브러리 금지.** 필요하면 CDN `<script>` 또는 인라인으로만.
3. **이모지 함부로 추가 금지.** 단, 사용자가 명시적으로 요청했거나 기존에 쓰이는 것은 허용: ⏳ 🕐 ✓(체크) ☹.
4. **localStorage 키 변경 금지** (`concentration-app-v1` 등).
5. **인라인 JS는 응답 전에 `node --check`로 검증** (방법은 §4).
6. 한국어로 답변/주석 OK. 사용자는 한국어로 요청함.

---

## 3. 파일 맵

| 경로 | 용도 |
|---|---|
| `focus/index.html` | **메인. 거의 모든 작업이 여기.** 인라인 HTML/CSS/JS 단일 파일 |
| `focus/ios-shim.js` | iOS(Capacitor)에서만 동작: splash 숨김, 상태바, 로컬알림(뽀모도로 경계), 키보드 클래스, 햅틱, iCloud KV 동기화. 웹에서는 no-op |
| `focus/CLAUDE.md` | 프로젝트 운영 매뉴얼(한국어). 새 세션 필독 |
| `focus/SESSION_HANDOFF.md` | **이 문서** |
| `.claude/launch.json` | 미리보기 서버 정의 (`bidoro-focus`, 포트 8848) |
| `bidoro-ios/` | Capacitor iOS 프로젝트 |
| `bidoro-ios/capacitor.config.json` | `Keyboard.resize:"none"`, `StatusBar.overlaysWebView:false` 등 |
| `/tmp/bidoro-all-v2.applescript` | "Bidoro Build & Deploy.app" 의 소스 (아이콘 생성→빌드→USB기기 설치→실행) |

---

## 4. 검증 워크플로 (편집 후 반드시)

### 4-1. JS 문법 검사
인라인 `<script>`를 추출해서 `node --check`:
```bash
node /tmp/extract-js.js index.html      # /tmp/idx-block-0.js (등) 생성
node --check /tmp/idx-block-0.js         # 통과해야 함
# 한 줄로:
node /tmp/extract-js.js index.html >/dev/null 2>&1 && for f in /tmp/idx-block-*.js; do node --check "$f" && echo "JS OK: $f"; done
```
> `/tmp/extract-js.js` 가 없으면: `<script>...</script>` 블록을 추출해 `/tmp/idx-block-N.js`로 저장하는 간단한 스크립트. 없으면 새로 만들어도 됨.

### 4-2. 미리보기 (웹)
```
mcp__Claude_Preview__preview_start   name="bidoro-focus"      # serverId 받기
mcp__Claude_Preview__preview_resize  serverId=..., preset="mobile"   # 375×812
mcp__Claude_Preview__preview_eval / _screenshot / _click ...
mcp__Claude_Preview__preview_stop    serverId=...             # 끝나면 정지
```
- 로딩 후 **인증 화면**이 뜨면 "Try it" 버튼 클릭으로 게스트 진입:
  `[...document.querySelectorAll('button')].find(b=>/Try it/i.test(b.textContent))?.click()`
- Focus 페이지: `document.getElementById('tab-focus').click()`, Stats: `#tab-stats`.
- **split(Time & Tasks) 모드 진입/검증**은 DOM 클릭 또는 `state` 직접 조작 + `renderFocusMatrix()/drawTimeArea()` 호출로.
- 데모 데이터에 옛날 패널티가 있어 "오늘" 금액이 음수(빨강)로 보일 수 있음 — 코드 버그 아님(레거시 데이터).

### 4-3. iOS 기기 배포
- **웹/Safari**: 새로고침이면 반영됨.
- **iPhone 앱**: **"Bidoro Build & Deploy.app"** 실행 필요(아이콘 재생성→`npm run build`(focus/→www/→ios/)→USB 기기 찾기→`xcodebuild` 설치→실행).
  - 요구사항: USB 연결 + 기기 잠금해제 + **Developer Mode ON** + Trust. (이건 **환경 이슈**지 코드 문제 아님 — 연결 안 되면 사용자에게 안내.)

---

## 5. 아키텍처 / 핵심 코드 위치 (grep 앵커 포함)

> 줄 번호는 편집하면 변함. **고유 문자열로 grep** 하세요.

### "Now focusing on" 카드 + 상단바 오버레이
- **카드 HTML** — grep `class="panel focus-card" id="focus-card"` (≈4389). `.fc-stats`(≈4402) = `<span id="fc-focused">…</span> focused · Session <span id="fc-session">…</span>`. `.fc-money-row`(≈4405) = `#fc-money-big` + `.fc-money-cur`(USD) + `#fc-money-change`. 내부:
  - `.fc-expanded` 안에: `.fc-label`("Now focusing on") / `.fc-name-row`(`#fc-pomo` 링 + `#fc-name`) / `.fc-left-row`(⏳ `#fc-left` left) / `.fc-stats`(`#fc-focused` focused · Session `#fc-session`) / `.fc-money-row`(`#fc-money-big` `#fc-money-cur`(USD) `#fc-money-change`).
  - ⚠️ **컴팩트 바(`.fc-compact`)는 이번 세션에서 제거됨.** 더 이상 존재하지 않음.
- **카드 CSS** — grep `"Now focusing on" focus card` (≈1789).
- **상단바 오버레이(스크롤 시 4버튼→링+이름)** — grep `.topbar-now` (CSS ≈1843, HTML `id="topbar-now"` ≈4145). `#tn-pomo`(링), `#tn-name`(이름), `.tn-sep`(회색 `|`). `body.scrolled-now` 토글로 4버튼 fade out / 오버레이 fade in.
- **JS**:
  - `renderImDoing()` — grep `function renderImDoing` (≈11800). 카드 채움. 헬퍼: `setName`(→`fc-name`+`tn-name`), `setFocused`(→`fc-focused`), `setSession`(→`fc-session`), `setLeft`(→`fc-left`), `setDot`(현재 no-op), `setPomo(fracElapsed,color)`(conic-gradient 링, `fc-pomo`+`tn-pomo`). idle 분기에서 이름을 "GTD before"/"Get Things Done Before"로.
  - `renderMoneyCard()` — grep `function renderMoneyCard` (≈11691). `#fc-money-big`, `#fc-money-change`(현재 텍스트 `'오늘 ' + (delta>=0?'+':'−') + '$' + ...`). **여기서 "오늘"→"Today" 바꿀 것(§6).**
  - `wireTopbarNow()` — grep `function wireTopbarNow` (≈14772). 스크롤→`body.scrolled-now`, 히스테리시스 show>64 / hide<12.
  - 세션 번호 출처: `_pomoCountsForToday()` (grep, ≈11739) → `workN`. 현재 `setSession(String((counts.workN||0)+1))`. 누적시간 `_pomoTotalsForToday()`(≈11768).

### 물통(bucket)
- **HTML** — grep `id="bucket-section"` (≈4512): `.bucket-stage` > `#bucket-svg`, 그 아래 `.bucket-buttons`(채우기/빼기/돈 버튼).
- **CSS** — grep `.bucket-stage` (≈385), `.bucket-buttons` (≈471).
- 물통 모듈 IIFE는 파일 뒤쪽(≈17120~). `window.bidoroBucketAddWater` 등 노출. (과거 회귀: 제거된 Habits 요소에 `null.onclick` 걸려 전체 스크립트 죽은 적 있음 — 새 코드가 옛 ID 건드리면 **null 가드** 필수.)

### Time & Tasks (split) 모드
- 토글 클래스: `body.tt-split`. CSS — grep `Phone split-view layout` (≈2437+).
- **컬럼 비율**: 평상시 `grid-template-columns: 50% 50%`; **작업 추가 중(`body.tt-adding`)** 이면 `38% 62%`로 morph (`transition: grid-template-columns .28s ease`). grep `body.tt-split.tt-adding .time-tasks-wrap`.
- **헤더 라벨**: `#time-toggle` 안에 `.lbl-full`("Time"/"Tasks") + `.lbl-abbr`("T"). `body.tt-split.tt-adding`이면 "Time & Tasks"→"T & T". grep `.lbl-abbr`.
- **+Add 흐름(JS)**:
  - `openMasterQuadrantPicker(masterBtn)` — grep (≈14481). +Add 누르면 4분면 선택 picker 생성. **여기서 `document.body.classList.add('tt-adding')`** 함. 초입 가드 `if (parent.querySelector('.quadrant-picker')) return;` ← §6-B-8 버그 용의자.
  - `showQuadrantInput(parent, picker, masterBtn, q)` — grep (≈14618). 분면 선택 후 색 입힌 입력칸(`.qp-input-row` = `[input][gap][✓ .qp-confirm]`) 표시. ✓ = `confirmTap`→`commit(true)`.
  - 취소(`cancelChoose`)/커밋(`commit`) 둘 다 `document.body.classList.remove('tt-adding')`.
  - `_trackGaugeDuringReflow(ms)` / `_syncSplitGaugeHeight()` — grep (≈14458 / ≈14443). picker 열고 닫는 동안 gauge 높이만 매 프레임 가볍게 맞춤(전체 drawTimeArea 매프레임 금지 — 그게 떨림 원인이었음). 끝에 한 번 `drawTimeArea()`.
- gauge block 가로 배치는 CSS(`left:36px; right:0`)로 유동적 → 컬럼 폭 바뀌면 JS 없이 CSS만으로 reflow.

### 4분면 매트릭스(2×2) / 작업바
- `renderFocusMatrix()` — grep `function renderFocusMatrix` (≈8178). 셀 헤더 `titles` 딕셔너리(≈8181)는 **이번 세션에서 strikethrough로 변경됨**:
  `q1:'Important · Urgent'`, `q2:'Important · <s>Urgent</s>'`, `q3:'<s>Important</s> · Urgent'`, `q4:'<s>Important</s> · <s>Urgent</s>'` (innerHTML로 들어감; h4는 `text-transform:uppercase`).
- **작업바 탭 핸들러(= gauge block 생성)**: `renderFocusMatrix` 내부 `row.onclick` (grep `row.onclick = (e) =>`, ≈8397). CASE A(일시정지)/B(재개)/C(새 시작) + `spawn25Block()`(grep, ≈8455). q4는 `startUpTask`(스톱워치).

### 뽀모도로 phase / gauge block 자동 추가
- `tickPomodoro()` — grep (≈9364). 남은시간 0 → `pendingPhaseConfirm=true`, `logPomodoroPhase`, `showPomoPhaseConfirm`.
- `showPomoPhaseConfirm()` — grep (≈9396). **Yes/No 처리부에서 옛 block을 phase 경계에서 닫고 다음 phase용 새 block을 `state.scheduledBlocks.push(newBlock)`**. 끝에 `renderFocusMatrix(); renderImDoing(); drawGauge();`.
  - ✅ **검증완료(이번 세션)**: work→Yes→break→Yes→next work 사이클에서 block 1→2→3 정상, 새 25분 work block이 now-line에 회색 사각형으로 자동 렌더. `drawGauge()`가 내부에서 `drawTimeArea()` 호출함(grep `drawGauge` 본문 ≈9950에 `drawTimeArea()`).
- `startPomodoro(q,i)` — grep (≈8981). **block은 여기서 안 만들고** 작업바 탭 핸들러에서 만듦(주의).
- `drawGauge()` — grep (≈9809), `drawTimeArea()` — grep (≈10110).
- 모달 버튼 id: `#custom-confirm-yes`, `#custom-confirm-no` (grep `function customConfirm`).

### GTD (Get Things Done before [time]) — ⭐설정 메커니즘 확인 완료
- **state 키**: `state.deadline`(시각 문자열 "HH:MM"), `state.deadlineDate`(선택 날짜, 비면 오늘). (수면은 `state.bedtime`/`state.bedtimeDate`.)
- **Setup 페이지 입력 UI**(grep `id="deadline"`, ≈4226): `<label>I'll get things done by</label>`, `#deadline-date`(date), `#deadline`(time), `#deadline-cd`(카운트다운), 빠른버튼 `#deadline-plus-30m`/`#deadline-plus-1h`, 리셋 `[data-reset="deadline"]`.
- **표준 세팅 패턴**(grep `dlInput.oninput`, ≈7597): 값 바꾼 뒤 반드시:
  ```js
  state.deadline = <"HH:MM">;            // state.deadlineDate = <"YYYY-MM-DD"> (선택)
  saveState();
  updateCountdowns();                     // 카운트다운/라벨 갱신
  drawGauge();                            // 파란 deadline 라인 + (내부) drawTimeArea
  markSettingsChanged(); debouncedPushSettings();
  ```
- **+30m/+1h 로직**(grep, ≈7643): `combineDateTime(state.deadlineDate, state.deadline)` 로 ms 얻고, `fmtDateLocal(t)`/`fmtTimeLocal(t)` 로 다시 문자열화해 저장.
- **gauge 파란 라인**: `drawGauge()` 안 `placeGoalLine(dlLineEl, dlLabelEl, state.deadline, state.deadlineDate, 'Go home')` (≈9942).
- **gauge 파란 캡슐 드래그**: `GtdCapsule` 컨트롤러(grep, ≈9995) + `wireGtdGaugeArm()`(≈10073). `_gtdMap`(px↔ms 매핑)은 `drawTimeArea`가 매 렌더 갱신.
- idle 라벨 "GTD before" 문구는 `renderImDoing` idle 분기에 이미 존재.
- ⚠️ **포커스 페이지 전용 GTD/Sleep "Set" 버튼은 과거에 제거됨**(`.tg-set-btn` CSS는 남아있지만 focus-page 행은 제거). 그래서 **§6의 새 `GTD before [ ]` 버튼**이 그 역할을 대신함.

#### 새 GTD 팝업 구현 레시피 (§6-A-6용)
가장 단순/안전한 방법: `[ ]` 버튼 클릭 → 작은 모달(또는 `customPrompt`)로 "HH:MM" 입력 받기 → 위 **표준 세팅 패턴** 실행.
- 시각 파싱은 관대하게(예: "9", "9:30", "21:00"). 비우면 `state.deadline=''`(클리어) + 동일 갱신 호출.
- 버튼 라벨: `state.deadline` 있으면 `fmtClock(state.deadline)`(grep) 같은 헬퍼로 hh:mm 표시, 없으면 빈 박스/연필 아이콘.
- 더 풍부하게 하려면 `<input type="time">` 한 줄 + +30m/+1h + Clear 를 모달에 넣고 기존 핸들러 로직을 재사용.
- 저장 후 `renderImDoing()`도 호출해 카드 버튼 라벨 즉시 갱신.

---

## 6. ⭐ PENDING TASK — (✅ 2026-06-01 세션에서 전부 완료)

> **✅ 완료 — 아래 A1~A6, B7~B8 모두 구현 + 폰(375)·PC 미리보기로 검증, `node --check` 통과, 콘솔 에러 없음.**
> 구현 요약 (다시 하지 말 것):
> - **A1/A2** 세션번호: `renderImDoing()` pomodoro 분기에서 `sessionN=(workN||0)+1`, `sessionN>=2`이면 `setName(name+' '+sessionN)` (1세션은 이름만). 상단바 `#tn-name`에도 자동 반영.
> - **A3** `.fc-stats` 줄 삭제: 카드 HTML에서 제거 + `setFocused/setSession` 정의·호출 제거(불필요해진 `_pomoTotalsForToday()` 호출도 제거). CSS의 `.fc-stats` 규칙은 dead로 남겨둠(무해).
> - **A4** `renderMoneyCard()`의 `'오늘 '` → `'Today '`.
> - **A5** 돈 줄을 `#bucket-section`의 `.bucket-stage` **위**(같은 흰 박스 최상단, 가운데)로 이동(`#bucket-money-row`). id(`fc-money-big`/`fc-money-change`) 유지 → `renderMoneyCard()` + 물방울 타겟 `_moneyTargetPoint()` 그대로 동작. CSS 셀렉터에서 `.focus-card` 접두사 제거.
> - **A6** 카드 안 옛 돈 자리에 `GTD before [⏱]` 행 추가: 네이티브 `<input type=time id=fc-gtd-time>`. onchange → 표준 세팅 패턴(`state.deadline` 저장 → `dlInput` 동기화 → `saveState/updateCountdowns/drawGauge/renderImDoing/markSettingsChanged/debouncedPushSettings`). 비우면 클리어. `renderImDoing`이 activeElement 가드로 값 동기화. 와이어링은 `dlInput.oninput` 근처(≈7603).
> - **B7** +Add morph 떨림(jitter) 제거: ① `openMasterQuadrantPicker`의 picker open `max-height` 타겟을 임의값 `320` → **측정한 `picker.scrollHeight`**(자연 높이)로 변경 → picker성장+버튼collapse 합이 단조 = overshoot 없음. ② `_trackGaugeDuringReflow(ms, dir)`에 방향 인자 추가 + 게이지 높이 **단조 클램프**(open=`'grow'`, close/분면선택=`'shrink'`), `bound`는 reflow 직전 높이로 시드. `_syncSplitGaugeHeight`는 이제 설정한 px를 반환. ③ `showQuadrantInput`에서 input 삽입 시 picker를 **input 높이만큼 즉시 선수축** 후 0으로 애니메이트 → task 바가 아래로 안 튀고 위로만 이동. (rAF 샘플링 측정: 모든 요소 reversals 0.)
> - **B8** +Add "회색만 깜빡, 무반응" 제거: ① `openMasterQuadrantPicker` 진입 가드를 "picker 있으면 return" → **stale picker/잔존 input-row 제거 후 재오픈**으로 변경. ② **세대 토큰**(`openMasterQuadrantPicker._gen`)으로 stale 타이머가 새 picker 버튼 스타일을 덮어쓰지 못하게. ③ open-cleanup 타이머가 이미 닫히는/분면선택된 picker(`picker._closing`/`picker._choosing`)에 대해선 master를 숨기지 않게 → **+Add 버튼이 사라지는 레이스 해결**. `showQuadrantInput`은 `picker._choosing=true` + master `display:none` 직접 설정.
>
> 아래는 **원래 요청 원문 + 구현 가이드**(기록용 보존).

원문 그대로 + 구현 가이드:

### (A) "Now focusing on" 카드 재구성

1. **task가 첫 세션(Session 1)일 때**: 지금처럼 **task 이름 오른쪽에 아무것도 없게**.
2. **task가 2번째 세션부터(Session 2+)**: **task 이름 옆에 숫자**를 붙임 (예: `공부 2`).
   - 구현: `renderImDoing()`의 pomodoro 분기에서 세션번호 `n = (_pomoCountsForToday().workN||0)+1`. `n>=2`이면 `setName(name + ' ' + n)` 형태로 이름 옆에 숫자. `n===1`이면 이름만.
   - ⚠️ 숫자는 `#tn-name`(상단바 오버레이)에도 동일 반영(setName이 둘 다 세팅).
3. **회색 `hh:mm:ss focused · Session n` 줄(`.fc-stats`) 삭제** — HTML에서 `.fc-stats` 블록 제거 + `renderImDoing`의 `setFocused`/`setSession` 호출 정리(또는 no-op). (`#fc-focused`/`#fc-session` 참조 깨지지 않게 가드.)
4. **`USD` 옆 "오늘" → "Today"** — `renderMoneyCard()`의 `changeEl.textContent='오늘 '+...` → `'Today '+...`.
5. **돈 줄(현재 금액 `#fc-money-big $X.XX USD` + 오늘 변화 `#fc-money-change`)을 물통(bucket) area 네모 윗쪽, 가운데 정렬로 이동.**
   - 구현: `.fc-money-row`(또는 그 내용)를 카드에서 빼서 `#bucket-section`의 `.bucket-stage` **위**에 배치. 가운데 정렬. `renderMoneyCard()`가 새 위치의 같은 id(`#fc-money-big`,`#fc-money-change`)를 그대로 쓰게 하면 JS 거의 안 바꿔도 됨(엘리먼트만 이동).
   - `_moneyTargetPoint()`(돈 물방울 도착점, grep)가 `#fc-money-big`/`#fcc-money`를 찾으므로 id 유지하면 물방울 애니메이션도 자동으로 새 위치를 따라감. (확인할 것.)
6. **원래 돈이 있던 자리(카드 안)에 `GTD before [   ]` 추가.**
   - `[   ]` 버튼은 **적절히 디자인**(예: 작은 pill/박스, 현재 GTD 목표 시각 hh:mm 표시 or 비어있으면 설정 유도). 누르면 **GTD 설정 팝업** 표시.
   - **TODO(새 세션 확인)**: 기존 GTD 설정 팝업/세터가 있는지 grep — `placeGtdCountdown`, `GtdCapsule`, "Time Start & Goals", "Starting Date", deadline/목표시간 state 키. 있으면 그 함수 재사용. 없으면 `customPrompt`/모달로 시간 입력 받아 해당 state에 저장 후 `drawTimeArea()` 재호출.

### (B) Time & Tasks 모드 버그 2개

7. **+Add 누른 후 morph 될 때, time gauge 와 +Add 줄의 bar 가 떨림(jitter)** — 자연스럽게.
   - 원인 후보: 이번 세션에 추가한 `body.tt-adding`의 `grid-template-columns:50%→38%` **컬럼 폭 transition** 동안, gauge(유동폭)와 picker/+Add row가 매 프레임 reflow되며 `_trackGaugeDuringReflow`의 높이 보정과 겹쳐 떨림.
   - 접근: (a) morph 중 gauge 폭 변화를 부드럽게(레이아웃 thrash 최소화), (b) `_trackGaugeDuringReflow` 추적 시간/방식과 컬럼 transition 타이밍 정합, (c) 필요시 morph 동안 gauge는 `will-change`/고정 후 끝에 한 번만 재배치, (d) picker 높이 애니메이션과 컬럼 폭 애니메이션이 동시에 다른 요소를 밀지 않도록.
   - **반드시 미리보기에서 실제로 +Add→분면선택까지 재현하며 떨림 측정**(요소 top/height를 rAF로 샘플링).

8. **+Add 버튼 누르면 가끔 회색 음영만 덮이고 아무 반응 없음** 개선.
   - 원인 후보: `openMasterQuadrantPicker` 초입 가드 `if (parent.querySelector('.quadrant-picker')) return;` — 이전 picker 잔존/애니메이션 중이면 무시됨. 또는 +Add(`#master-add-task`)의 `mab-out` 애니메이션 후 `pointer-events:none`/`display` 잔존 상태에서 탭이 먹힘. 또는 touchend+click 이중 바인딩으로 한 번은 삼켜짐. 또는 `:active` 회색만 보이고 핸들러 미발화.
   - 접근: 가드 조건 견고화(잔존 picker 정리 후 재오픈 허용), 애니메이션 종료 시 inline 스타일 확실히 초기화, touchstart/touchend/click 경합 정리, 비활성 구간 최소화.

### 검증
- 폰(375) 미리보기로 (A) 모든 항목 시각 확인 + (B) 두 버그 재현→해결 확인.
- `node --check` 통과.
- 끝나면 사용자에게 "웹은 새로고침 반영, 아이폰은 Bidoro Build & Deploy 필요" 안내.

---

## 7. 이번 세션에서 **이미 끝낸** 작업 (다시 하지 말 것)

1. **상단바 "now focusing" 오버레이**: "Now focusing on" 카드의 sticky/compact-morph 제거 → 카드는 다른 섹션처럼 그냥 스크롤되어 올라감. 스크롤 시 상단바(4버튼) fade out + (회색 `|` + 뽀모도로 링 `#tn-pomo` + task 이름 `#tn-name`) fade in. `body.scrolled-now`(show>64/hide<12). 4버튼 폭과 동일 영역. (CSS `.topbar-now`, JS `wireTopbarNow`.) `.fc-compact`/`fcc-*` 마크업·CSS·세터 제거, `--focus-card-top` 제거.
2. **4바 상단 마진 −3px**: `header.topbar` 폰 padding-top 6px→3px, iOS 10px→7px.
3. **Time & Tasks 평상시 50/50 + 작업추가 시 38/62 morph + "T & T" 약어**: `grid-template-columns` `1fr 1fr`(실제로 28/72로 깨지던 것)→`50% 50%`, `min-width:0` 추가. `body.tt-adding` 38/62 transition. `#time-toggle` 라벨 `.lbl-full`/`.lbl-abbr`.
4. **2×2 그리드 분면 헤더 strikethrough**: "Not Urgent"→`<s>Urgent</s>` 식 (renderFocusMatrix `titles`).
5. **검증 완료(코드 변경 없음)**: task→break→다음 task 시 gauge에 회색 block 자동 추가 — 정상 동작 확인(showPomoPhaseConfirm Yes 핸들러가 새 block push + drawGauge→drawTimeArea).
6. (이전) ✓ confirm 버튼(`.qp-confirm`), Stats Focus summary 1줄 자동축소, +Add/Cancel gauge 떨림 1차 완화(`_syncSplitGaugeHeight`).

> ⚠️ 위 6번/PENDING 7번이 모순처럼 보일 수 있음: 이전에 "+Add gauge 떨림"을 한 번 완화했는데, **이번 세션에 38/62 컬럼 morph를 새로 넣으면서 떨림이 다시 생겼을 가능성**이 큼(PENDING (B)7). 그래서 morph와 gauge 추적의 정합을 다시 봐야 함.

---

## 8. 알아두면 좋은 함정 / 교훈

- **sticky 깨짐**: 조상에 `overflow:hidden`이 있으면 `position:sticky`가 relative로 폴백. 가로 클립은 `overflow-x: clip` 사용(스크롤 컨테이너 안 만듦). (`html,body,main` 에 적용돼 있음.)
- **iOS 키보드**: 입력칸 `focus()`는 **touchend 핸들러 안에서** 호출해야 키보드가 뜸(WKWebView). 새 입력칸을 picker 제거보다 **먼저 insert+focus**. 초기 700ms 내 blur는 무시(스퍼리어스).
- **Capacitor**: `Keyboard.resize:"none"`, `StatusBar.overlaysWebView:false`. 그래서 topbar에 `env(safe-area-inset-top)` 패딩 **추가 금지**(이중 계산되어 분홍 여백 생김).
- **드로잉 함수 2종**: `drawGauge()`(상단 메인 게이지) 가 내부에서 `drawTimeArea()`(폰 미니 게이지) 호출. phase 핸들러는 `drawGauge()`만 불러도 둘 다 갱신됨.
- **block 생성 위치**: `startPomodoro`가 아니라 **작업바 `row.onclick`** 안. 테스트는 실제 DOM 클릭으로.
- **null 가드**: 제거된 옛 요소(Habits 등) ID에 핸들러 걸면 전체 스크립트가 죽음. 항상 존재 확인.
- **데모 데이터**: "오늘" 금액 음수/빨강은 레거시 패널티 데이터 탓. 코드 버그 아님.
- **미리보기 eval 주의**: 코드 수정 후엔 서버를 **stop→start(또는 새 serverId)** 해서 새 HTML을 받아야 함. 같은 페이지 인스턴스에 eval하면 옛 DOM이 보임.

---

## 9. 자주 쓰는 명령 모음

```bash
# JS 검사
node /tmp/extract-js.js index.html >/dev/null 2>&1 && for f in /tmp/idx-block-*.js; do node --check "$f" && echo OK; done

# 위치 찾기 (예시)
grep -n "function renderImDoing" index.html
grep -n "function renderMoneyCard" index.html
grep -n "id=\"focus-card\"" index.html
grep -n "id=\"bucket-section\"" index.html
grep -n "body.tt-split.tt-adding" index.html
grep -n "placeGtdCountdown\|GtdCapsule" index.html
```

```
# 미리보기 (MCP 툴)
preview_start name="bidoro-focus"  → serverId
preview_resize serverId=…, preset="mobile"
preview_eval / preview_screenshot / preview_click
preview_stop serverId=…
```

---

행운을 빕니다. **§6부터 시작**하고, 막히면 §5의 grep 앵커로 위치를 찾으세요.
