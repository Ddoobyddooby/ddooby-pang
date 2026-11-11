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
| 조합 발동 조건 | 나란히 있는 특수 블록 둘을 스왑하면 색이 달라도(예: 빨강 가로 + 노랑 세로), 매치가 없어도 발동 |
| 컬러(무지개) + 특수 | 슈퍼 포함 모두 v0.1 동작 그대로 (W4-25 변신 → 차례 발동) |
| 폭탄 + 폭탄 | 범위 5×5 한 번, 연출만 두 번 쾅쾅 |
| 조합 이름 | 크로스! / 빅 크로스! / 메가 폭발! / 줄줄이 팡! / 폭탄 비! / 올 클리어! / 슈퍼 콤보! (컬러 + 슈퍼도 슈퍼 콤보!) |
| 1주차 분담 | 조합 core와 연출을 다른 태스크로 |
| **조합 원복** | 새 조합 4개·조합 연출 모두 v0.1로 되돌림 (V2-W1-04). 아래 조합 관련 결정은 기록 |
| 조합 슬로모션 | 게임 전체 시간을 늦추지 않고, 모인 두 블록이 `slowMs` 동안 천천히 커지는 연출로 대신한다 (V2-W1-02, 사용자 확인) |
| 테마 | Codex 시안 5개(사탕·우주·바다·공주·인형) → 사용자가 3개 선택 → 메인 화면에서 고름 |
| 별 3개 기준 (FEEDBACK R6) | 4주차 스테이지 재조정 때 같이 올린다 |

## 3. 특수 블록 조합 (1주차) — 원복됨

> 2026-11-05 사용자 결정: 1주차에 만든 새 조합 4개와 조합 연출을 해 보니 애매해서 **v0.1 그대로 원복**했다 (V2-W1-04). 코드는 커밋 `00d3d23` 시점과 같다. 아래는 만들었던 설계의 기록이다.


### 3.1 core 규칙

- **발동 조건**: `resolveSwap(a, b)`에서 스왑한 두 칸이 **모두 특수 블록**이면 매치 검사보다 먼저 조합으로 처리한다 (지금은 컬러 블록만 매치 없이 발동). 한쪽만 특수면 v0.1과 같다
- **발동 칸 `at`** = `b` (끌어온 블록이 도착한 칸). `partner` = `a`
- 조합 종류 (`ComboKind`, 순서는 판정 우선순위):

| 두 블록 | `ComboKind` | 지우는 칸 (보드 밖은 잘림) |
|---|---|---|
| 컬러 + 컬러 | `colorColor` | 보드 전체 (v0.1 그대로) |
| 컬러 + 슈퍼 | `colorSuper` | v0.1 W4-25 그대로: 슈퍼 블록 색 블록이 슈퍼로 변신 → 차례 발동 |
| 컬러 + 줄 | `colorLine` | v0.1 W4-25 그대로: 상대 색 블록이 줄로 변신 → 차례 발동 (가로·세로 섞기) |
| 컬러 + 폭탄 | `colorBomb` | v0.1 W4-25 그대로: 상대 색 블록이 폭탄으로 변신 → 차례 발동 |
| 폭탄 + 폭탄 | `bombBomb` | `at` 기준 5×5 |
| 줄 + 폭탄 | `lineBomb` | `at` 행 기준 위아래 3행 + `at` 열 기준 좌우 3열 |
| 슈퍼 + 줄·폭탄·슈퍼 | `superAny` | `at` 기준 슈퍼 범위(5×5 + 십자) ∪ 상대 효과. 상대가 줄이면 그 방향 줄, 폭탄이면 3×3, 슈퍼면 같은 범위 |
| 줄 + 줄 (방향 무관) | `lineLine` | `at`의 행 전체 + 열 전체 |

- v0.1 동작은 바뀌지 않는다. 지금 매치가 없어 되돌아가던 "컬러(무지개)가 아닌 특수 블록 둘" 스왑만 새로 조합이 된다
- 지운 범위 안의 다른 특수 블록은 v0.1처럼 연쇄 발동한다 (`chainActivate`, 차례 `depth` 1부터). 조합한 두 블록 자신은 다시 발동하지 않는다
- 점수: 조합으로 지운 블록은 특수 효과 제거와 같다 (`SCORE.bySpecial`, 연쇄 배율 그대로). 새 점수 값은 만들지 않는다
- 조합도 이동 1회 (스왑 한 번이므로 modes 변경 없음)

### 3.2 core 타입·이벤트

- `types.ts`: `export type ComboKind = 'lineLine' | 'lineBomb' | 'bombBomb' | 'colorLine' | 'colorBomb' | 'colorSuper' | 'colorColor' | 'superAny'`
- 새 이벤트 (`swap` 다음의 **독립된 step**에 하나만 둔다):

  ```ts
  { type: 'combo'; combo: ComboKind; at: Pos; partner: Pos; cleared: readonly Pos[] }
  ```

  `steps` 순서는 `[swap] → [combo] → [match, transform?, activate*, remove, create*, score] → [fall, refill]`이다. `BoardView.play`는 한 step의 이벤트를 `Promise.all`로 동시에 시작하므로, `combo`와 `remove`를 같은 step에 넣어서는 안 된다. `combo` step이 끝난 뒤 다음 step을 시작하면 모이기·슬로모션·이름 팝업이 제거보다 먼저 끝난다
  `cleared`는 **조합이 직접 겨냥한 칸**(조합한 두 칸 포함, 행 우선·중복 없음)이다. 컬러 조합에서는 컬러의 최초 대상 칸만 담고, 변신한 블록이나 휘말린 특수 블록의 후속 발동 범위는 담지 않는다. `colorLine`·`colorBomb`·`colorSuper`·`colorColor`의 계산 결과는 v0.1 그대로 두고, 뒤 step에 기존 `activate`(컬러)·`transform`·차례 `activate`를 낸다. 나머지 4개(`lineLine`·`lineBomb`·`bombBomb`·`superAny`)는 `combo.cleared`가 직접 제거 범위를 맡고, 휘말린 특수 블록만 `activate`(depth ≥ 1)로 나온다
- V2-W1-01에서는 `BoardView.playEvent`에 `combo`를 기다림 없는 no-op으로 처리해 타입 검사와 기존 보드 대조를 유지한다. V2-W1-02에서 이 분기를 실제 준비 연출로 교체한다. core 이벤트에는 시간 값을 넣지 않는다
- `engine.ts`: `Trigger`에 `{ kind: 'combo'; at; partner }` 추가. `specials.ts`: `comboKind(x, y)`, `comboArea(kind, at, board, partnerBlock)` 순수 함수
- `remove` 이벤트의 `bySpecial`은 조합 범위도 true
- DEV 대조(`view ↔ board`)와 `assertInvariants`는 그대로 통과해야 한다

### 3.3 연출 (view)

- `combo` step에서 두 블록이 `at`으로 모이는 모션 → 짧은 슬로모션(0.2~0.3초) → 조합 이름 팝업을 마친다. **다음 step**에서 범위 제거 + 파티클 + 흔들림을 시작하고, 뒤따르는 `activate`는 v0.1 차례 연출 그대로 재생한다. 컬러 조합의 `transform`은 준비 연출이 끝난 뒤 기존 지연 규칙을 따른다
- 흔들림: `lineLine` 약하게 … `colorColor` 가장 세게. `bombBomb`은 폭발 연출 두 번 (두 번째는 짧게 뒤에)
- 연출 중 입력은 지금처럼 resolve 재생 동안 막힌다
- 값은 `config.ts`의 `COMBO` 한 곳: 이름 문자열, `mergeMs`, `slowMs`, `nameMs`, 종류별 흔들림 세기, `bombBombSecondMs`
- 소리: 전용 효과음 `public/audio/combo.ogg` + `.m4a` (CC0 소리, `public/audio/CREDITS.md`). 마땅한 게 없으면 `special` 소리를 재사용하고 FEEDBACK에 남긴다
- 개발 URL 옵션 `?specials=pairs`: 8개 조합을 각각 한 번에 시험할 수 있게 특수 블록을 나란히 배치 (v0.1 `?specials=combo` 확장)

### 3.4 테스트

- `tests/core/combo.test.ts`: 8개 범주마다 고정 보드 → 지워진 칸 집합, `combo` 이벤트 필드·독립 step 순서, 연쇄 발동 depth, 서로 다른 색 두 특수 블록 스왑이 `valid`인지. `a→b`와 `b→a`를 모두 확인하고, 슈퍼 + 가로·세로줄은 어느 쪽을 끌어도 상대 방향이 맞는지 본다. 모서리에서 범위가 잘리는 경우, 조합한 두 블록의 재발동 방지, 이동 1회 소모도 확인한다
- 회귀: 한쪽만 특수인 스왑, 일반 매치, `?specials=combo`의 기존 컬러 + 줄·폭탄 결과가 v0.1과 같음 (컬러 + 슈퍼 포함)
- 결정성: 같은 seed + 같은 스왑 목록 → 같은 점수·보드 (기존 결정성 테스트에 조합 스왑 섞기)
- view: `combo` step이 끝나기 전에는 `remove`·`transform`·연쇄 `activate`가 시작되지 않는지 검증한다. 이벤트 → 연출 단계 목록을 만드는 순수 함수가 있으면 단위 테스트하고, 브라우저 390×844 `?specials=pairs`로 8개 캡처

