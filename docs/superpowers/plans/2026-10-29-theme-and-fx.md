# 디자인 테마 + 연쇄 이펙트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> 이 계획은 두 코딩 세션(트랙 A, 트랙 B)이 나눠 실행한다. 자기 트랙의 태스크만 한다.

**Goal:** 경쟁 / 스토리 모드가 공통으로 쓰는 달콤 디저트 테마(솜사탕 하늘, 웨이퍼 보드판, 말랑 친구들 블록, Jua 글꼴)와 연쇄 단계별 이펙트를 붙인다.

**Architecture:** core는 건드리지 않는다. 테마는 `src/view/theme/`, 이펙트는 `src/view/fx/`에 둔다. `BoardView`는 core 이벤트를 재생하면서 `onMatch` 알림만 보내고, `FxDirector`가 연출을 재생한다. 연출 세기 계산(`fxLevels`)은 Phaser 없는 순수 함수로 테스트한다. 블록은 시작할 때 코드로 그린 텍스처를 재사용한다.

**Tech Stack:** Phaser 3.90, TypeScript 6.0 (strict), Vite 8, Vitest 5

**Spec:** `docs/superpowers/specs/2026-10-29-theme-and-fx-design.md` · 시안: `docs/superpowers/specs/mocks/` (`overall-style.html` A 배경 + C 보드판, `block-style.html` B안, `cascade-fx.html` 연출)

## Global Constraints

- `src/core/**`는 수정하지 않는다
- 연출은 `BoardView.play()`의 완료를 늦추지 않는다 (await 하지 않는다). 입력 잠금 시간이 그대로여야 한다
- 개발 모드 `[game] view ≠ board` 에러 0 유지. 블록 위치(x, y)는 연출 때문에 바뀌면 안 된다 (크기·회전·표정만)
- 수치·색·문구는 `src/config.ts`에만 둔다. 칭찬 문구: 연쇄2 `이안팡!` · 연쇄3 `이서팡!` · 연쇄4 `보라팡!!` · 연쇄5 이상 `사랑해!!!`
- 연쇄 단계 = core `match` 이벤트의 `cascade + 1`, 5 이상은 5로 취급
- 커밋 전 `npm run lint && npm run typecheck && npm test && npm run build` 통과. 태스크 하나 = 커밋 하나, 메시지 `[feat] D-0x 설명` + 마지막 줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- **`docs/` 아래 문서(TASKS, DEVELOPMENT, PLAN, SPEC)와 `CLAUDE.md` / `AGENTS.md`는 고치지 않는다.** 메인 세션이 쓴다. 대신 태스크를 끝낼 때마다 보고에 "사용자 확인 방법"과 "공부 포인트(개념 + 쓰인 파일)"를 적는다

## 작업 방식 (두 세션 공통)

| | 트랙 A (바탕) | 트랙 B (블록 · 이펙트) |
|---|---|---|
| 세션 | `ddooby-pang-22` | `ddooby-pang-fd` |
| 작업 폴더 | `../ddooby-pang-A` (git worktree) | `../ddooby-pang-B` (git worktree) |
| 브랜치 | `design/base` | `design/fx` |
| 개발 서버 | `npx vite --port 5174` | `npx vite --port 5175` |
| 태스크 | D-02 → D-03 → D-04 → D-10 | D-05 → D-06 → D-07 → D-08 → D-09 → D-11 |
| 담당 파일 | `config.ts`, `view/fx/fxLevels.ts`, `view/theme/Background.ts`, `view/theme/BoardFrame.ts`, `view/Hud.ts`, `scenes/BootScene.ts`, `index.html`, `public/fonts/` | `view/theme/textures.ts`, `view/BlockSprite.ts`, `view/BoardView.ts`, `view/fx/FxDirector.ts`, `view/fx/matchInfo.ts` |

