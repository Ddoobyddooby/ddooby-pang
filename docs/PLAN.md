# ddooby-pang PLAN (v0.1 MVP)

> 상태: Draft · 작성일: 2026-10-28 · 기준 문서: [`SPEC.md`](../SPEC.md)
> 이 문서는 SPEC을 **어떻게** 구현할지 정의한다. 작업 단위와 진행 상황은 [`TASKS.md`](./TASKS.md)에서 관리한다.

---

## 1. 구현 원칙

1. **core 먼저, 화면은 나중에.** `src/core/`가 테스트로 검증된 뒤에 Phaser를 붙인다.
2. **core는 순수 함수 + 불변 상태.** `(state, action) → { state, events }`. Phaser, DOM, `Math.random`을 import하거나 호출하지 않는다.
3. **랜덤은 seed RNG 하나로만.** 같은 seed + 같은 입력이면 항상 같은 결과가 나와야 한다 (재현 가능한 버그 리포트, 결정적 테스트).
4. **수치는 `config`에서.** 점수, 배율, 애니메이션 시간을 코드에 박지 않는다.
5. **view는 이벤트 재생기.** view는 상태를 직접 계산하지 않고 core가 준 이벤트 목록을 순서대로 트윈으로 재생한다.

## 2. 오픈 이슈 잠정 결정

SPEC 11절의 오픈 이슈는 아래 기본값으로 진행하고, 플레이 테스트 후 바꾼다. 바꿔도 영향이 `core/specials.ts`와 `view/input.ts`에 국한되도록 설계한다.

| # | 이슈 | 잠정 결정 | 이유 |
|---|---|---|---|
| 1 | 특수 블록: 개수 vs 모양 | **SPEC 4.5 혼합안 그대로** (4I / 5L·T / 5I / 6+) | 캔디크러시와 가장 비슷하고, 판정 함수 하나로 분리돼 교체가 쉽다 |
| 2 | 스왑 입력 | **스와이프 + 탭-탭 둘 다** | 조카(어린 사용자)는 탭이 더 쉬울 수 있다. 구현 비용 차이가 작다 |
| 3 | 블록 그래픽 | **'말랑 친구들'** (색 + 모양 + 얼굴 3표정), 달콤 디저트 테마. 2026-11-03부터 몸통은 Codex 생성 그림(그림책 A안, 6.16), 얼굴·특수 배지는 코드로 그린다 — [설계](./superpowers/specs/2026-10-29-theme-and-fx-design.md) | 캔디크러시와 구분되는 개성, 에셋·라이선스 관리 없음, 텍스처로 구워 성능 확보 |
| 4 | 경쟁 모드 시간 추가 | **없음** (SPEC대로) | v0.2 |

## 3. 프로젝트 구조

```
ddooby-pang/
├── public/
│   └── stages/
│       ├── story.json          # 스테이지 1~20 배열
│       └── timeattack.json     # 경쟁 모드 설정 1개
├── src/
│   ├── main.ts                 # Phaser.Game 생성, Scene 등록
│   ├── config.ts               # 점수·배율·애니메이션 시간
│   ├── core/                   # ★ 순수 TS, Phaser import 금지
│   │   ├── types.ts            # Cell, Block, Board, GameEvent ...
│   │   ├── rng.ts              # seed 기반 PRNG (mulberry32)
│   │   ├── board.ts            # 생성, 조회, 복사 유틸
│   │   ├── matcher.ts          # 매치 탐색 + 그룹 병합
│   │   ├── specials.ts         # 그룹 → 특수 블록 결정, 발동 범위 계산
│   │   ├── gravity.ts          # 낙하 + 리필
│   │   ├── moves.ts            # 가능한 수 탐색, 셔플
│   │   ├── scoring.ts          # 점수 계산
│   │   └── engine.ts           # resolveSwap: 전체 처리 루프 오케스트레이션
│   ├── modes/
│   │   ├── GameMode.ts         # 공통 인터페이스
│   │   ├── StoryMode.ts        # 이동 제한, 미션, 별
│   │   └── TimeAttackMode.ts   # 60초, 최고 점수
│   ├── data/
│   │   ├── stageSchema.ts      # 스테이지 JSON 타입 + 검증
│   │   └── stageLoader.ts
│   ├── storage/
│   │   └── progress.ts         # Preferences / localStorage 추상화
│   ├── view/
│   │   ├── BoardView.ts        # 스프라이트 그리드, 이벤트 재생
│   │   ├── BlockSprite.ts
│   │   ├── input.ts            # 스와이프 / 탭-탭 → SwapAction
│   │   └── effects.ts          # 파티클, 흔들림, 점수 팝업
│   └── scenes/
│       ├── BootScene.ts
│       ├── MenuScene.ts
│       ├── StageMapScene.ts
│       ├── GameScene.ts
│       └── ResultScene.ts
├── tests/
│   └── core/*.test.ts
├── capacitor.config.ts
├── vite.config.ts
└── tsconfig.json               # strict: true
```

**의존 방향 (단방향만 허용)**

```
scenes → view → core
scenes → modes → core
scenes → data, storage
core → (아무것도 의존하지 않음)
```

ESLint `no-restricted-imports`로 `src/core/**`에서 `phaser`, `../view`, `../scenes` import를 금지한다.

## 4. core 설계

### 4.1 타입

```ts
type Color = 0 | 1 | 2 | 3 | 4 | 5;          // 스테이지 colors 수만큼 사용
type SpecialKind = 'lineH' | 'lineV' | 'bomb' | 'color' | 'super';

interface Block {
  id: number;            // view가 스프라이트를 추적하는 고유 ID
  color: Color | null;   // 컬러 블록은 null
  special?: SpecialKind;
}

interface Pos { r: number; c: number }

interface Board {
  rows: number;
  cols: number;
  cells: (Block | null)[];   // 1차원 배열, index = r * cols + c
  nextId: number;
}

interface GameState {
  board: Board;
  rngState: number;          // RNG도 상태의 일부 → 완전 결정적
  colors: number;
}
```

- 보드는 **불변**으로 다룬다. 각 단계는 새 `Board`를 반환한다. 8x8=64칸이라 복사 비용은 무시해도 된다.
- `Block.id`가 있어야 view가 "어떤 스프라이트가 어디로 이동했는지"를 추적할 수 있다.

### 4.2 이벤트

core는 처리 결과를 **단계(step) 목록**으로 돌려준다. view는 step 하나씩 애니메이션을 재생하고 다음 step으로 넘어간다.

```ts
type GameEvent =
  | { type: 'swap'; a: Pos; b: Pos }
  | { type: 'swapBack'; a: Pos; b: Pos }
  | { type: 'match'; groups: MatchGroup[]; cascade: number }
  | { type: 'activate'; special: SpecialKind; at: Pos; cleared: Pos[] }
  | { type: 'remove'; blocks: { id: number; at: Pos; bySpecial: boolean }[] }
  | { type: 'create'; block: Block; at: Pos }           // 특수 블록 생성
  | { type: 'fall'; moves: { id: number; from: Pos; to: Pos }[] }
  | { type: 'refill'; blocks: { block: Block; at: Pos; dropFrom: number }[] }
  | { type: 'score'; delta: number; cascade: number; at: Pos }
  | { type: 'shuffle'; mapping: { block: Block; to: Pos }[] };  // 셔플 후 전체 배치. 상한 초과로 새로 생성하면 새 id가 섞여 있다

interface ResolveResult {
  state: GameState;
  steps: GameEvent[][];    // 같은 step 안의 이벤트는 동시에 재생
  scoreDelta: number;
  removedByColor: number[]; // 미션 '색 수집' 집계용
  valid: boolean;          // false면 swapBack만 들어 있음
}
```

### 4.3 처리 루프 (`engine.resolveSwap`)

```
resolveSwap(state, a, b):
  if not adjacent(a, b): return invalid
  if a 또는 b가 컬러 블록:
      → 컬러 발동 경로 (매치 판정 없이 바로 발동, 항상 valid)
        - 스왑 후 컬러 블록이 놓인 칸에서 발동. 대상 색 = 상대 블록의 색 (상대가 특수 블록이면 그 색)
        - 둘 다 컬러면 보드 전체, 발동은 하나 (상대 컬러 블록은 다시 발동하지 않는다)
        - 범위 안의 다른 특수 블록은 연쇄 발동. 이 단계의 match 이벤트는 groups가 빈 cascade 0
        - 스왑으로 생긴 매치는 보지 않는다. 이후 연쇄는 일반 경로와 같다
  board' = swap(board, a, b)
  groups = findMatches(board')
  if groups 비어 있음: return { valid: false, steps: [[swap], [swapBack]] }

  cascade = 0
  loop:
    1. 각 group → decideSpecial(group, swapPos | null)
         첫 cascade에서는 스왑 위치(a 또는 b 중 그룹에 속한 쪽), 이후는 그룹 중앙
    2. toRemove = 그룹 블록들 (생성 위치의 원래 블록도 제거하고, 그 자리에 새 특수 블록을 놓는다)
    3. toRemove 안에 기존 특수 블록이 있으면 발동 → 범위를 toRemove에 추가
       (BFS: 새로 범위에 들어온 특수 블록도 발동, 이미 발동한 건 다시 발동하지 않음)
    4. 점수 계산 (cascade 배율 적용)
    5. remove → create(특수) → fall → refill
    6. groups = findMatches(board)
    7. groups 비어 있으면 break, 아니면 cascade++

  if not hasAnyMove(board): shuffle (가능한 수가 생기고 매치가 없을 때까지)
  return result
```

**한 번의 resolve 안에서 무한 루프 방지**: cascade 상한(`BOARD.maxCascade` = 200)을 두고 넘으면 assert. 정상적인 보드에서는 도달하지 않지만 테스트에서 버그를 잡는다. 3색 보드는 특수 블록(슈퍼 → 대량 리필 → 또 매치) 때문에 정상적으로도 연쇄가 길다 (W2-05 측정: 8x8, 1362턴 중 최대 56, 상위 1% 36. 4색은 최대 16).

### 4.4 매치 판정 (`matcher.findMatches`)

1. 가로 스캔: 같은 색 연속 3개 이상인 구간(run)을 모두 수집
2. 세로 스캔: 같은 방식
3. **Union-Find**로 칸을 공유하는 run끼리 병합 → `MatchGroup`
4. 각 그룹에 메타데이터를 붙인다:
   - `cells: Pos[]`
   - `maxRunH`, `maxRunV`: 가장 긴 가로·세로 run 길이
   - `hasIntersection`: 가로 run과 세로 run이 교차하는지 (L / T / + 판별)

> 주의: 같은 색이라도 **칸을 공유하지 않는** 두 run은 별개 그룹이다. 색이 같다고 합치지 않는다.

### 4.5 특수 블록 결정 (`specials.decideSpecial`)