## 4. 테마 (1~2주차)

### 4.1 시안 (1주차, Codex)

- 키워드 5개(사탕·우주·바다·공주·인형)마다 **시안 한 장**: 세로 화면 배경 위에 블록 7개(빨강·주황·노랑·초록·파랑·보라 + 무지개)를 늘어놓은 모습. 쿼터 때문에 시안 단계에서는 한 장씩만 받는다
- 지킬 것: 6색 계열 유지, 블록 몸통에는 얼굴을 그리지 않음(얼굴은 코드가 겹침, 가운데를 비워 둠), 글자 없음, 기존 게임·캐릭터·브랜드 닮지 않기
- 저장: `assets/theme-src/drafts/<키워드>.png`, 설명 `.codex-out/V2-W1-03-image.md`. 사용자가 3개를 고른다

### 4.2 최종 그림 (2주차, Codex)

- 고른 3개 테마마다 블록 몸통 7장(256×256 투명 PNG, 지금 `public/blocks/`와 같은 규격) + 배경 1장(지금 `public/backgrounds/storybook.jpg`처럼 세로, 1086×1448 정도)
- `assets/theme-src/<테마ID>/`에 저장 → 구현 탭이 `public/themes/<테마ID>/`로 옮기고 `CREDITS.md`

### 4.3 테마 구조 (2주차, 구현)

- 테마 목록은 새 파일 `src/view/theme/themes.ts` (그림 경로·배치 값이라 `config.ts` 규칙 대상 아님. 2주차에 `config.ts`는 장애물 태스크만 고친다. 기본 `storybook`은 지금 `DECOR.blockArt`·`DECOR.storybook`을 그대로 가리킨다). 테마마다 `id`, 이름, 블록 7장 경로와 배치 값(지금 `DECOR.blockArt`의 scale·faceDy·faceScale), 배경 경로와 `band`. 지금 그림책 테마가 `storybook`(기본)
- 저장: `settings.theme` (없거나 모르는 값이면 `storybook`). **저장 형식이 바뀐다** (`parseSave` 정규화 + 테스트)
- 읽기: BootScene이 모든 테마 그림을 읽고, 블록 텍스처 키에 테마 ID를 넣는다. 그림이 없으면 v0.1처럼 도형 폴백
- 메인 화면에 테마 버튼 → 테마 카드(이름 + 블록 3개 미리보기) 4개 중 선택 → 바로 메뉴 배경이 바뀜
- 개발 URL 옵션 `?theme=<ID>`

## 5. 장애물 (2주차)

SPEC 4절. v0.1 형식(`layout` 없음) 스테이지와 경쟁 모드는 장애물 없이 지금과 똑같이 동작해야 한다.

### 5.1 보드 표현

- `Board`에 칸마다 장애물 층 `layers?: readonly (CellLayer | null)[]` (index는 `cells`와 같음, 없으면 장애물 없음):

  ```ts
  interface CellLayer { readonly lock?: true; readonly frost?: 1 | 2 | 3; readonly jelly?: 1 | 2 }
  ```

- **얼음벽 칸은 블록이 없다** (`cells[i] = null`, `frost > 0`). 그래서 resolve 뒤 불변식은 "빈칸은 얼음벽 칸뿐"으로 바뀐다 (`assertInvariants`)
- **고정 칸** = 얼음벽 칸 + 잠긴 블록 칸. 고정 칸은 움직이지 않고 블록이 통과하지 못한다. 한 열은 고정 칸으로 나뉜 **구간**들로 본다
- 얼음벽에는 잠금·젤리를 같이 둘 수 없다. 잠금 + 젤리는 같이 둘 수 있다

### 5.2 규칙

| 장애물 | 스왑 | 매치 | 피해 | 다 없어지면 |
|---|---|---|---|---|
| 🔒 잠금 | 안 됨 (`isValidSwap` 거짓, 입력 무시) | 색으로 매치에 낀다 | 매치에 포함되거나 특수·조합 범위에 들면 **잠금만 풀림**, 블록은 남는다 (제거 아님 → 젤리 피해·색 수집 없음) | 보통 블록 |
| 🧊 얼음벽 1~3 | - | - | 같은 step에서 **상하좌우 이웃 칸이 매치로 제거**되거나 특수·조합 범위에 들면 1겹 감소. 한 step에 최대 1겹 | 빈칸 → 일반 낙하 |
| 🟪 젤리 1~2 | 영향 없음 | 영향 없음 | 그 칸의 블록이 **제거**될 때 1겹 감소 (step당 최대 1겹) | 일반 칸 |

- 매치 그룹의 특수 블록 생성 칸이 잠긴 칸이면 그룹에서 잠기지 않은 칸 중 `specialPosition` 규칙으로 다시 고른다. 다 잠겼으면 특수 블록을 만들지 않는다
- 잠금이 풀리는 블록은 매치에 끼었어도 제거되지 않는다. 그 블록이 특수 블록이면 발동하지 않는다 (잠금 해제가 먼저)
- 점수: 장애물 1겹(잠금 해제 1회, 얼음 1겹, 젤리 1겹)마다 `SCORE.obstacle` (새 값, 연쇄 배율 적용). 매치 그룹 점수는 v0.1 그대로 그룹 칸 수 기준
- 낙하(`applyGravity`): 구간마다 아래로 모은다. 잠긴 블록·얼음벽은 그 자리. 리필(`refill`): 구간마다 빈칸을 채우고, **구간 맨 위가 0행이 아니면 그 구간 맨 위 칸이 생성 지점**이다. `refill` 이벤트 블록에 `spawnTop: number`(구간 맨 위 행, 0이면 보드 위에서 떨어짐)를 더한다
- 수직 낙하만 (대각선 미끄러짐 없음, SPEC 4.2)
- 시작 보드·셔플: 얼음벽·잠긴 칸 위치는 스테이지대로 고정. 잠긴 블록 색은 seed로 정하되 시작 매치는 피한다. 셔플은 움직일 수 있는 블록만 섞는다. 가능한 수 검사는 잠긴 블록을 스왑 불가로 본다
- 모든 것은 seed + 입력으로 재현된다 (RNG 호출 순서를 테스트로 고정)

### 5.3 이벤트

- 새 이벤트 하나: `{ type: 'obstacle'; changes: readonly { at: Pos; kind: 'lock' | 'frost' | 'jelly'; hp: number }[] }` (`hp`는 피해 뒤 남은 겹, 0이면 사라짐. 잠금은 항상 0). `remove`와 같은 step에 둔다
- `ResolveResult`에 `clearedObstacles: { lock: number; frost: number; jelly: number }` (이번 수로 **완전히 없어진** 개수: 잠금 해제, 얼음벽 칸 0겹, 젤리 칸 0겹)

### 5.4 스테이지 형식과 미션

- `layout`(행 수만큼의 문자열, 각 길이 = `cols`)과 `layers`(문자 → 장애물 정의 또는 정의 배열). `.`은 빈 장애물. 정의: `{type:'lock'}`, `{type:'frost', hp:1~3}`, `{type:'jelly', hp:1~2}`. 예: `"K": [{"type":"lock"},{"type":"jelly","hp":1}]`
- 검증(`stageSchema.ts`, 위치를 담은 `StageError`): 행 수·길이, 정의 없는 문자, hp 범위, 얼음벽 + 다른 장애물, 얼음벽이 너무 많아 가능한 수가 없는 보드(로드 뒤 생성 실패로 잡음)
- 새 미션: `{type:'clearJelly'}`(보드의 젤리가 0이 되면 완료, 진행 = 지운 젤리 칸 / 처음 젤리 칸), `{type:'clearObstacle', obstacle:'lock'|'frost'|'jelly', count}`(`clearedObstacles` 누적). `clearJelly`는 layout에 젤리가 없으면 검증 오류
- 개발 URL 옵션 `?obstacles`: 잠금·얼음 1~3겹·젤리 1~2겹·잠금 + 젤리를 다 넣은 시험 스테이지(`clearJelly` 미션)를 바로 연다

### 5.5 연출 (V2-W2-05)

- 잠금: 블록 위 자물쇠·리본 겹침, 풀릴 때 튕겨 나감. 얼음벽: 칸을 채운 얼음 덩어리, 겹수에 따라 금이 늘고 깨질 때 조각. 젤리: 블록 아래 칸 바닥 색, 겹수에 따라 진하기. 그림은 우선 코드로 그리고(테마와 무관), 나중에 Codex 그림으로 바꿀 수 있게 한 곳에 모은다
- `spawnTop > 0`인 리필은 얼음벽·잠긴 블록 바로 아래에서 작게 나타나 커진다
- 미션 카드·패널에 젤리·장애물 아이콘과 남은 수
- DEV view ↔ board 대조에 장애물 층 포함

### 5.6 작업 순서와 분담

