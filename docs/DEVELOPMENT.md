# 개발 가이드

> VSCode에서 프로젝트를 열고, 서버를 띄우고, 작업 결과를 확인하는 방법.
> 태스크가 끝날 때마다 아래 **작업별 확인 방법**에 항목을 추가한다.

---

## 1. 처음 한 번

1. Node.js 20.19 이상 설치 (`node -v`로 확인)
2. repo 받기
   ```bash
   gh repo clone Ddoobyddooby/ddooby-pang
   cd ddooby-pang
   ```
3. VSCode로 열기: `code .`
   - `code` 명령이 없으면 VSCode에서 `Cmd+Shift+P` → "Shell Command: Install 'code' command in PATH"
4. 의존성 설치: VSCode 터미널(`` Ctrl+` ``)에서 `npm install`
5. 추천 확장 설치: 처음 열면 오른쪽 아래에 "추천 확장을 설치할까요?" 알림이 뜬다 → 설치
   - ESLint, Prettier, Vitest (목록은 `.vscode/extensions.json`)
   - 설치하면 저장할 때 자동 포맷되고, 규칙 위반은 빨간 밑줄로 보인다

## 2. 매일 쓰는 명령

VSCode 터미널에서 실행한다. 터미널은 `+` 버튼으로 여러 개 열 수 있다 (서버용 1개, 테스트용 1개 권장).

| 명령 | 용도 |
|---|---|
| `npm run dev` | 개발 서버. 코드를 저장하면 브라우저가 자동 갱신된다. 끄려면 `Ctrl+C` |
| `npm test` | 테스트 한 번 실행 |
| `npm run test:watch` | 파일을 저장할 때마다 테스트 자동 재실행. 끄려면 `q` |
| `npm run typecheck` | 타입 에러만 확인 |
| `npm run lint` | ESLint 규칙 검사 (core 의존성 규칙 포함) |
| `npm run format` | Prettier로 코드 정리 (md 문서는 제외) |
| `npm run build` | 타입체크 + 배포용 빌드 (`dist/`) |

## 3. 게임 화면 확인하기

1. `npm run dev` 실행 → 터미널에 주소가 뜬다
   ```
   ➜  Local:   http://localhost:5173/
   ➜  Network: http://192.168.x.x:5173/
   ➜  VPN : http://100.x.x.x:5173/
   ```
2. **PC 브라우저**: `Local` 주소를 연다 (`Cmd` + 클릭)
3. **휴대폰 크기로 보기**: Chrome 개발자도구(`Cmd+Option+I`) → 기기 툴바(`Cmd+Shift+M`) → iPhone 등 선택
4. **실제 휴대폰으로 보기**: PC와 같은 Wi-Fi에 연결한 뒤 휴대폰 브라우저로 `Network` 주소를 연다
5. 에러가 나면 개발자도구의 **Console** 탭을 확인한다

**URL 옵션 (개발용)**

| 주소 | 동작 |
|---|---|
| `http://localhost:5173/` | 매번 다른 보드 (화면 위에 seed가 표시된다) |
| `http://localhost:5173/?seed=1001` | 항상 같은 시작 보드. 버그를 봤으면 seed를 적어두고 이 주소로 재현 |
| `http://localhost:5173/?demo` | 힌트 수를 자동으로 둔다 (`?seed=42&demo`처럼 같이 써도 된다) |

개발 모드(`npm run dev`)에서는 매 턴 화면과 게임 상태가 같은지 검사한다. Console에 `[game] view ≠ board`가 찍히면 버그이니 seed와 함께 기록해두자.

## 4. 작업별 확인 방법

### W1-01 프로젝트 세팅
- `npm run dev` → 브라우저에 어두운 배경과 가운데 "ddooby-pang" 글자가 보이면 정상
- 창 크기를 바꿔도 세로 화면 비율(720x1280)을 유지하며 가운데 정렬된다

### W1-02 Vitest
- `npm test` → 아래처럼 나오면 정상
  ```
  Test Files  1 passed (1)
       Tests  1 passed (1)
  ```
- 테스트 파일 위치: `tests/**/*.test.ts`
- 테스트가 실패하는 걸 직접 보고 싶으면 `tests/sample.test.ts`의 `toBe(63)`을 `toBe(64)`로 바꿔 저장해본다 (확인 후 되돌리기)

### W1-03 ESLint + Prettier
- `npm run lint` → 아무 출력 없이 끝나면 정상
- core 규칙 직접 확인: `src/core/test.ts` 파일을 만들고 아래를 넣어본다 → VSCode에 빨간 밑줄, `npm run lint`에 에러 3개. 확인 후 파일 삭제
  ```ts
  import Phaser from 'phaser';
  export const a = [Phaser, Math.random(), window];
  ```
- 같은 코드를 `src/main.ts`에 쓰면 에러가 안 난다 (core만 막는 규칙)
- 코드 파일을 저장할 때 따옴표·들여쓰기가 자동 정리되면 Prettier 확장이 잘 붙은 것

### W1-04 폴더 구조 + config
- VSCode 탐색기에서 `src/` 아래 `core / modes / scenes / view / data / storage` 폴더가 보이면 정상 (빈 폴더는 `.gitkeep`으로 git에 올라가 있다)
- `npm run dev` → W1-01과 같은 화면이 그대로 나와야 한다 (BootScene을 `src/scenes/`로 옮기기만 했다)
- 수치 바꿔보기: `src/config.ts`의 `GAME.backgroundColor`를 `'#004400'`로 바꾸고 저장 → 브라우저 배경이 초록으로 바뀐다 (확인 후 되돌리기)

### W1-05 core 타입
- `npm test` → `tests/core/types.test.ts` 5개 통과
- `npm run typecheck` → 통과. **타입 테스트는 typecheck가 실제 검사를 한다** (런타임엔 타입이 없으니까)
- 직접 확인: `src/core/types.ts`에서 `Color`의 `| 5`를 지우고 `npm run typecheck` → 에러. 되돌리기
- VSCode에서 `GameEvent` 위에 마우스를 올리면 이벤트 종류가 다 보인다

### W1-06 RNG
- `npm test` → `tests/core/rng.test.ts` 6개 통과 (같은 seed → 같은 수열, 원본 mulberry32와 일치, 분포 균등)
- 한 파일만 돌리기: `npx vitest run rng`
- VSCode 왼쪽 **테스트(플라스크 아이콘)** 탭에서 테스트별로 ▶ 실행할 수도 있다 (Vitest 확장)

### W1-07 보드 테스트 헬퍼
- `npm test` → `tests/helpers/board.test.ts` 7개 통과
- 표기법은 `tests/helpers/board.ts` 맨 위 주석에 있다. 앞으로 core 테스트는 전부 이 표기로 보드를 적는다
  ```
  R Y G      R=빨강 Y=노랑 G=초록 B=파랑 P=보라 O=주황
  B* C .     * 폭탄  C 컬러  . 빈칸  - | 라인  + 슈퍼
  ```

### W1-08 보드 생성
- `npm test` → `tests/core/board.test.ts` 통과. 색 3~6종 × seed 200개씩 만든 보드에 시작 매치가 없는지 검사한다
- 테스트가 진짜 잡는지 보기: `src/core/board.ts`의 `if (!banned.has(k as Color))`를 지워 저장 → `npm run test:watch`에서 실패가 뜨고, 실패 메시지에 문제의 보드가 그림으로 찍힌다. 되돌리기

### W1-09 매치 판정
- `npm test` → `tests/core/matcher.test.ts` 16개 통과
- 테스트 파일에서 보드 그림과 기대 결과를 나란히 보면 규칙이 한눈에 보인다: 3I, 4I, 5I, L, T, +, 6+, 떨어진 같은 색, 평행한 두 줄, 컬러 블록 제외
- 직접 실험: 테스트 하나를 복사해서 보드 그림만 바꿔보고 `npm run test:watch`로 결과를 확인해보자

### W1-10 낙하 / 리필
- `npm test` → `tests/core/gravity.test.ts` 9개 통과
- 테스트의 "전 / 후" 보드 그림을 보면 블록이 어떻게 내려가는지 보인다. `fall` 이벤트의 `from → to`, `refill` 이벤트의 `dropFrom`이 나중에 애니메이션(W1-16)의 입력이 된다

### W1-11 가능한 수 / 셔플
- `npm test` → `tests/core/moves.test.ts` 11개 통과
- `NO_MOVE` 보드(테스트 파일 맨 위)를 보고 정말 둘 수가 없는지 직접 찾아보자. 그 보드를 셔플하면 수가 생긴다
- 변경 사항: `shuffle` 이벤트가 `{ id, to }` 대신 `{ block, to }`를 담도록 바꿨다 (PLAN 4.2도 수정). 셔플이 실패해 보드를 새로 만들면 색과 id가 바뀌기 때문

### W1-12 처리 루프 (resolveSwap)
- `npm test` → `tests/core/engine.test.ts` 9개 통과
- 테스트의 `CASCADE` 보드를 종이에 그려서 따라가 보자: (3,0)↔(3,1) 스왑 → 세로 RRR 제거 → P가 3칸 떨어져 맨 아랫줄 PPP → 연쇄
- 결과의 `steps`가 애니메이션 대본이다. `[swap]` → `[match, remove]` → `[fall, refill]` → (연쇄 반복) → `[shuffle]`(필요할 때만)
- 아직 화면에는 연결되지 않았다 (W1-18에서 연결)

### W1-13 seed 1~1000 초기 보드
- `npm test` → `tests/core/initialBoard.test.ts` 통과 (색 5종·6종 × seed 1000개)
- SPEC 10절 수용 기준 2개(시작 보드 매치 0 + 수 ≥ 1, 같은 seed → 같은 보드)를 이 테스트가 확인한다
- `tests/core/__snapshots__/initialBoard.test.ts.snap`을 열면 seed 1001의 시작 보드가 그림으로 저장돼 있다
- 보드 생성 코드를 일부러 바꿔서 스냅샷이 다르게 나오면 테스트가 실패한다. **의도한 변경이면** `npx vitest run -u`로 스냅샷을 갱신한다 (기존 스테이지의 시작 보드가 바뀐다는 뜻이니 신중하게)

### W1-14 퍼즈 테스트
- `npm test` → `tests/core/fuzz.test.ts` 5개 통과 (8x8 색 3~6종 각 1000수 + 5x5 1000수, 1초 안쪽)
- 매 수마다 확인하는 것: 예외 없음, 빈칸 0, 매치 0, 가능한 수 ≥ 1, id 중복 없음, **이벤트만 재생해도 최종 보드와 같음**
- 실패하면 메시지에 `seed`, `turn`, 그때의 보드 그림이 나온다 → 그 seed로 바로 재현 가능
- 직접 확인: `src/core/gravity.ts`에서 `moves.push(...)` 앞에 `if (c !== 0)`을 붙여 저장 → 퍼즈 테스트가 `refill: 0,0가 비어 있지 않다`로 실패. 되돌리기
- **여기까지가 1주차 core 완료**. 다음 W1-15~18에서 화면(view)을 붙이면 브라우저에서 실제로 플레이할 수 있다

### W1-15 블록 그리기
- `npm run dev` → 8x8 보드(seed 1001)에 색과 모양이 다른 블록 6종이 보이고, 아래에 특수 블록 표시 5종(가로줄, 세로줄, 폭탄, 슈퍼, 컬러)이 보이면 정상
  - 빨강 원 · 노랑 둥근 사각형 · 초록 다이아몬드 · 파랑 삼각형 · 보라 육각형 · 주황 별
- `npm test` → `tests/view/layout.test.ts` 4개 통과 (칸 ↔ 화면 좌표 변환)
- 색 바꿔보기: `src/config.ts`의 `VIEW.blockColors` 첫 값을 `0x000000`으로 → 빨강 원이 검정이 된다. 되돌리기

### W1-16 이벤트 재생 (BoardView)
- `npm run dev` → "ddooby-pang (demo)" 화면에서 힌트 수를 자동으로 두며 스왑 → 사라짐 → 낙하 → 리필 → 연쇄가 1초 간격으로 반복된다 (W1-18 전까지 임시 데모)
- 개발자도구 Console에 `[demo] turn N ok`가 계속 찍히면 정상. 스프라이트의 실제 위치와 core 보드를 매 턴 대조한 결과다. `view ≠ board`가 찍히면 버그
- 애니메이션 속도 바꿔보기: `src/config.ts`의 `ANIM.fallPerCell`을 `300`으로 → 낙하가 느려져서 동작이 잘 보인다. 되돌리기
- `npm test` → `tests/view/eventTracker.test.ts` 3개 + 퍼즈 테스트가 view의 `EventTracker`도 검사한다

### W1-17 스와이프 입력
- `npm run dev` → "블록을 밀어보세요" 화면. 블록을 마우스로 눌러 옆으로 끌면 위 글자가 `swap (3,3) → (3,4)`처럼 바뀐다 (아직 블록은 안 움직인다. W1-18에서 연결)
- 확인할 것: 조금만 끌면(칸의 30% 미만) 반응 없음 / 대각선으로 끌면 더 많이 움직인 방향 / 보드 끝에서 바깥으로 밀면 반응 없음 / 한 번 누르면 스왑은 한 번만
- 휴대폰으로도 확인: `npm run dev`의 `Network` 주소를 휴대폰에서 열고 손가락으로 밀어보기 (터치도 같은 코드로 처리된다)
- `npm test` → `tests/view/input.test.ts` 5개 통과

### W1-18 GameScene (1주차 완료)
- `npm run dev` → 블록을 밀어서 같은 색 3개를 맞추면 터지고, 위에서 블록이 떨어지고, 연쇄가 일어난다. 화면 위에 `seed · 이동 수 · 연쇄 xN`이 보인다
- 확인할 것:
  - 매치가 안 되는 방향으로 밀면 블록이 바뀌었다가 **되돌아오고** 이동 수가 늘지 않는다
  - 애니메이션 중에 다른 블록을 밀어도 **무시**된다
  - 수가 없어지면 블록이 섞인다 (자주 일어나진 않는다)
  - Console에 빨간 에러(`view ≠ board`)가 없다
- `?seed=1001`로 열면 매번 같은 보드, `?demo`로 열면 자동 플레이
- **1주차 완료 기준**: 브라우저에서 3매치·연쇄가 돈다 + `npm test` 전부 통과 → 둘 다 충족

## 5. 문제 해결

| 증상 | 해결 |
|---|---|
| `Port 5173 is in use` | 다른 터미널에서 서버가 이미 떠 있다. 그 터미널에서 `Ctrl+C`, 또는 Vite가 제안하는 다른 포트를 쓴다 |
| `vite: command not found` 등 | `npm install`을 안 했거나 실패했다. 다시 실행 |
| 휴대폰에서 `Network` 주소가 안 열림 | 같은 Wi-Fi인지 확인. macOS 방화벽이 Node 연결을 막고 있는지 확인 |
| 화면이 갱신 안 됨 | 브라우저 강력 새로고침 `Cmd+Shift+R` |

## 6. Study for App

> 태스크마다 같이 공부하면 좋은 개념. **이 프로젝트의 어느 파일에서 쓰이는지**를 같이 적었으니 코드를 열어놓고 읽으면 좋다.

### W1-01 프로젝트 세팅
- **Vite**: 개발 서버 + 번들러. 저장하면 바로 반영되는 HMR, `npm run build`가 만드는 `dist/`의 정체 → `vite.config.ts`
- **TypeScript strict 옵션**: `strict`, `noUncheckedIndexedAccess`(배열 `a[i]`가 `undefined`일 수 있다고 봄)가 왜 버그를 줄이는지 → `tsconfig.json`
- **Phaser 게임 설정과 Scene**: `new Phaser.Game(config)`, Scene의 `preload / create / update` 생명주기, `Scale.FIT`으로 여러 화면 크기 대응 → `src/main.ts`
- 참고: [Vite 가이드](https://vite.dev/guide/), [TS tsconfig 레퍼런스](https://www.typescriptlang.org/tsconfig/), [Phaser 3 Scenes](https://docs.phaser.io/phaser/concepts/scenes)

### W1-02 Vitest
- **단위 테스트의 구조**: `describe`(묶음) / `it`(한 가지 동작) / `expect(...).toBe(...)`(기대값) → `tests/sample.test.ts`
- **왜 게임 로직부터 테스트하나**: 매치·낙하·연쇄는 눈으로 확인하기 어렵고, 고치다가 다른 곳이 깨지기 쉽다. 테스트가 안전망이 된다
- **watch 모드**: `npm run test:watch`를 띄워두고 코드를 고치면 바로 결과가 보인다 (TDD의 빨강 → 초록 흐름)
- 참고: [Vitest 시작하기](https://vitest.dev/guide/)

### W1-03 ESLint + Prettier
- **린터와 포매터의 차이**: ESLint는 "잘못될 수 있는 코드"를 잡고, Prettier는 "모양"만 맞춘다. 둘이 충돌하지 않게 `eslint-config-prettier`로 겹치는 규칙을 끈다 → `eslint.config.js`
- **Flat config**: ESLint 9부터의 설정 방식. 배열 순서대로 덮어쓰고, `files`로 특정 폴더에만 규칙을 건다
- **린트로 아키텍처 지키기**: `no-restricted-imports`로 `src/core`가 Phaser·view를 못 가져오게 막았다. "규칙을 문서에만 쓰지 말고 도구로 강제한다"는 생각이 핵심
- 참고: [ESLint 설정](https://eslint.org/docs/latest/use/configure/configuration-files), [typescript-eslint](https://typescript-eslint.io/getting-started/), [Prettier 왜 쓰나](https://prettier.io/docs/why-prettier)

### W1-04 폴더 구조 + config
- **계층형 구조와 의존 방향**: `scenes → view/modes → core`. 아래 계층은 위 계층을 모른다. 그래서 core만 떼어 테스트하거나, 나중에 Phaser 대신 다른 렌더러를 붙일 수 있다 → `README.md`의 아키텍처 그림
- **설정값 분리 (매직 넘버 제거)**: 점수 `120`이 코드 곳곳에 박혀 있으면 조정할 때 다 찾아야 한다. `SCORE.match4`처럼 이름을 붙여 한 곳에 모은다 → `src/config.ts`
- **`as const`**: 객체를 읽기 전용 + 리터럴 타입으로 만든다. `GAME.width`가 `number`가 아니라 `720` 타입이 되고, 실수로 값을 바꾸는 코드를 컴파일러가 막는다
- **ES 모듈 `import / export`**: 파일 하나가 모듈 하나. `export class BootScene` → `import { BootScene } from './scenes/BootScene'` → `src/main.ts`
- 참고: [TS const assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions), [MDN 모듈](https://developer.mozilla.org/ko/docs/Web/JavaScript/Guide/Modules)

### W1-05 core 타입
- **유니온 타입과 판별 유니온(discriminated union)**: `GameEvent`는 `type` 필드 값으로 종류를 구분한다. `if (e.type === 'fall')` 안에서는 TS가 `e.moves`가 있다는 걸 안다. 이벤트 기반 설계의 핵심 도구 → `src/core/types.ts`
- **`readonly`와 불변 데이터**: 보드를 직접 고치지 않고 매번 새 보드를 만든다. `readonly`를 붙이면 실수로 고치는 코드를 컴파일러가 막는다. 버그 추적과 되돌리기(undo)가 쉬워진다
- **2차원 보드를 1차원 배열로**: `cells[r * cols + c]`. 복사·비교가 단순해진다
- **`interface` vs `type`**: 객체 모양은 `interface`, 유니온·조합은 `type`으로 쓰는 게 일반적
- **타입 테스트**: `expectTypeOf`로 "타입이 내가 의도한 모양인지"를 테스트한다 → `tests/core/types.test.ts`
- 참고: [TS 핸드북: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions), [Vitest 타입 테스트](https://vitest.dev/guide/testing-types)

### W1-06 RNG
- **의사난수(PRNG)와 seed**: 컴퓨터의 "랜덤"은 공식으로 만든 수열이다. 시작값(seed)이 같으면 수열도 같다. 덕분에 "seed 1001에서 버그"처럼 버그를 재현할 수 있다 → `src/core/rng.ts`
- **왜 `Math.random`을 금지했나**: seed를 지정할 수 없어서 테스트가 매번 다른 보드로 돌고, 실패를 재현할 수 없다
- **순수 함수로 만든 RNG**: 내부에 상태를 숨기지 않고 `next(state) → [값, 새 상태]`로 상태를 밖으로 꺼냈다. 상태가 `GameState`에 들어가니 게임 전체가 결정적이 된다
- **비트 연산**: `| 0`(32비트 정수로 자르기), `>>>`(부호 없는 오른쪽 시프트), `Math.imul`(32비트 곱셈). mulberry32가 짧은 코드로 빠른 이유
- **`[0,1)` → 정수**: `Math.floor(v * n)`으로 0~n-1. 블록 색을 고를 때 쓴다
- **기준 구현(oracle)으로 테스트**: 결과값을 손으로 적는 대신, 검증된 원본 구현과 비교한다 → `tests/core/rng.test.ts`
- 참고: [MDN 비트 연산자](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Operators#비트_시프트_연산자), [PRNG (위키백과)](https://ko.wikipedia.org/wiki/유사난수_생성기)

### W1-07 보드 테스트 헬퍼
- **테스트를 읽기 쉽게 만드는 DSL**: `{ id: 1, color: 0 }` 64개를 손으로 쓰는 대신 `R G B` 문자열로 보드를 그린다. 테스트가 "그림"이 되어 무엇을 검사하는지 한눈에 보인다 → `tests/helpers/board.ts`
- **왕복(round-trip) 테스트**: `printBoard(parseBoard(text)) === text`. 변환 함수 쌍을 검증하는 간단하고 강력한 방법
- **실패 메시지도 기능이다**: 잘못된 표기에 "1행의 칸 수가 다르다"처럼 위치를 알려주면 테스트를 고치는 시간이 줄어든다
- **문자열 처리**: `trim`, `split(/\s+/)`(공백 여러 개로 자르기), `padEnd`(폭 맞추기), `flat`(2차원 → 1차원)
- 참고: [MDN String](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/String), [MDN 정규식](https://developer.mozilla.org/ko/docs/Web/JavaScript/Guide/Regular_expressions)

### W1-08 보드 생성
- **불변 업데이트 패턴**: `cells.slice()`로 복사 → 한 칸만 바꿈 → `{ ...board, cells }`로 새 객체. 원본은 그대로라 "바뀌기 전 보드"를 언제든 다시 볼 수 있다 → `setBlock`, `swapBlocks`
- **제약을 지키며 채우는 생성 (greedy)**: 칸을 순서대로 채우면서 "왼쪽 2칸 또는 위 2칸과 같은 색"만 피하면 매치가 절대 생기지 않는다. 다시 뽑는 방식보다 빠르고 항상 끝난다 → `createBoard`
- **맨해튼 거리**: `|Δr| + |Δc| === 1`이면 상하좌우로 붙어 있다 → `isAdjacent`
- **파라미터화 테스트**: `it.each([3,4,5,6])`로 같은 테스트를 여러 입력에 돌린다. 실패 메시지에 seed와 보드 그림을 넣어서 바로 재현할 수 있게 했다
- **뮤테이션 테스트(개념)**: 코드를 일부러 망가뜨렸을 때 테스트가 실패하는지 본다. 통과만 하는 테스트는 아무것도 지켜주지 않을 수 있다
- 참고: [MDN 전개 구문](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Operators/Spread_syntax), [Vitest test.each](https://vitest.dev/api/#test-each)

### W1-09 매치 판정
- **run 스캔**: 한 줄을 왼쪽부터 보며 "같은 색이 몇 개 이어지나"를 센다. 색이 바뀌는 순간 길이가 3 이상이면 run으로 기록 → `collectRuns`
- **Union-Find (Disjoint Set)**: "같은 집합인가?"를 빠르게 답하는 자료구조. run의 칸들을 한 집합으로 묶으면, 가로 run과 세로 run이 칸을 공유할 때 자동으로 하나로 합쳐진다. L / T / + 모양이 이렇게 하나의 그룹이 된다 → `createUnionFind`
  - 경로 압축: `find`할 때 부모를 할아버지로 당겨서 트리를 납작하게 만든다
- **`Map` / `Set`**: 루트별 run 모으기(`Map<number, Run[]>`), 중복 없는 칸 모으기(`Set<number>`)
- **결정적 출력**: `Map` 순서에 기대지 않고 그룹을 왼쪽 위 칸 기준으로 정렬한다. 테스트와 리플레이가 항상 같은 결과를 내게 하려면 "순서"도 정해야 한다
- **테스트도 틀릴 수 있다**: 이번에 6+ 테스트 보드의 채움 칸에 `Y Y Y`를 넣어서 테스트가 먼저 틀렸다. 실패하면 코드와 테스트 중 어느 쪽이 틀렸는지 먼저 판단한다
- 참고: [Union-Find (위키백과)](https://ko.wikipedia.org/wiki/서로소_집합_자료_구조), [MDN Map](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Map)

### W1-10 낙하 / 리필
- **투 포인터로 압축하기**: 열을 아래에서 위로 읽는 포인터(`r`)와 "다음에 내려앉을 자리" 포인터(`write`)를 따로 둔다. 블록을 만날 때마다 `write`로 옮기고 한 칸 올린다. 배열에서 빈칸을 한 번에 제거하는 고전 기법 → `applyGravity`
- **상태 변화 = 이벤트**: core는 "R이 (0,0)에서 (3,0)으로 이동"을 이벤트로 남긴다. view는 이걸 보고 트윈만 만든다. 화면은 상태를 계산하지 않는다
- **`Extract<유니온, 조건>`**: `GameEvent` 중 `type: 'fall'`인 것만 뽑는 유틸리티 타입 → `FallEvent`
- **리필이 매치를 피하지 않는 이유**: 새로 떨어진 블록이 우연히 맞으면 연쇄가 일어난다. 그게 매치-3의 재미
- 이번에도 테스트 기대값을 잘못 써서 한 번 고쳤다. **기대값은 손으로 계산해서 적는다** (코드를 돌려 나온 값을 그대로 붙이면 버그도 같이 굳는다)
- 참고: [TS 유틸리티 타입](https://www.typescriptlang.org/docs/handbook/utility-types.html#extracttype-union)

### W1-11 가능한 수 / 셔플
- **전수 탐색(brute force)도 충분할 때가 있다**: 8x8이면 인접한 쌍이 112개뿐이다. 영리한 알고리즘보다 "다 해보기"가 단순하고 버그가 적다. 대신 스왑한 두 칸을 지나는 줄만 검사해서 빠르게 했다 → `hasMatchThrough`
- **Fisher-Yates 셔플**: 뒤에서부터 `i`번째와 `0..i` 중 랜덤 하나를 바꾼다. 모든 순서가 같은 확률로 나오는 표준 셔플. `sort(() => Math.random() - 0.5)`는 편향이 있어서 쓰면 안 된다 → `shuffle`
- **재시도 + 상한 + 대비책**: "조건을 만족할 때까지 다시"는 무한 루프가 될 수 있다. 상한(100회)을 두고, 넘으면 확실히 끝나는 대비책(새로 생성)을 둔다
- **기준 구현과 비교하는 테스트**: 빠른 `hasAnyMove`를 느리지만 확실한 전수 탐색과 랜덤 보드 300개로 비교했다
- **"불가능한 입력" 만들기**: 수 없는 보드는 `(c + 2r) % 4` 같은 규칙적인 패턴으로 만들었다. 이번에도 "3색 3개씩이면 못 푼다"는 내 가정이 틀려서 테스트가 먼저 실패했다
- 참고: [Fisher-Yates (위키백과)](https://ko.wikipedia.org/wiki/피셔-예이츠_셔플)

### W1-12 처리 루프 (resolveSwap)
- **게임 루프를 함수 하나로**: 입력(상태 + 스왑) → 출력(새 상태 + 단계별 이벤트). 화면과 시간에 상관없이 "결과"를 한 번에 계산하고, 화면은 그걸 천천히 재생한다. Redux의 reducer와 같은 생각이다 → `src/core/engine.ts`
- **오케스트레이션**: engine은 직접 계산을 거의 안 한다. matcher, gravity, moves를 순서대로 부르고 이벤트를 모은다. 각 모듈을 따로 테스트했기 때문에 engine 테스트는 "흐름"에만 집중할 수 있다
- **불변 조건(invariant)과 assert**: "resolve가 끝나면 빈칸 0, 매치 0, 수 ≥ 1"을 매번 검사하고 어기면 바로 에러. 버그가 화면에서 이상하게 보이기 전에 원인 근처에서 멈추게 한다 → `assertInvariants`
- **무한 루프 방지 상한**: 연쇄가 50번을 넘으면 에러. 테스트에서는 색을 1개로 만들어 일부러 무한 연쇄를 일으켜 상한이 동작하는지 확인했다
- **상태를 "덮어쓰지 않는" 루프**: `board = ...`로 지역 변수만 갈아끼우고, 들어온 `state`는 그대로 둔다. 그래서 매치 없는 스왑은 원래 `state` 객체를 그대로 돌려줄 수 있다
- 참고: [Redux: reducer 개념](https://redux.js.org/tutorials/fundamentals/part-3-state-actions-reducers), [Invariant (위키백과)](https://en.wikipedia.org/wiki/Invariant_(mathematics)#Invariants_in_computer_science)

### W1-13 seed 1~1000 초기 보드
- **수용 기준을 테스트로 옮기기**: SPEC의 "seed 1~1000에서 매치 0, 수 ≥ 1"을 그대로 코드로 적었다. 문서의 약속이 자동으로 지켜지는지 매번 확인된다 → `tests/core/initialBoard.test.ts`
- **스냅샷 테스트**: 결과를 파일에 저장해두고 다음 실행 결과와 비교한다. "값이 맞는지"보다 "**바뀌었는지**"를 잡는 용도. 여기서는 스테이지 1의 시작 보드가 몰래 바뀌는 걸 막는다
- **결정성(determinism)의 가치**: 같은 seed → 같은 보드. 조카가 "3번 스테이지 시작하자마자 이상해"라고 하면 seed로 똑같은 보드를 다시 만들어볼 수 있다
- **`describe.each`**: 테스트 묶음 전체를 여러 설정(색 5종, 6종)으로 반복한다
- 참고: [Vitest 스냅샷](https://vitest.dev/guide/snapshot.html)

### W1-14 퍼즈 테스트
- **퍼즈(fuzz) 테스트**: 사람이 생각하지 못한 입력을 대량으로 넣어서 깨지는지 본다. 예제 테스트가 "이 경우는 된다"를 보여준다면, 퍼즈는 "어떤 경우에도 이 규칙은 지켜진다"를 확인한다
- **속성 기반 테스트(property-based testing)**: 정답 값 대신 **항상 참이어야 하는 속성**(빈칸 0, 매치 0, id 중복 없음)을 검사한다. 정답을 몰라도 테스트할 수 있다
- **재현 가능한 랜덤**: 퍼즈도 seed RNG로 돌린다. 실패하면 seed와 턴 번호로 똑같이 다시 돌릴 수 있다. `Math.random`으로 퍼즈를 돌리면 "가끔 실패하는 테스트"가 되어 원인을 못 찾는다
- **계약(contract) 테스트**: `replay`는 view가 할 일을 흉내 낸다. "이벤트만 따라가도 최종 보드가 된다"는 core와 view 사이의 약속을 테스트로 고정했다. 화면을 만들기 전에 화면 버그의 한 종류를 미리 없앤 셈이다
- **`switch`와 완전성**: 이벤트 종류마다 `case`를 두고, 아무것도 안 하는 종류도 명시했다. 새 이벤트를 추가하면 어디를 고쳐야 하는지 보인다
- 참고: [Fuzzing (위키백과)](https://ko.wikipedia.org/wiki/퍼징), [fast-check: 속성 기반 테스트 소개](https://fast-check.dev/docs/introduction/)

### W1-15 블록 그리기
- **좌표계 두 개**: 게임 로직은 (행, 열), 화면은 (x, y) 픽셀. 변환을 `layout.ts` 한 곳에 모아 순수 함수로 만들었더니 Phaser 없이 테스트할 수 있었다 → `src/view/layout.ts`
- **Phaser Graphics로 도형 그리기**: `fillStyle` → `fillCircle / fillRoundedRect / fillPoints`. 이미지 파일 없이 코드로 그린다. 나중에 에셋으로 바꿔도 `BlockSprite`만 고치면 된다 → `src/view/BlockSprite.ts`
- **Container**: 도형 + 하이라이트 + 특수 표시를 묶어 하나처럼 움직이고 크기를 바꾼다. 트윈(W1-16)에서 이 묶음을 통째로 움직인다
- **극좌표로 다각형 만들기**: 꼭짓점 = `(cos θ · r, sin θ · r)`. 삼각형·육각형·별이 같은 공식으로 나온다 → `regularPolygon`, `star`
- **접근성(색각 이상)**: 색만으로 구분하면 일부 사람은 빨강·초록을 헷갈린다. 모양을 같이 바꾸면 누구나 구분할 수 있다
- 참고: [Phaser Graphics](https://docs.phaser.io/phaser/concepts/gameobjects/graphics), [Phaser Container](https://docs.phaser.io/phaser/concepts/gameobjects/container)

### W1-16 이벤트 재생 (BoardView)
- **트윈(tween)**: "x를 0.1초 동안 100에서 200으로"처럼 값을 시간에 따라 바꾸는 애니메이션. `ease`(Quad.easeIn: 점점 빨라짐, Back: 살짝 튕김)로 느낌이 달라진다 → `src/view/BoardView.ts`
- **Promise와 async/await로 애니메이션 순서 잡기**: 트윈을 Promise로 감싸면(`tween.ts`) "step 하나 끝날 때까지 기다렸다가 다음 step"을 `for … await`로 쓸 수 있다. 동시에 재생할 것은 `Promise.all`
- **`Map<id, sprite>`**: core가 "id 7번이 (2,3)으로"라고 하면 view는 id로 스프라이트를 찾아 움직인다. id가 있어야 화면과 로직을 연결할 수 있다 (W1-05에서 `Block.id`를 둔 이유)
- **마스크**: 리필 블록은 보드 위에서 출발한다. 보드 영역만 보이게 잘라서 HUD 위로 블록이 비치지 않게 했다
- **테스트 가능한 부분을 떼어내기**: Phaser는 테스트에서 돌리기 어렵다. 위치 추적(`EventTracker`)만 순수 코드로 분리해 퍼즈 테스트 5000수로 검증하고, Phaser 쪽은 얇게 유지했다
- **런타임 디버그 체크**: 데모가 매 턴 "스프라이트 실제 위치 = core 보드"를 확인한다. 테스트로 못 잡는 화면 쪽 버그를 개발 중에 바로 알 수 있다
- 참고: [Phaser Tweens](https://docs.phaser.io/phaser/concepts/tweens), [easings.net (ease 그래프)](https://easings.net/ko), [MDN async/await](https://developer.mozilla.org/ko/docs/Learn/JavaScript/Asynchronous/Promises)

### W1-17 스와이프 입력
- **포인터 이벤트 3종**: `pointerdown`(누름) → `pointermove`(끄는 중) → `pointerup`(뗌). Phaser는 마우스와 터치를 "포인터" 하나로 합쳐서 준다 → `src/view/input.ts`
- **입력 판정을 순수 함수로**: "누른 칸 + 끈 거리 → 상대 칸"을 `swipeTarget`으로 떼어내 테스트했다. Phaser 이벤트 연결(`SwipeInput`)은 이 함수를 부르기만 한다
- **문턱값(threshold)과 데드존**: 손가락은 누를 때 조금씩 흔들린다. 칸의 30%를 넘어야 스와이프로 인정해서 실수 입력을 막는다. 값은 `VIEW.swipeThreshold`
- **입력과 규칙의 분리**: 입력은 "(3,3)과 (3,4)를 바꾸고 싶다"만 전한다. 그게 유효한지는 core가 판단한다. 그래서 W2-13에서 탭-탭 입력을 추가해도 core는 그대로다
- **이벤트 리스너 정리**: 씬이 끝날 때(`shutdown`) `off`로 리스너를 떼야 씬을 다시 시작할 때 입력이 두 번 들어오지 않는다
- 참고: [Phaser Input](https://docs.phaser.io/phaser/concepts/input), [MDN Pointer events](https://developer.mozilla.org/ko/docs/Web/API/Pointer_events)

### W1-18 GameScene
- **게임 루프의 전체 흐름**: 입력(`SwipeInput`) → 규칙(`resolveSwap`, core) → 재생(`BoardView.play`) → 상태 교체. Scene은 이 셋을 잇는 접착제 역할만 한다 → `src/scenes/GameScene.ts`
- **busy 플래그 (입력 잠금)**: 애니메이션이 끝나기 전에 다음 입력을 받으면 화면과 상태가 어긋난다. `await play()` 동안 입력을 끄고, 끝나면 켠다. 작은 상태 머신(대기 ↔ 재생 중)이다
- **화면은 상태를 따라간다**: Scene은 `result.state`로 상태를 통째로 바꾼다. 블록 위치를 화면에서 계산하지 않는다
- **Scene 생명주기와 전환**: `BootScene.create()` → `this.scene.start('Game')`. 나중에 메뉴·결과 화면도 같은 방식으로 이어진다
- **개발 전용 코드**: `import.meta.env.DEV`일 때만 디버그 체크와 `window.__ddooby` 훅이 켜진다. 배포 빌드에서는 빠진다. 브라우저 Console에서 `__ddooby.state()`로 현재 보드를 볼 수 있다
- **URL 파라미터로 디버그 옵션**: `URLSearchParams`로 `?seed`, `?demo`를 읽는다. 코드를 안 고치고 상황을 재현할 수 있다
- 참고: [Phaser Scene 전환](https://docs.phaser.io/phaser/concepts/scenes#starting-a-scene), [Vite 환경 변수](https://vite.dev/guide/env-and-mode), [MDN URLSearchParams](https://developer.mozilla.org/ko/docs/Web/API/URLSearchParams)