SPEC 4.5를 그대로 옮긴다. 우선순위는 위에서부터.

| 조건 | 결과 |
|---|---|
| `cells.length >= 6` | `super` |
| `maxRunH >= 5` 또는 `maxRunV >= 5` | `color` |
| `cells.length === 5 && hasIntersection` | `bomb` |
| `maxRunH === 4` | `lineV` (가로로 맞추면 세로줄 제거, 캔디크러시 방식) |
| `maxRunV === 4` | `lineH` |
| 그 외 | 없음 |

> SPEC은 "매치 방향 기준으로 해당 행 또는 열"이라고만 적혀 있다. 캔디크러시는 **가로 4매치 → 세로 줄무늬(열 제거)** 이다. 이 문서는 캔디크러시 방식을 따르되 `config.lineDirection: 'perpendicular' | 'parallel'`로 바꿀 수 있게 한다.

**생성 위치 (`specials.specialPosition`)**

- 첫 cascade(스왑으로 생긴 매치): 스왑한 두 칸 a, b 중 그룹에 속한 칸. 새 매치는 반드시 a나 b를 지나므로 항상 찾는다
- 이후 cascade: 그룹 **중앙** = 그룹 칸들의 평균 위치(무게중심)에 가장 가까운 그룹 칸. 거리가 같으면 `group.cells` 순서(왼쪽 위)가 먼저. 항상 그룹 안의 칸이고 결정적이다
- 생성 칸이 같은 턴의 발동 범위에 걸리면: `config.SPECIAL.newSpecialInBlast`
  - `'keep'`(기본, 캔디크러시 방식): 새 특수 블록은 발동이 끝난 뒤 놓이므로 남는다
  - `'explode'`: 새 특수 블록이 놓이자마자 발동한다 (`create` 없이 그 칸의 `activate`만). 그 범위의 다른 특수 블록도 연쇄. 시범 플레이(W4-11)에서 비교용
- 같은 step의 이벤트 순서: `match` → `activate`… → `remove` → `create`…

**발동 범위 (`specials.blastArea`)**

| 종류 | 범위 |
|---|---|
| `lineH` | 해당 행 전체 |
| `lineV` | 해당 열 전체 |
| `bomb` | 중심 3x3 |
| `super` | 중심 5x5 ∪ 해당 행 ∪ 해당 열 |
| `color` | 대상 색 블록 전체 (스왑 상대의 색. 상대도 컬러면 보드 전체 제거. 상대가 줄·폭탄·슈퍼면 그 색 블록이 모두 그 특수 블록으로 바뀌어 차례로 발동, 6.18) |

- 범위에는 발동한 블록 자신의 칸이 항상 들어 있고, 보드 밖은 잘린다. 결과는 행 우선(왼쪽 위부터) 정렬
- `color`의 대상 색이 없으면(`null`) 보드 전체

**연쇄 발동 (`specials.chainActivate`)**

- 제거할 칸 목록에서 시작해 BFS로 퍼진다: 칸 안의 특수 블록이 발동 → 범위를 제거 목록에 추가 → 범위 안에서 새로 만난 특수 블록도 발동. 블록마다 최대 한 번
- 순서: 시작 칸은 목록 순서, 범위 안의 칸은 행 우선. 같은 입력 → 같은 `activate` 순서
- `activated` 인자: 이미 발동한 칸(컬러 스왑 발동). 제거는 되지만 다시 발동하지 않는다
- 연쇄로 휘말린 컬러 블록은 스왑 상대가 없으므로 **보드에서 가장 많은 색**을 대상으로 한다 (동점이면 Color 번호가 작은 색). 플레이 테스트 후 바꿀 수 있다

### 4.6 낙하 / 리필 (`gravity.ts`)

- 열 단위로 아래에서 위로 스캔하며 빈칸을 채운다 → `fall` 이벤트
- 남은 빈칸은 RNG로 새 블록 생성 → `refill` 이벤트 (`dropFrom`은 화면 위 몇 칸에서 떨어지는지)
- 리필 블록은 매치를 **피하지 않는다** (연쇄의 재미). 초기 생성과 셔플만 매치를 피한다.

### 4.7 초기 생성 / 가능한 수 / 셔플 (`board.ts`, `moves.ts`)

- **초기 생성**: 왼쪽 위부터 채우며, 왼쪽 2칸 또는 위쪽 2칸과 같은 색이면 그 색을 후보에서 뺀다 → 매치 0개 보장
- **hasAnyMove**: 모든 인접 쌍(가로 56 + 세로 56 = 112쌍)을 시험 스왑해서 매치가 생기는지 확인. 컬러 블록이 있으면 항상 true. 64칸이라 전수 탐색해도 충분히 빠르다
- **findHint**: 위 탐색에서 첫 번째로 찾은 수를 반환 (힌트 기능용, 4주차)
- **생성 후 수 없음**: 다시 생성 (RNG 계속 진행). 시도 상한 100회
- **shuffle**: 기존 블록(특수 블록 포함)을 Fisher-Yates로 섞고, 매치 없음 + 수 있음 조건을 만족할 때까지 반복. 상한 초과 시 일반 블록만 새로 생성

### 4.8 점수 (`scoring.ts`)

SPEC 5절 기준. 그룹 단위로 계산한다.

```
groupBase = 3개: 블록당 10 × 3
            4개: 120
            5개: 200
            6개 이상: 300 + (n - 6) × 50
specialBase = 특수 효과로 제거된 블록 수 × 20
multiplier = 1 + cascade × 0.5
delta = floor((Σ groupBase + specialBase) × multiplier)
```

- **그룹 크기** = `group.cells.length` (L / T / + 모양도 칸 수로 센다. 5칸 L = 5매치 200점)
- **특수 효과로 제거된 블록** = 그 cascade의 `remove` 이벤트에서 `bySpecial: true`인 블록 수. 그룹 칸은 그 칸의 블록이 특수 블록이어도 `groupBase`로만 센다 (두 번 세지 않음)
- **컬러 블록 스왑 발동**(cascade 0, groups 빈 배열): `groupBase` 0, 지워진 블록 전부 `bySpecial`로 20점씩, 배율 1x
- **`score` 이벤트**: cascade마다 1개, 그 cascade의 `match` / `remove`와 같은 step의 맨 끝. `at` = 첫 그룹의 중앙(4.5의 중앙 정의, `specialPosition(group, [])`), 그룹이 없으면(컬러 발동) 컬러 블록이 발동한 칸. 점수 팝업(W4-01) 위치로 쓴다
- **`ResolveResult.scoreDelta`** = 그 턴 `score` 이벤트 delta의 합. 무효 스왑은 0. 누적 점수는 core가 들고 있지 않고 mode가 `onResolve`에서 더한다 (5절)
- 남은 이동 보너스(`movesLeftBonus`)는 StoryMode(W3) 몫이라 `scoring.ts`에 넣지 않는다

`config.ts`:

```ts
export const SCORE = {
  perBlock: 10,
  match4: 120,
  match5: 200,
  match6Base: 300,
  match6Extra: 50,
  bySpecial: 20,
  cascadeStep: 0.5,
  movesLeftBonus: 300,     // 스토리 클리어 후 남은 이동 1회당
};
```

### 4.9 RNG (`rng.ts`)

- `mulberry32` 사용. 상태가 `number` 하나라 `GameState`에 넣기 쉽다
- `next(state) → [value, newState]` 형태의 순수 함수로 만든다

## 5. modes 설계

```ts
interface GameMode {
  readonly kind: 'story' | 'timeattack';
  onResolve(result: ResolveResult): void;   // 점수·미션·이동 갱신
  tick(dtMs: number): void;                 // 타임어택 타이머
  score(): number;                          // 누적 점수 (HUD용)
  canInput(): boolean;
  isOver(): boolean;
  result(): ModeResult;
}

type ModeResult =
  | { kind: 'timeattack'; score: number; bestScore: number; newBest: boolean }
  | { kind: 'story'; cleared: boolean; score: number; stars: 0 | 1 | 2 | 3 };  // W3
```

- `src/modes`도 core처럼 순수 TS다. `phaser`, DOM, `Math.random`, `src/view`, `src/scenes`를 쓰지 않는다 (ESLint로 막는다). 의존은 `core`와 `config`만. 예외로 스테이지 **타입**(`StageDef`, `Goal`)은 `import type`으로 `src/data/stageSchema`에서 가져온다 (값 import는 ESLint 에러, W3-05)
- 씬은 매 프레임 `mode.tick(delta)`를 부르고, 스왑 전에 `canInput()`을 보고, 재생(`view.play`)이 끝난 뒤 `isOver()`면 결과 화면으로 간다

### StoryMode
- `movesLeft`: **유효한** 스왑에서만 1 감소
- `goals`: `score`는 누적 점수, `collect`는 `removedByColor`로 집계 (특수 효과로 제거된 블록도 포함)
- 종료: 모든 미션 달성 → **클리어** / `movesLeft === 0` 이고 미달성 → **실패**
- 클리어 시 남은 이동 × `movesLeftBonus` 가산 후 별 계산 (`stars` 기준)
- 남은 이동 보너스 연출(Sugar Crush처럼 랜덤 블록을 특수 블록으로 바꿔 터뜨리기)은 v0.1에서는 **점수만 더하고 연출은 생략**
- 생성: `new StoryMode(stage: StageDef)`. `canInput()` = `!isOver()`, `tick`은 아무것도 안 함
- 판정은 `onResolve` 뒤에만 한다. 한 턴의 연쇄는 core가 끝까지 계산해서 오므로, 마지막 이동에서 미션을 달성해도 **클리어**
- 미션 진행 `goalProgress(): { goal: Goal; current: number; done: boolean }[]` (`current`는 목표를 넘어도 그대로 센다, HUD는 W3-10), `movesLeft(): number`
- 별: 최종 점수(보너스 포함)가 `stars[i]` 이상인 개수. **클리어하면 최소 1개**, 실패는 0개
- `ModeResult` 스토리 쪽에 `stageId`를 더한다: `{ kind: 'story'; stageId: number; cleared; score; stars }` (결과 화면의 [다음 스테이지]용)