| 태스크 | 탭 | 파일 |
|---|---|---|
| V2-W2-01 파서·Board 층·불변식·시작 보드 | claude-1 | `src/core/types.ts`·`board.ts`·`moves.ts`, `src/data/stageSchema.ts`, `src/config.ts`(`SCORE.obstacle`) |
| V2-W2-02 잠금 → V2-W2-03 얼음벽 → V2-W2-04 젤리·미션 | claude-1 (차례로, 같은 core 파일) | `engine.ts`·`gravity.ts`·`specials.ts`·`moves.ts`, `src/modes/StoryMode.ts` |
| V2-W2-07 테마 구조·메인 화면 선택 | claude-2 (V2-W2-06 그림 받은 뒤) | `src/view/theme/themes.ts`(새)·`textures.ts`, `BootScene.ts`, `MenuScene.ts`, `src/storage/progress.ts` |
| V2-W2-05 장애물 연출 | claude-2 (V2-W2-04 main 반영 뒤) | `src/view/` 장애물 그림, `BoardView.ts`, 미션 카드·패널 |
| V2-W2-08 core 공유·시간 검증 PoC | 3주차 전에 (5.7) | |

- 2주차 동안 `config.ts`는 claude-1만 고친다. claude-2의 테마 값은 `themes.ts`에 둔다

### 5.7 V2-W2-08 PoC 준비 (확인 필요)

- 이 PC에 Deno·Docker·Supabase CLI가 없다. Edge Function이 `src/core`를 쓰는지 보려면 Deno(로컬 실행)만 있으면 되고, 실제 배포 시험은 ddooby-pang 전용 Supabase 프로젝트가 있어야 한다 (사용자가 만들고 키는 직접 넣음)
- 1차 PoC는 Deno로 `src/core`를 import해 같은 리플레이 로그의 점수가 Node(Vitest)와 같은지 보는 데까지. 프로젝트 생성은 3주차 시작 때

### 5.8 V2-W2-08 결정 (2026-11-06, PoC 결과 `scripts/server-poc/RESULT.md`)

**core 공유: 빌드 복사.** 리플레이 진입점을 rolldown(vite 8 포함)으로 ESM 한 파일로 묶어 `supabase/functions/_shared/replay.js`에 둔다. Deno의 sloppy import(확장자 없는 import 자동 해석)나 실험 기능(`--use-api`)에 기대지 않고, Supabase 권장 구조(`_shared/`) 그대로 배포된다. src는 고치지 않는다.
- 코어 `version` = 번들 sha256 앞 12자리. 리플레이에 쓰이는 코드·config 값만 남으므로 화면 값(애니메이션·색)을 바꿔도 버전이 안 바뀐다. 클라이언트 빌드는 같은 값을 상수로 넣는다. `public/stages/timeattack.json`의 보드 값도 번들 입력에 포함한다
- CI(`pages.yml`)가 번들을 다시 만들어 커밋본과 다르면 실패시킨다
- 근거: 1000개 랜덤 로그 Node↔Deno 1000/1000 일치(직접 import·번들 둘 다), 실제 브라우저 6판의 화면 점수 = 리플레이 점수(무효 스왑·셔플·타임 업 직전 스왑 포함). 판당 리플레이 1ms 미만

**리플레이 흐름** (`GameScene.trySwap`·`playFinale`와 같다): `createInitialState(seed)` → move마다 `resolveSwap`(무효면 상태·점수 그대로) → 끝에 `resolveFinale` 한 번 → 점수 합. 셔플은 core 안에서 seed RNG로 재현된다.

**클라이언트 기록 (3주차 구현 기준)**
- `trySwap`이 실제로 처리한 스왑만 기록한다: 유효·무효 모두. 재생 중(busy)이라 막힌 입력은 처리되지 않으므로 기록하지 않는다
- `t` = 제한 시간 − `timeLeftMs()`, 스왑 시작 때의 **게임 시간**(일시정지 시간 제외, ms 정수)
- 무효 스왑도 `swap`+`swapBack` 재생(약 240ms) 동안 입력이 막히므로 연속 간격 200ms 하한을 지킨다. 유효 스왑 뒤 실측 최소 간격은 433ms

**서버 판정** (하나라도 어기면 거부. SPEC 5.3·11절 5번)

| 항목 | 기준 |
|---|---|
| 서버 시각 하한 | `submit 도착 − start-run 발급` < 58초 → 거부 (게임 타이머는 벽시계보다 빠를 수 없다. 60초 − 오차 2초) |
| run 유효기간 | 발급 후 30분 이상 → 만료 거부. 30분 안의 일시정지는 허용 (일시정지는 게임 시간만 멈춘다) |
| move 시각 | 모든 `t`가 유한한 정수, `0 ≤ t < 60000`. 60초 이후 move가 하나라도 있으면 거부 (화면은 이런 move를 만들지 않는다) |
| move 간격 | 연속 두 move의 `t` 차이 ≥ 200ms (유효·무효 구분 없이). 같은 `t`·역순도 여기서 거부 |
| move 좌표 | 보드 안의 정수 좌표, 두 칸이 상하좌우로 이웃. 아니면 거부 (화면 입력으로는 만들 수 없다). 개수 상한은 간격 규칙으로 300개 |
| 점수 | 리플레이 점수 ≠ `clientScore` → 거부 |
| 버전 | `version` ≠ 서버 번들 버전 → 거부 + 새로고침 안내 |
| 재제출 | run은 점수 등록에 1회만. 제출 내용(`moves`·`clientScore`·`version`)의 해시를 run에 저장해, 같은 해시면 저장된 이전 결과를 그대로 돌려주고 다른 해시면 거부 |

**닉네임 순서**: 게임이 끝나면 점수를 먼저 제출·검증한다. 닉네임은 그 뒤 별도 요청으로 `profiles`에 저장하므로 입력이 늦어도 run 시간 판정에 영향이 없다. 닉네임이 없는 동안의 랭킹 표시 방식은 V2-W3-02·04에서 정한다.

**남은 확인 (3주차)**: Supabase Edge Runtime의 실제 배포(번들 import), 서버 시각 판정의 실제 지연 분포

## 6. 3~4주차 큰 틀 (자세한 설계는 그 주 시작 전에)

- **3주차 온라인**: PoC에서 정한 방식을 사용한다. `src/online/`에 인증·랭킹 클라이언트를 모으고, Supabase 마이그레이션은 `supabase/migrations/`에 둔다

### 6.1 3주차 준비 결정 (2026-11-06 사용자)

- 도구: Supabase CLI(Homebrew, 3.0.0)만 쓴다. 마이그레이션은 전용 프로젝트에 `supabase db push`로 올리고, 권한(RLS) 시험도 그 프로젝트에서 한다 (아직 사용자 없는 개발용). 로컬 Docker 스택은 쓰지 않는다
- 키: 개발은 `.env.local`(gitignore)에 `VITE_SUPABASE_URL`·`VITE_SUPABASE_PUBLISHABLE_KEY`를 사용자가 직접 넣는다. 배포 빌드는 GitHub 저장소 Variables의 같은 이름을 `pages.yml`이 읽는다. secret·service_role 키는 저장소·클라이언트·채팅에 두지 않는다 (Edge Function은 Supabase가 주입하는 환경 변수만 쓴다)
- 키가 없으면(로컬 빌드·포크) 온라인 기능만 꺼지고 게임은 그대로 된다
- 닉네임이 없는 사용자의 기록은 저장하되 랭킹에 보이지 않는다. 닉네임을 정하면 그때부터 보인다

### 6.2 V2-W3-01 스키마·RLS (`supabase/migrations/`)

| 테이블 | 열 (요지) | 클라이언트 권한 (anon·authenticated) |
|---|---|---|
| `profiles` | `id uuid PK → auth.users on delete cascade`, `nickname text null (2~10자)`, `tag int null (0~9999)`, `created_at`, `updated_at`. `unique (nickname, tag)` | SELECT 전체. **쓰기 없음** (닉네임은 금칙어 검사를 우회하지 못하게 Edge Function `set-nickname`만 쓴다, V2-W3-02) |
| `runs` | `id uuid PK default gen_random_uuid()`, `user_id → auth.users`, `seed int`, `mode text check ('timeattack')`, `version text`, `week_key text`, `created_at timestamptz default now()`, `submitted_at`, `submission_hash text`, `result jsonb` | SELECT 본인 것만. 쓰기 없음 (`start-run`·`submit-score`만) |
| `weekly_scores` | `user_id`, `week_key`, `best_score int ≥ 0`, `run_id → runs`, `updated_at`, `PK (user_id, week_key)`. 인덱스 `(week_key, best_score desc)` | SELECT 전체. **INSERT·UPDATE·DELETE 불가** |
| `stage_attempts` | `id bigserial`, `user_id default auth.uid()`, `stage_id int 1~999`, `result text check ('clear','fail')`, `moves_left int ≥ 0`, `score int ≥ 0`, `stars int 0~3`, `attempt_no int ≥ 1`, `created_at` | INSERT 본인(`user_id = auth.uid()`)만, SELECT 본인만 |

