# ddooby-pang PLAN (v0.2)

> 상태: Draft · 작성일: 2026-11-05 · 기준 문서: [`SPEC.md`](../SPEC.md) "v0.2 확정 변경분"
> 이 문서는 v0.2를 **어떻게** 만들지 정한다. 작업 단위는 [`TASKS.md`](./TASKS.md).
> v0.1 구현 기록(core 구조·이벤트·화면 설계)은 [`v0.1/PLAN.md`](./v0.1/PLAN.md)에 있고 지금도 유효하다. 코드 주석의 `PLAN 4.5`처럼 번호만 쓴 것은 v0.1 문서를, `PLAN2 3.1`은 이 문서를 가리킨다.
> SPEC 9절대로 마일스톤 단위로 자세히 쓴다. 지금은 **1주차(조합 + 테마 시안)** 가 자세하고 2~4주차는 큰 틀이다.

---

## 1. 원칙 (v0.1과 같음)

- core는 순수 TS, `(state, action) → { state, events }`, seed RNG만, 값은 `src/config.ts`. view는 이벤트를 재생만 한다
- 서버 리플레이 검증(3주차)을 위해 **core 결과는 연출 시간과 무관**해야 한다. 연출 값은 view만 읽는다
- 태스크 ID는 `V2-W<주차>-<번호>`, 브랜치는 `feat/v2-w1-01-combo-core`처럼 쓴다

## 2. 결정 사항 (2026-11-05 사용자)

| 항목 | 결정 |
|---|---|
| 조합 발동 조건 | 나란히 있는 특수 블록 둘을 스왑하면 색이 달라도, 매치가 없어도 발동 |
| 폭탄 + 폭탄 | 범위 5×5 한 번, 연출만 두 번 쾅쾅 |
| 조합 이름 | 크로스! / 빅 크로스! / 메가 폭발! / 줄줄이 팡! / 폭탄 비! / 올 클리어! / 슈퍼 콤보! |
| 1주차 분담 | 조합 core와 연출을 다른 태스크로 |
| 테마 | Codex 시안 5개(사탕·우주·바다·공주·인형) → 사용자가 3개 선택 → 메인 화면에서 고름 |
| 별 3개 기준 (FEEDBACK R6) | 4주차 스테이지 재조정 때 같이 올린다 |

## 3. 특수 블록 조합 (1주차)

### 3.1 core 규칙

- **발동 조건**: `resolveSwap(a, b)`에서 스왑한 두 칸이 **모두 특수 블록**이면 매치 검사보다 먼저 조합으로 처리한다 (지금은 컬러 블록만 매치 없이 발동). 한쪽만 특수면 v0.1과 같다
- **발동 칸 `at`** = `b` (끌어온 블록이 도착한 칸). `partner` = `a`
- 조합 종류 (`ComboKind`, 순서는 판정 우선순위):

| 두 블록 | `ComboKind` | 지우는 칸 (보드 밖은 잘림) |
|---|---|---|
| 슈퍼 + 아무 특수 (슈퍼 + 슈퍼, 컬러 + 슈퍼 포함) | `superAny` | `at` 기준 슈퍼 범위(5×5 + 십자) ∪ 상대 효과. 상대가 줄이면 그 방향 줄, 폭탄이면 3×3, 슈퍼면 같은 범위, **컬러면 슈퍼 블록 색 전체** |
| 컬러 + 컬러 | `colorColor` | 보드 전체 (v0.1 그대로) |
| 컬러 + 줄 | `colorLine` | v0.1 W4-25 그대로: 상대 색 블록이 줄로 변신 → 차례 발동 (가로·세로 섞기) |
| 컬러 + 폭탄 | `colorBomb` | v0.1 W4-25 그대로: 상대 색 블록이 폭탄으로 변신 → 차례 발동 |
| 폭탄 + 폭탄 | `bombBomb` | `at` 기준 5×5 |
| 줄 + 폭탄 | `lineBomb` | `at` 행 기준 위아래 3행 + `at` 열 기준 좌우 3열 |
| 줄 + 줄 (방향 무관) | `lineLine` | `at`의 행 전체 + 열 전체 |

