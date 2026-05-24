# TODO.md — 앞으로 할 일

이 문서는 **이미 끝낸 작업의 기록은 아님** (그건 PROJECT_NOTES.md 의 §9 와 git log 참고). 여기는 **아직 할 일 + 잠재적 위험 + 추후 검토** 만.

---

## 🔴 우선순위 1 — 사용자가 실제 운영 중 발견 가능한 잠재 버그

### 1.1 — 사용자가 직접 실행해야 할 미실행 SQL 마이그레이션
사용자가 SQL 파일을 만들기만 하고 Supabase Dashboard 에서 실행 안 한 경우, `writeResilient` 가 조용히 그 컬럼을 drop 해서 데이터가 안 저장됨. **마지막으로 만든 / 변경된 SQL 파일들이 모두 적용됐는지 확인 필요**:

| SQL 파일 | 추가하는 컬럼 / 테이블 | 확인 방법 |
|---|---|---|
| `supabase-add-lesson-cover.sql` | `wc_lessons.cover_image_url` | lesson edit → cover 업로드 → 저장 → 다시 열어서 cover 가 살아 있는지 |
| `supabase-add-viz-recordings.sql` | `wc_visualization_messages.recording_urls text[]` | 학생이 한 페이지 녹음 완료 → 메시지 보내기 → 교사 messages 탭에 audio controls 보이는지 |
| `supabase-add-viz-time.sql` | `wc_visualization_messages.gift_minutes` | 교사가 답장에 1/2/3분 buttons 클릭 → 학생 시간 popup 에 반영 |
| `supabase-add-reward-fade.sql` | `wc_users.total_pages_read`, `wc_money_entries`, `wc_time_entries` | 학생 reading → total_pages_read 가 증가하는지 |
| `supabase-add-xp-and-money-ledger.sql` | `wc_users.xp`, money/time ledger | profile 페이지 XP 게이지 표시 |
| `supabase-add-lesson-scroll.sql` | `wc_lessons.default_scroll boolean` | comic lesson 의 ⬇ 토글 디폴트 적용 |
| `supabase-add-viz-voice.sql` | `wc_visualization_messages.student_voice_url`, `teacher_voice_url` | 학생/교사 목소리 메시지 기능 |

**확인 명령** (Supabase Dashboard → SQL Editor):
```sql
select column_name from information_schema.columns
where table_name in ('wc_users','wc_lessons','wc_visualization_messages')
order by table_name, column_name;
```

### 1.2 — Edge Functions 재배포 상태
사용자가 `supabase functions deploy <name>` 안 했으면 옛 버전이 응답:

- **`wc-korbar-gpt`** — chunk parts (EN:KO breakdown) 기능 — `parts` 필드 응답하는지 확인
- **`wc-ocr`** — bubble OCR — bubble editor 에서 박스 생성 시 dialogue 자동 입력되는지
- **`wc-align`** — auto-align — 오디오 보정 ✨ Auto-align 버튼이 정상 동작하는지
- **`wc-tts-google`** — TTS — 단어 탭 시 청크 음성 들리는지

### 1.3 — 모바일 bottom sheet word cache 없음
- `WCKorBar.fetchWord` / `fetchChunk` 가 같은 단어 / 청크 재선택 시 매번 fetch
- 서버 cache hit 이라 비용은 낮지만, **네트워크 느린 환경에서 느림 체감**
- TODO: client-side memoization. invalidation 정책 필요 (e.g. 단어 level 변경 시 invalidate?)

---

## 🟡 우선순위 2 — UX 개선 / 추가 기능

### 2.1 — 모바일 push-up 의 sheet height transition 동기화
- 현재 sheet height 가 transition 으로 변할 때 (`resizeCurrentPage` 호출 → 새 페이지 자연 높이로 transition), push-up 이 transitionend 후에 다시 계산
- **부드러움 개선 여지**: sheet height transition 과 shell push-up transition 을 같은 easing/duration 으로 동기

### 2.2 — 오디오 보정 — peaks 캐시
- zoom 마다 `regenPeaks(decodedBuf)` 가 매번 풀 채널 재샘플링
- 작은 곡 (3분) 은 100ms 이내지만, 긴 곡은 lag 체감 가능
- TODO: zoom factor → peaks 캐시 Map<zoom, Float32Array>

### 2.3 — 오디오 보정 — 시작 위치 자동 nudge
- 현재 ← 누르면 playhead 그대로 위치
- 노래 가사 시작은 보통 강박 1박 뒤이므로 정확한 자연 시작점 찾기 어려움
- TODO: ← 누르면 playhead 위치 기준 ±0.2초 안에서 amplitude valley 찾아서 그 위치로 snap