- 모든 public 테이블에 RLS를 켜고, 테이블 권한은 `revoke all` 뒤 위 표만 `grant`한다 (RLS와 GRANT 이중으로 막는다)
- 서버 쓰기는 Edge Function의 service role 연결로만 한다 (RLS 우회). 3주차 함수는 V2-W3-02·03에서 만든다
- 시험 (`scripts/supabase-check/`, `npm test`에 넣지 않음): 익명 로그인한 두 사용자 A·B로 ① `weekly_scores` INSERT·UPDATE·DELETE 실패 ② `profiles` UPDATE 실패, SELECT 성공 ③ B가 A의 `runs`를 못 읽음 ④ `stage_attempts`는 자기 것 INSERT 성공, 남의 `user_id`로 INSERT 실패, 남의 것 SELECT 0행. 비로그인(anon)은 쓰기 전부 실패. 시험이 만든 계정·행은 끝나면 남겨도 되는 개발 프로젝트지만 `stage_attempts` 시험 행에는 `stage_id = 999`를 써서 구분한다
- 사용자가 할 일: 대시보드에서 Anonymous Sign-ins 켜기, `.env.local`에 URL·publishable key 넣기, 터미널에서 `supabase login`·`supabase link --project-ref <ref>`(DB 비밀번호 입력)

### 6.3 V2-W3-02 익명 로그인·닉네임 (SPEC 5.1)

**구조** (의존 방향: `scenes → online`, `online`은 core·view·scenes를 모른다)

| 파일 | 하는 일 |
|---|---|
| `src/online/nicknameRules.ts` | 순수 함수. import 없음. `normalizeNickname`, `checkNickname(name) → {ok:true, nickname} \| {ok:false, code}`. 클라이언트(즉시 안내)와 서버(최종 판정)가 같은 파일을 쓴다 |
| `src/online/bannedWords.ts` | 직접 관리하는 짧은 금칙어 목록 (SPEC 5.1, 11절 4번) |
| `src/online/client.ts` | `import.meta.env`의 URL·publishable key로 supabase-js 클라이언트를 한 번만 만든다. 키가 없으면 온라인 기능 꺼짐 (`disabled`) |
| `src/online/account.ts` | `ensureAccount()`: 세션이 있으면 그대로, 없고 온라인이면 `signInAnonymously()`. 실패·오프라인이면 조용히 넘어가고 브라우저 `online` 이벤트와 다음 진입 때 다시 시도. 게임 시작을 기다리게 하지 않는다 |
| `src/online/profile.ts` | `getMyProfile() → {nickname, tag} \| null \| 'error'`(profiles SELECT), `setNickname(name) → 결과`(Edge Function `set-nickname` 호출) |
| `supabase/functions/set-nickname/index.ts` | 사용자 토큰 확인 → `checkNickname` → 태그 발급 → service role로 `profiles` upsert |
| `supabase/functions/_shared/nicknameRules.js` | `src/online/nicknameRules.ts`·`bannedWords.ts`를 rolldown으로 묶은 파일 (PLAN2 5.8 빌드 복사 방식). `npm run server:shared`로 만들고 CI가 다시 만들어 커밋본과 다르면 실패 |
| `src/view/NicknamePrompt.ts` | 닉네임 입력 창. Phaser에는 글자 입력이 없어 HTML `<input>`을 캔버스 위에 띄운다 (한글 조합 입력 지원). 제출 함수는 주입받는다 |
| `BootScene`·`ResultScene` | 부팅 때 `ensureAccount()` (기다리지 않음). 경쟁 모드 결과 화면에서 온라인·계정 있음·닉네임 없음이면 입력 창 |

**닉네임 규칙 (PM 확인 대상, 기본값)**
- 앞뒤 공백 제거, 유니코드 NFC 정규화. 길이 2~10자(코드 포인트 기준. 한글 완성형 1자 = 1)
- 쓸 수 있는 글자: 한글 완성형, 영문, 숫자. 공백·기호·이모지·자모 단독(ㅋㅋ)은 안 됨 → 보이지 않는 글자·흉내 글자로 금칙어를 피하는 길을 막는다
- 금칙어: 소문자로 바꾸고 숫자를 뺀 문자열에 목록 단어가 **포함**되면 거부 (`시1발` 같은 숫자 끼워 넣기 차단). 목록은 짧게 유지해 오탐을 줄이고, 통과해야 하는 흔한 이름 목록 테스트로 오탐을 막는다. 범주: 욕설·비속어 대표형과 흔한 변형, 성적 표현, 혐오·비하, 운영자 사칭(운영자·관리자·admin·공식)
- 태그: 같은 닉네임 안에서 겹치지 않는 0~9999 무작위, 화면에는 `#0427`처럼 4자리. 겹치면 다시 뽑는다(최대 20번, 실패 시 `server` 오류)
- 한 번 정하면 v0.2에서는 바꾸는 화면이 없다. 서버는 이미 닉네임이 있으면 `already-set`으로 거부

**set-nickname 응답**: 성공 `200 {nickname, tag}` / 규칙 위반 `400 {code: 'too-short'|'too-long'|'bad-chars'|'banned'}` / `401` 토큰 없음·무효 / `409 {code:'already-set'}` / `500 {code:'server'}`. CORS 허용 출처: `https://ddoobyddooby.github.io`, Capacitor `https://localhost`, 개발 `http://localhost:5173`. CORS와 별개로 토큰을 검사한다 (SPEC 8절)

**화면 흐름 (PM 확인 대상)**
- 경쟁 모드 결과 화면이 뜬 뒤 입력 창: "랭킹에 쓸 이름을 정해 주세요" / 입력칸 / [확인] [나중에]. V2-W3-03부터는 점수 제출·검증이 성공한 뒤에만 띄운다
- 확인 → 성공: "이안#0427 으로 정했어요" 후 닫힘 / 규칙 위반: 입력칸 아래에 이유(짧아요·길어요·한글·영문·숫자만·쓸 수 없는 말이에요) / 연결 실패: "지금은 연결이 안 돼요. 다음에 다시 물어볼게요" 후 닫힘
- [나중에] 또는 연결 실패 → 다음 경쟁 결과 때 다시 묻는다. 오프라인·키 없음·계정 없음이면 묻지 않는다
- 저장 형식(`progress.ts`)은 바꾸지 않는다. 닉네임은 서버에서 읽는다
- 입력 창 안내 (2026-11-07 PM): 저장 전 "한 번 정하면 바꿀 수 없어요", [나중에]를 누르면 "이름을 정하기 전까지 기록이 랭킹에 보이지 않아요"
- **배포 게이트**: 점수 제출(V2-W3-03) 전에 입력 창이 뜨면 랭킹에 등록된 것으로 오해할 수 있다. 그래서 V2-W3-02에서는 결과 화면 연결을 DEV 옵션 `?ranking`으로만 켠다. 배포본은 V2-W3-03에서 "점수 제출·검증 성공" 뒤에만 창을 켠다. 부팅 때 `ensureAccount()`(익명 계정 만들기)는 배포본에서도 돈다

**검증**: Vitest — 규칙·금칙어·통과 이름 목록, `ensureAccount` 상태 전이(가짜 클라이언트: 세션 있음/온라인 신규/오프라인/실패 후 재시도), set-nickname 처리 로직(가짜 DB: 성공·각 거부·태그 충돌 재시도·already-set), 입력 창 상태. `deno check`로 함수 타입 확인. 원격 시험 `npm run supabase:check`에 닉네임 항목 추가(정상·금칙어·짧음·already-set·토큰 없음 401·허용 안 된 출처 CORS·profiles 직접 UPDATE 여전히 실패). 브라우저 390×844: `?time=5` 경쟁 → 결과 → 입력 창 성공·거부·[나중에], 오프라인(네트워크 끊기)에서 창 없음·게임 정상

**분담**: claude-1 = `src/online/*`, `supabase/functions/*`, `scripts/` 묶음·원격 시험, package.json, CI. claude-2 = `src/view/NicknamePrompt.ts`(주입식) → claude-1 반영 뒤 `BootScene`·`ResultScene` 연결

### 6.4 V2-W3-03 `start-run`·`submit-score`와 서버 리플레이 (SPEC 5.2·5.3)

PoC(PLAN2 5.8, `scripts/server-poc/`)의 리플레이·판정을 src로 옮겨 실제 Edge Function 두 개를 만든다. 판정 기준(58초·30분·0~60초·200ms·좌표·점수·버전·재제출)은 5.8 표 그대로다.

**구조** (의존 방향: `scenes → replay → modes → core`, `scenes → online`. `online`은 여전히 core를 모른다)