- 사용자가 5173에서 `npm run dev`를 띄워두었을 수 있다. 5173은 건드리지 않는다
- `src/scenes/GameScene.ts`는 두 트랙이 모두 고친다. **자기 태스크에 적힌 줄만** 바꾸고 다른 부분은 손대지 않는다
- 시작: `git worktree add ../ddooby-pang-A -b design/base origin/main && cd ../ddooby-pang-A && npm install` (B는 이름만 바꿔서)
- 태스크가 끝날 때마다 `main`에 올린다:
  ```bash
  git fetch origin && git rebase origin/main
  npm run lint && npm run typecheck && npm test && npm run build
  git push origin HEAD:main
  ```
  push가 거절되면(다른 트랙이 먼저 올림) 위를 다시 한다. 충돌이 자기 담당이 아닌 파일에서 나면 멈추고 메인 세션(`ddooby-pang-1a`)에 알린다
- 트랙 B는 D-02가 `origin/main`에 올라온 뒤 시작한다 (메인 세션이 알려준다)

## Review Focus

1. **연쇄가 빠르게 이어질 때 `^^` 표정이 풀리지 않음** → 웃음 타이머는 하나만 두고, 새 연쇄가 오면 다시 잰다. 끝나면 반드시 `normal`로 (D-09)
2. **사라지는 중이거나 이미 파괴된 스프라이트에 트윈·표정 변경** → 제거 시작 시 `removing`으로 표시해 `setFaces`에서 제외하고, 파괴 전에 `scene.tweens.killTweensOf(sprite)` (D-05, D-06)
3. **글꼴 로딩 실패·지연 (오프라인, 느린 휴대폰)** → 2초가 지나면 기본 글꼴로라도 게임을 시작한다 (D-03)
4. **긴 연쇄에서 파티클 폭증** → `particleCount` 상한을 테스트로 고정한다 (D-02)
5. **말랑 움직임이 위치를 바꿔 디버그 체크 실패** → 스왑 팝·착지 눌림은 `scale`만 바꾼다. `?demo` 20턴 동안 `view ≠ board` 0 확인 (D-06)

---

## 트랙 A

### Task D-02: config `THEME` / `FX` / `ANIM` + `fxLevels`

**Files:**
- Modify: `src/config.ts`
- Create: `src/view/fx/fxLevels.ts`
- Test: `tests/view/fxLevels.test.ts`

**Interfaces:**
- Produces (`src/config.ts`):
  ```ts
  export const THEME = {
    font: 'Jua',
    sky: { top: 0xbfe4ff, bottom: 0xffd9ea },
    cloud: 0xffffff, star: 0xffe27a,
    wafer: { fill: 0xf3d29b, stroke: 0xd9a866, grain: 0xe8bf80, inner: 0xfff8ec },
    /** index = Color. 스펙 2절 표 */
    blocks: [
      { fill: 0xff7b88, stroke: 0xe45a6b }, { fill: 0xffdb5e, stroke: 0xe8b622 },
      { fill: 0x6be0a4, stroke: 0x34b877 }, { fill: 0x78b6ff, stroke: 0x3f88e6 },
      { fill: 0xbc8af2, stroke: 0x8f55d6 }, { fill: 0xffab69, stroke: 0xee8031 },
    ],
    face: { ink: 0x3b2b3a, cheek: 0xff7fa8 },
    title: { fill: '#ff6b9a', stroke: '#ffffff' },
    info: { bg: 0xffffff, bgAlpha: 0.85, text: '#8a7aa8' },
    /** 칭찬 문구 색 (단계 2~5) */
    praiseColors: { 2: '#ff6b9a', 3: '#ff9a3c', 4: '#4d96ff', 5: '#b37cf0' },
  } as const;

  export const FX = {
    maxLevel: 5,
    /** 사용자가 언제든 바꾸는 문구. 키 = 연쇄 단계 */
    praise: { 2: '이안팡!', 3: '이서팡!', 4: '보라팡!!', 5: '사랑해!!!' } as Record<2 | 3 | 4 | 5, string>,
    praiseScale: { 2: 1, 3: 1.2, 4: 1.4, 5: 1.6 },
    /** index = 단계 - 1 */
    particlesPerBlock: [1, 2, 3, 3, 4],
    maxParticles: 60,
    starsFromLevel: 2,
    shakeFromLevel: 3,
    shake: { 3: { duration: 150, intensity: 0.004 }, 4: { duration: 220, intensity: 0.008 }, 5: { duration: 260, intensity: 0.01 } },
    happyFromLevel: 3,
    happyMs: 600,
  } as const;
  ```
  `ANIM`에 추가: `squish: 160`, `swapPop: 1.1` (스왑 때 커지는 배율), `squintHold: 80` (`remove` 안에서 `><` 유지 시간). `VIEW.boardBackground`를 `THEME.wafer.inner`와 같은 `0xfff8ec`로 바꾼다. `VIEW.blockColors`는 지우지 않는다 (D-05가 지운다).