- **바뀌는 v0.1 동작**: 컬러 + 슈퍼는 지금 "같은 색 블록이 슈퍼로 변신"이다. v0.2에서는 `superAny`로 바뀐다 (SPEC 3절)
- 지운 범위 안의 다른 특수 블록은 v0.1처럼 연쇄 발동한다 (`chainActivate`, 차례 `depth` 1부터). 조합한 두 블록 자신은 다시 발동하지 않는다
- 점수: 조합으로 지운 블록은 특수 효과 제거와 같다 (`SCORE.bySpecial`, 연쇄 배율 그대로). 새 점수 값은 만들지 않는다
- 조합도 이동 1회 (스왑 한 번이므로 modes 변경 없음)

### 3.2 core 타입·이벤트

- `types.ts`: `export type ComboKind = 'lineLine' | 'lineBomb' | 'bombBomb' | 'colorLine' | 'colorBomb' | 'colorColor' | 'superAny'`
- 새 이벤트 (조합 첫 step 맨 앞, `swap` 다음 step):

  ```ts
  { type: 'combo'; combo: ComboKind; at: Pos; partner: Pos; cleared: readonly Pos[] }
  ```

  `cleared`는 조합 자체 범위다. `colorLine`·`colorBomb`·`colorColor`는 v0.1처럼 `activate`(컬러)·`transform`·차례 `activate`가 뒤따르고, `combo.cleared`는 컬러 효과 범위와 같다. 나머지 4개는 `combo` 하나가 범위를 맡고, 휘말린 특수 블록만 `activate`(depth ≥ 1)로 나온다
- `engine.ts`: `Trigger`에 `{ kind: 'combo'; at; partner }` 추가. `specials.ts`: `comboKind(x, y)`, `comboArea(kind, at, board, partnerBlock)` 순수 함수
- `remove` 이벤트의 `bySpecial`은 조합 범위도 true
- DEV 대조(`view ↔ board`)와 `assertInvariants`는 그대로 통과해야 한다

### 3.3 연출 (view)

- `combo` 이벤트를 받으면 순서대로: 두 블록이 `at`으로 모이는 모션 → 짧은 슬로모션(0.2~0.3초) → 조합 이름 팝업 → 범위 제거 + 파티클 + 흔들림 → 뒤따르는 `activate`는 v0.1 차례 연출 그대로
- 흔들림: `lineLine` 약하게 … `colorColor` 가장 세게. `bombBomb`은 폭발 연출 두 번 (두 번째는 짧게 뒤에)
- 연출 중 입력은 지금처럼 resolve 재생 동안 막힌다
- 값은 `config.ts`의 `COMBO` 한 곳: 이름 문자열, `mergeMs`, `slowMs`, `nameMs`, 종류별 흔들림 세기, `bombBombSecondMs`
- 소리: 전용 효과음 `public/audio/combo.ogg` + `.m4a` (CC0 소리, `public/audio/CREDITS.md`). 마땅한 게 없으면 `special` 소리를 재사용하고 FEEDBACK에 남긴다
- 개발 URL 옵션 `?specials=pairs`: 7개 조합을 각각 한 번에 시험할 수 있게 특수 블록을 나란히 배치 (v0.1 `?specials=combo` 확장)

### 3.4 테스트

- `tests/core/combo.test.ts`: 7개 범주마다 고정 보드 → 지워진 칸 집합, `combo` 이벤트 필드, 연쇄 발동 depth, 서로 다른 색 두 특수 블록 스왑이 `valid`인지
- 회귀: 한쪽만 특수인 스왑, 일반 매치, `?specials=combo`의 기존 컬러 + 줄·폭탄 결과가 v0.1과 같음 (`superAny`로 바뀐 컬러 + 슈퍼 테스트는 새 기대값으로)
- 결정성: 같은 seed + 같은 스왑 목록 → 같은 점수·보드 (기존 결정성 테스트에 조합 스왑 섞기)
- view: 이벤트 → 연출 단계 목록을 만드는 순수 함수가 있으면 단위 테스트. 브라우저 390×844 `?specials=pairs`로 7개 캡처

