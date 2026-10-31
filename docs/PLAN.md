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
| 3 | 블록 그래픽 | **코드로 그린 '말랑 친구들'** (색 + 모양 + 얼굴 3표정), 달콤 디저트 테마 — [설계](./superpowers/specs/2026-10-29-theme-and-fx-design.md) | 캔디크러시와 구분되는 개성, 에셋·라이선스 관리 없음, 텍스처로 구워 성능 확보 |
| 4 | 경쟁 모드 시간 추가 | **없음** (SPEC대로) | v0.2 |

## 3. 프로젝트 구조

```
ddooby-pang/
├── public/
│   └── stages/
│       ├── story.json          # 스테이지 1~10 배열
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
| `color` | 대상 색 블록 전체 (스왑 상대의 색. 상대가 특수 블록이면 그 블록의 색, 상대도 컬러면 v0.2 조합으로 미루고 일단 보드 전체 제거) |

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

- **효과음만** (배경 음악은 v0.2에서 시범 플레이 반응을 보고 정한다). 출처는 **Kenney**(CC0, 출처 표시 의무 없음). 고른 파일·원본 팩 이름은 `public/audio/CREDITS.md`에 적는다
- 파일은 `public/audio/*.ogg` (Android WebView·Chrome 기준). BootScene이 미리 읽는다. 합계 500KB 이하를 목표
- 재생은 `src/view/Sfx.ts` 한 곳에서. 씬은 `sfx.play('match', { level })`처럼 이름만 부른다. 이름 → 파일·볼륨·연쇄 단계별 음 높이(도·레·미·파·솔), 같은 소리 최소 간격(`minGapMs`)은 `config.SOUND`
- 게임 중 소리는 **GameScene이 BoardView hooks에서** fx와 sfx를 같이 부른다. FxDirector는 그림만 맡는다 (어디서 무슨 소리가 나는지 한 곳에서 보이게)
- 소리 나는 때: 스왑, 되돌아가는 스왑, 매치(연쇄 단계마다 음이 조금씩 높아짐), 특수 발동, 클리어·실패, 버튼, 결과 화면 별 하나 찰 때
- **음소거**: 메뉴·지도 오른쪽 위 스피커 버튼. 값은 `SaveData.settings.muted`에 저장해 다시 켜도 유지 (`parseSave`가 빠진 필드는 기본값으로 채우므로 `version`은 1 그대로). 게임 중 음소거는 W4-04 일시정지 메뉴에서
- 브라우저는 첫 터치 전에는 소리를 막는다. Phaser가 첫 입력에서 오디오를 풀어 주므로 메뉴 첫 탭부터 소리가 난다

### 6.6 일시정지 (W4-04)

- **버튼**: 게임 화면 오른쪽 위 동그란 버튼(❚❚). 메뉴·지도의 스피커 버튼과 같은 모양·자리. 정보 패널 오른쪽 열은 스토리 이동 배지가 쓰므로 거기 두지 않는다 (W2-10a 설계의 "일시정지 자리"를 이것으로 바꾼다)
- **방식**: `PauseScene`을 GameScene 위에 띄우고(`scene.launch`) GameScene은 `scene.pause`. 트윈·타이머·`update`가 함께 멈추므로 연쇄 재생 중에 눌러도 그 자리에서 멈췄다가 [계속]에서 이어진다. 타임어택 남은 시간도 `update`가 멈춰서 줄지 않는다
- **창**: 반투명 덮개 + 크림 판 + 제목 `잠깐 쉬어요` + 버튼 [계속] [다시하기] [지도](스토리) / [메뉴](경쟁) + 음소거 버튼. 결과 화면과 같은 Button
- **나가기·다시하기는 기록하지 않는다**: 결과가 아니므로 저장·해금·최고 점수에 반영하지 않는다
- **자동 일시정지**: 화면이 가려지면(`document.visibilitychange` → hidden, 앱이 백그라운드로 갈 때) 게임 중이면 자동으로 일시정지 창을 띄운다. 돌아왔을 때 바로 이어지지 않게 하려는 것
- Android 뒤로 가기 버튼 연결은 W4-07

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
- `Capacitor.isNativePlatform()`으로 선택
- 키 하나(`ddooby-pang/save`)에 JSON 통째로 저장. `version`으로 이후 마이그레이션 대비

### 7.3 Android 패키징 (W3-13, W4-07)

- Capacitor 8 (`@capacitor/core`·`cli`·`android` `~8.5.3`). Node 22 이상, JDK 21(Android Studio 내장 JBR), compileSdk는 Capacitor 기본값을 따른다
- 앱 ID `com.ddooby.pang`, 앱 이름 `Ddooby-Pang`. **설치 후에는 바꾸지 않는다** (바꾸면 다른 앱이 되고 저장 기록이 끊긴다)
- `capacitor.config.ts`: `webDir: 'dist'`. 웹 빌드(`npm run build`) → `npx cap sync android` → Gradle로 APK
- `android/` 폴더는 커밋한다 (Capacitor 권장). 빌드 산출물(`android/app/build/`, `android/.gradle/`, `local.properties`)은 `.gitignore`
- W3-13은 디버그 APK를 에뮬레이터에서 한 번 띄워 보는 시험. 세로 고정·아이콘·스플래시는 W4-07, Preferences 저장은 W4-08

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