- Produces (`src/view/fx/fxLevels.ts`, Phaser import 금지):
  ```ts
  export interface FxLevel {
    level: number;                 // 1~5
    particlesPerBlock: number;
    stars: boolean;
    praise: string | null;
    praiseScale: number;
    praiseColor: string | null;
    shake: { duration: number; intensity: number } | null;
    happy: boolean;
  }
  export function cascadeToLevel(cascade: number): number; // 0 → 1, 상한 FX.maxLevel
  export function fxLevel(level: number): FxLevel;          // 1 미만은 1, maxLevel 초과는 maxLevel로 취급
  export function particleCount(level: number, removedBlocks: number): number; // min(per × removed, FX.maxParticles)
  ```

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/view/fxLevels.test.ts`
  - `cascadeToLevel`: `0→1`, `1→2`, `4→5`, `9→5`
  - `fxLevel(1)`: `praise === null`, `shake === null`, `happy === false`, `stars === false`
  - `fxLevel(2)`: `praise === '이안팡!'`, `stars === true`, `shake === null`
  - `fxLevel(3)`: `praise === '이서팡!'`, `shake` 있음, `happy === true`
  - `fxLevel(4).praise === '보라팡!!'`, `fxLevel(5).praise === '사랑해!!!'`
  - `fxLevel(7)`이 `fxLevel(5)`와 같다(`level` 필드 5 포함), `fxLevel(0)`이 `fxLevel(1)`과 같다
  - `particleCount`: 같은 제거 수에서 단계 1→5로 감소하지 않는다, `particleCount(5, 100) === FX.maxParticles`, `particleCount(1, 3) === 3`
  - `FX.praise`에 2, 3, 4, 5 키가 모두 있고 빈 문자열이 없다
- [ ] **Step 2: `npx vitest run fxLevels` → FAIL (모듈 없음)**
- [ ] **Step 3: config 추가, `fxLevels.ts` 구현**
- [ ] **Step 4: `npx vitest run fxLevels` → PASS, 전체 `npm test` PASS**
- [ ] **Step 5: 커밋 `[feat] D-02 THEME / FX config + fxLevels` → main에 올리기 → 메인 세션에 "D-02 main 반영" 보고**

### Task D-03: Jua 글꼴 포함 + 로딩 대기

**Files:**
- Create: `public/fonts/Jua-Regular.ttf`, `public/fonts/OFL.txt`
- Modify: `index.html`, `src/scenes/BootScene.ts`

**Interfaces:**
- Consumes: `THEME.font`
- Produces: 게임 시작 시점에 `THEME.font`를 Phaser 텍스트에서 바로 쓸 수 있다

- [ ] **Step 1: 글꼴 받기** — `https://github.com/google/fonts/raw/main/ofl/jua/Jua-Regular.ttf`, `https://github.com/google/fonts/raw/main/ofl/jua/OFL.txt` → `public/fonts/`. `file public/fonts/Jua-Regular.ttf`가 TrueType으로 나와야 한다
- [ ] **Step 2: `index.html`에 `@font-face { font-family: 'Jua'; src: url('./fonts/Jua-Regular.ttf') format('truetype'); font-display: block; }`** (상대 경로: Capacitor용 `base: './'`)
- [ ] **Step 3: `BootScene.create()`** — `Promise.race([document.fonts.load(\`48px ${THEME.font}\`), 2초 타이머])` 후 `this.scene.start('Game')`. 실패(reject)해도 시작한다
- [ ] **Step 4: 확인** — 5174에서 열고 Console에 `document.fonts.check('48px Jua')` → `true`. DevTools Network를 Offline으로 두고 새로고침해도 게임이 2초 안에 뜬다 (Vite가 캐시하면 하드 새로고침)
- [ ] **Step 5: 커밋 `[feat] D-03 Bundle Jua font + wait in BootScene` → main**