### 2.4 — 학생 home 의 `Maths / Pets / Space / Phonics / Animals` chip 들
- 모바일에서 일부만 숨기면 trailing `|` 가 어색하게 남을 가능성 (기존 `.wc-nav-item` 클래스가 인접 separator 도 처리해야 함)
- 검증 필요

### 2.5 — 교사 messages 의 inline audio
- 현재 `<audio controls>` N개 세로 stack
- 한 페이지 4-5문장 녹음하면 컨트롤 4-5개 → 세로로 길어짐
- TODO: 압축 표시 (총 길이 + 1버튼 play-all) 옵션

### 2.6 — Lesson edit 의 mp3 자동 정렬
- 만든 lesson 의 mp3 에서 sentence 정렬 정확도가 wc-align edge fn 의 OpenAI 의존
- 교사가 정렬 결과를 수동 보정해야 함 — 좋음 (현재 빨리 모드로 빠른 보정 가능)
- TODO 없음, 모니터링만

---

## 🟢 우선순위 3 — 새 기능 아이디어 (사용자 요청 대기)

### 3.1 — 클래스 별 leaderboard / 통계
- "이 클래스에서 가장 많이 읽은 학생" / "가장 많이 색칠한 단어" 등
- Insights 탭에 추가 가능
- 사용자 요청 없음 — 보류

### 3.2 — 학부모용 별도 페이지
- 학부모가 자녀 진행 상황 보는 read-only 뷰
- `wc_users.role` 'parent' 신설 + parent ↔ student link
- 사용자 요청 없음 — 보류

### 3.3 — 오프라인 모드 / PWA
- 비행기 / 카페 등 offline 에서도 읽기 가능
- ServiceWorker + lesson body cache + recording 큐
- 복잡도 높음 — 보류

### 3.4 — `wc-spelling` (받아쓰기) 모드
- TTS 가 단어 / 문장 읽으면 학생이 타이핑
- 별도 lesson mode `mode = 'spelling'`?
- 사용자 요청 없음 — 보류

---

## 🧪 테스트해야 할 부분 (다음 사용자 세션 시작 시 확인)

### 4.1 — 모바일 시트 + push-up + swipe 동시 동작
1. 모바일에서 lesson 열기
2. 단어 탭 → 시트 올라오고 push-up 적용
3. 본문 가로 swipe → 페이지 넘기기 (시트 닫힘? push-up reset?)
4. 새 페이지에서 다시 단어 탭 → 시트 + push-up 정상?
5. ✏️ Edit 버튼이나 다른 영역 인터랙션 → 충돌 없음?

### 4.2 — Reward fade preset 별 동작
1. 교사 Settings → 페이드 preset 변경 (off / slow / normal / fast)
2. 학생으로 로그인 → 많이 읽기 → `total_pages_read` 증가
3. 동물 빈도 변화 관찰
4. 매일 휴식 grant 가 home 의 ⏰ popup 에 잘 보이는지

### 4.3 — 40% 단어 색칠 게이트
1. 새 lesson 열기 → 단어 안 색칠한 채 페이지 넘기기 → 동물 안 나오는지
2. 페이지의 40% 단어 색칠 → 페이지 넘기기 → 동물 나오는지
3. comic / song mode 에서도 동작 (또는 안 동작) 확인

### 4.4 — 녹음 → forced encounter → 메시지 popup → 교사 messages
1. 모든 문장 녹음
2. 재생-올 버튼 연두색?
3. 누르면 sequential 재생?
4. 끝나면 동물 인카운터 → 메시지 popup
5. 텍스트 입력 → 보내기
6. 교사로 로그인 → messages 탭에 녹음 audio controls?

### 4.5 — Cover image 업로드 + 라이브러리 표시
1. teacher lesson edit → cover 업로드 → 저장
2. 학생 home → library 에 cover 가 보이는지
3. 다른 비율 (1:1 CD, 2:3 책, 16:9 포스터) 섞어 업로드 → 너비 균일 / 높이 가변 / 아랫변 정렬 확인

### 4.6 — 오디오 보정 ⚡ 빨리 모드
1. lesson edit 의 mp3 attach 한 song lesson → 🌊 파형 보정 클릭
2. 빨리 모드 ON (디폴트) 확인
3. SPACE 재생 → ← / → 로 한 번에 전체 정렬
4. 번호 배지 드래그로 미세 조정
5. + / − 로 확대 / 축소 + 검은선 자동 따라가기

### 4.7 — 모바일 iOS Safari 주소표시줄 동적 동작
1. iOS Safari 에서 lesson 열기
2. 스크롤 위/아래 → 주소표시줄 보였다 사라졌다
3. lesson box 가 주소표시줄 따라 dynamically 리사이즈?
4. 박스가 항상 바 바로 위 12px 간격 유지?

---

## 🚀 배포 전 확인 사항 (git push 직전)