### TimeAttackMode
- `timeLeftMs = config.TIMEATTACK.timeLimitMs`(60000), `tick`에서 감소. 0 아래로 내려가지 않는다. `dtMs`가 0 이하이거나 유한수가 아니면 무시
- 시간은 **애니메이션 중에도 흐른다** (타임어택이라 연쇄 구경도 시간에 포함)
- **연쇄 애니메이션 중 시간 0이 되면**: 진행 중인 연쇄는 끝까지 처리·점수 반영하고 그 뒤에 종료 (입력만 막음). core는 스왑 순간 결과를 다 계산하므로 점수는 이미 들어와 있고, 씬이 재생이 끝날 때까지 결과 화면을 미룬다
- `canInput()` = 남은 시간 > 0, `isOver()` = 남은 시간 0
- 시간 0 뒤의 "마지막 팡"(SPEC 3.3, PLAN 6.14) 점수도 `onResolve`로 그대로 더한다. 모드는 바뀌지 않는다
- 생성자에서 이전 `bestScore`를 받는다(기본 0). `result().newBest` = 점수 > bestScore. **저장은 W3-07(storage)**, 그 전까지 최고 점수는 새로고침하면 사라진다
- 마지막 `config.TIMEATTACK.warnMs`(10000) 동안 HUD 시간 강조 (W2-11). `TimeAttackMode.timeLeftMs()`로 읽는다
- W3-04에서 `timeLimit`을 `timeattack.json`으로 옮긴다

## 6. view / scenes 설계

### 6.1 BoardView
- `Map<blockId, BlockSprite>`로 스프라이트를 관리
- `play(steps: GameEvent[][]): Promise<void>` — step마다 해당 이벤트들의 트윈을 동시에 시작하고 모두 끝나면 다음 step
- 애니메이션 중에는 입력을 막는다 (`GameScene`의 `busy` 플래그)
- 시간 값은 `config.ANIM` (swap 120ms, remove 150ms, fall 칸당 60ms 등)

### 6.2 입력 (`view/input.ts`)
- **스와이프**: pointerdown 위치의 칸 기억 → 이동 거리가 칸 크기의 30%를 넘는 순간 주 방향으로 스왑 확정
- **탭-탭**: 첫 탭 선택(하이라이트) → 인접 칸 탭이면 스왑, 아니면 선택 변경, 같은 칸이면 선택 해제
- 출력은 `{ a: Pos, b: Pos }` 하나. core는 입력 방식을 모른다

### 6.3 화면 크기
- 기준 해상도 **720x1280** 세로, `Phaser.Scale.EXPAND` (더 긴 화면은 높이만 늘어난다)
- 위 타이틀 → 보드 680x680 → 아래 정보 패널 → 바닥 장식. 늘어난 높이 배분과 안전 영역은 `docs/superpowers/specs/2026-10-30-screen-layout-design.md` (W2-10a)

### 6.4 Scene 흐름

```
BootScene (에셋 로드, 스테이지 JSON 로드, 저장 데이터 로드)
  → MenuScene ─┬─ StageMapScene → GameScene(story, stageId) → ResultScene
               └─ GameScene(timeattack) → ResultScene
ResultScene → [다시하기] GameScene / [다음] GameScene(stageId+1) / [지도] StageMapScene (경쟁은 [메뉴] MenuScene)
```

씬 키·데이터·버튼 표와 화면 세부는 `docs/superpowers/specs/2026-10-30-story-screens-design.md` (W3-08 ~ W3-12)

### 6.5 사운드 (W4-02)

- 효과음 (배경 음악은 6.7, W4-13). 출처는 **Kenney**(CC0, 출처 표시 의무 없음). 고른 파일·원본 팩 이름은 `public/audio/CREDITS.md`에 적는다
- 파일은 `public/audio/*.ogg` (Android WebView·Chrome 기준). BootScene이 미리 읽는다. 합계 500KB 이하를 목표
- 재생은 `src/view/Sfx.ts` 한 곳에서. 씬은 `sfx.play('match', { level })`처럼 이름만 부른다. 이름 → 파일·볼륨·연쇄 단계별 음 높이(도·레·미·파·솔), 같은 소리 최소 간격(`minGapMs`)은 `config.SOUND`
- 게임 중 소리는 **GameScene이 BoardView hooks에서** fx와 sfx를 같이 부른다. FxDirector는 그림만 맡는다 (어디서 무슨 소리가 나는지 한 곳에서 보이게)
- 소리 나는 때: 스왑, 되돌아가는 스왑, 매치(연쇄 단계마다 음이 조금씩 높아짐), 특수 발동, 클리어·실패, 버튼, 결과 화면 별 하나 찰 때
- **음소거**: 메뉴·지도 오른쪽 위 스피커 버튼. 값은 `SaveData.settings.muted`에 저장해 다시 켜도 유지 (`parseSave`가 빠진 필드는 기본값으로 채우므로 `version`은 1 그대로). 게임 중 음소거는 W4-04 일시정지 메뉴에서
- 브라우저는 첫 터치 전에는 소리를 막는다. Phaser가 첫 입력에서 오디오를 풀어 주므로 메뉴 첫 탭부터 소리가 난다

### 6.6 일시정지 (W4-04)

- **버튼**: 게임 화면 오른쪽 위 동그란 버튼(❚❚). 메뉴·지도의 스피커 버튼과 같은 모양·자리. 정보 패널 오른쪽 열은 스토리 이동 배지가 쓰므로 거기 두지 않는다 (W2-10a 설계의 "일시정지 자리"를 이것으로 바꾼다)
- **방식**: `PauseScene`을 GameScene 위에 띄우고(`scene.launch`) GameScene은 `scene.pause`. 트윈·타이머·`update`가 함께 멈추므로 연쇄 재생 중에 눌러도 그 자리에서 멈췄다가 [계속]에서 이어진다. 타임어택 남은 시간도 `update`가 멈춰서 줄지 않는다
- **창**: 반투명 덮개 + 크림 판 + 제목 `잠깐 쉬어요` + 버튼 [계속] [다시하기] [지도](스토리) / [메뉴](경쟁) + 판 안 맨 아래 줄에 ♪·스피커 버튼(W4-14). 결과 화면과 같은 Button
- **나가기·다시하기는 기록하지 않는다**: 결과가 아니므로 저장·해금·최고 점수에 반영하지 않는다
- **자동 일시정지**: 화면이 가려지면(`document.visibilitychange` → hidden, 앱이 백그라운드로 갈 때) 게임 중이면 자동으로 일시정지 창을 띄운다. 돌아왔을 때 바로 이어지지 않게 하려는 것
- Android 뒤로 가기 버튼 연결은 W4-07

### 6.7 배경 음악 (W4-13)

2026-11-01 사용자 결정. 모두 OpenGameArt **CC0** (출처는 `public/audio/CREDITS.md`)

| 화면 | 곡 | 원본 |
|---|---|---|
| 메뉴·스테이지 지도 | Happy Clappy Loop (OwlishMedia, 피아노) | `HappyClappyLoop.wav` · https://opengameart.org/content/happy-clappy-loop |
| 경쟁 60초 게임 | Happy Vibes (Ruskerdax, 레트로 신스) | `ruskerdax_-_happy_vibes.mp3` · https://opengameart.org/node/160228 |
| 스토리 게임 | Two Simple Game Music Loops 중 게임 곡 (qubodup) | `levelmusicloop-tigrun.ogg/.wav` · https://opengameart.org/node/174263 |

- **파일**: `public/audio/music/{menu,timeattack,story}.ogg` + `.m4a` (W4-12와 같은 대체 방식). 모노 96kbps 정도로 줄여 세 곡 합계 3MB 이하 목표. mp3·인코더가 앞뒤에 넣는 무음은 잘라서 반복할 때 끊김이 없게 한다
- **읽기**: Boot는 메뉴 곡만 기다린다. 나머지 두 곡은 메뉴가 뜬 뒤 뒤에서 읽고, 게임 시작 때 아직이면 다 읽힌 순간부터 튼다 (첫 화면이 늦어지지 않게)
- **재생 규칙** (`src/view/Music.ts` 한 곳, 씬은 `music.play('menu')`처럼 이름만)
  - 메뉴 ↔ 지도를 오가도 메뉴 곡은 끊기지 않고 이어진다 (같은 곡이면 다시 시작하지 않음)
  - 게임에 들어가면 그 모드 곡으로 바꾼다 (짧은 페이드). [다시하기]도 곡은 이어진다
  - 일시정지 중에는 음악 볼륨을 줄인다(`MUSIC.pauseDuck`). [계속]에서 원래대로
  - 결과 화면에 들어가면 게임 곡을 페이드아웃해 끝낸다 (클리어·실패 효과음이 들리게). 결과 화면은 음악 없음, 메뉴·지도로 가면 메뉴 곡
  - 앱이 뒤로 가거나 탭이 가려지면 Phaser가 소리를 멈췄다 돌아오면 잇는다 (기본 동작)
- **볼륨·시간 값**은 `config.MUSIC` (`volume` 0.35 근처에서 시작, `fadeMs`, `pauseDuck`)
- **켜고 끄기 (효과음과 따로)**
  - 스피커 버튼 = 효과음, 새 ♪ 버튼 = 음악. 메뉴·지도는 오른쪽 위 스피커 왼쪽에, 일시정지 창은 크림 판 안 맨 아래 줄에 ♪·스피커 나란히 (W4-14에서 옮김: 오른쪽 위에 두면 좁은 화면에서 제목과 겹침)
  - 지금 스피커는 게임 전체 음소거(`sound.mute`)라 음악까지 꺼진다 → 효과음만 끄도록 바꾼다 (`Sfx`가 재생을 건너뜀)
  - 저장: `SaveData.settings`에 `music: boolean`(기본 true) 추가. 기존 `muted`는 "효과음 끔"으로 뜻을 좁힌다 (`version` 1 그대로, `parseSave`가 기본값으로 채움)
  - 끄면 꺼진 ♪ 모양(사선)으로 바뀐다. 다시 켜면 지금 화면의 곡부터 시작

### 6.8 다듬기 묶음 (W4-14)

2026-11-01 사용자 요청 ("다듬을거 작업진행해줘"). 값은 모두 config에 두고, 판단은 순수 함수로 빼서 테스트한다

1. **일시정지 창 소리 버튼**: 오른쪽 위 ♪·스피커를 크림 판 안 맨 아래 줄 가운데로 옮긴다 (6.6, 6.7). 판 높이는 그만큼 늘린다
   - 결과: `PAUSE.sound` { dy 120(마지막 버튼 → 줄), gap 100(두 원 중심) }, ♪ 왼쪽·스피커 오른쪽. 360×640에서도 겹치지 않음
2. **점수 팝업 1단계 색**: 지금 1단계(제목 분홍)와 2단계(`#ff6b9a`)가 거의 같다. 1단계는 크림 보드 위에서 잘 보이는 다른 색(따뜻한 갈색·민트 등)으로 바꾸고, 2~5단계는 칭찬 문구 색 그대로. 스크린샷으로 비교해 고른다
   - 결과: `THEME.popupBase` `#a8692e`(따뜻한 갈색). 분홍·갈색·민트·주황 비교: 주황은 3단계와, 민트는 초록 블록과 헷갈려 뺐다