| 파일 | 하는 일 |
|---|---|
| `src/replay/replay.ts` | PoC `replay.ts` 이동. `replayTimeAttack(seed, moves)`. 보드 값은 `public/stages/timeattack.json`을 import해 번들에 넣는다 (PoC의 `TIMEATTACK_BOARD` 상수와 대조 테스트를 없앤다) |
| `src/replay/judge.ts` | PoC `validate.ts` 이동. `judgeSubmission`·`JUDGE`·`RejectReason`. 아래 "판정 저장" 변경 하나만 더한다 |
| `src/replay/weekKey.ts` | `weekKey(ms) → '2026-W45'`: KST(UTC+9, 서머타임 없음) 날짜의 ISO 8601 주차. 월요일 00:00 KST에 바뀐다. import 없음 (V2-W3-04 랭킹 화면도 쓴다) |
| `src/replay/index.ts` | 서버 번들 진입점: 위 셋을 다시 내보낸다 |
| `src/replay/coreVersion.ts` | **자동 생성** `export const CORE_VERSION = '<12자>'`. 클라이언트가 제출에 넣는다. 번들 입력에 넣지 않는다 (자기 해시를 품을 수 없어서) |
| `scripts/server-shared/build.ts` | TARGETS에 `src/replay/index.ts → supabase/functions/_shared/replay.js` 추가. 묶은 코드의 sha256 앞 12자를 `CORE_VERSION`으로 번들 끝에 `export`로 붙이고 `src/replay/coreVersion.ts`도 쓴다. `:check`는 세 파일 모두 대조 |
| `supabase/migrations/<시각>_v2_w3_03_weekly_best.sql` | 함수 `public.record_weekly_best(p_user uuid, p_week text, p_score int, p_run uuid) returns int`: `insert … on conflict (user_id, week_key) do update set best_score = excluded.best_score, run_id = excluded.run_id where excluded.best_score > weekly_scores.best_score`, 그 주 최고 점수를 돌려준다. `security invoker`, `set search_path = ''`, execute는 `service_role`만 (PUBLIC·anon·authenticated revoke). 동시 제출에도 최고 점수만 남는다 |
| `supabase/functions/start-run/` | `index.ts`(Deno·DB) + `handler.ts`(순수, Vitest). 토큰 확인 → body `{version}`이 `CORE_VERSION`과 다르면 409 → seed = `crypto.getRandomValues` 0~999,999 → `runs` insert(`user_id, seed, mode 'timeattack', version, week_key = weekKey(now)`) → `200 {runId, seed}` |
| `supabase/functions/submit-score/` | 같은 나눔. 토큰 확인 → `runs`에서 `id = runId`·`user_id = 본인` 조회(없으면 404, 남의 run도 404) → `judgeSubmission(run, payload, {version: CORE_VERSION, issuedAtMs: created_at, submittedAtMs: now})` → 판정 저장 → 통과면 `record_weekly_best(user, run.week_key, score, run.id)` → 응답 |
| `src/online/runs.ts` | `startRun() → {runId, seed} \| null`(키 없음·오프라인·계정 없음·오류·**2.5초 초과**면 null), `submitScore(runId, {moves, clientScore, version}) → SubmitOutcome`. account·client 주입식 (`profile.ts`와 같은 모양) |
| `src/scenes/GameScene.ts` | 경쟁 모드에 run이 있으면 그 seed로 보드를 만들고, `trySwap`이 실제로 처리한 스왑(유효·무효)마다 `{from, to, t}` 기록. `t = timeLimitMs − timeLeftMs()`를 스왑 시작 때 정수 ms로. `finish()`에서 `submitScore`를 시작해 그 Promise를 Result에 넘긴다 (기다리지 않는다) |
| 경쟁 시작 경로 | `MenuScene`(경쟁 버튼)·`ResultScene`(다시하기)·`PauseScene`(다시하기)이 공통 함수 `startTimeAttack(scene)`을 쓴다: 버튼을 잠그고 "준비 중…"을 띄운 뒤 `startRun()`(최대 2.5초) → `scene.start('Game', {mode:'timeattack', run})`. null이면 run 없이(지금처럼 로컬 seed) 시작 |
| `src/scenes/ResultScene.ts` | 경쟁 결과에 등록 상태 한 줄: "랭킹에 올리는 중…" → 성공 "이번 주 최고 N점" / 실패 "랭킹에 올리지 못했어요 (점수는 저장됐어요)" / run 없음이면 줄 없음. **닉네임 입력 창은 제출 성공 뒤에만** 연다 (V2-W3-02의 DEV `?ranking` 게이트를 이것으로 바꾼다 → 배포본에서도 켜진다) |

**판정 저장** (5.8에서 한 가지만 바꾼다): 새 제출의 해시·결과·`submitted_at`은 `update runs … where id = ? and submission_hash is null`로 한 번만 쓴다 (0행이면 다른 요청이 먼저 썼으므로 다시 읽어 same/conflict 판정). 단 **`too-fast`는 저장하지 않는다**: 내용이 아니라 시각 때문의 거부라, 저장하면 같은 내용의 정상 재시도까지 영구히 막힌다. `expired`·내용 거부(점수 불일치 등)는 저장해 같은 내용이면 같은 거부를 돌려준다.

**submit-score 응답**: 통과 `200 {ok:true, score, best, weekKey, isNewBest}` (재제출 same이면 저장된 결과) / 판정 거부 `400 {ok:false, code: RejectReason}` (`version-mismatch`만 `409`, 클라이언트는 "새 버전이 있어요. 새로고침해 주세요") / `resubmit-conflict` `409` / run 없음·남의 run `404` / 토큰 `401` / `500 {code:'server'}`. CORS·토큰 검사는 set-nickname과 같다 (허용 출처 3개). 클라이언트 `SubmitOutcome` = `{kind:'ok', best, isNewBest} | {kind:'rejected', code} | {kind:'outdated'} | {kind:'failed'}`(네트워크·5xx·10초 초과)

**랭킹 대상이 아닌 판** (run 없이 로컬 seed): 오프라인·키 없음·`startRun` 실패·시간 초과, DEV `?seed`·`?time`·`?specials`(보드·시간이 서버와 다르다). 게임과 로컬 최고 점수는 지금처럼 저장된다 (SPEC 5.2)

**결정 필요 (PM 확인 대상, 기본값)**
- 주차: run **발급 시각**의 주에 넣는다. 일요일 23:59에 시작해 월요일 00:01에 제출한 판은 지난주 기록
- 메뉴에서 경쟁을 누르면 최대 2.5초 "준비 중…" 뒤 시작. 넘으면 랭킹 없이 바로 시작하고 결과 화면에서 "이번 판은 랭킹에 안 올라가요"
- 일시정지 → [다시하기]·[나가기]로 버린 run은 제출하지 않는다 (30분 뒤 만료). 하루 run 수 제한은 두지 않는다
- 결과 화면 문구 3가지(위 표)

**검증**
- Vitest: `tests/poc/*`를 `tests/replay/*`로 옮겨 그대로 통과. **SPEC 10절 1000개 랜덤 로그**: `randomLog(1~1000)`을 src `replayTimeAttack`과 배포 번들 `supabase/functions/_shared/replay.js`(Node에서 import)로 각각 돌려 점수·판정이 모두 같은지 새 테스트로 확인. Deno 쪽은 `npm run poc:deno`가 번들을 쓰도록 바꿔 1000/1000을 유지한다. `weekKey`(일 23:59:59 KST ↔ 월 00:00 KST 경계, 연말 W52/W53/W01, UTC 일요일 15:00 = KST 월요일). start-run·submit-score 처리 로직(가짜 DB: 정상·버전 불일치·남의 run·same·conflict·too-fast 미저장 뒤 재시도 통과·expired·점수 조작·최고 점수 아닐 때 best 유지). `runs.ts`(시간 초과·오프라인 null). GameScene 기록은 순수 함수로 빼서(`moveLog.ts`) t 계산·무효 스왑 포함 테스트
- `npm run functions:check`가 세 함수 모두 `deno check`. CI `server:shared:check`가 `replay.js`·`coreVersion.ts`까지 대조
- 원격 `npm run supabase:check -- .env.local --scores` (새 항목, 약 70초): ① start-run 200 ② 바로 제출 → too-fast ③ 60초 기다린 뒤 PoC 고정 로그를 그 seed로 리플레이한 점수로 제출 → 200, `weekly_scores` 반영 ④ 같은 내용 재제출 → 같은 200 ⑤ 다른 내용 → 409 ⑥ 점수 +10 조작(새 run) → score-mismatch ⑦ 버전 다름 → 409 ⑧ B가 A의 runId → 404 ⑨ 낮은 점수 새 run → best 그대로 ⑩ 클라이언트 `weekly_scores` 직접 INSERT·UPDATE 여전히 실패 ⑪ 클라이언트가 `record_weekly_best` RPC 호출 → 실패. 만료(30분)는 단위 테스트로만
- 브라우저 390×844 (DEV, `.env.local` 있음): 메뉴 → 경쟁 60초 한 판 → 결과에 "이번 주 최고 N점", 닉네임 없으면 입력 창. 대시보드 `weekly_scores`에 행. Network Offline으로 경쟁 → 바로 시작, 결과에 등록 줄 없음·로컬 최고 점수 갱신. `?seed=1`이면 랭킹 대상 아님

