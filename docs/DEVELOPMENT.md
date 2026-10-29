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
   ```
2. **PC 브라우저**: `Local` 주소를 연다 (`Cmd` + 클릭)
3. **휴대폰 크기로 보기**: Chrome 개발자도구(`Cmd+Option+I`) → 기기 툴바(`Cmd+Shift+M`) → iPhone 등 선택
4. **실제 휴대폰으로 보기**: PC와 같은 Wi-Fi에 연결한 뒤 휴대폰 브라우저로 `Network` 주소를 연다
5. 에러가 나면 개발자도구의 **Console** 탭을 확인한다

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
