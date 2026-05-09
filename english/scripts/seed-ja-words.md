# 일본어 어휘 캐시 시드 (Phase 4 #5)

`word_info_gpt_cache` 테이블에 흔한 일본어 단어들을 미리 채워놓으면, 일본어 학습자가 처음 클릭할 때 GPT 호출 없이 즉시 의미가 표시됩니다.

## 동작 원리

1. 시드 스크립트가 단어 리스트를 읽어 각 단어를 deployed `word-info-gpt` Edge Function에 POST
2. Edge Function이 캐시 미스 → GPT 호출 → 결과를 `word_info_gpt_cache.cache_key='ja:<word>'`에 저장
3. 이후 모든 사용자/디바이스가 이 캐시 hit → GPT 호출 0회

## 단어 리스트 출처 (5000개 권장)

다음 공개 데이터셋 중 하나 사용:

- **JLPT N5-N1 통합** (~8000개): https://github.com/elzup/jlpt-word-list (json 형식)
- **Tanos JLPT** (~2000개): https://www.tanos.co.uk/jlpt/
- **NHK 뉴스 빈도 상위 5000** (한자 + 빈도): https://github.com/wkentaro/nhk-easier
- **Frequency dictionary** (Tanaka/JEDIC): https://github.com/scriptin/jmdict-simplified

가장 추천: **JLPT N5-N1 통합** — 학습자 표준 어휘.

## 스크립트 실행 방법

### 1. 단어 리스트 파일 준비

`/scripts/ja-words.txt` 형식 (한 줄에 한 단어):
```
食べる
飲む
行く
来る
する
...
```

### 2. Deno 스크립트 실행

```bash
# Supabase 프로젝트 URL과 anon key를 환경변수로 설정
export SUPABASE_URL="https://sbatsnivlrlywpfytlio.supabase.co"
export SUPABASE_ANON="sb_publishable_..."

# 스크립트 실행 (rate-limited 동시 4개 호출, 1단어당 ~1초)
deno run --allow-net --allow-env --allow-read \
  scripts/seed-ja-words.ts scripts/ja-words.txt
```

### 3. 진행 상황

스크립트는 콘솔에 진행률 출력:
```
[1/5000] 食べる … cached
[2/5000] 飲む … cached
[3/5000] 行く … cached (already in cloud)
...
```

### 4. 검증

```sql
-- Supabase SQL Editor
SELECT COUNT(*) FROM word_info_gpt_cache
WHERE cache_key LIKE 'ja:%';
```

5000 정도가 나오면 완료.

## 비용 추정

- 새 단어 1건 = GPT-4o-mini 1 call ≈ 350 input tokens + 350 output tokens
- 가격: $0.15/1M input + $0.60/1M output
- 5000개 시드: 1.75M input + 1.75M output ≈ **$1.31 (약 1700원)**

이 비용은 한 번만 발생. 이후 모든 사용자가 캐시 hit으로 무료 사용.

## 주의사항

- 스크립트 중단됐다 재시작해도 안전 (이미 캐시된 단어는 GPT 재호출 안 함, Edge Function이 cache hit 처리)
- Rate limit: OpenAI는 분당 약 500 RPM 허용. 스크립트는 4 동시 호출 + 200ms 간격으로 안전한 페이스 유지
- 일부 단어가 실패해도 다른 단어 처리 계속 (실패 단어는 stderr에 로깅)