**분담** (파일이 겹치지 않게)
- claude-1: `src/replay/*`(PoC 이동, `scripts/server-poc`는 import만 바꿔 남긴다), `scripts/server-shared/build.ts`, 마이그레이션, `supabase/functions/start-run`·`submit-score`, `src/online/runs.ts`, `scripts/supabase-check/`, `tests/replay`·`tests/online`, ESLint(`src/replay/**`를 modes와 같은 순수 규칙으로), CI·package.json(`functions:check`)
- claude-2: `src/scenes/GameScene.ts`·`MenuScene`·`ResultScene`·`PauseScene`, 새 `src/scenes/startTimeAttack.ts`, `src/view/moveLog.ts`(또는 `src/modes/`), 결과 문구(`src/view/` 텍스트 파일). `runs.ts`는 위 시그니처로 가짜를 주입해 먼저 만들고, claude-1 반영 뒤 연결
- 원격 적용(마이그레이션 `db push`·함수 배포 2개)은 사용자 승인 뒤 PL이 한다

### 6.5 V2-W3-04 주간 랭킹 화면과 오프라인 플레이 (SPEC 5.2·10절)

2026-11-08 PL 초안(`.codex-out/V2-W3-04-plan.md`)을 PM이 기본값 그대로 확정했다. W3-03(6.4) main 반영·원격 적용 뒤에 구현한다.

**구조** (의존 방향 `scenes → view/online`, online은 core를 모른다)

| 파일 | 하는 일 |
|---|---|
| `supabase/migrations/<시각>_v2_w3_04_weekly_ranking.sql` | 함수 `public.weekly_ranking(p_week text default null)`. `security invoker`, `stable`, `set search_path = ''`, execute는 `anon, authenticated`. 표 권한·RLS는 그대로 (두 표 모두 이미 전체 SELECT) |
| `src/online/ranking.ts` | `fetchRanking(week?) → {kind:'ok', …} \| {kind:'offline'} \| {kind:'error'}`. 키 없음·오프라인·계정 offline이면 요청 없이 `offline`. `rpc('weekly_ranking')` 한 번, 5초 시간 초과·5xx·네트워크는 `error`. account·client 주입식 (`runs.ts` 모양) |
| `src/view/rankingRows.ts` | 순수 함수: 응답 → 화면 줄. TOP 50과 내 ±5를 나열 순번으로 합쳐 중복 제거, 순번이 끊기는 곳에 `⋯` 줄, 내 줄 표시, 상태별 안내 선택 |
| `src/view/rankingText.ts` | 랭킹 화면 문구 (W3-03에서 생긴 파일에 더한다) |
| `src/scenes/RankingScene.ts` | 제목·주 기간·목록(드래그 스크롤, `StageMapScene` 방식)·하단 내 순위 고정 줄·[새로고침]·[돌아가기]·필요하면 [이름 정하기] |
| `MenuScene`·`ResultScene`(경쟁) | 진입 버튼: 메뉴 "주간 랭킹", 경쟁 결과 "랭킹 보기". 기존 `addButton` 스타일, 새 그림 없음 |
| `src/config.ts` | 줄 높이·글자 크기·시간 초과 ms·색 |

**DB 함수 `weekly_ranking(p_week)`**
- `p_week`가 null이면 서버 시각으로 이번 주: `to_char(now() at time zone 'Asia/Seoul', 'IYYY-"W"IW')` (`src/replay/weekKey.ts`와 같은 규칙·`2026-W45` 형식). 기기 시계와 무관하게 월요일 00:00 KST에 바뀐다. 명시 week는 시험용
- 대상: 그 주 `weekly_scores` 중 `profiles.nickname is not null`만. 닉네임 없는 점수는 목록·순위 계산에서 빠지고 이름을 정하면 그때부터 보인다 (6.1)
- 나열 `best_score desc, updated_at asc, user_id` (같은 점수는 먼저 최고 점수에 도달한 사람이 위). 표시 순위는 `rank()` 공동 순위 (100, 90, 90, 80 → 1, 2, 2, 4)
- 반환 한 번에: `week_key`, `section`('top' 나열 1~50번째 / 'around' 내 위아래 5명 / 'me' 내 상태 1행), `rank`, `nickname`, `tag`, `best_score`, `is_me`. me: 닉네임·기록 있음 → rank, 기록 있으나 닉네임 없음 → rank null·점수, 기록 없음 → 행 없음. anon은 around·me 없음
- user_id는 돌려주지 않는다 (is_me로만 구분). 한 사람은 PK `(user_id, week_key)`로 한 주 1행

**화면 상태와 문구 (PM 확정)**

| 상태 | 판단 | 화면 |
|---|---|---|
| 불러오는 중 | 요청 중 | "불러오는 중…" (0.3초 넘을 때만) |
| 연결 불가 | `offline` | "인터넷에 연결되면 랭킹을 볼 수 있어요" + [다시 시도] |
| 오류 | `error` | "랭킹을 불러오지 못했어요" + [다시 시도] |
| 빈 주 | top 0행 | "이번 주 첫 기록을 남겨 보세요!" |
| 목록 | top ≥ 1행 | TOP 50, 내 순번이 51 이후면 `⋯` 뒤 내 ±5. 내 줄은 연한 노랑 바탕·굵게. 1~3위 순위 숫자는 금·은·동 색 |
| 내 기록 없음 | me 없음 | 하단 고정 줄 "이번 주 기록이 없어요" |
| 닉네임 없음 | me.rank null | 하단 "N점 · 이름을 정하면 랭킹에 보여요" + [이름 정하기] → 결과 화면과 **같은 `NicknamePrompt`·같은 규칙**. 성공하면 목록을 다시 불러온다 |

- 줄: `12  이안#0427  15,320`. 주 기간 "11월 2일(월) ~ 11월 8일(일)" (weekKey에서 계산). 이번 주만 보여 준다
- 390×844: 줄 약 44px, 한 화면 11~12줄 → 드래그 스크롤. 10자 닉네임 + `#0000` + 6자리 점수가 한 줄에 들어간다. 하단 내 줄은 고정. 버튼 터치 영역 44px 이상
- 글꼴: Jua 서브셋(상용 2,350자) 밖의 드문 한글은 그 글자만 기본 글꼴로 보인다. 그대로 둔다 (FEEDBACK)

**오프라인 플레이 (SPEC 10절)**: W3-02·03에서 이미 계정·run을 기다리지 않고 로컬 seed·로컬 저장으로 진행한다. W3-04는 수용 시험으로 확인한다: Network Offline으로 시작 → 스토리 1판·경쟁 1판 끝까지 → 로컬 최고 점수·별 갱신 → 랭킹 "연결 불가" → 온라인 복귀 후 [다시 시도]로 목록. 키 없는 빌드도 같은 흐름

**검증**
- Vitest `rankingRows`: TOP 50만, 내가 7·50·51·56·200위, top·around 겹침 중복 제거, `⋯` 위치, 공동 순위 2·2·4, 닉네임 없음·기록 없음·anon, 빈 주, 10자 닉네임. `ranking.ts`: offline·error(5초·5xx·네트워크)·정상 매핑. 주 기간 문자열(W53·W01)
- PGlite: 서버 주 계산 = `weekKey()` (일 23:59:59 KST ↔ 월 00:00 KST, UTC 일요일 15:00), 닉네임 없는 행 제외, 동점 순서·공동 순위, around 경계(1위·꼴찌·51위), anon 호출
- 원격 `npm run supabase:check -- .env.local --ranking`: anon 호출 성공·me 없음, 닉네임 있는 시험 사용자 목록·is_me, 닉네임 없는 시험 사용자 목록 제외·me.rank null, 먼 과거 주 0행, 클라이언트 `weekly_scores` 직접 쓰기 실패. 기록은 `--scores` 경로로 만든다
- 브라우저 390×844: DEV `?fakeranking=`(60명·내가 57위·동점·10자 닉네임·빈 주·오류·느림·닉네임 없음) 캡처, 실서버 1회, 오프라인 수용 시험

**분담**: claude-1 = 마이그레이션, `src/online/ranking.ts`, `scripts/supabase-check`(`--ranking`), PGlite 확인, tests/online. claude-2 = `src/view/rankingRows.ts`·문구, `RankingScene`, 메뉴·결과 진입 버튼, DEV `?fakeranking`, 브라우저 확인·오프라인 수용 시험. 원격 적용(마이그레이션·`--ranking`)은 PL

### 6.6 V2-W4-01 기존 1~30 재조정 (SPEC 6절, FEEDBACK R6)

코드 변경 없이 `public/stages/story.json` 데이터와 측정 도구·데이터 테스트만 바꾼다. 장애물 규칙·미션·화면은 2주차(V2-W2-01~05)에 이미 있다.

**기준선** (2026-11-08, `npm run stages:sim` 300판, 장애물 없음): 봇 클리어율 1~10번 45~96%, 11~20번 28~77%, 21~30번 16~44%. 봇의 별 3개 비율은 2~18%로 이미 낮은데 시범 플레이에서는 "별 3개가 쉽다"(R6)였다. 봇(첫 번째 힌트만 두는 단순한 봇)은 아이보다 훨씬 약하므로 **봇 수치를 SPEC 6절의 사람 목표(80%·50%·35%)에 그대로 맞추지 않는다**. 봇 목표는 아래 별도 기준을 쓰고, 사람 기준은 V2-W4-03(조카 2차 테스트)에서 확인한다.

**구간별 설계** (SPEC 6절 표 그대로)