### 5.1 — 캐시 버전 모두 동기화?
- 같은 작업에서 변경된 파일들은 같은 `?v=xxx` 라벨로 통일
- styles.css 는 4개 페이지 모두 (`lesson.html`, `home.html`, `teacher.html`, `profile.html`) 같은 버전인지 확인
- 명령:
  ```bash
  grep -n "styles.css?v=" /Users/moonleon/Documents/Homepage/focus/edu/*.html
  ```

### 5.2 — JS 문법 검증
```bash
for f in /Users/moonleon/Documents/Homepage/focus/edu/js/*.js; do
  node --check "$f" 2>&1 || echo "FAIL: $f"
done
```

### 5.3 — CSS brace balance
```bash
grep -c '{' /Users/moonleon/Documents/Homepage/focus/edu/css/styles.css
grep -c '}' /Users/moonleon/Documents/Homepage/focus/edu/css/styles.css
# 두 값이 같아야 함
```

### 5.4 — Console error 체크 (학생 페이지)
- index → home → 아무 lesson 열기 → 단어 클릭 → 페이지 넘기기 → 메시지 보내기 — 모두 console error 없는지

### 5.5 — Edge case 단어
- 매우 긴 lesson (50+ 페이지)
- 빈 lesson (본문 0줄)
- 이미지만 있는 lesson (text 0)
- 한국어가 섞인 lesson (영어가 아닌 단어)
- 만화 lesson (image + bubbles)
- song lesson (audio + sentences)

### 5.6 — 학생 데이터 보존 확인
변경 후에도:
- `wc.session.v1` 유지됨? 학생 강제 로그아웃 안 됨?
- `wc.headCollapsed.v1` 같은 per-device pref 가 깨지지 않음?
- 학생들의 `wc_word_states` 데이터가 (level / 색칠) 그대로?
- 잡은 동물 (`wc_student_pets`) 그대로?

---

## 🔭 잠재 리스크 / 모니터링

### 6.1 — Supabase free tier 한계
- DB 500MB / Storage 1GB 한도. 녹음이 많아지면 storage 부족 가능
- 모니터링: Supabase Dashboard → Settings → Usage

### 6.2 — Edge Function cold start
- 첫 호출이 느림 (1-3초). 학생 첫 단어 탭 시 lag 체감
- 완화: prewarm 버튼들 (lessons 탭의 🔥🎵🎶🇰🇷📝) 이 미리 cache 채움
- 교사가 매 lesson 만든 후 prewarm 누르도록 교육

### 6.3 — OpenAI 비용
- `wc-korbar-gpt` / `wc-word-info-gpt` 가 매 단어/청크 첫 호출 시 OpenAI 호출
- 캐시 (`wc_korbar_cache`, `wc_word_info_cache`) 가 비용 절감
- 모니터링: OpenAI Dashboard → Usage

### 6.4 — GitHub Pages 배포 지연
- push 후 1-3분 후에 반영. 사용자가 즉시 hard refresh 해도 옛 버전 보일 수 있음
- 캐시 버전 업이 이 lag 을 우회

### 6.5 — iOS Safari 업데이트
- `dvh` / `safe-area-inset-bottom` / `touch-action` 동작이 OS 버전마다 미세 차이
- 새 iOS 출시 시 모바일 lesson 페이지 재테스트

---

## 📋 다음 대화에서 사용자에게 먼저 물어볼 질문 후보

(사용자가 새 요청 없이 단순히 "이어서 작업해" 라고 하면 다음 중 하나를 제안)

1. "최근에 만든 SQL 마이그레이션 파일 다 Supabase 에서 실행하셨나요?" (§1.1 list)
2. "최근 변경된 edge function 들 (wc-korbar-gpt 등) 재배포하셨나요?" (§1.2)
3. "모바일에서 단어 탭 + 페이지 swipe + push-up 조합 테스트해보셨나요?" (§4.1)
4. "혹시 이전 대화에서 끝내지 못한 항목이 있나요?" (open-ended)

---

## 🏷️ 현재 캐시 버전 (마지막 변경 시점)

(다음 변경 시 카운터 +1 또는 새 라벨로)

- `styles.css?v=voice-msg-1`
- `lesson.js?v=voice-msg-1`  ← 메시지 팝업 2단 + 학생 목소리 녹음
- `teacher.js?v=voice-msg-1` ← 교사 목소리 답장 녹음
- `db.js?v=voice-msg-1`      ← viz.send/respondWithGift에 voice URL 파라미터 추가
- `sidebar.js?v=voice-msg-1` ← 교사 목소리 답장 재생
- `quiz.js?v=profile-xp-1`
- `encounter.js?v=color40-1`

`grep -n "?v=" /Users/moonleon/Documents/Homepage/focus/edu/*.html` 로 확인.