### Task D-04: 배경 + 웨이퍼 보드판

**Files:**
- Create: `src/view/theme/Background.ts`, `src/view/theme/BoardFrame.ts`
- Modify: `src/scenes/GameScene.ts` (`create()`에서 `BoardView` 생성 **직전**에 두 줄 추가만)

**Interfaces:**
- Consumes: `THEME.sky / cloud / star / wafer`, `GAME.width / height`, `Layout`
- Produces:
  ```ts
  export class Background { constructor(scene: Phaser.Scene); }        // 깊이 가장 아래
  export function drawBoardFrame(scene: Phaser.Scene, layout: Layout): void;
  ```

- [ ] **Step 1: `Background`** — 화면 전체 세로 그라데이션(`fillGradientStyle`, 위 `sky.top` → 아래 `sky.bottom`). 구름 4개(타원 2~3개 묶음, 흰색 0.9): 각자 다른 속도로 좌우 `yoyo` 트윈(20~40초). 작은 별 6개: `alpha` 0.3↔1 반복 트윈, 시작 시간 엇갈림. 시안 `overall-style.html` A안 배치를 참고
- [ ] **Step 2: `drawBoardFrame`** — layout 사각형보다 사방 10px 큰 둥근 사각형(반지름 18) `wafer.fill` + 테두리 4px `wafer.stroke`, 가로 결 4줄 `wafer.grain` 알파 0.6. 안쪽 크림색은 `BoardView`가 `VIEW.boardBackground`로 이미 그린다
- [ ] **Step 3: GameScene 연결** — `new Background(this); drawBoardFrame(this, layout);`을 `new BoardView(...)` 바로 앞에
- [ ] **Step 4: 확인** — 5174, 휴대폰 크기(390x844)와 데스크톱 크기에서 스크린샷: 그라데이션이 화면 전체, 구름이 천천히 움직임, 리필 블록이 보드판 위로 비치지 않음. `?demo` 20턴 Console 에러 0
- [ ] **Step 5: 커밋 `[feat] D-04 Cotton-candy sky background + wafer board frame` → main**

### Task D-10: HUD 새 스타일

**Files:**
- Create: `src/view/Hud.ts`
- Modify: `src/scenes/GameScene.ts` (타이틀·정보 `add.text` 두 개를 `Hud`로 교체, `updateInfo`는 `hud.setInfo(...)` 호출로)

**Interfaces:**
- Consumes: `THEME.font / title / info`
- Produces: `export class Hud { constructor(scene: Phaser.Scene, title: string); setInfo(text: string): void; }`

- [ ] **Step 1: `Hud`** — 타이틀: Jua 56px, `title.fill`, 흰 테두리 10px, 위치 (360, 80). 정보 표시줄: (360, 150)에 둥근 알약(가로는 글자 폭 + 40, 높이 44, `info.bg` 알파 `info.bgAlpha`) + Jua 26px `info.text`. `setInfo`가 알약 폭을 다시 맞춘다
- [ ] **Step 2: GameScene 교체** — 타이틀 문자열은 지금 값 `'Ddooby-Pang'` 유지
- [ ] **Step 3: 확인** — 5174 스크린샷: 시안 `block-style.html` B안의 타이틀·표시줄과 비슷, 연쇄가 나면 `연쇄 xN`까지 알약 안에 들어감
- [ ] **Step 4: 커밋 `[feat] D-10 HUD restyle (Jua title, info pill)` → main → 메인 세션에 트랙 A 완료 보고**