| 구간 | 장애물 (처음 등장) | 색 | 미션 | 이동 |
|---|---|---|---|---|
| 1~10 입문 | 없음 | 지금 그대로 (4~6) | 지금 그대로 | **10~15% 줄인다** |
| 11~15 잠금 | 🔒 잠금 (**11번**에 처음) | 5 | 기존 미션 + `clearObstacle lock` 섞기 | 줄인다 |
| 16~20 얼음벽 | 🧊 얼음 1겹 (**16번**) → 2겹 | 5 → 6 | `clearObstacle frost` 섞기 | 줄인다 |
| 21~25 젤리 | 🟪 젤리 (**21번**) + 앞의 장애물 섞기 | 6 | `clearJelly` 포함 | 줄인다 |
| 26~30 종합 | 3종 혼합, 얼음 **3겹** | 6 | 혼합 | 빠듯하게 |

- 리듬: 5의 배수(5·10·…·30)는 "보스"로 앞 판보다 어렵게, 그다음 판(6·11·16·21·26)은 "휴식"으로 쉽게. 새 장애물이 처음 나오는 11·16·21번은 휴식 판이라 장애물을 적게(몇 칸) 놓아 익히게 한다
- 처음 등장 순서를 지킨다: 10번까지 장애물 없음, 15번까지 잠금만, 20번까지 잠금·얼음만. 데이터 테스트가 막는다
- 배치는 `layout` 문자열 그리드(SPEC 4.3). 대칭에 가깝게, 시작 보드에 가능한 수가 있어야 한다(엔진이 보장하는지 테스트로 확인)

**봇 목표 클리어율 (결정 필요, 기본값)**: 1~10번 **65~80%**, 11~20번 **40~55%**, 21~30번 **25~40%**. 구간 안에서는 천천히 내려가고, 보스는 앞 판보다 5~10%p 낮게, 휴식은 높게. 근거: 지금 1~10번(봇 45~96%)이 "쉽다"였으므로 봇 수치를 조금 내리되, 장애물이 새로 들어가는 11번 이후는 너무 가파르지 않게

**별 기준 (결정 필요, 기본값, R6 상향)**: 별 1 = 클리어(점수 미션이면 그 목표), 별 2 = 봇 **클리어 판 점수 70%** 지점, 별 3 = 봇 **클리어 판 점수 95%** 지점 (지금은 대략 50%·80% 지점). 이미 받은 별은 저장값이라 줄지 않는다. 측정 도구가 클리어 판 70·95% 지점을 함께 출력하게 한다

**측정·테스트**
- `scripts/sim/`: 표에 장애물 요약(종류·칸 수·겹), 장애물 미션 진행, 클리어 판 70·95% 점수 열을 더한다. 최종 표는 seed 1~1000으로 잰다
- `tests/data/storyStages.test.ts`(새 파일): 30개 모두 스키마 통과, 장애물 첫 등장 순서(위 규칙), 구간별 색 수, 11·16·21번에 해당 장애물이 실제로 있음, 몇 개 seed로 시작 보드에 가능한 수가 있음, 별 기준이 오름차순
- 브라우저 390×844: 11·16·21·26·30번 미션 카드와 첫 화면 캡처, 각 판 `?demo`로 끝까지 진행(오류·`view ≠ board` 없음)

**Codex 투입: 생략.** 장애물 규칙·미션 코드는 2주차에 이미 테스트됐고 이번엔 데이터와 측정 도구만 바뀐다. 데이터 테스트·시뮬레이션·화면 확인으로 메인이 검증한다 (WORKFLOW 8.1)

**분담** (같은 파일을 나누지 않는다)
- claude-1: `public/stages/story.json` 30개 재조정 (위 표·목표대로 시뮬레이션하며 숫자 조정), 결과 표를 보고
- claude-2: `scripts/sim/` 출력 확장, `tests/data/storyStages.test.ts`, 브라우저 캡처. 도구가 먼저 끝나면 claude-1이 그 도구로 최종 측정한다
- 메인: 결과 표·별 기준 근거를 이 절에 남기고 TASKS 확인

**진행 중 바뀐 결정** (2026-11-08~09, PL. 사용자는 봇 목표·별 기준 기본값을 확정했고 아래 측정 방법 변경은 보고함)
1. **측정 봇 두 개.** 첫 힌트 봇(왼쪽 위부터 찾은 첫 수)은 장애물을 무시해 아래쪽 장애물 미션을 거의 못 깬다(잠금 4개: 위쪽 84% / 아래쪽 3%). 그래서 1~10번(장애물 없음)은 첫 힌트 봇, 11~30번은 **미션 의식 탐욕 봇**으로 잰다. 탐욕 봇은 아이보다 강하므로 11~30번 봇 목표를 사람 목표보다 높게 바꿨다: 11~20번 **60~75%**, 21~30번 **45~60%** (1~10번은 그대로 65~80%). 장애물을 봇에 맞춰 위쪽에 몰지 않는다
2. **탐욕 봇은 미리보기 없음.** 후보 수의 가치를 `resolveSwap` 결과 전체가 아니라 첫 `refill` 이벤트 전까지(첫 매치와 그때 터진 특수 블록)만 센다. 리필로 들어올 블록과 그 뒤 연쇄는 seed RNG라 사람이 볼 수 없다 (`scripts/sim/greedyBot.ts` `seenBeforeRefill`, 가중치 `GREEDY_WEIGHTS`). `SIM_BOT=first|greedy|both`(기본 both)
3. **11~30번 이동은 원래 −10% (25~32회), 난이도는 미션 양으로.** 이동을 17~23회까지 줄이는 안은 W4-27의 "판을 길게" 의도와 어긋나서 버렸다. 대신 11~17번 모을 개수가 원래의 1.5~2.8배다 → V2-W4-03 사람 테스트에서 확인
4. **미션은 판마다 최대 2개.** 미션 카드·HUD가 `HUD.story.maxGoalLines`(2)줄만 보여 3번째 미션이 안 보였다(16번 화면 확인에서 발견). 장애물 판은 장애물·젤리 미션 + 기존 미션 하나. 데이터 테스트가 `goals.length ≤ maxGoalLines`를 막는다

**결과** (main `37b6607`~`7a0f35a`, `npm run stages:sim` SIM_BOT=both 1000판. 클리어율·별 비율은 기준 봇: 1~10 첫 힌트, 11~30 탐욕)

| # | 색 | 이동 | 미션 | 장애물 | 클리어율 (첫 / 탐욕) | 별 (1 / 2 / 3) |
|---|---|---|---|---|---|---|
| 1 | 4 | 33 | 4,200점 | - | **80%** / 100% | 4,200 / 11,400 / 13,700 |
| 2 | 4 | 33 | 4,400점 | - | **78%** / 100% | 4,400 / 11,600 / 13,800 |
| 3 | 4 | 29 | 빨강 45 | - | **78%** / 100% | 3,600 / 10,100 / 13,500 |
| 4 | 5 | 33 | 2,100점 | - | **78%** / 100% | 2,100 / 6,600 / 7,900 |
| 5 | 5 | 29 | 노랑 26 | - | **71%** / 100% | 1,900 / 5,100 / 6,300 |
| 6 | 5 | 29 | 빨강 22 + 파랑 22 | - | **77%** / 100% | 1,900 / 4,900 / 6,100 |
| 7 | 5 | 26 | 1,500점 + 초록 18 | - | **76%** / 100% | 1,500 / 4,900 / 5,900 |
| 8 | 6 | 26 | 1,200점 | - | **76%** / 99% | 1,200 / 4,200 / 5,200 |
| 9 | 6 | 24 | 보라 13 + 주황 12 | - | **70%** / 99% | 1,200 / 3,300 / 4,100 |
| 10 | 6 | 24 | 1,100점 + 빨강 13 | - | **64%** / 98% | 1,100 / 3,600 / 4,400 |
| 11 | 5 | 32 | 보라 64 + 잠금 4 | 잠금 4 | 0% / **73%** | 6,900 / 10,000 / 12,100 |
| 12 | 5 | 30 | 6,500점 + 잠금 8 | 잠금 8 | 2% / **72%** | 6,500 / 9,700 / 11,400 |
| 13 | 5 | 30 | 초록 58 + 잠금 10 | 잠금 12 | 1% / **70%** | 6,500 / 9,500 / 11,700 |
| 14 | 5 | 29 | 파랑 56 + 잠금 8 | 잠금 8 | 0% / **67%** | 6,300 / 9,100 / 11,200 |
| 15 | 5 | 27 | 보라 50 + 잠금 12 | 잠금 12 | 1% / **62%** | 5,800 / 8,800 / 10,800 |
| 16 | 5 | 28 | 빨강 58 + 얼음 4 | 얼음 4 | 1% / **73%** | 6,100 / 9,200 / 11,400 |
| 17 | 5 | 27 | 노랑 57 + 얼음 6 | 잠금 4·얼음 6 | 1% / **68%** | 6,400 / 9,400 / 11,500 |
| 18 | 6 | 27 | 빨강 27 + 얼음 8 | 얼음 4·얼음2×4 | 3% / **65%** | 2,900 / 5,300 / 6,900 |
| 19 | 6 | 26 | 파랑 24 + 얼음 4 | 잠금 8·얼음2×4 | 3% / **66%** | 3,100 / 5,200 / 6,700 |
| 20 | 6 | 25 | 주황 23 + 얼음 6 | 잠금 8·얼음2×8 | 4% / **60%** | 3,200 / 5,100 / 6,500 |
| 21 | 6 | 28 | 젤리 전부 + 초록 31 | 젤리 8 | 1% / **59%** | 3,200 / 5,600 / 7,100 |
| 22 | 6 | 29 | 젤리 전부 + 파랑 27 | 잠금 4·젤리 24 | 0% / **57%** | 4,400 / 6,600 / 8,400 |
| 23 | 6 | 27 | 젤리 전부 + 노랑 28 | 얼음 4·젤리 16 | 0% / **55%** | 3,900 / 6,000 / 7,400 |
| 24 | 6 | 27 | 젤리 전부 + 빨강 30 | 잠금 4·얼음2×4·젤리 8·젤리2×4 | 0% / **55%** | 4,200 / 6,400 / 8,000 |
| 25 | 6 | 26 | 젤리 전부 + 파랑 23 | 잠금 4·얼음2×2·젤리 16·젤리2×4 | 0% / **46%** | 4,400 / 6,300 / 7,600 |
| 26 | 6 | 29 | 젤리 전부 + 3,700점 | 잠금 2·얼음3×2·젤리 4 | 4% / **58%** | 3,700 / 6,000 / 7,900 |
| 27 | 6 | 27 | 젤리 전부 + 보라 23 | 잠금 4·얼음3×2·젤리 10·젤리2×2 | 0% / **57%** | 3,900 / 6,200 / 7,800 |
| 28 | 6 | 26 | 젤리 전부 + 초록 23 | 잠금 4·얼음2×2·얼음3×2·젤리 12·젤리2×4 | 0% / **57%** | 4,100 / 6,300 / 7,500 |
| 29 | 6 | 26 | 젤리 전부 + 노랑 23 | 잠금 4·얼음2×2·얼음3×2·젤리 8·젤리2×4 | 1% / **55%** | 3,800 / 5,900 / 7,400 |
| 30 | 6 | 25 | 젤리 전부 + 주황 25 | 잠금 4·얼음2×2·얼음3×2·젤리 18·젤리2×4 | 1% / **49%** | 4,400 / 6,500 / 8,000 |