3. **흔들림은 센 쪽이 이긴다**: Phaser 카메라 흔들림은 이미 흔들리는 중이면 새 요청을 무시한다. 그래서 폭탄 → 슈퍼처럼 이어질 때 약한 폭탄 흔들림만 보인다. 순수 함수 `pickShake(current, next, now)`로 "지금 흔들림이 끝났거나 새 것이 더 세면 새 것(force)" 을 정하고, 연쇄 흔들림·특수 흔들림 모두 이것을 거친다
   - 결과: `src/view/fx/shake.ts`. 같은 세기면 무시, 센 것이 오면 `camera.shake(…, force=true)`
4. **결과 화면 간격**: "최고 점수" 줄이 새 기록 배지에 붙어 있고 "끝!" 아래가 비어 보인다. 제목 ↔ 점수 ↔ 최고 점수 ↔ 배지 ↔ 버튼 사이를 고르게. 경쟁·스토리 클리어·실패 세 가지 모두 390×844와 360×640에서 스크린샷 확인
   - 결과: 고정 dy 대신 `resultLayout(view)`가 있는 줄만 `RESULT.layout` { gap 26, scoreGap 6, beforeButtons 44, 줄 높이 h }으로 쌓아 화면 가운데에 둔다
5. **힌트 배율**: `HINT.scale` 1.15 → 1.25 (아이가 알아보게)
   - 결과: 1.25 적용