## 4. 테마 (1~2주차)

### 4.1 시안 (1주차, Codex)

- 키워드 5개(사탕·우주·바다·공주·인형)마다 **시안 한 장**: 세로 화면 배경 위에 블록 7개(빨강·주황·노랑·초록·파랑·보라 + 무지개)를 늘어놓은 모습. 쿼터 때문에 시안 단계에서는 한 장씩만 받는다
- 지킬 것: 6색 계열 유지, 블록 몸통에는 얼굴을 그리지 않음(얼굴은 코드가 겹침, 가운데를 비워 둠), 글자 없음, 기존 게임·캐릭터·브랜드 닮지 않기
- 저장: `assets/theme-src/drafts/<키워드>.png`, 설명 `.codex-out/V2-W1-03-image.md`. 사용자가 3개를 고른다

### 4.2 최종 그림 (2주차, Codex)

- 고른 3개 테마마다 블록 몸통 7장(256×256 투명 PNG, 지금 `public/blocks/`와 같은 규격) + 배경 1장(지금 `public/backgrounds/storybook.jpg`처럼 세로, 1086×1448 정도)
- `assets/theme-src/<테마ID>/`에 저장 → 구현 탭이 `public/themes/<테마ID>/`로 옮기고 `CREDITS.md`

### 4.3 테마 구조 (2주차, 구현)

- 테마 목록: 테마마다 `id`, 이름, 블록 7장 경로와 배치 값(지금 `DECOR.blockArt`의 scale·faceDy·faceScale), 배경 경로와 `band`. 지금 그림책 테마가 `storybook`(기본)
- 저장: `settings.theme` (없거나 모르는 값이면 `storybook`). **저장 형식이 바뀐다** (`parseSave` 정규화 + 테스트)
- 읽기: BootScene이 모든 테마 그림을 읽고, 블록 텍스처 키에 테마 ID를 넣는다. 그림이 없으면 v0.1처럼 도형 폴백
- 메인 화면에 테마 버튼 → 테마 카드(이름 + 블록 3개 미리보기) 4개 중 선택 → 바로 메뉴 배경이 바뀜
- 개발 URL 옵션 `?theme=<ID>`

## 5. 2~4주차 큰 틀 (자세한 설계는 그 주 시작 전에)

- **2주차 장애물**: Board 칸에 장애물 층(잠금·얼음벽·젤리) 추가, `layout`·`layers` 파서, 수직 낙하에서 얼음벽 고정 칸·그 아래 리필 지점 (SPEC 4.2). 이벤트 추가(`obstacleHit`, `obstacleClear` 등). v0.1 스테이지 하위 호환 테스트
- **3주차 온라인**: 시작 전에 core 공유 PoC (SPEC 11절 1번, 5번). `src/online/`에 인증·랭킹만. Supabase 마이그레이션 `supabase/migrations/`
- **4주차 재조정**: 1~30 데이터(이동·장애물·색), `npm run stages:sim`에 장애물 반영, **별 3개 기준 상향 (FEEDBACK R6)**, 플레이 로그 → 조카 2차 테스트

## 6. 리스크

- 조합이 너무 세서 쉬워짐 → 4주차 재조정에서 이동 수로 맞춘다. `superAny` 밸런스는 SPEC 11절 3번
- 컬러 + 슈퍼 동작 변경으로 v0.1에 익숙한 아이가 헷갈릴 수 있음 → 시범 플레이에서 본다
- 테마 그림 7장 × 3세트의 크기 차이 → 테마마다 배치 값을 따로 둔다 (4.3)