---

## 트랙 B

### Task D-05: 블록 텍스처 + BlockSprite 교체

**Files:**
- Create: `src/view/theme/textures.ts`
- Modify: `src/view/BlockSprite.ts` (전면 교체), `src/view/BoardView.ts` (생성자에서 `ensureTextures` 호출), `src/config.ts` (`VIEW.blockColors` 삭제 한 줄만)

**Interfaces:**
- Consumes: `THEME.blocks / face`, `VIEW.blockScale`, `Block`, `Color`, `SpecialKind`
- Produces:
  ```ts
  // textures.ts
  export type Face = 'normal' | 'squint' | 'happy';
  export const TEX_SIZE = 160;                       // 텍스처 한 변(px). 칸(85px)보다 크게 그려 축소
  export function blockKey(color: Color | null, face: Face): string; // 'block-0-normal', 컬러 블록은 'block-rainbow-normal'
  export function specialKey(kind: Exclude<SpecialKind, 'color'>): string; // 'special-lineH' …
  export const FX_TEX = { heart: 'fx-heart', star: 'fx-star' } as const;
  export function ensureTextures(scene: Phaser.Scene): void; // 이미 있으면 건너뜀 (씬 재시작 대비)

  // BlockSprite.ts
  export class BlockSprite extends Phaser.GameObjects.Container {
    readonly blockId: number;
    removing: boolean;                                // BoardView가 제거 시작 시 true
    constructor(scene: Phaser.Scene, x: number, y: number, block: Block, cellSize: number);
    setFace(face: Face): this;
  }
  ```
- [ ] **Step 1: `ensureTextures`** — `Graphics`로 그려 `generateTexture(key, TEX_SIZE, TEX_SIZE)` 후 Graphics 파괴. 텍스처 7종(6색 + 무지개) × 3표정 = 21장 + 특수 4장 + 파티클 2장. 모양·얼굴 좌표는 시안 `docs/superpowers/specs/mocks/block-style.html`(B안 `s0`~`s5`, `#face`)과 `cascade-fx.html`(`#faceS` `><` 눈 + 작은 입, `#faceH` `^^` 눈 + 큰 웃음)을 그대로 옮긴다 (시안 좌표 -50~50 → 텍스처 0~160). 파랑 삼각형은 얼굴을 아래로 14, 초록 다이아몬드·주황 별은 얼굴을 작게(0.85 / 0.72)
- [ ] **Step 2: `BlockSprite`** — `Image(blockKey(...))` + 특수면 `Image(specialKey)` 겹침, `setDisplaySize(cellSize × VIEW.blockScale)`. `setFace`는 텍스처만 바꾼다
- [ ] **Step 3: `BoardView` 생성자 첫 줄에 `ensureTextures(scene)`**, 제거 시작 시 `sprite.removing = true`와 파괴 직전 `scene.tweens.killTweensOf(sprite)`
- [ ] **Step 4: 확인** — 5175 스크린샷이 시안 B안과 같은 블록. `?demo` 20턴 Console 에러 0. `npm test` PASS
- [ ] **Step 5: 커밋 `[feat] D-05 Block textures (6 colors x 3 faces) + image BlockSprite` → main**

### Task D-06: 말랑 움직임

**Files:**
- Modify: `src/view/BlockSprite.ts`, `src/view/BoardView.ts`

**Interfaces:**
- Consumes: `ANIM.squish / swapPop / squintHold / remove / swap`
- Produces: `BlockSprite.squish(): void` (기다리지 않는 연출), `BlockSprite.pop(scale: number, duration: number): void`