- **1~10번 별 3개 완화 (V2-W4-01b, 2026-11-09 사용자 결정)**: 사용자가 실기기에서 스테이지 1을 4판 해 별 2개가 최대였다. 점수 미션은 목표에 닿는 순간 끝나 남은 이동 보너스(1회 300점)만 더해지므로, 95% 지점(18,000점)은 큰 연쇄 운에 달렸다. 1~10번 별 3개만 첫 힌트 봇 클리어 판 점수의 **85% 지점**으로 내렸다(위 표 값, 전: 18,000·18,100·18,100·9,600·7,500·7,800·7,300·6,400·5,100·5,400). 봇 별 3개 비율 3~4% → 10~12%. 별 1·2개와 11~30번은 그대로 (main `ecfc783`)
- **11~30번 별 2·3개 완화 (V2-W4-01c, 2026-11-11 사용자 결정)**: 사용자가 11번 이후를 해 보니 별 1~2개가 최대였다. 11~30번 기준 봇(탐욕 봇)은 아이보다 강한데 그 봇의 클리어 판 70%·95% 지점이라 사람에게는 1~10번보다 더 빡빡했다(봇 별 3개 비율 2~4%). 별 2를 탐욕 봇 클리어 판 점수의 **50% 지점**(`clearP50`), 별 3을 **80% 지점**(`clearP80`)으로 내린다. 별 1, 이동·미션·장애물(클리어율)은 그대로. 측정은 `npm run stages:sim` 1000판, 위 표의 11~30번 별 값은 이 변경 뒤 값이다(전 값: 별 2 = 5,900~11,300, 별 3 = 8,100~14,600). main `e8ceccb`, 탐욕 봇 클리어율·클리어 판 점수 분포는 전후 같고, 탐욕 봇 별 3개 비율 3~4% → 9~15%, 별 2개 이상 14~22% → 23~37%(전체 판 대비). 결과 화면에서 클리어 판의 새 별 표시는 demo 봇이 11~30번을 거의 못 깨서 브라우저로는 못 봤다(`starsFor` 단위 테스트로 검증)
- **별 기준 상향 근거 (R6)**: 별 2·3을 기준 봇 클리어 판 점수의 50%·80% 지점에서 **70%·95% 지점**으로 올렸다. 기준 봇의 별 3개 비율은 1~10번 3~4%, 11~30번 2~4% (전에는 첫 힌트 봇으로 2~18%). 별 1 값은 표시용이고 클리어하면 별은 최소 1개(`starsFor`)
- **목표 범위 밖·리듬 어긋남**: 10번 64%(하한 65%보다 1%p 낮음, 9번과 보스 차이를 지키느라). 21번(휴식 59%) < 20번(보스 60%)은 두 구간 목표가 달라서. 23·24번, 28·29번은 하강이 평평하다(모을 개수 1개당 2~3%p씩 움직여 더 촘촘히 맞추기 어려움)
- 11~30번을 첫 힌트 봇으로 돌리면 0~4%다. 사람 수치는 V2-W4-03에서 이 두 봇 수치와 비교해 보정한다
- 화면: 11·16·21·26·30번 `?stage=N&demo` 끝까지 진행, 콘솔 오류·`view ≠ board` 0, 미션 2개가 카드·HUD에 모두 보임 (캡처 `.playwright-mcp/v2w401-2g-stage*.png`)
- Codex 투입 생략 (6.6 위 이유). 메인이 데이터 테스트·시뮬·캡처로 검증

- **4주차 재조정**: 1~30 데이터(이동·장애물·색), `npm run stages:sim`에 장애물 반영, **별 3개 기준 상향 (FEEDBACK R6)**, 플레이 로그 → 조카 2차 테스트

### 6.7 V2-W4-02 `stage_attempts` 플레이 로그 (SPEC 6.1)

**결정 (2026-11-09 사용자)**
- 오프라인·실패한 기록은 **버린다** (모아 두었다 나중에 보내지 않는다). 게임은 기다리지 않는다
- `attempt_no`: 스테이지별로 **끝까지 한 판(클리어·실패)만** 센다. 중간에 나간 판(일시정지 → 지도·다시하기)은 세지 않는다. 기기의 저장값에 스테이지별 횟수를 둔다 (보내기에 실패해도 횟수는 오른다 → 서버에서 번호가 빠질 수 있다)

**구조**
| 파일 | 변경 |
|---|---|
| `src/storage/progress.ts` | `SaveData.story.attempts: Record<number, number>` 추가. `parseSave`는 없거나 잘못된 값을 버리고 `{}`로 채운다 (version 1 그대로, 기존 `bestStars` 방식). `applyModeResult`가 스토리 결과마다 그 스테이지 횟수 +1 |
| `src/online/attempts.ts` | `logStageAttempt(row)`: 키 없음·오프라인·계정 없음이면 바로 끝. 아니면 `stage_attempts`에 INSERT (`user_id`·`created_at`·`id`는 서버 기본값, 클라이언트가 보내지 않음). 최대 5초, 어떤 실패도 throw하지 않는다 |
| `src/online/index.ts` | `logStageAttempt` 공개 |
| `src/scenes/GameScene.ts` `finish()` | 스토리 결과면 저장 뒤 `logStageAttempt({stage_id, result: cleared ? 'clear' : 'fail', moves_left, score, stars, attempt_no})`를 기다리지 않고 호출. `moves_left`는 끝난 순간 남은 이동 수(보너스로 바꾸기 전 값) |

- **보내지 않는 판**: DEV 시험 스테이지(`?obstacles` 등 `devStage`), `?demo` 자동 플레이, DEV 빌드(개발 중 플레이가 자료를 흐리지 않게. DEV에서 시험할 때만 `?attemptlog`로 켠다)
- 클라이언트 로그는 참고 자료다 (SPEC 6.1). 서버 검증·중복 제거는 하지 않는다

**검증**: Vitest — parseSave 옛 저장값·잘못된 attempts, applyModeResult 횟수 증가(스토리만, 경쟁 제외), logStageAttempt(가짜 백엔드: 성공·키 없음·오프라인·계정 없음·오류·시간 초과에서 throw 없음, 보내는 열이 6개 + 서버 기본값 열 없음), 보내지 않는 판 판정 함수. 원격: `?attemptlog&stage=1` 끝까지 → `npm run supabase:check`의 새 항목 또는 대시보드에서 본인 행 확인. 브라우저: 오프라인에서 스토리 끝까지·결과 화면 정상

## 7. 리스크

- 조합이 너무 세서 쉬워짐 → 4주차 재조정에서 이동 수로 맞춘다. `superAny` 밸런스는 SPEC 11절 3번
- 테마 그림 7장 × 3세트의 크기 차이 → 테마마다 배치 값을 따로 둔다 (4.3)
