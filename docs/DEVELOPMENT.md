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