- [ ] **Step 1: 착지 눌림** — `squish()`: 아래쪽 기준으로 납작(가로 1.2, 세로 0.8) → 길쭉(0.9, 1.1) → 1, 합계 `ANIM.squish`. 원점을 바꾸지 말고 `scaleX/scaleY`만 트윈 (위치 불변). `fall`·`refill`의 `moveTo`가 끝나는 순간 호출하고 기다리지 않는다
- [ ] **Step 2: 스왑 팝** — `swap`·`swapBack` 때 두 블록을 `ANIM.swapPop`까지 커졌다 돌아오게 (`yoyo`, 길이 `ANIM.swap`)
- [ ] **Step 3: 터지기 전 `><`** — `remove`: `setFace('squint')` → `ANIM.squintHold` 뒤 기존 축소·투명 트윈. 전체 길이가 `ANIM.squintHold + ANIM.remove`를 넘지 않게
- [ ] **Step 4: 확인** — 5175 `?demo`로 눈으로 확인 + 20턴 `view ≠ board` 0
- [ ] **Step 5: 커밋 `[feat] D-06 Squishy motion (landing, swap pop, squint before pop)` → main**

### Task D-07: FxDirector + BoardView 알림

**Files:**
- Create: `src/view/fx/matchInfo.ts`, `src/view/fx/FxDirector.ts`
- Modify: `src/view/BoardView.ts`, `src/scenes/GameScene.ts` (`BoardView` 생성 줄과 그 다음 줄만)
- Test: `tests/view/matchInfo.test.ts`

**Interfaces:**
- Consumes: `cascadeToLevel` (D-02), `Face` (D-05), `GameEvent`, `MatchGroup`
- Produces:
  ```ts
  // matchInfo.ts (Phaser import 금지)
  export interface RemovedCell { at: Pos; color: Color | null; }
  export function removedFromMatch(groups: readonly MatchGroup[]): RemovedCell[];

  // BoardView.ts
  export interface BoardViewHooks { onMatch?(level: number, removed: readonly RemovedCell[]): void; }
  constructor(scene, board, layout, hooks?: BoardViewHooks)
  setFaces(face: Face): void;   // removing 인 스프라이트는 건너뜀

  // FxDirector.ts
  export class FxDirector {
    constructor(scene: Phaser.Scene, layout: Layout, faces: { setFaces(face: Face): void });
    playMatch(level: number, removed: readonly RemovedCell[]): void; // 기다리지 않음
    preview(level: number): void;                                     // D-11
  }
  ```
  GameScene: `let fx!: FxDirector; this.view = new BoardView(this, board, layout, { onMatch: (l, r) => fx.playMatch(l, r) }); fx = new FxDirector(this, layout, this.view);`

- [ ] **Step 1: 실패하는 테스트** — `removedFromMatch`: 그룹 2개(빨강 3칸, 파랑 4칸) → 7개, 각 칸의 `color`가 그룹 색, 순서는 그룹 순서 그대로. 빈 배열 → 빈 배열
- [ ] **Step 2: `npx vitest run matchInfo` → FAIL**
- [ ] **Step 3: 구현** — `BoardView.playEvent`의 `'match'`에서 `hooks.onMatch?.(cascadeToLevel(event.cascade), removedFromMatch(event.groups))`를 **동기로** 부르고 기존처럼 바로 끝난다. `FxDirector.playMatch`는 이 태스크에서 빈 함수
- [ ] **Step 4: `npm test` PASS, 5175 `?demo` 20턴 에러 0**
- [ ] **Step 5: 커밋 `[feat] D-07 FxDirector skeleton + BoardView onMatch hook` → main**

### Task D-08: 조각 파티클

**Files:**
- Modify: `src/view/fx/FxDirector.ts`

**Interfaces:**
- Consumes: `fxLevel`, `particleCount` (D-02), `FX_TEX` (D-05), `cellCenter`, `THEME.blocks`, `THEME.star`