6. **Android 상태바·아래 바 색**: 바 뒤가 흰색/연회색으로 보인다 (WebView 140 미만은 native padding이라 창 배경이 보임). 창 배경(`android:windowBackground`)을 위 하늘(`THEME.sky.top` #bfe4ff) → 아래 땅 색으로 이어지는 세로 그라데이션 drawable로 바꿔 위·아래 띠가 화면과 이어지게 한다. 상태바 아이콘은 밝은 배경용(어두운 아이콘). WebView 140+ passthrough일 때는 `html` 배경이 이미 보이므로 영향 없음
   - 결과: `drawable/app_background.xml`(#BFE4FF → #FFF3D9 = `THEME.hills.front`). Capacitor SystemBars가 시작·설정 변경 때 창 배경을 테마 `windowBackground` **단색**으로 다시 칠해서(테마에 drawable을 넣으면 검정), 테마 대신 `MainActivity`가 그 뒤에 decorView 배경을 칠한다. 상태바·내비바 아이콘은 어두운색. 시작 화면 색은 그대로

### 6.9 칭찬 목소리 (W4-15)

2026-11-01 사용자 요청: 칭찬 문구가 뜰 때 가족이 녹음한 목소리가 같이 나온다. 공개 저장소·공개 웹에 올라가는 것은 사용자가 괜찮다고 했다

| 연쇄 단계 | 문구 | 소리 |
|---|---|---|
| 2 | `이안팡!` | `voice1` ("팡") |
| 3 | `이서팡!` | `voice2` ("팡") |
| 4 | `보라팡!!` | `voice3` ("팡") |
| 5 | `사랑해!!!` | `voice4` |
| 6 이상 | `사랑해!!!` | 없음 (한 턴에 한 번만. 계속 반복되면 시끄럽다) |

- **원본**: `assets/voice-src/voice1~4.m4a` (아이폰 녹음, 48kHz 모노). 앞뒤 빈 소리를 자른 것이 `assets/voice-src/trimmed/voice1~4.wav` (사용자가 듣고 승인. 목소리 앞 0.03초·뒤 0.08초 여유, 끝 0.04초 페이드아웃, 녹음 끝 버튼 소리 제거). 길이 0.91 / 0.86 / 0.94 / 1.99초
- **게임 파일**: `public/audio/voice/voice1~4.ogg` + `.m4a` (6.5·7.4와 같은 대체). trimmed WAV에서 `oggenc`·`afconvert`로 만든다. 모노, 효과음 크기에 맞게 작게
- **재생**: 효과음의 하나로 다룬다 (`config.SOUND.effects`에 voice1~4, `Sfx`로 재생). 스피커 버튼(효과음 끔)을 따르고 ♪(음악)와는 상관없다. 단계 → 소리 짝은 config에 두고, 순수 함수가 "이 단계에서 낼 목소리(없으면 null)"를 정한다 (2·3·4·5만 소리, 6 이상 없음)
- **어디서**: `GameScene`의 `hooks.onMatch`에서 match 소리와 같이 부른다 (6.5: 소리는 GameScene 한 곳). 같은 단계에 매치 그룹이 여럿이어도 목소리는 한 번
- **크기**: 목소리가 match 소리·배경 음악에 묻히지 않게 볼륨을 귀로 맞춘다. 그래도 묻히면 목소리가 나오는 동안 음악을 잠깐 줄이는 것을 검토 (지금은 하지 않음)
- 결과: `SOUND.voiceByLevel` { 2: voice1 … 5: voice4 } + `voiceFor(level)`(`src/view/Sfx.ts`). match 이벤트가 연쇄 단계마다 하나라 그룹이 여럿이어도 목소리는 한 번 (minGapMs와 상관없음). 볼륨 0.7: 녹음이 효과음보다 훨씬 커서(가장 큰 0.1초 RMS 약 0.3, match 0.06) 0.7이면 경쟁 곡(×0.35, 중앙값 약 0.08)보다 2배 넘게 크다. 숫자로 정했고 귀로 최종 확인은 사용자. 음악 줄이기는 하지 않음. 파일은 편집본에서 그대로 변환(ogg 12~26KB, m4a 16~28KB)

### 6.10 미션 안내 카드 (W4-16)

2026-11-01 사용자 결정 (FEEDBACK R2). 스토리 게임을 시작하면 보드 위에 미션 카드를 잠깐 띄워, 아이가 무엇을 모아야 하는지 알고 시작하게 한다

- **언제**: 스토리 게임 시작 때마다 ([다시하기], [다음 스테이지] 포함). 경쟁 60초에는 띄우지 않는다 (시간이 바로 흐르고, 규칙이 "많이 터뜨리기" 하나뿐)
- **모양**: 보드 가운데 크림 판(일시정지 창과 같은 계열), 반투명 덮개 없음
  - 첫 줄 `스테이지 9`
  - 미션 줄: 수집은 그 색 블록 그림(텍스처 `normal`) + `10개 모으기!`, 점수는 `점수 2,000 넘기기!`. 줄 수는 스테이지 미션 수 그대로(최대 2)
  - 마지막 줄 작게 `이동 18번`
- **움직임**: 통통 튀며 나타남 → 그대로 보여 줌 → 판이 작아지며 아래 정보 패널 쪽으로 날아가 사라짐. 시간은 config (`MISSION_CARD`: 나타남·머묾·날아감 ms, 머묾 2000ms (2026-11-01 사용자 결정, 1600에서 늘림))
- **누르면 바로 넘어감**: 카드나 화면 아무 곳을 누르면 머묾을 건너뛰고 날아가기 시작. 이 터치는 블록 입력으로 쓰지 않는다
- **카드가 있는 동안**: 보드 입력을 막는다. 힌트 대기 시간도 카드가 사라진 뒤부터 센다. 일시정지 버튼은 눌린다 (일시정지·자동 일시정지 중에는 카드 트윈도 같이 멈춘다: `scene.pause`)
- **문구 계산**은 순수 함수로 빼서 테스트한다 (`storyLines.ts` 옆, 스테이지 → 카드 줄 목록). 6색 이름은 쓰지 않고 블록 그림으로 보여 준다 (글자를 아직 못 읽어도 알게)
- 소리: 카드가 나타날 때 기존 효과음 하나(예: `button` 또는 `star`)를 쓸지 귀로 보고 정한다. 새 파일은 넣지 않는다
- 결과: `src/view/MissionCard.ts`(카드) + `src/view/missionCardLines.ts`(문구, 순수). `MISSION_CARD` { 나타남 420 Back.easeOut 0.3→1, 머묾 2000, 날아감 520 Quad.easeIn → 패널 가운데 크기 0.2·투명 }. 카드 중에는 `setBusy(true)`로 보드를 막아 힌트 타이머도 0에 머물고, 사라지면 힌트를 처음부터 잰다(카드 뒤 5.0초에 힌트). 건너뛰기는 씬 `pointerdown`에서 버튼 위(`currentlyOver`)가 아닐 때만이라 ❚❚를 눌러도 카드는 그대로 멈춘다. 소리는 `star`(반짝 소리가 "시작!"에 어울려서, 귀로 최종 확인은 사용자)

### 6.11 게임 화면 제목 (W4-17)

2026-11-01 사용자 요청 (FEEDBACK R1). 게임 화면 위 제목이 모든 모드에서 `Ddooby-Pang`이라 몇 번 스테이지인지 모른다

- 스토리: `스테이지 9`, 경쟁: `경쟁 60초` (메뉴 버튼 글자와 같은 말). 글꼴·색·자리는 지금 제목 그대로
- 글자가 길어져도 오른쪽 위 일시정지 버튼과 겹치지 않는지 360×640에서 확인
- 문구는 순수 함수로 (모드 → 제목), 테스트
- W4-16 미션 카드 첫 줄과 같은 문구라 같은 함수를 쓴다
- 결과: `src/view/gameTitle.ts`의 `gameTitle(mode)` (스토리 `스테이지 N`, 경쟁은 `MENU.timeattack.text`를 그대로 읽어 메뉴 버튼과 늘 같은 말). `Hud` 제목과 `missionCardLines`의 제목이 이 함수를 쓴다. 360×640에서 가장 긴 `스테이지 10`도 오른쪽 끝이 ❚❚ 왼쪽 끝보다 100px 넘게 떨어져 있다

### 6.12 스테이지 11~20, 스크롤 지도 (W4-18, W4-19)

2026-11-01 사용자 결정: 스테이지를 10개 더 (총 20), 지도는 **길게 위로 스크롤** (두 번째 지도로 나누는 안 대신). 난이도는 지금 만들고 시범 플레이(W4-11) 뒤 1~20을 한꺼번에 다시 맞춘다

**지도 (W4-18)**
- 노드 간격을 화면 높이로 나누지 않고 **고정 간격**으로 둔다 (지금 1280 높이에서의 간격 근처, config). 길 전체 높이 = 위 여백 + (개수 − 1) × 간격 + 아래 여백. `mapNodes`는 이 "세계 좌표"를 돌려주고 테스트한다 (개수와 무관하게 간격 같음, 1번이 맨 아래, 겹치지 않음)
- **움직이는 것 / 고정**: 노드·점선 길·바닥 언덕(1번 아래 땅)은 같이 스크롤. 하늘 배경·구름, 제목 `스토리`, [←] 버튼, 오른쪽 위 ♪·스피커는 화면에 고정
- **처음 위치**: 지도에 들어오면 "지금 할 곳"이 화면 가운데 근처에 오게 스크롤된 채로 시작. 방금 열린 스테이지(W3-12 연출)가 있으면 그곳으로 부드럽게 이동한 뒤 튀어나옴
- **끌기 vs 누르기**: 손가락을 일정 거리(config, 12px 근처) 넘게 움직이면 스크롤, 아니면 누르기(노드 선택). 끌다가 놓은 손은 노드를 누르지 않는다. 위·아래 끝에서 더 못 넘어가게 막는다(살짝 튕김은 있어도 되고 없어도 됨). 놓은 뒤 조금 미끄러지는 관성은 선택
- 스크롤 판단(거리 문턱, 범위 막기, 처음 위치 계산)은 순수 함수로 빼서 테스트
- 길이가 화면보다 짧으면(스테이지 10개 이하) 스크롤 없이 지금처럼 보인다
- `MAP.maxNodes`와 10개 넘으면 경고는 없앤다
- 메뉴의 `스테이지 N / 20`, 결과 화면 "모든 스테이지 클리어!"(마지막 번호), 해금 상한은 스테이지 수를 읽으므로 그대로 동작하는지만 확인
- 결과 (W4-18): `mapNodes(count, screenHeight)` → { nodes, worldHeight }. 간격 = max(`MAP.gap` 86, 화면을 고르게 나눈 값)이라 10개는 1280·1558 모두 지금처럼 한 화면이고(1280에서 87.8), 넘치면 86 고정으로 길어진다(20개 = 세계 높이 2124). 노드·길·별·바닥 언덕은 내용 묶음(Container) 하나에 넣어 y만 옮기고, 나머지는 그대로 고정. 끌기 문턱 `MAP.dragThreshold` 12. 끌다 놓으면 노드·[←]를 누르지 않는다. 끝에서 딱 멈추고(튕김·관성 없음), 방금 열린 곳은 직전에 할 곳에서 시작해 250ms 뒤 700ms 동안 옮겨 간 다음 튀어나온다. 순수 함수 `clampScroll`·`contentY`·`scrollToCenter`·`isDrag`·`mapFocus`(`src/view/mapLayout.ts`). `MAP.maxNodes`·경고 제거. 스테이지 수 상한은 코드·스키마에 없었다(`tests/data/stories.test.ts`의 10개 확인은 W4-19에서 20으로)

**스테이지 11~20 (W4-19)**
- `public/stages/story.json`에 데이터만 추가 (코드 수정 없이, SPEC 6절). 스키마·검사 그대로
- 미션은 지금 두 종류(점수, 색 모으기)와 그 조합만. 장애물 등 새 규칙은 백로그
- 난이도 방향: 1~10보다 조금씩 어렵게, 그러나 한 번에 튀지 않게. 11~13은 쉬어 가는 판(5색, 미션 하나), 14~17은 두 미션 조합, 18~20은 6색 + 두 미션. 이동 18~25 범위. 마지막 20번은 "보스" 느낌으로 조금 더 어렵게
- 숫자 정하기: `?demo` 자동 플레이로 스테이지마다 여러 seed를 돌려 클리어율을 재고, 11 → 20으로 갈수록 클리어율이 천천히 내려가게 맞춘다. 잰 결과(스테이지별 클리어율, 평균 점수)를 DEVELOPMENT 또는 이 절의 결과 줄에 남긴다. 별 기준(`stars`)도 같은 결과로 정한다
- 결과 (W4-19): 11~20을 `story.json`에 추가(코드 수정 없음, 1~10 숫자 그대로). `npm run stages:sim`(`scripts/sim/`, core + StoryMode만으로 `?demo`와 같은 봇: 첫 번째 힌트 수)으로 스테이지마다 seed 1~1000을 돌려 맞췄다. 클리어율 11 75% → 20 31%로 한 판에 3~6%p씩 내려가고, 20번만 10%p 떨어뜨렸다(1,000점이면 37%로 19번과 거의 같아서 1,100점). 11은 쉬어 가는 판이라 10(49%)보다 쉽다. 별 1 = 미션 점수(수집만이면 1~10과 같은 1,500 / 1,000), 별 2 ≈ 클리어한 판 중간값, 별 3 ≈ 클리어한 판 상위 20%를 100 단위로. 봇은 단순해서 절대값보다 순서를 본다. 시범 플레이(W4-11) 뒤 1~20을 다시 맞출 때 같은 명령으로 잰다. 색: 0 red · 1 yellow · 2 green · 3 blue · 4 purple · 5 orange

  자동 플레이 1000판 (seed 1~1000), 점수는 최종 점수(클리어면 남은 이동 보너스 포함)

  | # | 색 | 이동 | 미션 | 클리어율 | 전체 중간값 | 클리어 판 50% / 80% | 별 (1 / 2 / 3) | 별 ≥1 / ≥2 / ≥3 |
  |---|---|---|---|---|---|---|---|---|
  | 1 | 4 | 25 | 2,000점 | 91% | 6,250 | 6,540 / 8,825 | 2,000 / 6,000 / 9,000 | 91% / 52% / 17% |
  | 2 | 4 | 25 | 3,000점 | 76% | 5,940 | 7,275 / 9,850 | 3,000 / 7,000 / 10,000 | 76% / 40% / 15% |
  | 3 | 4 | 22 | red 25 | 92% | 4,985 | 5,355 / 8,180 | 2,000 / 5,000 / 8,500 | 92% / 50% / 16% |
  | 4 | 5 | 25 | 1,500점 | 78% | 3,315 | 3,925 / 5,810 | 1,500 / 4,000 / 6,000 | 78% / 38% / 14% |
  | 5 | 5 | 22 | yellow 18 | 79% | 2,760 | 3,215 / 4,505 | 1,500 / 3,200 / 4,500 | 79% / 40% / 16% |
  | 6 | 5 | 22 | red 15 + blue 15 | 85% | 2,785 | 3,050 / 4,395 | 1,500 / 3,200 / 4,500 | 85% / 39% / 15% |
  | 7 | 5 | 20 | 1,300점 + green 15 | 60% | 1,995 | 3,100 / 4,435 | 1,300 / 3,100 / 4,500 | 60% / 30% / 11% |
  | 8 | 6 | 20 | 900점 | 75% | 1,830 | 2,430 / 3,710 | 900 / 2,500 / 4,000 | 75% / 36% / 11% |
  | 9 | 6 | 18 | purple 10 + orange 10 | 49% | 1,185 | 1,935 / 2,910 | 800 / 2,000 / 3,000 | 49% / 23% / 9% |
  | 10 | 6 | 18 | 900점 + red 10 | 49% | 1,065 | 2,115 / 3,085 | 900 / 2,200 / 3,500 | 49% / 21% / 7% |
  | 11 | 5 | 23 | purple 19 | 75% | 2,720 | 3,375 / 4,710 | 1,500 / 3,400 / 4,700 | 75% / 37% / 15% |
  | 12 | 5 | 22 | 1,400점 | 69% | 2,620 | 3,570 / 5,150 | 1,400 / 3,600 / 5,200 | 69% / 34% / 13% |
  | 13 | 5 | 22 | green 20 | 65% | 2,260 | 3,105 / 4,420 | 1,500 / 3,100 / 4,400 | 65% / 33% / 13% |
  | 14 | 5 | 21 | blue 17 + yellow 18 | 60% | 1,970 | 2,820 / 4,175 | 1,500 / 2,800 / 4,200 | 60% / 30% / 12% |
  | 15 | 5 | 20 | 1,400점 + purple 12 | 59% | 2,010 | 3,225 / 4,660 | 1,400 / 3,200 / 4,700 | 59% / 31% / 12% |
  | 16 | 5 | 20 | red 17 + green 17 | 54% | 1,800 | 2,785 / 3,970 | 1,500 / 2,800 / 4,000 | 54% / 27% / 11% |
  | 17 | 5 | 20 | 1,500점 + yellow 16 | 50% | 1,655 | 3,160 / 4,475 | 1,500 / 3,200 / 4,500 | 50% / 24% / 10% |
  | 18 | 6 | 20 | red 12 + purple 13 | 45% | 1,260 | 2,090 / 2,970 | 1,000 / 2,100 / 3,000 | 45% / 22% / 9% |
  | 19 | 6 | 18 | 1,000점 + blue 10 | 41% | 990 | 2,100 / 3,155 | 1,000 / 2,100 / 3,200 | 41% / 21% / 8% |
  | 20 | 6 | 18 | 1,100점 + orange 12 | 31% | 990 | 2,040 / 2,950 | 1,100 / 2,000 / 3,000 | 31% / 17% / 6% |

### 6.13 연쇄 발동을 차례로 보여 주기 (W4-20)

2026-11-02 사용자 결정 (FEEDBACK F1, 조카 피드백). core는 이미 휘말린 특수 블록을 연쇄 발동한다(SPEC 4.5, `chainActivate`). 그런데 화면은 한 단계의 모든 `activate`를 같은 프레임에 재생해서(BoardView가 `activate`를 기다리지 않고 단계 안 이벤트를 `Promise.all`로 동시 재생) 무엇이 무엇을 터뜨렸는지 안 보인다. 규칙·점수·미션·결정성은 바꾸지 않고 **재생 순서만** 바꾼다

- **차례**: 첫 발동 → 그 범위에 휘말린 특수 블록이 다음 차례 → … (BFS 깊이). 깊이마다 `ANIM.chainStep`(90~120ms 근처, config)씩 늦게 재생
- **각 차례에서**: 휘말린 특수 블록이 짧게 번쩍·부풀었다가(`FX`에 값) 자기 빛줄기·링을 쏘고, 그 범위의 블록은 그 순간부터 지워지기 시작한다. 이미 앞 차례에서 지워진 칸은 다시 지우지 않는다
- **소리**: `special` 효과음이 차례마다 다시 울린다 (간격이 `minGapMs`보다 크면 자연스럽게)
- **깊이 계산**: core가 `activate` 이벤트에 깊이(또는 원인 칸)를 실어 주는 쪽과 view가 cleared 포함 관계로 계산하는 쪽 중 단순한 쪽. core에 필드를 더하면 core 테스트도 맞춘다. 블록별 지연(어느 칸이 몇 ms 뒤 지워지는지)은 순수 함수로 빼서 표 테스트
- **같은 단계에 새로 생긴 특수 블록**은 지금처럼 남는다 (`newSpecialInBlast: 'keep'`, 사용자에게 설명함. 만든 블록을 바로 잃지 않게)
- 매치 그룹(일반 매치)의 제거·점수 팝업·칭찬 문구·목소리 시점은 지금 그대로. 연쇄가 큰 턴은 0.1~0.4초 길어진다 (재생 중엔 원래 입력이 막혀 있음)
- 특수 블록 조합 효과(두 특수 블록 스왑)는 여전히 v0.2 백로그
- 결과: core `activate` 이벤트에 `depth`(차례)를 더했다. `chainActivate(board, start, activated, depth)`가 BFS 큐에 깊이를 같이 넣어 휘말린 블록은 터뜨린 블록 + 1, 컬러 스왑 발동은 첫 발동 0·휘말린 블록 1부터, 'explode'로 걸린 새 블록은 그 칸을 덮은 가장 이른 차례 + 1. view 계산(cleared 포함 관계)은 매치 그룹 안의 특수 블록끼리 서로 범위에 있으면 차례를 잘못 매겨서 core 쪽이 단순했다. 시간표는 `src/view/fx/chainTimeline.ts`(`activateDelay`·`flashDelay`·`removeDelays`, 순수): 매치 칸 0, 휘말린 특수 블록은 자기 차례, 나머지는 그 칸을 덮은 가장 이른 차례. `ANIM.chainStep` 110ms, 번쩍임 `FX.special.chainFlash` { scale 1.3(chainStep 동안 Back.easeOut), whiteMs 70 }. 지연은 `scene.time.delayedCall`이라 일시정지·다시하기에 같이 멈추고 사라진다. `?seed=4&specials` (1,2)↔(2,2)의 4차례 연쇄(lineH → lineV → super → bomb)가 0.11초 간격으로 보이고 그 단계가 약 0.33초 길어졌다. 단일 발동은 지연 0이라 예전과 같은 코드 경로

### 6.14 경쟁 모드 마지막 팡 (W4-21)

2026-11-02 사용자 결정: 시간이 끝나도 판에 남은 특수 블록을 다 터뜨리고 끝낸다 (SPEC 3.3). 지금은 시간 0 때 재생 중인 연쇄만 끝까지 보고 바로 결과 화면으로 간다

- **core** `resolveFinale(state): ResolveResult` (engine.ts, 순수·결정적). 판에 특수 블록이 없으면 `valid: false`, `steps: []`, 상태 그대로. 있으면 **한 라운드에 하나씩**: 행 우선으로 첫 특수 블록을 `chainActivate`의 시작 칸으로 발동 → 제거 → 낙하·리필 → 생긴 매치는 보통 연쇄처럼(`cascade` 배율, 새 특수 블록 생성 포함) 끝까지 → 다음 라운드. 특수 블록이 남지 않거나 `TIMEATTACK.finale.maxRounds`(config, 20 근처)에 닿으면 멈춘다. 라운드마다 `cascade`는 0부터. 점수·`removedByColor`·불변식(빈칸 0, 매치 0, 가능한 수 ≥ 1, 필요하면 셔플)은 `resolveSwap`과 같다. `resolveSwap`의 연쇄 루프를 "시작 발동 칸"을 받는 내부 함수로 빼서 같이 쓰고, 기존 `resolveSwap` 결과(이벤트·점수)는 한 글자도 바뀌지 않게 한다 (기존 테스트 그대로 통과)
- **이벤트**: 새 타입은 만들지 않는다. 라운드의 첫 단계는 `match`(groups 빈 배열, cascade 0) + `activate`들(depth는 지금처럼 BFS) + `remove` + `score`(at = 발동 칸). view의 기존 재생 경로를 그대로 쓴다
- **씬** (GameScene, 타임어택만): 시간 0 → 재생 중인 스왑이 끝나기를 기다림(지금처럼) → "타임 업!" 글자를 `TIMEATTACK.finale.bannerMs`(800 근처) 띄움 → `resolveFinale` 결과를 `view.play` → `mode.onResolve` → HUD 점수 갱신 → `finish()`. 특수 블록이 없으면 글자만 짧게 보이고 결과로. 마지막 팡 동안 입력은 막히고, 일시정지(❚❚·화면 가림)는 지금처럼 된다. 데모(`?demo`)도 같은 흐름
- **스토리 모드는 안 바꾼다** (남은 이동 보너스는 점수만, PLAN 5절)
- 소리·목소리·칭찬 문구·흔들림은 보통 연쇄와 같은 규칙으로 나온다
- 테스트: 특수 블록 없음 → 그대로 / 있음 → 끝난 판에 불변식 성립, 같은 seed 같은 결과, 점수 > 0, `maxRounds` 넘지 않음. 줄 블록 하나 판에서 라운드 1회·그 줄 제거 확인. 타임어택 모드가 시간 0 뒤 `onResolve` 점수를 더하는 테스트
- 확인: `?time=5&specials`로 시간 0 → "타임 업!" → 특수 블록이 하나씩 터지고 점수가 오른 뒤 결과 화면, 최고 점수에 들어감
- 결과: `resolveSwap`의 연쇄 루프를 내부 `runCascades(board, state, trigger, …)`로 뺐다. `Trigger`는 `match`(스왑 매치, 스왑 칸) / `burst`(컬러 스왑) / `fire`(마지막 팡의 특수 블록 하나). 뺀 뒤 예전 engine.ts와 seed 150 × 색 4~6 × 특수 블록 6개 판의 모든 인접 스왑 × keep/explode(10만 800건, 유효 2만 584건)를 `toEqual`로 비교해 결과가 같았다(임시 비교, 커밋 안 함). 셔플·불변식은 `finishResolve`로 같이 쓴다. `resolveFinale(state, maxRounds = 20)`은 셔플·불변식 확인을 마지막 라운드 뒤에 한 번 한다. config `TIMEATTACK.finale` { maxRounds 20, bannerMs 800, text '타임 업!' }, 글자 크기 `FX.bannerScale` 1.3(칭찬 문구 모양, `THEME.title` 색). 씬은 `end()`가 경쟁이면 `playFinale`, 스토리면 `finish`. 점수 패널은 마지막 팡을 다 재생한 뒤 한 번에 오른다(팝업은 터질 때마다). `?seed=4&specials&time=5`: 1라운드 4연쇄 + 2라운드 무지개로 약 3.2초, 1,280점이 최고 점수에 저장. 일시정지·`?demo`·특수 블록 없음 확인

### 6.15 경쟁 결과로 넘어가기 전 쉼, 기록 소리 (W4-22)

2026-11-02 사용자 결정 (SPEC 3.3). 사용자가 직접 들어 보고 골랐다. 모두 CC0

- **쉼**: 경쟁 모드는 마지막 팡(또는 특수 블록이 없을 때 "타임 업!" 글자)이 끝난 뒤 `TIMEATTACK.finale.endHoldMs`(1000) 동안 판을 그대로 보여 주고 결과 화면으로. 씬 시계로 기다려 일시정지에 같이 멈춘다. 스토리 모드는 그대로
- **소리** (결과 화면, 경쟁만. 스토리 `clear`/`fail`은 그대로):
  - `newBest` → `newbest`(짧은 축하 곡)와 `applause`(박수)를 **같이** 시작
  - 못 깸 → `nobest`(아쉬움 곡)
  - 최고 점수가 0인 첫 판(점수 > 0이면 newBest)은 축하 쪽. 점수 0으로 끝나 newBest가 아니면 아쉬움
  - 효과음 끄기를 따른다. 결과 곡(`MUSIC`)이 나오면 곡 위에서 들리게 볼륨을 맞춘다 (config `SOUND.effects`)
- **파일**: 메인이 준비해 둔 `newbest`·`applause`·`nobest`의 `.ogg`/`.m4a`를 `public/audio/`에 둔다
  - `newbest` ← OpenGameArt "Win Jingle" `winfretless_0.ogg` (CC0, 3.8초, 손대지 않음)
  - `applause` ← OpenGameArt "Applause in a large hall or church" `applause-clapping-church-crowd-immersive.wav` (CC0) 5.0~7.5초 구간, 앞 0.05초·뒤 0.8초 페이드, oggenc -q 4
  - `nobest` ← Kenney "85 Short music jingles" (OpenGameArt `jingleSounds_Kenney.zip`, CC0) `jingles_STEEL07.ogg` (1.6초, 손대지 않음)
  - `public/audio/CREDITS.md`에 위 출처를 적는다
- 결과: config `TIMEATTACK.finale.endHoldMs` 1000. `playFinale`이 마지막 팡 재생(또는 "타임 업!" 대기) 뒤 같은 씬 시계 대기로 1초 더 기다리고 `finish()`. 소리 고르기는 순수 함수 `resultSounds(result)`(`scenes/resultText.ts`, 스토리 `clear`/`fail`, 경쟁 `newBest` → `newbest`+`applause`, 아니면 `nobest`), ResultScene은 돌려받은 이름을 차례로 `sfx.play`. 볼륨 `SOUND.effects` newbest 0.9(원본 RMS 약 -19dB로 조용함) · applause 0.7 · nobest 0.55. `clear.ogg`는 스토리 클리어 전용이 됐다. 브라우저(390×844): 특수 블록 없는 `?time=3`은 시간 0부터 결과 소리까지 약 1.8초(글자 0.8 + 쉼 1.0), `?seed=4&specials&time=5`는 마지막 팡 점수 반영(약 3.2초) 약 1초 뒤 결과. 첫 판 30점 → `newbest`+`applause` 같은 시각, 최고 99,999 → `nobest`, 점수 0 첫 판 → `nobest`. 쉼 도중 ❚❚ 2.5초 동안 결과로 안 넘어가고 [계속] 뒤 남은 약 0.7초 후 결과. 효과음 끔이면 결과 소리 없음, 스토리 미리보기는 `clear`/`fail` 그대로

### 6.16 블록 몸통 그림 (W4-23)

- 2026-11-03 사용자: 그림책 배경을 넣은 뒤에도 "캐릭터는 안 바뀐 것 같다". 시안(`assets/design-src/storybook-gameplay-concept.png`)의 도톰한 펠트 블록과 지금 코드 블록(납작한 도형 + 종이 결)의 차이가 크다. 사용자가 Codex 그림으로 교체를 골랐다
- **그림으로 받는 것**: 몸통 7장 (빨강 원, 노랑 둥근 사각형, 초록 마름모, 파랑 둥근 삼각형, 보라 육각형, 주황 별, 무지개 원). 투명 PNG 512×512, 모양이 가운데에 꽉 차게(여백 약 6%), 얼굴 없음. 원본은 `assets/block-src/`
- **코드로 그리는 것**: 얼굴 3표정(normal·squint·happy)과 특수 배지. 지금 `textures.ts`가 몸통을 그리는 자리만 그림으로 바꾸고, 얼굴은 색마다 `FACE_PLACE`대로 그 위에 그린다. 표정이 바뀌는 연출·앱 아이콘(`drawBlockOnCanvas`)이 그대로 돈다
- 그림을 못 읽으면 지금 코드 도형으로 그린다 (배경과 같은 방식)
- 색은 `THEME.blocks`에 가깝게. 매치는 색으로 보므로 6색이 작은 화면에서 서로 헷갈리지 않아야 한다
- 결과: 256px로 줄인 7장(`public/blocks/`, 약 490KB)을 BootScene이 읽고 `textures.ts`가 몸통으로 굽는다. 색마다 몸통 배율·얼굴 위치는 `config.ts` `DECOR.blockArt`(노랑 0.96, 마름모 1.1, 삼각형 1.08·얼굴 9 아래, 별 1.04·얼굴 4 아래), 그림이 없으면 예전 도형, 앱 아이콘은 도형 그대로

### 6.17 물결 웨이퍼 테두리, 제목 리본 (W4-24)

- 2026-11-03 사용자: 시안(`assets/design-src/storybook-new-blocks-concept.png`)의 웨이퍼 테두리와 위쪽 리본도 넣는다
- **테두리**: 지금 둥근 사각형 웨이퍼(`BoardFrame`, 대각선 격자)의 바깥 가장자리를 시안처럼 둥근 물결(가리비)로. 코드로 그린다. 물결 개수·깊이는 `DECOR.frame`에
- **리본**: Codex 그림(`assets/ribbon-src/title-ribbon.png`, 크림 구름 명판 + 분홍 리본, 가운데 비움)을 게임 화면 제목 뒤에 깐다. 제목 글자는 지금처럼 코드로 쓴다. 일시정지 버튼과 겹치지 않게 크기를 정하고, 그림을 못 읽으면 지금처럼 제목만
- 블록 그림(W4-23)과 같은 때 다른 탭이 작업한다. `config.ts`는 `DECOR.frame`과 새 `DECOR.ribbon`만 고치고, W4-23이 main에 먼저 들어간 뒤 rebase해서 반영한다
- 결과: 보드 테두리는 `scallop.ts`의 물결 윤곽(깊이 9, 혹 폭 44, `pad` 10→18), 아래 정보 패널은 그대로 둥근 사각. 리본은 `public/decor/title-ribbon.png`(720폭)를 폭 480으로 제목 뒤에 깔고 글자는 44px (`DECOR.ribbon`). 못 읽으면 제목만

### 6.18 컬러 블록 + 특수 블록 조합 (W4-25)

- 2026-11-03 사용자 결정. 컬러(무지개) 블록을 줄·폭탄·슈퍼 블록과 스왑하면, 상대 특수 블록과 **같은 색** 블록이 모두 그 특수 블록으로 바뀐 뒤 하나씩 발동한다 (캔디크러시 컬러 폭탄 + 줄무늬). 지금은 그 색을 지우고 상대 블록 하나만 발동한다 (`engine.ts` `colorSwapBurst`)
- **변신**: 상대가 `lineH`/`lineV`면 바뀐 블록마다 칸 위치로 번갈아 (`(r + c) % 2 === 0`이면 `lineH`, 아니면 `lineV`. RNG를 쓰지 않아 결정적). `bomb`·`super`면 모두 같은 종류. 상대 블록 자신은 원래 종류 그대로. 이미 다른 특수 블록인 같은 색 블록은 바꾸지 않고 자기 효과로 발동
- **발동 순서**: 컬러 블록이 먼저 사라지고(차례 0), 바뀐 블록이 행 우선 순서로 한 차례씩(`depth` 1, 2, 3 …) 발동한다. 그 범위에 휘말린 다른 특수 블록은 지금 연쇄 발동 규칙(6.13) 그대로
- **core**: 새 이벤트 `transform` (`{ type: 'transform'; changes: { at: Pos; block: Block }[] }`)을 발동 전에 같은 단계에 낸다. 블록 id는 그대로 두고 `special`만 바뀐다. 점수는 지금 규칙 그대로 (효과로 지운 블록당 20, 연쇄 배율)
- **view**: `transform`을 받으면 바뀌는 블록이 반짝이며 특수 표시가 붙는 연출(`ANIM`/`FX`에 시간, 약 0.4초) 뒤 발동을 차례로 재생한다. DEV view↔board 대조(`eventTracker`)도 `transform`을 안다
- 그대로 둔 것: 컬러 + 컬러(보드 전체), 컬러 + 일반 블록, 휘말린 컬러 블록(가장 많은 색), 경쟁 모드 마지막 팡
- 스토리 난이도가 쉬워질 수 있다. `npm run stages:sim`으로 1~20 클리어율 변화를 재서 여기에 적고, 숫자 조정은 시범 플레이(W4-11) 뒤에 한다
- 결과: `colorSwapBurst`가 상대가 줄·폭탄·슈퍼면 같은 색 일반 블록을 바꾼 보드에서 `chainActivate`를 부른다. 시작 칸은 컬러 블록 범위(행 우선)이고 차례는 컬러 칸 0, 나머지 1, 2, 3 …. `chainActivate`의 `depth`는 숫자 또는 시작 칸별 배열이고, 큐에서 차례가 가장 이른 블록부터(같으면 먼저 들어온 것) 꺼낸다. 시작 칸 차례가 모두 같으면 예전 BFS 순서와 같아서 조합이 아닌 스왑 8만 640건(유효 1만 6,992건)·`resolveFinale` 720건이 예전 엔진과 `toEqual`로 같았다(임시 비교, 커밋 안 함). 시작 칸은 앞 차례 범위에 들어도 자기 차례에 발동한다. `transform`은 `match` 바로 뒤. view는 `ANIM.transform` 400ms 동안 `FX.special.transformFlash` { scale 1.25(왕복), whiteMs 120 }로 번쩍이며 표시를 붙이고, 그 step의 발동·제거 시각을 모두 400ms 늦춘다(`chainTimeline.transformDelay`). 소리는 변신 때 `star` 한 번. 확인용 DEV `?specials=combo`(무지개 + ↔·폭탄·슈퍼 세 쌍). `stages:sim`(300판) 1~20 클리어율은 전과 같다(바뀐 칸은 13번 클리어 판 80% 점수 4,470 → 4,520 하나). 봇이 첫 힌트 수만 두어 10만 1,811수 중 컬러 스왑 217번, 조합 1번뿐이라 시뮬로는 효과가 거의 안 잡힌다. 난이도 영향은 시범 플레이(W4-11)로 본다

### 6.19 마지막 스테이지 별, 30스테이지, 한 판 1.5배 (W4-26, W4-27)

- 2026-11-03 사용자: "20스테이지 깼는데도 별이 안 채워져 있다", "한 판이 너무 빨리 끝난다"는 피드백. 30스테이지까지, 스토리 한 판을 약 1.5배 길게. 경쟁 모드는 60초·최고 점수 그대로
- **별 (W4-26)**: 저장의 `unlocked`는 스테이지 수를 넘지 않아서(`recordResult`) 마지막 스테이지는 깨도 `nodeStates`가 'current'로 두고 지도가 별을 그리지 않는다. 저장된 별(`bestStars`)은 맞다. `bestStars[id] ≥ 1`이면 'done'으로 본다. 저장 형식은 그대로
- **해금 이어가기 (W4-27)**: 20번을 깬 저장은 `unlocked = 20`에 머물러 있다. 스테이지가 늘어도 21번이 열리도록, 저장을 읽거나 결과를 반영할 때 `unlocked`를 "별이 있는 가장 높은 번호 + 1"(스테이지 수 이하) 이상으로 맞춘다
- **길이 (W4-27)**: 1~20번 이동을 약 1.5배(18~25 → 27~38). 목표 점수·모을 개수·별 기준도 같이 키워 자동 플레이 클리어율이 지금(6.12 표)과 비슷하게. 컬러 조합(W4-25)이 들어간 main에서 잰다
- **21~30번 (W4-27)**: 20번에 이어 클리어율이 천천히 내려가게. 6색·두 미션 판을 늘리고 30번은 마지막 판답게 조금 더 어렵게. 이동은 같은 1.5배 기준(대략 27~36). 지도 노드 x(`MAP.xs`)와 스테이지 수 20이 박힌 테스트·문서를 30으로

## 7. 데이터 / 저장

### 7.1 스테이지
- SPEC 6절 스키마. `stageSchema.ts`에서 타입 정의 + 런타임 검증 (필수 필드, `colors` 4~6, `stars` 오름차순 등)
- 파일: `public/stages/story.json` = 스테이지 **배열**, `public/stages/timeattack.json` = 객체 하나 (`moves`·`goals`·`stars` 대신 `timeLimit`(초))
- 검증 함수 (순수, Phaser·DOM 없음): `parseStory(raw: unknown): StageDef[]`, `parseTimeAttack(raw: unknown): TimeAttackDef`. 실패하면 `StageError`를 던지고 메시지에 위치를 담는다 (예: `story[3].goals[0].count: 1 이상의 정수여야 한다`)
- 검증 규칙: `id`는 1부터 빈틈없이 순서대로 · `rows`/`cols` 5~10 정수 · `colors` 4~6 · `moves` 1 이상 · `goals` 1개 이상 · `score.target` 1 이상 · `collect.color`는 색 이름이고 **그 스테이지 `colors` 안의 색** · `collect.count` 1 이상 · `stars` 정수 3개, 엄격히 오름차순 · `seed`는 선택(없으면 매번 다른 보드) · 모르는 필드는 무시
- `src/data`도 순수 TS 규칙(ESLint)을 따른다. `fetch`는 `stageLoader.ts`만 쓴다 (W3-02)
- 잘못된 스테이지는 BootScene에서 에러를 띄운다 (조용히 넘어가지 않음)
- 색 이름 매핑: `["red","yellow","green","blue","purple","orange"]` → `Color` 0~5

### 7.2 저장 (`storage/progress.ts`)

```ts
interface SaveData {
  version: 1;
  story: { unlocked: number; bestStars: Record<number, 0|1|2|3>; bestScore: Record<number, number> };
  timeattack: { bestScore: number };
  settings: { muted: boolean }; // W4-02. 옛 저장값엔 없으므로 parseSave가 기본값(false)으로 채운다
}
```

- 인터페이스 이름은 DOM의 `Storage`와 겹치지 않게 **`SaveStorage`**: `load(): Promise<SaveData>`, `save(data: SaveData): Promise<void>` (Capacitor Preferences가 비동기라서)
- 구현 두 개: `CapacitorPreferencesStorage`(W4-08), `LocalStorageAdapter`(W3-07). `LocalStorageAdapter`는 `getItem`/`setItem`을 가진 객체를 받아서 테스트에서 가짜를 넣는다
- 순수 함수: `defaultSave()`(unlocked 1), `parseSave(json: string | null): SaveData`(없음·깨진 JSON·버전 다름 → 기본값, 빠진 필드는 기본값으로 채움), `recordTimeAttack(save, score)`, `recordStory(save, stageId, { cleared, stars, score })`(클리어면 `unlocked = max(unlocked, stageId + 1)`, 별·점수는 큰 값만 남김). 원본은 바꾸지 않고 새 객체를 돌려준다
- 저장 실패(용량·시크릿 모드)는 게임을 멈추지 않는다. 경고만 찍고 진행
- `Capacitor.isNativePlatform()`으로 선택 (BootScene). 웹·`npm run dev`는 지금처럼 `LocalStorageAdapter`
- **`CapacitorPreferencesStorage` (W4-08)**: `@capacitor/preferences`의 `get({ key })`·`set({ key, value })` 모양 객체를 생성자로 받는다(테스트에서 가짜). 같은 키·같은 `parseSave`를 쓴다. 실패는 경고만 찍고 진행
  - 저장은 순서대로: 이전 `save()`가 끝난 뒤 다음 것을 쓴다(Promise 사슬). 결과 화면 직후 음소거를 눌러도 나중 값이 남는다
  - **한 번 옮기기**: Preferences에 값이 없으면 같은 키의 WebView localStorage 값을 읽어 Preferences에 써 둔다 (W3-13~W4-07 APK로 한 기록 유지). localStorage는 지우지 않는다
  - Preferences 읽기가 실패해도 localStorage 기록이 있으면 그것으로 시작한다 (기본값으로 덮지 않게)
  - 왜 Preferences인가: WebView localStorage는 기기 저장 공간이 부족할 때 OS가 지울 수 있다. Preferences는 Android `SharedPreferences`라 앱을 지울 때까지 남는다
- 키 하나(`ddooby-pang/save`)에 JSON 통째로 저장. `version`으로 이후 마이그레이션 대비

### 7.3 Android 패키징 (W3-13, W4-07)

- Capacitor 8 (`@capacitor/core`·`cli`·`android` `~8.5.3`). Node 22 이상, JDK 21(Android Studio 내장 JBR), compileSdk는 Capacitor 기본값을 따른다
- 앱 ID `com.ddooby.pang`, 앱 이름 `Ddooby-Pang`. **설치 후에는 바꾸지 않는다** (바꾸면 다른 앱이 되고 저장 기록이 끊긴다)
- `capacitor.config.ts`: `webDir: 'dist'`. 웹 빌드(`npm run build`) → `npx cap sync android` → Gradle로 APK
- `android/` 폴더는 커밋한다 (Capacitor 권장). 빌드 산출물(`android/app/build/`, `android/.gradle/`, `local.properties`)은 `.gitignore`
- W3-13은 디버그 APK를 에뮬레이터에서 한 번 띄워 보는 시험. 세로 고정·아이콘·스플래시는 W4-07, Preferences 저장은 W4-08
- **W4-07 정식 설정** (2026-10-31 결정)
  - 세로 고정: `AndroidManifest.xml`의 MainActivity `android:screenOrientation="portrait"`
  - 앱 아이콘: **분홍 배경 + 빨강 말랑이 얼굴 하나**. 게임의 블록 텍스처(`textures.ts`, 빨강 `normal` 표정)를 1024px PNG로 뽑아 원본을 `assets/app-icon/`에 두고, `@capacitor/assets`로 Android 아이콘(적응형 포함)을 만든다. 시작 화면은 Android 12+ 기본(아이콘 + 배경색)을 쓰고 배경색은 하늘 그라데이션 위쪽 색
  - 뒤로 가기(`@capacitor/app` `backButton`): **화면별로 한 단계 뒤로**. 게임 중 → 일시정지, 일시정지 → 계속, 지도·결과 → 메뉴(스토리 결과는 지도), 메뉴 → 앱 종료(`App.exitApp`). 웹에서는 아무 일도 안 한다
  - Android 15 이상(targetSdk 36)은 화면이 상태바·내비바 밑까지 그려진다(edge-to-edge). API 36 에뮬레이터에서 안전 영역(`env(safe-area-inset-*)`)이 맞는지 확인한다

### 7.4 아이폰용 웹 배포 (W4-12)

- **GitHub Pages**: 저장소가 공개라 무료. `main`에 push하면 GitHub Actions가 `npm ci && npm run build` 후 `dist/`를 배포한다 (`.github/workflows/pages.yml`, `actions/deploy-pages`). 주소 `https://ddoobyddooby.github.io/ddooby-pang/`. `base: './'`라 하위 경로에서도 그대로 동작
  - 배포 전에 lint·test도 돌려 실패하면 배포하지 않는다
- **홈 화면에 추가**: `index.html`에 `apple-touch-icon`(180px, `assets/app-icon/` 원본으로 만든 PNG), `apple-mobile-web-app-capable`·`mobile-web-app-capable`, `apple-mobile-web-app-title`(`Ddooby-Pang`), `theme-color`. `manifest.webmanifest`(이름, 아이콘 192·512, `display: standalone`, `orientation: portrait`, 배경색 `THEME.sky.top`). 서비스 워커(오프라인)는 넣지 않는다
- **효과음 형식**: 아이폰 Safari는 Ogg Vorbis를 못 읽을 수 있다. 같은 이름의 `.m4a`(AAC)를 `public/audio/`에 같이 두고 Phaser 로더에 `[ogg, m4a]` 두 URL을 넘겨 브라우저가 고르게 한다. 변환은 `afconvert`(macOS 내장) 또는 ffmpeg로, 방법은 `public/audio/CREDITS.md`에 적는다
- **저장**: 웹이라 Safari localStorage(`LocalStorageAdapter`). 홈 화면 앱은 Safari 탭과 저장소가 따로라 기록도 따로다. Safari는 오래 쓰지 않은 사이트 데이터를 지울 수 있다(v0.1에서는 받아들인다)
- **뒤로 가기**: 웹에는 없음 (W4-07 `registerBackButton`은 native에서만)

## 8. 테스트 전략

| 대상 | 방식 |
|---|---|
| core 전체 | Vitest 단위 테스트. **보드를 문자열로 정의**하는 헬퍼를 먼저 만든다 |
| 결정성 | seed 1~1000 초기 보드: 매치 0개, 가능한 수 ≥ 1, 같은 seed 두 번 생성 결과 동일 |
| 매치 모양 | 3I, 4I(H/V), 5I, L, T, +, 6+, 서로 떨어진 같은 색 두 그룹 |
| 특수 발동 | 범위 정확성, 특수 → 특수 연쇄 발동, 중복 발동 없음 |
| 연쇄 | 고정 seed로 다단 연쇄 시나리오, 배율 적용 확인 |
| 셔플 | 수 없는 보드를 강제로 만들어 셔플 후 조건 충족 확인 |
| 퍼즈(fuzz) | 랜덤 seed + 랜덤 유효 스왑 1000회: 예외 없음, 빈칸 없음, resolve 후 매치 0개 |
| modes | 이동 차감, 미션 집계, 별 계산, 타이머 종료 |
| view / scenes | 수동 확인 (브라우저 + 실기기) |

보드 헬퍼 예시:

```ts
const board = parseBoard(`
  R G B R G
  G R R B R
  B B R G B
`);  // 대문자 = 일반, 접미사로 특수: R| (lineV) R- (lineH) R* (bomb) C (color) R+ (super)
```

## 9. 주차별 진행 계획

SPEC 9절 마일스톤을 구체화한다. 세부 작업은 TASKS.md.

### 1주차 — 코어 엔진
- 프로젝트 세팅 (Vite + TS strict + Phaser + Vitest + ESLint)
- core: types, rng, board(초기 생성), matcher, gravity, moves, engine(특수 블록 제외)
- 최소 view: 단색 사각형 보드, 스왑·제거·낙하 트윈, 스와이프 입력
- **완료 기준**: 브라우저에서 3매치 연쇄 플레이 가능, core 테스트 통과, seed 1~1000 테스트 통과

### 2주차 — 특수 블록 + 경쟁 모드
- specials: 결정, 발동 범위, 연쇄 발동
- engine에 특수 블록 통합, 컬러 블록 스왑 발동
- scoring + config
- TimeAttackMode, HUD(점수·타이머), 간단한 결과 화면
- 탭-탭 입력
- **완료 기준**: 4I / 5L / 5I / 6+ 블록 생성·발동, 60초 타임어택 한 판 플레이 가능

### 3주차 — 스토리 모드
- stageSchema + loader, 스테이지 10개 작성
- StoryMode (이동, 미션 2종, 별, 남은 이동 보너스)
- storage (localStorage 먼저)
- StageMapScene, ResultScene 완성, 해금 흐름
- **완료 기준**: 스테이지 1~10 순차 해금, 새로고침 후 진행 유지

### 4주차 — 폴리싱 + APK
- 이펙트(파티클, 화면 흔들림, 점수 팝업), 사운드
- 힌트(5초 무입력 시 가능한 수 깜빡임), 일시정지
- Capacitor Android 세팅, Preferences 저장 연결
- 실기기 성능 확인 (60fps 목표)
- **완료 기준**: 실기기 설치 → 조카 시범 플레이

## 10. 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 연쇄 중 특수 블록 상호작용 버그 | 게임이 멈추거나 빈칸 발생 | 퍼즈 테스트 + 매 resolve 후 불변 조건 assert (빈칸 0, 매치 0) |
| 애니메이션과 상태 불일치 | 스프라이트가 엉뚱한 곳에 남음 | view는 상태를 계산하지 않고 이벤트만 재생. resolve 후 view와 board를 id로 대조하는 디버그 체크 |
| 특수 블록 규칙 변경 | 재작업 | `decideSpecial` 함수 하나 + 테이블 테스트로 격리 |
| 실기기 성능 | 끊김 | 1주차부터 저사양 기기에서 한 번 확인. 파티클 수 제한, WebGL 렌더러 사용 |
| Capacitor/Android 빌드 환경 | 4주차 지연 | 2~3주차 중 빈 앱으로 APK 빌드를 미리 한 번 해본다 |
| 난이도 | 조카가 못 깨거나 너무 쉬움 | 스테이지 JSON만 고치면 되도록 유지, 시범 플레이 후 조정 |
| 아이폰 Safari 오디오 형식 (2026-11-01 발견, W4-12) | iOS Safari·홈 화면 앱은 Ogg Vorbis를 못 읽을 수 있어 효과음·음악이 안 남 (Android·Chrome은 정상) | 모든 소리를 `.ogg` + `.m4a`(AAC) 두 개로 두고 로더에 `[ogg, m4a]` 배열을 넘긴다. Phaser가 `canPlayType`으로 고른다 (PLAN 7.4). **새 소리를 넣을 때 m4a를 빼먹지 않는다** (`afconvert -f m4af -d aac x.ogg x.m4a`). 실제 아이폰 확인은 W4-12. W4-13: macOS `afconvert`는 Vorbis를 **읽기만** 하고 쓰지 못한다(WAV·mp3에서 `.ogg`를 새로 만들 땐 `oggenc`, `brew install vorbis-tools`). AAC는 인코더가 앞에 무음(priming)을 넣지만 `afconvert`가 그 길이를 파일에 적어 두어, Chrome에서 디코드한 길이가 원본 WAV와 샘플 단위로 같았다(반복 끊김 없음). iOS의 loop 이음새는 실기기로 확인 |
