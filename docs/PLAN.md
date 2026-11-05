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

## 6. 3~4주차 큰 틀 (자세한 설계는 그 주 시작 전에)

- **3주차 온라인**: PoC에서 정한 방식을 사용한다. `src/online/`에 인증·랭킹 클라이언트를 모으고, Supabase 마이그레이션은 `supabase/migrations/`에 둔다
- **4주차 재조정**: 1~30 데이터(이동·장애물·색), `npm run stages:sim`에 장애물 반영, **별 3개 기준 상향 (FEEDBACK R6)**, 플레이 로그 → 조카 2차 테스트

## 7. 리스크

- 조합이 너무 세서 쉬워짐 → 4주차 재조정에서 이동 수로 맞춘다. `superAny` 밸런스는 SPEC 11절 3번
- 테마 그림 7장 × 3세트의 크기 차이 → 테마마다 배치 값을 따로 둔다 (4.3)