- [ ] **Step 1: 이미터 두 개를 생성자에서 한 번 만든다** — `scene.add.particles(0, 0, FX_TEX.heart, { emitting: false, speed: {min: 120, max: 260}, angle: {min: 200, max: 340}, gravityY: 500, lifespan: 700, scale: {start: 0.35, end: 0.1}, alpha: {start: 1, end: 0} })`, 별도 같은 방식(`FX_TEX.star`, 사방으로 `angle 0~360`, 회전). 깊이는 블록 위
- [ ] **Step 2: `playMatch`** — 총 개수 `particleCount(level, removed.length)`를 칸마다 고르게 나눠 `emitter.explode(n, x, y)`, 하트는 그 칸 블록 색으로 `setParticleTint` (컬러 블록은 흰색). `stars`면 칸마다 별 1~2개 추가 (상한 안에서)
- [ ] **Step 3: 확인** — 5175 `?demo`에서 단계가 오를수록 조각이 많아짐, 긴 연쇄에서도 끊김 없음 (DevTools Performance로 한 번 녹화해 프레임 확인)
- [ ] **Step 4: 커밋 `[feat] D-08 Cascade particles (hearts tinted per block, stars from level 2)` → main**

### Task D-09: 칭찬 문구 + 흔들림 + `^^`

**Files:**
- Modify: `src/view/fx/FxDirector.ts`

**Interfaces:**
- Consumes: `fxLevel` (`praise`, `praiseScale`, `praiseColor`, `shake`, `happy`), `FX.happyMs`, `THEME.font`

- [ ] **Step 1: 칭찬 문구** — `praise`가 있으면 Jua `72 × praiseScale`px, 색 `praiseColor`, 흰 테두리 12px, 위치 (보드 가운데 x, `layout.y + layout.height × 0.3`), 맨 위 깊이. 트윈: 크기 0 → 1.25 → 1 (0.25초) → 0.5초 유지 → 위로 30px 뜨며 사라짐 (0.4초) → 파괴. 이전 문구가 남아 있으면 즉시 파괴하고 새로 띄운다
- [ ] **Step 2: 흔들림** — `shake`가 있으면 `scene.cameras.main.shake(duration, intensity)`
- [ ] **Step 3: `^^`** — `happy`면 `faces.setFaces('happy')`, 타이머 **하나**를 `FX.happyMs`로 (이미 있으면 취소 후 다시), 끝나면 `faces.setFaces('normal')`
- [ ] **Step 4: 확인** — 5175 `?demo` 20턴: 문구·흔들림·웃음이 단계에 맞게, 연쇄가 끝나면 모든 블록이 평소 표정으로 돌아옴, 에러 0
- [ ] **Step 5: 커밋 `[feat] D-09 Praise text, camera shake, happy faces` → main**

### Task D-11: 개발용 이펙트 미리보기

**Files:**
- Modify: `src/view/fx/FxDirector.ts` (`preview`), `src/scenes/GameScene.ts` (`create()` 끝의 `if (import.meta.env.DEV)` 블록 안에만)

- [ ] **Step 1: `preview(level)`** — 보드 가운데 행의 3칸(`{r: 3, c: 2..4}`)을 제거된 것처럼 만들어 `playMatch(level, cells)` 호출. 블록 상태는 바꾸지 않는다
- [ ] **Step 2: GameScene** — DEV에서만 `this.input.keyboard?.on('keydown', (e) => { const n = Number(e.key); if (n >= 1 && n <= 5) fx.preview(n); })`
- [ ] **Step 3: 확인** — 5175에서 키 1~5를 눌러 각 단계 연출 확인, `npm run build` 결과물(`npx vite preview --port 5176`)에서는 키가 반응하지 않음
- [ ] **Step 4: 커밋 `[feat] D-11 DEV FX preview keys 1-5` → main → 메인 세션에 트랙 B 완료 보고**

---

## 완료 (메인 세션)

- 두 트랙 보고를 받아 `docs/TASKS.md` 체크, `docs/DEVELOPMENT.md` 4절(확인 방법)·6절(Study for App), `CLAUDE.md`/`AGENTS.md`(새 파일 위치) 갱신
- 디자인 완료 기준 확인: `?demo` 연쇄 단계별 연출 + 휴대폰 브라우저 끊김 없음 + `npm test` 전부 통과
- worktree 정리: `git worktree remove ../ddooby-pang-A`, `../ddooby-pang-B`
