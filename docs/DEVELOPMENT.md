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
| `npm run fonts:subset` | Jua 글꼴을 상용 한글 2,350자 + 영문·기호만 남긴 WOFF2로 다시 만든다 (원본: `assets/fonts-src/`) |
| `npm run build` | 타입체크 + 배포용 빌드 (`dist/`) |
| `npm run android:sync` | 웹 빌드 후 `android/` 앱에 복사 (`cap sync`). 웹 코드를 고친 뒤 Android Studio에서 ▶ 하기 전에 실행 |
| `npm run icons` | `assets/app-icon/`의 원본 그림으로 Android 앱 아이콘(mipmap-*)을 다시 만든다 |

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
   - 밖에서는 Tailscale로: PC와 휴대폰을 같은 Tailscale에 연결하고 `http://<PC 이름>.<tailnet>.ts.net:5173/` 또는 `100.x.x.x:5173`을 연다. `.ts.net` 주소는 `vite.config.ts`의 `allowedHosts`에 넣어 두어서 열린다
5. 에러가 나면 개발자도구의 **Console** 탭을 확인한다

**URL 옵션 (개발용)**

| 주소 | 동작 |
|---|---|
| `http://localhost:5173/` | 매번 다른 보드 (개발 모드에서는 아래 패널 구석에 seed가 표시된다) |
| `http://localhost:5173/?seed=1001` | 항상 같은 시작 보드. 버그를 봤으면 seed를 적어두고 이 주소로 재현 |
| `http://localhost:5173/?demo` | 힌트 수를 자동으로 둔다 (`?seed=42&demo`처럼 같이 써도 된다) |
| `?time=15` | (개발 모드) 제한 시간을 15초로. 마지막 10초 강조·결과 화면을 빨리 볼 때 |
| `?specials` | (개발 모드) 시작 보드에 특수 블록 5종을 하나씩 놓는다 |
| `?result=12450&best=9000` | (개발 모드) 게임 없이 결과 화면만 띄운다 (`best` 생략 시 0) |
| `?result=3200&stage=2&stars=2&bonus=900` | (개발 모드) 스토리 결과 미리보기. `stars=0`이면 실패 화면. [다음 스테이지]까지 보려면 `&unlock=3`도 붙인다 |
| `?stage=3` | (개발 모드) 메뉴를 건너뛰고 스토리 3번 스테이지로 |
| `?unlock=5` | (개발 모드) 스테이지 5까지 열고 **저장까지 한다** (새로고침해도 유지). 되돌리기: `?unlock=1` |
| `?hint=1000` | (개발 모드) 힌트가 뜨기까지 기다리는 시간을 1초로 (기본 5초) |
| `?icon` | (개발 모드) 게임 대신 앱 아이콘 원본 그림 3장을 만들어 받는 페이지 (`assets/app-icon/README.md`) |

주소 옵션이 없으면 메뉴부터 시작한다. `?demo`, `?seed`, `?time`, `?specials`는 메뉴를 건너뛰고 바로 경쟁 모드로 간다. 스테이지 지도에서 **U 키**(개발 모드)를 누르면 다음 스테이지가 하나 열린다.

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

### D-02 테마·이펙트 설정값
- `npm test` → `tests/view/fxLevels.test.ts` 8개 통과
- `npm run dev` → 보드판 바탕이 어두운 남색에서 밝은 크림색으로 바뀌었다. 나머지 테마 값은 D-03부터 화면에 쓰인다
- **칭찬 문구 바꾸기**: `src/config.ts`의 `FX.praise`에서 `3: '이서팡!'`을 원하는 말로 고치고 저장하면 된다. 문구 색은 `THEME.praiseColors`, 크기는 `FX.praiseScale`

### D-03 Jua 글꼴
- `npm run dev` → 타이틀과 표시줄이 둥근 Jua 글꼴로 보이면 정상
- Console에 `document.fonts.check('48px Jua')` 입력 → `true`
- 글꼴 파일은 `public/fonts/Jua-subset.woff2` (343KB, 라이선스 `OFL.txt`). 원본 2.1MB에서 상용 한글 2,350자 + 영문·기호만 남겼다. 인터넷이 없어도 앱 안의 파일을 쓴다. 글꼴을 못 불러와도 2초 뒤에는 기본 글꼴로 게임이 시작된다
- 개발자도구 Network 탭에서 `Jua-subset.woff2`가 약 343KB로 받아지는지 확인
- 2,350자에 없는 글자(드문 한글, 일부 기호)는 기본 글꼴로 보인다. 원본 Jua에도 `·` `…` `×`는 없다

### D-04 배경 + 웨이퍼 보드판
- `npm run dev` → 하늘색에서 분홍으로 넘어가는 하늘, 천천히 좌우로 움직이는 구름, 깜빡이는 작은 별, 베이지색 웨이퍼 보드판
- 블록이 위에서 떨어질 때 보드판 밖(하늘)으로 비치지 않는다
- 구름·별 위치와 보드판 두께는 `src/config.ts`의 `DECOR`에서 바꾼다
- 하늘 그라데이션은 웹페이지 배경(`index.html`) 하나로 그리고 게임 화면은 투명하다. 창 크기를 바꿔도 하늘이 한 장으로 이어진다. **하늘 색을 바꿀 땐 `index.html`과 `THEME.sky` 둘 다**

### D-10 HUD
- 분홍 Jua 타이틀(흰 테두리)과 그 아래 흰 알약 모양 표시줄(`seed · 이동 · 연쇄`)
- 이동이 늘거나 연쇄가 나서 글자가 길어지면 알약 폭도 같이 늘어난다
- 위치·크기는 `src/config.ts`의 `HUD`

### D-05 말랑 친구들 블록
- `npm run dev` (예: `?seed=1234`) → 블록마다 눈·볼터치·입이 있고, 색마다 모양이 다르다
- 블록 그림은 게임 시작 때 한 번 텍스처로 구워 두고 재사용한다. 표정을 바꿀 땐 텍스처만 갈아끼운다
- 블록 크기는 `src/config.ts`의 `VIEW.blockScale`

### D-06 말랑 움직임
- `?demo` → 블록이 떨어져 착지할 때 납작했다 길쭉해졌다 돌아오고, 스왑할 때 살짝 커지고, 터지기 직전 눈이 `><`가 된다
- 움직임은 크기만 바꾸고 위치는 안 바꾼다. Console에 `view ≠ board`가 없어야 한다

### D-07 ~ D-09 연쇄 이펙트
- `?demo` → 블록이 터질 때 그 블록 색의 하트 조각이 튄다. 연쇄 2단계부터 노란 별이 섞이고 칭찬 문구가 뜬다
  - 2 `이안팡!` → 3 `이서팡!` (화면 흔들림 + 블록들이 `^^`) → 4 `보라팡!!` → 5 이상 `사랑해!!!`
- 연쇄가 끝나면 문구가 사라지고 모든 블록이 평소 표정으로 돌아온다
- 이펙트는 애니메이션 진행을 기다리게 하지 않는다. 입력 잠금 시간이 이전과 같다
- 문구 바꾸기: `src/config.ts`의 `FX.praise` / 문구 모양·속도: `src/view/fx/FxDirector.ts` 맨 위 `PRAISE`

### D-11 이펙트 미리보기 (개발 모드 전용)
- `npm run dev` 화면을 클릭한 뒤 키보드 **1~5**를 누르면 그 연쇄 단계의 연출이 보드 가운데 행에서 터진다. 문구를 바꾼 뒤 바로 확인할 때 쓴다
- `npm run build` 결과물에서는 키가 반응하지 않는다

### D-12 블록·조각 크기, 칭찬 문구 설정값
- `npm run dev` → `?demo`: 블록이 칸을 꽉 채우되 옆 블록과 붙거나 겹치지 않는다
- 키보드 **2~5**: 하트·별 조각이 예전보다 큼직하게 터진다
- 칭찬 문구 크기·시간은 `src/config.ts`의 `FX.praiseStyle`에서 바꾼다 (예: `fontSize`를 90으로 바꾸고 키 5)

### W2-01 특수 블록 결정
- `npm test` → `tests/core/specials.test.ts` 12개 통과. 화면은 아직 바뀌지 않는다 (엔진 연결은 W2-05)
- 테스트 표에서 보드 그림 → 결과를 보면 규칙이 보인다: 3I 없음, 4I 가로 → `lineV`, 4I 세로 → `lineH`, 5L·5T·5+ → `bomb`, 5I → `color`, 6개 이상 → `super`
- 라인 방향 바꿔보기: `src/config.ts`의 `SPECIAL.lineDirection`을 `'parallel'`로 바꾸면 4I 가로 → `lineH`가 된다 (테스트는 기본값 기준이라 4I 두 줄이 실패한다. 되돌리기)

### W2-02 특수 블록 생성 위치
- `npm test` → `tests/core/specials.test.ts`의 `specialPosition` 10개 통과. 화면은 아직 그대로 (엔진 연결은 W2-05)
- 테스트 표에서 모양별 "중앙" 칸을 볼 수 있다: 4I는 가운데 두 칸 중 왼쪽(위), +·T는 교차점 쪽, L은 동점이라 위쪽 칸

### W2-03 특수 블록 발동 범위
- `npm test` → `tests/core/specials.test.ts`의 `blastArea` 10개 통과. 화면은 아직 그대로 (엔진 연결은 W2-05)
- 테스트의 `x` 그림이 곧 범위다: 라인 한 줄, 폭탄 3x3, 슈퍼 5x5 + 십자, 모서리·가장자리에서 잘리는 모양, 컬러는 대상 색 전체

### W2-04 연쇄 발동
- `npm test` → `tests/core/specials.test.ts`의 `chainActivate` 8개 통과. 화면은 아직 그대로 (엔진 연결은 W2-05)
- "줄 → 줄 → 폭탄" 테스트에서 `activated` 순서와 `x` 그림으로 연쇄가 퍼지는 모양을 볼 수 있다
- 휘말린 컬러 블록은 보드에서 가장 많은 색을 지운다 (PLAN 4.5). 바꾸고 싶으면 `src/core/specials.ts`의 `mostCommonColor`

### W2-05 엔진에 특수 블록 연결
- `npm test` → `tests/core/engine.test.ts`의 "특수 블록" 7개 + 퍼즈 테스트(특수 블록 생성·발동 수 확인, `'explode'` 모드 1000회) 통과
- 화면: `npm run dev`에서 4개를 맞추면 줄무늬 블록, L/T 5개는 폭탄, 일자 5개는 무지개, 6개 이상은 슈퍼 블록이 그 자리에 생긴다. 특수 블록이 섞인 매치를 만들면 범위가 한꺼번에 사라진다 (발동 연출은 W2-07)
- B 방식 해보기: `src/config.ts`의 `SPECIAL.newSpecialInBlast`를 `'explode'`로 바꾸면, 특수 블록이 섞인 매치에서 새 특수 블록이 생기자마자 같이 터진다

### W2-06 무지개 블록 스왑
- `npm test` → `tests/core/engine.test.ts`의 "컬러 블록 스왑" 4개 통과. 퍼즈 테스트도 무지개 블록 스왑을 포함해 다시 1000수씩 돈다
- 화면: 일자 5개로 무지개 블록을 만든 뒤 아무 이웃과 바꾸면, 매치가 없어도 그 이웃과 같은 색 블록이 보드에서 전부 사라진다
  - 이웃이 줄무늬·폭탄이면 그 색이 사라지면서 이웃 특수 블록도 터진다
  - 무지개끼리 바꾸면 보드 전체가 사라진다
- `?demo`가 무지개 블록 힌트에서 더 이상 멈추지 않는다

### W2-07 특수 블록 표시 + 발동 연출
- `npm run dev` → `http://localhost:5173/?specials`: 시작 보드에 특수 블록 5종이 하나씩 놓인다 (개발 모드 전용)
  - 블록 오른쪽 위 흰 배지: ↔ 가로줄, ↕ 세로줄, 검은 폭탄, ★ 슈퍼. 무지개 블록은 몸통이 무지개
- 화면을 클릭한 뒤 키보드 **Q W E R T**: 보드 가운데에서 가로줄 / 세로줄 / 폭탄 / 슈퍼 / 무지개 발동 연출만 재생한다 (블록은 그대로)
  - 가로·세로줄: 줄을 가로지르는 흰 빛줄기, 폭탄: 3x3 크기 노란 원, 슈퍼: 십자 빛줄기 + 5x5 원 + 흔들림, 무지개: 섬광 + 보드 곳곳에 별
- 실제 발동: `?specials`에서 특수 블록이 섞이게 맞추거나 무지개 블록을 아무 이웃과 바꿔 본다. `?specials&demo`로 자동 플레이해도 된다. Console에 `view ≠ board`가 없어야 한다
- 연출 길이·색·두께는 `src/config.ts`의 `FX.special`
- `npm test` → `tests/view/specialFx.test.ts` 5개 통과

### W2-08 점수 계산
- `npm test` → `tests/core/scoring.test.ts`(점수표 각 줄)와 `engine.test.ts`의 "resolveSwap: 점수"가 통과한다
- `npm run dev` → `?demo&seed=7`을 열고 개발자도구 Console에서 `__ddooby.score()`를 몇 번 실행하면 점수가 늘어난다. 같은 seed면 같은 턴에서 같은 점수가 나온다 (10턴 = 1275점)
- 화면에 점수가 보이는 건 W2-11(HUD)부터

### W2-09 게임 모드 인터페이스
- `npm test` → `tests/modes/gameMode.test.ts` 통과 (타입 검사라 `npm run typecheck`에서도 확인된다)
- `src/modes/` 파일에 `Math.random()` 한 줄을 넣고 `npm run lint` → 에러가 난다. 확인 후 지운다

### W2-10 타임어택 모드
- `npm test` → `tests/modes/timeAttackMode.test.ts` 8개 통과 (60초 시작, 시간 줄기, 0에서 멈춤, 점수 누적, 최고 기록 판정)
- 제한 시간은 `src/config.ts`의 `TIMEATTACK.timeLimitMs`. 화면 연결은 W2-11부터

### W2-13 탭-탭 입력
- `npm run dev` → 블록 하나 탭: 살짝 커지고 분홍 테두리가 생긴다 → 같은 블록 다시 탭: 해제
- 옆 블록 탭: 교환 (매치가 안 되면 되돌아가고 테두리도 사라짐) → 먼 블록 탭: 선택이 그 블록으로 옮겨감
- 선택한 채로 다른 블록을 스와이프하면 스와이프가 먼저, 테두리는 사라진다. 블록이 터지는 중에 탭하면 무시된다
- 크기·색은 `src/config.ts`의 `VIEW.select`

### W2-12 결과 화면
- `npm run dev` → `?result=12450&best=9000`: "끝!", 점수 12,450, "최고 점수 12,450", "최고 기록!" 배지가 통통 튄다
- `?result=500&best=9000`: 배지 없이 "최고 점수 9,000" (`best`를 빼면 0)
- [다시하기]를 누르면 버튼이 말랑하게 눌렸다가 새 게임이 시작된다
- `?result=` 미리보기는 개발 모드에서만 된다. 실제로는 60초가 끝나면 이 화면으로 온다 (W2-11 연결 후)

### W2-11 아래 정보 패널 + 화면 배치 + 타이머
- 휴대폰(또는 개발자도구 390×844)에서 보드 바로 아래 웨이퍼 패널(점수, 남은 시간, 솜사탕 막대)과 맨 아래 디저트 언덕이 보인다. 빈 하늘이 남지 않는다
- 블록을 맞추면 점수가 콤마와 함께 오르고, 시간 막대가 줄어든다
- `?time=15`: 마지막 10초에 시간 글자·막대가 빨갛게 바뀌고 1초마다 통통 튄다 → 0이 되면 터지던 연쇄를 끝까지 보여준 뒤 결과 화면 → [다시하기]
- PC 넓은 창에서도 보드가 가운데이고 탭·스와이프가 맞는 칸에 들어간다
- 창 크기를 도중에 바꾸면 배치가 다시 맞춰지지 않는다 (새로고침하면 맞음)

### W3-01 스테이지 데이터 검증
- `npm test` → `tests/data/stageSchema.test.ts` 통과 (정상 스테이지, 필드별 잘못된 값, 에러 메시지에 위치)
- 스테이지 JSON을 잘못 쓰면(예: `colors: 3`) `story[0].colors: …`처럼 어느 스테이지 어느 칸이 틀렸는지 알려준다. 화면에 띄우는 건 W3-02부터

### W3-07 저장 (최고 점수)
- `npm run dev` → `?time=5`로 한 판 → 결과 화면의 최고 점수 확인 → 새로고침 후 다시 한 판 → 이전 최고 점수가 남아 있고, 더 높을 때만 "최고 기록!"
- 개발자도구 Application 탭 > Local Storage > `ddooby-pang/save`에 저장 내용이 보인다. 이 키를 지우면 기록이 초기화된다
- 시크릿 모드에서는 저장이 안 될 수 있다. 그래도 게임은 멈추지 않는다

### W3-05 스토리 모드 규칙
- `npm test` → `tests/modes/storyMode.test.ts` 통과 (실패한 교환은 이동을 안 깎음, 마지막 이동에서 달성해도 클리어, 이동 0이면 실패, 특수 블록으로 지운 것도 수집에 포함)
- 화면 연결은 W3-08~W3-12부터

### W3-06 남은 이동 보너스 + 별
- `npm test` → `tests/modes/storyScore.test.ts` 통과 (별 기준과 같은 점수면 포함, 클리어하면 최소 별 1개, 실패면 0개)
- 보너스 금액은 `src/config.ts`의 `SCORE.movesLeftBonus` (남은 이동 1회당 300)

### W3-02 스테이지 파일 읽기
- `npm run dev` → 평소처럼 게임이 시작된다 (스테이지·경쟁 설정을 시작할 때 읽는다)
- `public/stages/story.json`의 `"target": 2000`을 `0`으로 바꾸고 새로고침 → 게임이 시작되지 않고 빨간 글씨로 "데이터를 불러오지 못했어요 / stages/story.json: story[0].goals[0].target: 1 이상의 정수여야 한다"가 뜬다. 되돌리면 정상

### W3-03 스토리 스테이지 1~10
- `public/stages/story.json`에 10개가 들어 있다 (표: `docs/superpowers/specs/2026-10-30-story-stages-design.md`). 화면에서 고르는 건 W3-09부터
- 난이도를 바꾸고 싶으면 이 파일의 숫자만 고치면 된다. 잘못 쓰면 W3-02의 에러 화면이 알려준다
- `npm test` → `tests/data/stories.test.ts`가 실제 파일을 검사한다

### W3-04 경쟁 모드 설정 파일
- `public/stages/timeattack.json`의 `timeLimit`을 `30`으로 바꾸고 새로고침 → 패널에 "남은 시간 0:30". 되돌리기
- 개발용 `?time=15`는 이 파일보다 우선한다

### W3-08 메뉴
- `npm run dev` → 첫 화면이 메뉴. 타이틀 아래 친구들이 번갈아 통통 튀고, 버튼 안에 진행 상황(`스테이지 1 / 10 ★ 0`, `처음 도전!` 또는 `최고 12,450점`)
- [스토리] → 지도, [경쟁 60초] → 게임. `?demo`, `?seed=7`은 예전처럼 바로 게임

### W3-09 스테이지 지도
- 메뉴 [스토리] → 아래 1번부터 위 10번까지 사탕 길. 지금 할 스테이지가 크게 숨쉬고, 잠긴 곳은 자물쇠(누르면 흔들림). [←] → 메뉴
- `?unlock=3` → 1·2번 완료(아래에 별), 3번이 지금 할 곳. 지도에서 U 키 → 다음 스테이지가 튀어나오며 열린다
- 별까지 넣어 보려면 개발자도구 Console에서 `localStorage.setItem('ddooby-pang/save', JSON.stringify({version:1, story:{unlocked:3, bestStars:{1:3,2:2}, bestScore:{}}, timeattack:{bestScore:12450}}))` 후 새로고침
- 처음 상태로: `localStorage.removeItem('ddooby-pang/save')` 또는 `?unlock=1`

### W3-11 결과 화면 (스토리)
- `?unlock=3&result=3200&stage=2&stars=2&bonus=900`: "클리어!", 별 2개가 하나씩 차오름, `남은 이동 보너스 +900`, [다음 스테이지] [다시하기] [지도]
- `?result=800&stage=4&stars=0`: "아쉬워요", 빈 별, [다시하기] [지도]
- `?unlock=11&result=9000&stage=10&stars=3&bonus=300`: `모든 스테이지 클리어!`
- `?result=12450&best=9000`: 경쟁 결과, [다시하기] [메뉴]

### W3-10 스토리 HUD
- 메뉴 [스토리] → 1번: 패널 왼쪽 `점수 0 / 2,000`, 오른쪽 동그란 배지에 남은 이동 `25`. 블록을 맞추면 점수가 오르고 이동이 준다 (실패한 교환은 안 줄어든다)
- `?stage=6`: 색 그림 + `0 / 15` 두 줄과 `점수 N` 줄. `?stage=7`: 점수 미션 + 수집 미션
- 남은 이동이 5 이하가 되면 배지 숫자가 빨갛게, 이동할 때마다 통통. 미션을 채우면 그 줄에 초록 체크가 한 번 통통
- [경쟁 60초]의 패널은 예전 그대로 (점수, 남은 시간 막대)

### W3-12 해금 + 저장
- 1번 클리어 → 결과 화면 [다음 스테이지]가 보인다 → [지도]로 가면 2번이 튀어나오며 열린다 → 새로고침해도 그대로
- 빠른 확인: `?stage=1&demo` (스토리에서도 자동 플레이). 개발자도구 Local Storage `ddooby-pang/save`에 `unlocked`, `bestStars`, `bestScore`가 쌓인다
- 같은 스테이지를 다시 해서 별이 적게 나와도 최고 별은 줄지 않는다

### W3-13 Android 앱 시험 빌드
1. 터미널에서 `npm run android:sync` (웹 빌드 + `android/`에 복사)
2. Android Studio → Open → 프로젝트의 **`android/`** 폴더 (프로젝트 최상위가 아님)
3. 오른쪽 아래 Gradle sync가 끝날 때까지 기다린다 (처음엔 1분쯤)
4. 위쪽 기기 목록에서 `Pixel_3a_API_34` 선택 → ▶ Run
5. 에뮬레이터에 메뉴가 뜨면 경쟁 60초 한 판, 스토리 1번을 해 본다
- 에뮬레이터를 막 켠 직후 앱이 한 번 꺼질 수 있다 (에뮬레이터 부팅 마무리 중 글꼴 서비스가 재시작되는 것). 다시 ▶ 하면 된다
- 터미널로만 APK 만들기: `cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk` (약 5MB). 시스템 java가 17이면 꼭 Android Studio 내장 Java 21을 지정한다
- Logcat에 `Error injecting safe area CSS`가 몇 번 보이는 건 Capacitor가 넣는 스크립트의 경고라 무시해도 된다 (W4-07에서 Android 15 이상으로 다시 확인)

### W4-01 점수 팝업 + 특수 발동 흔들림
1. `npm run dev` → `http://localhost:5173/?seed=3&demo`
2. 블록이 터진 자리에 `+점수`가 톡 튀어 올랐다가 위로 떠오르며 사라진다. 연쇄 단계가 오를수록 칭찬 문구와 같은 색(분홍 → 주황 → 파랑 → 보라)으로 바뀌고 조금씩 커진다
3. 숫자 키 1~5: 가운데에 그 단계의 연출 + 점수 팝업 미리보기. 빨리 연타하면 팝업이 겹치지 않게 위로 쌓인다
4. `?specials`: 특수 블록을 터뜨리거나 E(폭탄)·R(무지개)·T(슈퍼)를 눌러 흔들림 세기를 비교한다. Q·W(줄 지우기)는 빛줄기만 나오고 흔들리지 않는다
5. 맨 왼쪽·오른쪽 열에서 맞춰도 팝업이 보드 밖으로 잘리지 않는다
- 연쇄 3단계 이상이면 연쇄 흔들림이 먼저 걸려 특수 흔들림은 겹치지 않는다 (의도한 동작)

### W4-02 효과음 + 음소거
1. `npm run dev` → 메뉴에서 아무 곳이나 한 번 탭 (브라우저는 첫 탭 전까지 소리를 막는다)
2. 어디서 무슨 소리가 나는지
   - 메뉴·결과 버튼, 지도 노드·[←]: "딸깍" (button)
   - 블록을 바꿔 매치될 때: "뽁" (swap) / 매치가 안 돼 되돌아갈 때: 낮은 "툭" (bad)
   - 블록이 터질 때: 유리 "띵". 연쇄될수록 도→레→미→파→솔로 높아진다 (match)
   - 특수 블록 발동: 올라가는 "슈웅" (special)
   - 결과 화면: 클리어·경쟁 끝은 짧은 팡파르(clear), 스토리 실패는 내려가는 소리(fail), 별이 찰 때마다 "띵"(star)
3. 메뉴·지도 오른쪽 위 스피커 → X로 바뀌고 소리가 꺼진다. 새로고침해도 유지. 다시 누르면 켜지며 "딸깍"
- 거슬리는 소리는 `src/config.ts`의 `SOUND.effects` 볼륨을 낮추거나, `public/audio/CREDITS.md`의 원본 팩(다운로드 폴더의 Kenney zip)에서 다른 파일로 바꾼다
- `?result=...`처럼 주소로 결과 화면에 바로 들어가면 탭 전이라 clear 소리가 안 들린다 (정상)

### W4-03 힌트
1. `npm run dev` → `http://localhost:5173/?seed=7` (또는 메뉴 → 경쟁/스토리)
2. 아무것도 누르지 않고 5초 기다리면, 바꾸면 매치되는 두 블록이 말랑하게 커졌다 작아지기를 반복한다
3. 화면 아무 곳이나 터치하거나 블록을 누르면 바로 멈춘다. 다시 5초 가만히 있으면 또 나온다
4. 힌트대로 바꾸면, 블록이 다 떨어진 뒤 5초 지나 새 힌트가 나온다
5. 경쟁 시간이 끝났거나 스토리 마지막 이동 뒤, `?demo` 자동 플레이 중에는 나오지 않는다
- 빨리 보려면 `?seed=7&hint=1000`
- 혹시 손대지 않았는데 이동 수가 늘어나는 걸 보면 seed와 상황을 알려 주세요 (확인 중 한 번 보였고 재현되지 않았다)

### W4-04 일시정지
1. `npm run dev` → 메뉴 → 경쟁 60초
2. 오른쪽 위 ❚❚ → 게임이 어두워지고 `잠깐 쉬어요` 창. 남은 시간이 멈춘다
3. [계속]: 그 자리에서 이어진다. 블록이 떨어지는 중에 눌러도 멈췄다 이어진다
4. [다시하기]: 처음부터. [메뉴]: 메뉴로. 둘 다 최고 점수에 기록되지 않는다
5. 스토리에서는 세 번째 버튼이 [지도]
6. 창의 스피커로 소리를 끄면 메뉴에서도 꺼져 있다
7. 게임 중 다른 탭으로 갔다 오거나(휴대폰은 홈으로 나갔다 오기) 하면 일시정지 창이 떠 있다

### W4-07 Android 앱 설정 (세로 고정, 아이콘, 뒤로 가기)
1. `npm run android:sync`
2. Android Studio → Open → `android/` → Gradle sync가 끝날 때까지 기다린다
3. 위쪽 기기 목록에서 **`Pixel_7_API_36`**(Android 16) 선택 → ▶ Run (Android 14 확인은 `Pixel_3a_API_34`)
4. 홈 → 앱 서랍: 분홍 원 안에 빨강 말랑이 아이콘 `Ddooby-Pang`. 누르면 하늘색 시작 화면 → 메뉴
5. 에뮬레이터 옆 회전 버튼을 눌러도 게임은 세로 그대로
6. 뒤로 가기(에뮬레이터 ◁ 또는 아래에서 옆으로 쓸기)
   - 게임 중 → 일시정지 창, 한 번 더 → 계속
   - 지도 → 메뉴, 결과 → 메뉴 (스토리 결과는 지도)
   - 메뉴 → 앱 종료
7. 위 상태바, 아래 제스처 바에 버튼이나 글자가 가리지 않는다 (바 뒤는 흰색/연회색으로 보인다. 색 맞추기는 다음 폴리싱 후보)
- 아이콘 바꾸기: `npm run dev` → `?icon` 페이지에서 그림 3장 받기 → `assets/app-icon/`에 덮어쓰기 → `npm run icons`
- 새로 받은 폴더나 worktree에서 터미널로 빌드하면 `SDK location not found`가 날 수 있다. Android Studio로 `android/`를 한 번 열면 `android/local.properties`가 생겨 해결된다 (git에 올리지 않는 파일)
- Logcat의 `Error injecting safe area CSS`는 Capacitor 내부 타이밍 경고라 그대로 둔다 (화면에는 영향 없음)


### W4-08 앱 전용 저장소 (Preferences)
1. `npm run android:sync` → Android Studio에서 `android/` 열기 → `Pixel_7_API_36` → ▶
2. 경쟁 한 판으로 최고 점수를 내거나 스토리 1번을 클리어하고, 메뉴 오른쪽 위 스피커로 음소거
3. 최근 앱 화면에서 앱을 위로 밀어 완전히 끄기 (또는 터미널 `adb shell am force-stop com.ddooby.pang`) → 다시 실행
4. 최고 점수·별·열린 스테이지·음소거가 그대로다
- 예전 버전 앱으로 하던 기록은 이 버전을 덮어 설치해도 처음 실행 때 옮겨 와서 이어진다
- 저장된 내용 직접 보기: `adb shell run-as com.ddooby.pang cat shared_prefs/CapacitorStorage.xml`
- 웹(`npm run dev`)은 지금까지처럼 브라우저 localStorage에 저장한다
## 5. 문제 해결

| 증상 | 해결 |
|---|---|
| `Port 5173 is in use` | 다른 터미널에서 서버가 이미 떠 있다. 그 터미널에서 `Ctrl+C`, 또는 Vite가 제안하는 다른 포트를 쓴다 |
| `vite: command not found` 등 | `npm install`을 안 했거나 실패했다. 다시 실행 |
| 휴대폰에서 `Network` 주소가 안 열림 | 같은 Wi-Fi인지 확인. macOS 방화벽이 Node 연결을 막고 있는지 확인 |
| 화면이 갱신 안 됨 | 브라우저 강력 새로고침 `Cmd+Shift+R` |
| `npm install`이 `SELF_SIGNED_CERT_IN_CHAIN` | 회사·보안 프로그램이 HTTPS를 검사하는 네트워크. Node가 OS 인증서 저장소를 쓰게 한다: Windows PowerShell `[Environment]::SetEnvironmentVariable('NODE_OPTIONS','--use-system-ca','User')` 후 VSCode 재시작 (`strict-ssl false`로 검사를 끄지 않는다) |
| `git push`가 403 (`Permission ... denied`) | 등록된 토큰에 쓰기 권한이 없다. `gh auth status`에서 확인. Classic 토큰은 `repo` scope, Fine-grained 토큰은 이 저장소 + Contents: Read and write로 다시 만들고 `gh auth login` → `gh auth setup-git` |
| Windows에서 받은 뒤 파일이 전부 "수정됨" 또는 prettier 경고가 많다 | `core.autocrlf=true`로 CRLF가 풀린 것. 저장소는 `.gitattributes`로 LF 고정이라 내용 변경은 없다. 할 일이 없을 때 `git rm --cached -r -q . && git reset --hard -q`로 다시 받으면 LF로 풀린다 (커밋 안 한 변경이 없을 때만) |

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

### D-02 테마·이펙트 설정값
- **연출 세기 계산을 순수 함수로 분리**: "연쇄 3단계면 조각 몇 개, 문구는 뭐, 흔들림은 얼마"를 Phaser 없이 계산한다. 화면 없이 테스트할 수 있고, 연출 코드는 이 결과만 따른다 → `src/view/fx/fxLevels.ts`
- **값 고정(clamp)과 상한**: 범위 밖 입력(연쇄 0단계, 9단계)을 1~5로 맞추고, 조각 수는 `min(블록당 개수 × 제거 수, 60)`으로 제한한다. 긴 연쇄에서 휴대폰이 버벅이지 않게 하는 안전장치 → `clampLevel`, `particleCount`
- **0부터 세기 vs 1부터 보여주기**: core는 연쇄를 0부터 세고(`cascade`), 화면은 1단계부터 보여준다. 변환을 `cascadeToLevel` 한 곳에 둬서 "+1"이 여기저기 흩어지지 않게 했다
- **`noUncheckedIndexedAccess`**: 배열 `a[i]`를 `T | undefined`로 본다. 범위를 보장해도 TS는 모르니 `?? 1` 같은 기본값을 둔다 → `fxLevel`의 `particlesPerBlock`
- 참고: [TS noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess)

### D-03 Jua 글꼴
- **웹 글꼴 미리 불러오기**: `index.html`의 `@font-face`로 글꼴 파일을 등록하고, `document.fonts.load()`로 다 받을 때까지 기다린 뒤 게임을 시작한다. 안 그러면 Phaser가 기본 글꼴로 글자를 먼저 그려버린다 → `index.html`, `src/scenes/BootScene.ts`
- **`Promise.race`로 시간 제한**: "글꼴 로딩"과 "2초 타이머" 중 먼저 끝나는 쪽을 기다린다. 실패(reject)도 잡아서 게임은 무조건 시작된다. 느린 휴대폰·오프라인 대비 → `BootScene.loadFont`
- **`public/` 폴더**: 빌드할 때 그대로 복사되는 정적 파일 자리. `vite.config.ts`의 `base: './'` 덕분에 상대 경로로 불러와서 Capacitor 앱 안에서도 동작한다
- **글꼴 라이선스(OFL)**: 무료로 쓰고 앱에 넣을 수 있지만 라이선스 파일을 같이 둬야 한다
- 참고: [MDN @font-face](https://developer.mozilla.org/ko/docs/Web/CSS/@font-face), [MDN Promise.race](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise/race)

### D-04 배경 + 웨이퍼 보드판
- **그라데이션과 둥근 사각형**: `fillGradientStyle`로 위·아래 색을 정해 하늘을 칠하고, `fillRoundedRect` / `strokeRoundedRect`로 보드판 테두리를 그린다 → `src/view/theme/Background.ts`, `BoardFrame.ts`
- **반복 트윈**: `yoyo: true` + `repeat: -1`이면 왕복을 끝없이 반복한다. `delay`를 다르게 주면 구름·별이 제각각 움직여 자연스럽다
- **깊이(depth)와 그리는 순서**: 배경은 `depth -100`으로 맨 뒤. 보드판은 블록보다 먼저 만들어서 그 아래에 깔린다 → `GameScene.create`
- **장식 수치도 config로**: 구름 좌표, 별 개수, 보드판 두께를 `DECOR`에 모았다. 코드를 몰라도 숫자만 바꿔 실험할 수 있다
- 참고: [Phaser Graphics](https://docs.phaser.io/phaser/concepts/gameobjects/graphics), [Phaser Tween 반복](https://docs.phaser.io/phaser/concepts/tweens)

### D-10 HUD
- **외곽선 글자**: Text 스타일의 `stroke` / `strokeThickness`로 흰 테두리를 둘러 어떤 배경에서도 읽히게 한다 → `src/view/Hud.ts`
- **내용에 맞춰 다시 그리기**: 글자를 바꾼 뒤 `text.width`를 읽고, 알약 Graphics를 `clear()` 후 그 폭으로 다시 그린다 → `Hud.setInfo`
- **화면 조각을 작은 클래스로**: GameScene은 `hud.setInfo('…')`만 부르고, 어떻게 그릴지는 `Hud`가 안다. 모드 화면을 만들 때 HUD만 갈아끼우기 쉽다
- **글꼴 서브셋(subset)**: 쓸 글자만 남겨 용량을 줄인다. 한글 상용 2,350자는 옛 한글 인코딩(EUC-KR) 범위와 같아서 그 범위를 돌며 글자를 만든다 → `scripts/subset-font.mjs`
- **WOFF2**: 웹용으로 압축한 글꼴 형식. 같은 글꼴도 TTF보다 훨씬 작다 (2.1MB → 343KB)
- **원본과 결과물 분리**: `public/`은 앱에 그대로 실리므로 원본은 `assets/fonts-src/`에 두고, 만든 결과물만 `public/`에 둔다. `npm run fonts:subset`으로 언제든 다시 만들 수 있다
- **투명한 캔버스**: Phaser `transparent: true`면 캔버스 뒤의 HTML 배경이 비친다. 같은 그라데이션을 두 곳(캔버스, 페이지)에서 그리면 기준 높이가 달라 이음새가 생기므로 한 곳에서만 그린다 → `src/main.ts`, `index.html`

### D-05 말랑 친구들 블록
- **텍스처를 한 번 구워 재사용**: 블록 그림 27장(색 7 × 표정 3 + 특수 4 + 파티클 2)을 시작할 때 canvas에 그려 텍스처로 등록한다. 블록 64개가 매 프레임 도형을 다시 그리지 않아서 휴대폰에서 가볍다 → `src/view/theme/textures.ts`
- **표정 = 텍스처 교체**: `setTexture('block-0-happy')`처럼 이미지만 바꾼다 → `src/view/BlockSprite.ts`
- **큰 그림을 줄여 쓰기**: 160px로 그려 `setDisplaySize`로 칸 크기에 맞춘다. 고해상도 화면에서도 선명하다
- **이름 충돌 조심**: Phaser 오브젝트에는 이미 `body`(물리 몸체) 같은 속성이 있다. 내 필드 이름이 겹치면 이상하게 동작하니 `faceImage`처럼 구체적으로 짓는다

### D-06 말랑 움직임
- **크기만 트윈하기**: 착지 눌림·스왑 팝은 `scaleX/scaleY`만 바꾼다. 위치를 건드리면 "화면 위치 = 게임 상태" 디버그 체크가 깨진다 → `BlockSprite.squish`, `pop`
- **트윈 이어 붙이기**: 납작 → 길쭉 → 원래를 `onComplete`로 연결, 왕복은 `yoyo`
- **`killTweensOf`**: 사라지는 블록에 남아 있는 트윈을 먼저 멈춰야 파괴된 오브젝트를 건드리는 오류가 안 난다 → `BoardView.removeSprite`

### D-07 ~ D-09 연쇄 이펙트
- **알림(hook)으로 분리**: BoardView는 "연쇄 N단계 매치가 났다"만 알리고, 어떤 연출을 할지는 FxDirector가 정한다. 2주차 특수 블록 연출도 FxDirector에만 더하면 된다 → `BoardViewHooks`, `src/view/fx/FxDirector.ts`
- **서로를 필요로 하는 두 객체 만들기**: BoardView는 FxDirector에 알려야 하고, FxDirector는 BoardView의 표정을 바꿔야 한다. 빈 `hooks` 객체를 먼저 만들어 넘기고 나중에 채운다 → `GameScene.create`
- **파티클 이미터 재사용**: 이미터를 한 번 만들고 `explode(개수, x, y)`로 그때그때 터뜨린다. 흰 하트에 `setParticleTint`로 블록 색을 입힌다
- **타이머 하나만 두기**: 웃는 표정 타이머가 여러 개면 서로 엇갈려 표정이 안 풀린다. 새 연쇄가 오면 기존 타이머를 취소하고 다시 건다 → `FxDirector.beHappy`
- **카메라 흔들림**: `cameras.main.shake`는 화면(카메라)만 흔들고 오브젝트 위치는 그대로다
- 참고: [Phaser Particles](https://docs.phaser.io/phaser/concepts/gameobjects/particles), [Phaser Camera shake](https://docs.phaser.io/api-documentation/class/cameras-scene2d-effects-shake)

### D-11 이펙트 미리보기
- **개발 전용 코드**: `import.meta.env.DEV` 안의 코드는 배포 빌드에서 통째로 빠진다
- **키보드 입력**: `this.input.keyboard.on('keydown', …)`로 숫자 키를 받는다
- **연출과 상태 분리 덕분에 가능한 기능**: 블록을 실제로 지우지 않고 "지운 것처럼" 연출만 재생할 수 있다

### D-12 블록·조각 크기, 칭찬 문구 설정값
- **하드코딩 상수를 config로**: 화면 곳곳의 숫자를 한곳(`src/config.ts`의 `FX.praiseStyle`)에 모으면 찾기·바꾸기가 쉽다 (`src/view/fx/FxDirector.ts`)
- **파티클 scale `{ start, end }`**: 텍스처는 그대로 두고 emitter가 조각을 키웠다 줄이며 그린다 (`FX.heartScale`, `FX.starScale`)
- **크기 배율은 곱해진다**: 블록 크기 = 칸 × `VIEW.blockScale`, 스왑할 때는 여기에 `ANIM.swapPop`이 또 곱해진다. 두 값을 같이 봐야 이웃과 겹치지 않는다 (`src/view/BlockSprite.ts`)

### W2-01 특수 블록 결정
- **우선순위 있는 규칙 = 위에서부터 `if` → `return`**: 6개 이상이면서 5I를 품은 그룹도 `super`가 된다. 순서가 곧 규칙이라 PLAN 4.5 표와 코드 순서를 똑같이 맞췄다 (`src/core/specials.ts`)
- **판정에 필요한 정보는 미리 계산해 둔다**: `maxRunH`, `maxRunV`, `hasIntersection`은 매치 판정(W1-09) 때 이미 구해 둬서, 결정 함수는 숫자 비교만 한다
- **기본값 매개변수로 설정 주입**: `decideSpecial(group, lineDirection = SPECIAL.lineDirection)`. 평소엔 config를 쓰고, 테스트에서는 다른 값을 넘겨 config를 건드리지 않고 두 방식을 다 검사한다
- **표 기반 테스트**: `it.each([[이름, 보드, 기대값], …])`로 규칙 표를 그대로 테스트로 옮겼다. `%s`로 테스트 이름에 행 이름이 찍힌다 (`tests/core/specials.test.ts`)
- 참고: [MDN 기본값 매개변수](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Functions/Default_parameters)

### W2-02 특수 블록 생성 위치
- **문서 먼저**: SPEC의 "그룹 중앙"이 어느 칸인지 정해져 있지 않아서, 코드보다 PLAN 4.5에 정의(무게중심에 가장 가까운 그룹 칸, 동점이면 왼쪽 위)를 먼저 적었다
- **무게중심(centroid)**: 칸 좌표의 평균. L 모양처럼 평균점이 그룹 밖일 수 있어서 "가장 가까운 그룹 칸"을 고른다 (`src/core/specials.ts`)
- **부동소수점 동점 함정**: `0.36 + 0.16`과 `0.16 + 0.36`이 컴퓨터에서 똑같다는 보장이 없다. 평균으로 나누는 대신 양쪽에 칸 수 n을 곱해 정수끼리 비교했다
- **`reduce`로 최솟값 찾기**: `cells.reduce((best, p) => (dist(p) < dist(best) ? p : best))`. `<`(같으면 유지)라서 동점이면 앞 칸이 남는다 → 결정적
- **`find` + `some`**: 스왑한 두 칸 중 그룹에 들어 있는 칸 찾기
- 참고: [MDN Array.reduce](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce), [0.1 + 0.2 ≠ 0.3](https://0.30000000000000004.com/)

### W2-03 특수 블록 발동 범위
- **범위 = 조건(predicate)**: 칸마다 "범위 안인가?"를 묻는 함수 하나로 모양을 표현한다. 폭탄은 `|Δr| ≤ 1 && |Δc| ≤ 1`(체비쇼프 거리 1), 슈퍼는 그 5x5에 `Δr = 0 || Δc = 0`을 더한 것 (`src/core/specials.ts`)
- **전체를 훑으면 잘림·정렬·중복이 공짜**: 보드 칸을 행 우선으로 한 번 돌며 조건에 맞는 칸만 모으니, 보드 밖 좌표가 생기지 않고 결과도 항상 정렬돼 있다. 8x8 = 64칸이라 성능 걱정이 없다
- **`switch` 완전성 검사**: `SpecialKind`의 5가지를 모두 `case`로 다루면 TypeScript가 빠진 경우가 없다는 걸 안다 (하나 지우면 반환 타입 에러)
- **그림으로 비교하는 테스트**: 칸 목록을 `x`/`.` 그림 문자열로 바꿔 비교하면 실패 메시지가 보드 모양 그대로 나온다 (`tests/core/specials.test.ts`의 `mask`)
- 참고: [체비쇼프 거리](https://ko.wikipedia.org/wiki/체비쇼프_거리)

### W2-04 연쇄 발동
- **BFS (너비 우선 탐색)**: 큐에 발동할 특수 블록을 넣고 앞에서부터 꺼내 처리한다. 처리하다 새로 만난 특수 블록은 큐 뒤에 붙는다. 배열 + 인덱스(`for (k = 0; k < queue.length; k++)`)로 큐를 흉내 내면 `shift()` 비용도 없다 (`src/core/specials.ts`)
- **방문 표시(`seen`)로 무한 루프 막기**: 두 줄 블록이 서로를 범위에 넣어도, 이미 본 칸은 다시 큐에 넣지 않으니 한 번씩만 발동한다. 그래프 탐색의 기본
- **`Extract<유니온, 조건>`**: `GameEvent` 중 `type: 'activate'`인 모양만 뽑아 타입으로 쓴다. 이벤트 모양이 바뀌면 여기도 같이 따라간다
- **결정적 순서**: 시작 칸은 넘겨받은 순서, 범위 칸은 행 우선. 같은 보드 → 같은 `activate` 순서라 리플레이·테스트가 흔들리지 않는다
- 참고: [너비 우선 탐색 (위키백과)](https://ko.wikipedia.org/wiki/너비_우선_탐색), [TypeScript Extract](https://www.typescriptlang.org/docs/handbook/utility-types.html#extracttype-union)

### W2-05 엔진에 특수 블록 연결
- **작은 함수를 조립하는 오케스트레이터**: `resolveSwap`은 `decideSpecial` → `specialPosition` → `chainActivate`를 차례로 부르기만 한다. 각 부품은 W2-01~04에서 따로 테스트했으니, 여기서는 "조립 순서"만 검증하면 된다 (`src/core/engine.ts`)
- **순서가 규칙을 만든다**: 폭발로 지울 칸을 다 정한 *다음에* 새 특수 블록을 놓으니, 'keep' 규칙은 코드 한 줄 없이 저절로 지켜진다. 'explode'만 추가 처리가 필요하다
- **설정 스위치 + 기본값 매개변수**: `resolveSwap(state, a, b, newSpecialInBlast = SPECIAL.newSpecialInBlast)`. 게임은 config를 따르고, 테스트는 두 값을 직접 넘겨 둘 다 검사한다
- **퍼즈 테스트가 찾은 것**: 3색 보드에서 연쇄가 56번까지 이어져 "무한 연쇄" 안전장치(50)에 걸렸다. 버그인지 보려고 색 수별 연쇄 길이를 측정해 보니 끝나는 연쇄였다 → 상한을 200으로. 안전장치가 울리면 먼저 "진짜 버그인가, 기준이 틀렸나"를 데이터로 가린다
- **이벤트 계약**: 같은 step 안에서 `remove` 다음에 `create`가 와야 view(`EventTracker`)가 "빈칸에만 놓는다"는 검사를 통과한다. 퍼즈 테스트의 `replay`가 이 계약을 매 턴 확인한다
- **`Error`의 `cause`**: 잡은 에러를 감싸 다시 던질 때 `new Error(msg, { cause: e })`로 원인을 붙이면 원래 스택이 사라지지 않는다 (`tests/core/fuzz.test.ts`)
- 참고: [MDN Error cause](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Error/cause)

### W2-06 무지개 블록 스왑
- **특수 경로를 기존 루프에 합류시키기**: 무지개 스왑은 "매치 대신 발동으로 시작"하는 것만 다르다. 첫 바퀴만 `burst` 분기로 지울 칸을 정하고, 제거·낙하·연쇄는 일반 루프를 그대로 탄다. 경로를 따로 복사하지 않아서 버그가 날 곳이 하나다 (`src/core/engine.ts`의 `colorSwapBurst`)
- **이미 처리한 것 알려주기**: 무지개 블록은 자기 범위에 자기 자신이 들어 있어서, 그대로 연쇄에 넘기면 한 번 더 발동한다. `chainActivate`에 `activated`(이미 발동한 칸)를 넘겨 막았다. BFS에서 시작 노드를 "방문함"으로 미리 표시하는 것과 같다 (`src/core/specials.ts`)
- **`null`이 뜻을 갖는 값**: 무지개 블록의 색은 `null`이라, 무지개끼리 바꾸면 대상 색이 `null` → `blastArea`의 "보드 전체" 규칙으로 자연스럽게 이어진다. 따로 `if`를 두지 않았다
- **임시 우회는 표시하고 꼭 지운다**: W2-05에서 퍼즈 테스트에 남긴 `shortcut:` 주석 두 개를 이번에 지우고 원래 검사(1000수)로 되돌렸다. `grep -rn shortcut src tests`로 남은 게 없는지 확인한다

### W2-07 특수 블록 표시 + 발동 연출
- **"무엇을" 과 "어떻게 그리나" 나누기**: 종류별로 빛줄기·원·흔들림·반짝임 중 무엇을 쓸지는 Phaser 없는 순수 함수(`src/view/fx/specialFx.ts`)가 정하고 테스트한다. 실제 그리기는 `FxDirector`가 한다. `fxLevels.ts`와 같은 패턴
- **알림(hooks)으로만 연결**: `BoardView`는 `activate` 이벤트를 만나면 `onActivate`를 부르기만 하고, 어떤 연출이 나오는지 모른다. 연출은 기다리지 않으니 입력 잠금 시간도 그대로다 (`src/view/BoardView.ts`, `src/scenes/GameScene.ts`)
- **한 번 쓰고 버리는 도형 + 트윈**: 빛줄기(`rectangle`)와 원(`circle`)을 만들고 `tweens.add`로 가늘어지거나 퍼지며 투명해지게 한 뒤 `onComplete`에서 `destroy()`. 한 턴에 몇 개뿐이라 이미터를 미리 만들 필요가 없다
- **트윈 속성 이름을 계산하기**: `[row ? 'scaleY' : 'scaleX']: end`처럼 계산된 키로 가로·세로 빛줄기를 한 코드로 처리했다
- **모양이 여럿이면 배지**: 블록 모양이 6가지라 줄무늬는 삼각형·별 밖으로 삐져나온다. 모양과 무관한 자리(오른쪽 위)에 배지를 붙이면 모든 블록에서 똑같이 읽힌다 (`src/view/theme/textures.ts`의 `drawSpecial`)
- **개발용 장면 만들기**: `?specials`처럼 확인하고 싶은 상태를 바로 만드는 URL 옵션이 있으면, 4개를 맞춰 특수 블록을 만들 때까지 기다리지 않아도 된다. `import.meta.env.DEV` 안에 두어 배포 빌드에는 빠진다

### W2-08 점수 계산
- **규칙을 작은 순수 함수로**: `groupBase`(그룹 크기 → 점수), `cascadeMultiplier`(연쇄 배율), `stepScore`(한 단계 합계). 숫자는 전부 `config.SCORE`에서 읽어서 밸런스 조정은 config만 고치면 된다 (`src/core/scoring.ts`, `src/config.ts`)
- **결과는 이벤트로 넘긴다**: core는 누적 점수를 들고 있지 않고, 단계마다 `score` 이벤트(점수·위치)와 턴 합계 `scoreDelta`만 돌려준다. 더하는 건 바깥(지금은 `GameScene`, 나중엔 mode) 몫이다 (`src/core/engine.ts`, `src/scenes/GameScene.ts`, PLAN 4.8)
- **같은 블록을 두 번 세지 않기**: 맞춘 줄의 블록은 그룹 점수로, 특수 효과로 추가로 지워진 블록만 20점씩. `remove` 이벤트의 `bySpecial` 표시로 구분한다
- **퍼즈 테스트의 불변식**: 무작위로 많은 판을 돌리며 "매치가 있는 단계마다 score 1개, 합계 = `scoreDelta`, 점수 > 0"을 확인한다. 예시 테스트가 놓치는 경우를 잡는다 (`tests/core/fuzz.test.ts`)

### W2-09 게임 모드 인터페이스
- **인터페이스로 모드 나누기**: 씬은 `GameMode`만 알고, 타임어택·스토리 규칙은 각 클래스가 가진다. `implements GameMode`를 붙이면 빠진 메서드를 TypeScript가 잡아 준다 (`src/modes/GameMode.ts`)
- **판별 유니온(discriminated union)**: `ModeResult`의 `kind`로 분기하면 그 안에서 타입이 좁혀진다(`kind === 'story'`면 `stars`가 있다). `expectTypeOf`로 타입 자체를 테스트한다 (`tests/modes/gameMode.test.ts`)
- **규칙을 도구로 강제**: `src/modes`도 core처럼 Phaser·DOM·`Math.random`을 못 쓰게 ESLint가 막는다 (`eslint.config.js`)

### W2-10 타임어택 모드
- **시간을 밖에서 받기**: `tick(dtMs)`로 흐른 시간을 넘겨받아서 `Date.now()` 없이도 테스트가 항상 같은 결과를 낸다 (`src/modes/TimeAttackMode.ts`)
- **이상한 입력 막기**: 0 이하, `NaN`, `Infinity` 같은 값은 무시하고 남은 시간은 0 아래로 안 내려간다. 프레임이 튀어도 타이머가 깨지지 않는다
- **"끝"과 "입력 막기"는 다르다**: 시간이 0이 되면 입력만 막고, 이미 시작된 연쇄 점수는 그 뒤에 들어와도 더한다 (PLAN 5절)

### W2-11 아래 정보 패널 + 화면 배치 + 타이머
- **화면 크기에 맞추기**: `Phaser.Scale.EXPAND`는 기준(720×1280)보다 긴 화면이면 게임 높이를 늘린다. 늘어난 만큼을 어디에 줄지는 순수 함수 `screenLayout(height)`가 계산해서 테스트할 수 있다 (`src/main.ts`, `src/view/layout.ts`, `config.VIEW.screen`)
- **바뀔 때만 다시 그리기**: HUD는 매 프레임 불리지만 점수·초·막대 길이가 실제로 바뀔 때만 글자를 바꾸고 다시 그린다. 휴대폰에서 아끼는 방법 (`src/view/Hud.ts`, 포맷은 `src/view/format.ts`)
- **씬의 `update(time, delta)`**: 매 프레임 흐른 시간(`delta`, ms)을 모드의 `tick`에 넘긴다. 게임 규칙(모드)은 시간을 받기만 하고 시계를 직접 보지 않는다 (`src/scenes/GameScene.ts`)
- **카메라와 월드 좌표**: 넓은 창에서는 카메라를 밀어서 보드를 가운데 맞추므로, 입력은 화면 좌표가 아니라 `pointer.worldX/worldY`로 칸을 찾는다 (`src/view/input.ts`)
- **그려서 한 번 굽기 (복습)**: 언덕·막대사탕·컵케이크를 canvas에 한 번 그려 텍스처로 쓴다 (`src/view/theme/Hills.ts`)

### W2-12 결과 화면
- **씬끼리 데이터 넘기기**: `scene.start('Result', { result })` → 받는 쪽 `init(data)`에서 꺼낸다. `init`은 `create`보다 먼저, 씬을 다시 시작할 때마다 불려서 초기화 자리로 쓴다 (`src/scenes/ResultScene.ts`)
- **버튼 만들기**: 배경 그림과 글자를 `Container`로 묶고 `setInteractive`. 눌림 트윈이 끝난 뒤(`onComplete`) 다음 화면으로 가서 누른 느낌이 끝까지 보인다. 두 번 눌러도 한 번만 시작되게 막는다
- **화면 크기 기준 배치**: 위치를 `this.scale.width/height`의 가운데 + config의 `dy`로 정해서 화면 비율이 바뀌어도 가운데에 온다. 콤마 넣기(`formatScore`)처럼 계산만 하는 부분은 Phaser 없는 함수로 빼서 테스트한다 (`src/scenes/resultText.ts`, `config.RESULT`)

### W2-13 탭-탭 입력
- **선택 규칙을 순수 함수로**: `tapSelect(선택, 탭한 칸)` → 선택·해제·교환을 Phaser 없이 테스트한다 (`src/view/input.ts`, `tests/view/input.test.ts`)
- **입력 상태 기계**: 누름을 기억 → 움직임이 기준을 넘으면 스와이프, 못 넘고 떼면 탭 (`BoardInput`의 down / move / up)
- **연출끼리 겹치지 않게**: 컨테이너 크기는 말랑·팝 연출이, 몸통 이미지 크기는 선택 확대가 맡는다. 한 값을 두 연출이 동시에 바꾸면 서로 덮어쓴다 (`src/view/BlockSprite.ts`)

### W3-01 스테이지 데이터 검증
- **외부 데이터는 믿지 않는다**: JSON은 사람이 손으로 쓰니 틀릴 수 있다. `unknown`으로 받아 칸마다 확인한 뒤에야 `StageDef` 타입으로 넘긴다 (`src/data/stageSchema.ts`의 `parseStory`)
- **위치가 담긴 에러**: "잘못됐다"가 아니라 `story[3].goals[0].count: 1 이상의 정수여야 한다`처럼 고칠 곳을 알려준다 (`StageError`)
- **이름 ↔ 숫자 매핑**: JSON에는 읽기 쉬운 `"red"`, 게임 안에서는 숫자 `0`. 경계(검증)에서 한 번만 바꾼다 (`COLOR_NAMES`, `colorFromName`)

### W3-07 저장 (최고 점수)
- **순수 규칙과 부수효과 나누기**: "더 큰 점수만 남긴다" 같은 규칙(`recordTimeAttack`, `recordStory`)은 순수 함수, 실제 저장은 어댑터(`LocalStorageAdapter`)가 맡는다. 테스트에서는 가짜 저장소를 넣는다 (`src/storage/progress.ts`)
- **깨진 저장 데이터 다루기**: 없음·깨진 JSON·버전 다름은 기본값으로, 일부 칸만 틀리면 그 칸만 기본값으로 채운다. `version`은 나중에 형식이 바뀔 때 옮기기 위한 표시 (`parseSave`)
- **전역은 한 곳에서만**: `window.localStorage`는 `BootScene`에서만 만지고, 씬끼리는 Phaser registry로 저장 데이터를 나눠 쓴다 (`src/scenes/BootScene.ts`, `src/scenes/saveRegistry.ts`)

### W3-05 스토리 모드 규칙
- **상태 하나로 판정**: `'playing' | 'cleared' | 'failed'` 한 값에서 끝났는지·입력 가능한지·결과를 모두 끌어낸다. 값이 여러 개면 서로 어긋날 수 있다 (`src/modes/StoryMode.ts`)
- **타입만 가져오기**: modes는 data의 값은 못 쓰고 `import type { StageDef }`로 타입만 가져온다. 실행 코드 의존이 생기지 않는다. ESLint의 `allowTypeImports`로 지킨다 (`eslint.config.js`)
- **실제 엔진 결과로 테스트**: 가짜 결과만 쓰지 않고 `resolveSwap` 결과를 넣어서 모드와 엔진이 정말 맞물리는지 본다 (`tests/modes/storyMode.test.ts`)

### W3-06 남은 이동 보너스 + 별
- **경계값 테스트**: 별 기준이 3000이면 2999·3000·3001을 다 확인한다. 버그는 경계에서 잘 난다 (`tests/modes/storyScore.test.ts`)
- **계산을 순수 함수로**: `movesLeftBonus`, `starsFor`를 모드 밖으로 빼서 표처럼 테스트한다 (`src/modes/storyScore.ts`)
- **결과에 근거 담기**: 결과에 최종 점수뿐 아니라 그중 보너스 금액(`bonus`)도 넣어서 결과 화면이 "남은 이동 보너스 +900"을 보여줄 수 있다

### W3-02 스테이지 파일 읽기
- **에러를 감싸서 다시 던지기**: 네트워크 실패, 404, 깨진 JSON, 검증 실패를 모두 `stages/story.json: 이유` 형태로 바꾼다. 원래 에러는 `cause`에 남겨서 추적할 수 있다 (`src/data/stageLoader.ts`)
- **의존성 주입으로 테스트**: `loadStages(fetchFn)`처럼 `fetch`를 인자로 받으면 테스트에서 가짜 fetch로 404·깨진 응답을 마음대로 만든다 (`tests/data/stageLoader.test.ts`)
- **실패하면 시작하지 않기**: 데이터가 틀린 채로 게임이 돌면 원인을 찾기 어렵다. Boot에서 한 번 읽고, 틀리면 화면에 바로 보여준다 (`src/scenes/BootScene.ts`, `src/scenes/stageRegistry.ts`)

### W3-03 스토리 스테이지 1~10
- **데이터로 게임 조정하기**: 난이도 숫자가 코드가 아니라 JSON에 있어서 코드를 몰라도 바꿀 수 있다 (`public/stages/story.json`)
- **계약 테스트**: 실제 파일을 읽어 검증을 통과하는지, 10개인지, 색 수가 뒤로 갈수록 줄지 않는지 확인한다. 누가 파일을 잘못 고치면 `npm test`가 잡는다. Vite의 `?raw` import로 파일 내용을 문자열로 읽는다 (`tests/data/stories.test.ts`)
- **숫자 정하기 (시뮬레이션)**: 별·목표 숫자는 자동 플레이 300판의 분포로 정했다. 감보다 측정 (설계 문서 3절)

### W3-04 경쟁 모드 설정 파일
- **기본값과 설정 파일**: 실제 값은 `timeattack.json`, `config.TIMEATTACK`은 파일이 없을 때나 테스트에서 쓰는 기본값으로 남는다. 개발용 URL 옵션 > 설정 파일 > 기본값 순서로 우선한다 (`src/scenes/GameScene.ts`)

### W3-08 메뉴
- **어디로 갈지 정하는 것도 순수 함수로**: 주소(`?stage=3` 등)를 보고 첫 화면을 고르는 `bootRoute`, 메뉴 문구를 만드는 `storyLabel`은 Phaser 없이 테스트한다 (`src/scenes/bootRoute.ts`, `src/scenes/menuText.ts`)
- **공통 컴포넌트**: 결과 화면의 버튼을 `addButton`으로 빼서 메뉴·지도·결과가 같이 쓴다. 한 화면 버튼끼리 `PressLock`을 나눠서 두 버튼을 동시에 눌러도 한 번만 이동한다 (`src/view/ui/Button.ts`)
- **씬 사이 데이터 타입**: `GameData`, `ResultData`를 한 파일에 모아 두면 보내는 쪽·받는 쪽이 같은 모양을 쓴다 (`src/scenes/sceneData.ts`)

### W3-09 스테이지 지도
- **곡선 길 그리기**: 노드 점들로 `Spline` 곡선을 만들고 `getSpacedPoints`로 같은 간격의 점을 찍어 점선 길을 그린다 (`src/scenes/StageMapScene.ts`)
- **트윈 조합**: 숨쉬기는 `yoyo + repeat`, 튀어나오기는 `tweens.chain`(여러 단계를 차례로), 흔들림은 `isTweening`으로 겹치지 않게
- **씬이 끝나도 남겨야 하는 값**: "직전에 본 열린 스테이지 수"를 game registry에 두어 지도에 다시 왔을 때 비교한다. 씬 안 변수는 `scene.start` 때 사라진다
- **배치·상태 계산 분리**: `mapNodes`(노드 위치), `nodeStates`(완료/지금/잠김)를 테스트한다 (`src/view/mapLayout.ts`)

### W3-11 결과 화면 (스토리)
- **화면 내용 결정 함수**: 결과를 받아 제목·별·보너스 줄·버튼 조합을 돌려주는 `resultView`를 표처럼 테스트한다. 씬은 받은 대로 그리기만 한다 (`src/scenes/resultText.ts`)
- **Phaser 함정 하나**: `tweens.chain`의 맨 바깥 `delay`는 무시된다. 첫 단계 트윈 안에 넣어야 한다 (`src/scenes/ResultScene.ts`)

### W3-10 스토리 HUD
- **모드별 화면을 클래스로 나누기**: 패널 테두리는 `Hud`, 안쪽은 `TimePanel`(경쟁)과 `StoryPanel`(스토리). 씬은 모드에 맞는 패널 하나만 만든다 (`src/view/Hud.ts`, `src/view/TimePanel.ts`, `src/view/StoryPanel.ts`)
- **문구는 순수 함수로**: 미션 진행 → `빨강 12 / 25` 같은 줄 계산을 `goalLine`, `storyLines`로 빼서 테스트 (`src/view/storyLines.ts`)
- **씬 시작 데이터로 분기**: `init(data)`에서 `mode`를 보고 `TimeAttackMode` 또는 `StoryMode`를 만든다. 나머지 게임 진행은 `GameMode` 인터페이스 하나로 같다 (`src/scenes/GameScene.ts`)

### W3-12 해금 + 저장
- **결과 → 저장 규칙도 순수 함수로**: `applyModeResult(save, result, stageCount)`가 모드에 따라 최고 점수·해금·별을 갱신한 새 저장 데이터를 돌려준다. 10번을 깨도 11번이 열리지 않게 상한도 여기서 (`src/storage/progress.ts`)
- **순서가 중요한 곳**: 저장 데이터(registry)를 먼저 갱신한 뒤 결과 화면으로 간다. 결과 화면이 그 값을 보고 [다음 스테이지]를 보일지 정하기 때문이다. 실제 저장소 쓰기는 기다리지 않는다 (`GameScene.finish`)

### W3-13 Android 앱 시험 빌드
- **Capacitor는 껍데기**: 웹 빌드(`dist/`)를 Android 앱 안의 WebView에 담는다. `MainActivity`(BridgeActivity)가 WebView를 띄우고 `https://localhost`로 앱 안 파일을 보여 준다. 그래서 `fetch('/stages/story.json')`도 그대로 동작한다 (`capacitor.config.ts`, `android/app/src/main/java/com/ddooby/pang/MainActivity.java`)
- **sync = 복사 + 설정 갱신**: `cap sync`가 `dist/`를 `android/app/src/main/assets/public`에 복사하고 플러그인 Gradle 설정을 갱신한다. 복사본은 산출물이라 커밋하지 않는다 (`package.json`의 `android:sync`, `android/.gitignore`)
- **Gradle·JDK·SDK**: Gradle(+ Android Gradle Plugin)이 빌드 도구, JDK는 그걸 돌리는 Java(여기선 21), SDK는 Android API와 빌드 도구. `compileSdk`(컴파일 기준 API 36) / `targetSdk`(동작을 맞추는 API 36) / `minSdk`(설치 가능한 최저 API 24) (`android/variables.gradle`, `android/gradle/wrapper/gradle-wrapper.properties`)
- **앱 ID와 서명은 바꾸면 다른 앱**: 디버그 APK는 `~/.android/debug.keystore`로 자동 서명된다. 스토어 배포용은 따로 만든 release 키로 서명해야 하고, 앱 ID(`com.ddooby.pang`)나 서명 키가 바뀌면 기존 앱 위에 업데이트로 설치되지 않는다 (PLAN 7.3)

### W4-01 점수 팝업 + 특수 발동 흔들림
- **트윈은 대상을 지우지 않는다**: 떠오르며 사라진 글자도 화면에 남아 쌓인다. 마지막 단계의 `onComplete`에서 `destroy()`한다 (`src/view/fx/FxDirector.ts` `playScore`)
- **clamp(가두기)**: 글자 폭의 절반을 알아야 해서, 만든 뒤 `text.width × 커지는 배율`로 [보드 왼쪽 + 반폭, 오른쪽 − 반폭] 안에 x를 가둔다. 계산은 순수 함수로 빼서 테스트 (`src/view/fx/scorePopup.ts`)
- **이벤트에 위치 담기**: core의 `score` 이벤트가 `at`(팝업 위치)을 함께 주므로 view는 계산 없이 그 칸에 띄우기만 한다 (`src/core/engine.ts`, `BoardViewHooks.onScore`)
- **흔들림 겹침 규칙**: `camera.shake(시간, 세기, force=false)`는 이미 흔들리는 중이면 새 요청을 무시한다. 그래서 호출 순서(연쇄 match → 특수 activate)가 곧 우선순위다. 종류별 세기는 `FX.special.shake` (`src/view/fx/specialFx.ts`)
- **칸별 카운터**: 같은 칸에 팝업이 떠 있는 수를 `Map`으로 세어 그만큼 위로 띄우고, 사라질 때 줄인다 (`FxDirector`)

### W4-02 효과음 + 음소거
- **오디오 로드·캐시**: `this.load.audio(key, url)`로 읽으면 디코드되어 `cache.audio`에 남는다. 씬이 바뀌어도 게임 전체에서 쓴다. 실패한 파일은 캐시에 없으니 `cache.audio.exists(key)`로 확인하고 넘어간다 (`src/scenes/BootScene.ts`, `src/view/Sfx.ts`)
- **오디오 잠금 해제**: 브라우저는 사용자가 한 번 누르기 전까지 소리를 막는다(AudioContext가 suspended). Phaser가 첫 터치에서 풀어 준다
- **음 높이 = 재생 속도**: `rate` 1.5면 1.5배 빠르고 완전5도 높다. 반음 하나는 2^(1/12) ≈ 1.0595배. 연쇄 단계별 값은 `SOUND.matchRateByLevel` (`sfxRate`)
- **저장 데이터에 필드 추가하기**: 새 필드를 `defaultSave`에 넣고, `parseSave`가 "있고 타입이 맞을 때만" 읽게 하면 옛 저장값도 기본값으로 채워져 `version`을 올리지 않아도 된다 (`src/storage/progress.ts` `settings.muted`, `setMuted`)
- **예약 반영되는 값**: WebAudio 볼륨은 다음 처리 주기에 바뀌어서 `sound.mute`를 바로 다시 읽으면 옛값이 나온다. 판단에 쓰는 음소거 상태는 따로 들고 있는다 (`Sfx.ts`)
- **CC0 에셋**: 출처 표시 의무는 없지만 어디서 왔는지 `public/audio/CREDITS.md`에 남겨 두면 나중에 바꾸기 쉽다

### W4-03 힌트
- **무입력 타이머를 상태 기계로**: 매 프레임 "지금 입력할 수 있나(ready)"를 넘기고, ready가 아니면 잰 시간을 0으로 버린다. 이 하나로 재생 중·게임 끝·자동 플레이를 다 처리하고, 입력 이벤트는 `reset()`만 부른다. Phaser 없이 테스트한다 (`src/view/hintTimer.ts`, `GameScene.updateHint`)
- **무한 반복 트윈 끄기**: `repeat: -1` 트윈은 스스로 끝나지 않는다. `killTweensOf(대상)`으로 멈춘 뒤 크기를 직접 원래 값으로 돌려놓는다. 멈춘 그 크기로 남기 때문이다 (`BlockSprite.setHint`)
- **사라졌을 수 있는 대상**: 힌트를 끄는 사이 블록이 터졌을 수 있으니 id로 다시 찾고 없으면 건너뛴다 (`sprites.get(id)?.`, `BoardView.hideHint`)
- **위치는 안 건드린다**: 크기만 바꾸므로 DEV 화면 ↔ 게임 상태 위치 대조가 깨지지 않는다

### W4-04 일시정지
- **씬 위에 씬 띄우기**: `scene.launch('Pause')`는 다른 씬을 끄지 않고 하나 더 띄운다. `scene.pause()`는 그 씬의 update·트윈·타이머·입력을 멈추고 그리기는 계속한다(멈춘 화면이 보인다). `resume`은 멈춘 자리부터 이어간다. 그래서 연쇄 재생 중에도 멈췄다 이어진다 (`GameScene.requestPause`, `src/scenes/PauseScene.ts`)
- **그리는 순서와 입력 삼키기**: 씬은 `main.ts`의 배열 순서대로 그려지므로 Pause를 Game 뒤에 둔다. 덮개에 `setInteractive`를 걸면 위 씬이 입력을 먼저 받아 아래 게임에 닿지 않는다
- **리스너는 직접 뗀다**: `document`와 `scene.events`에 단 리스너는 씬이 끝나도 자동으로 사라지지 않는다. 다시하기를 반복하면 쌓이므로 `events.once('shutdown')`에서 같은 함수 참조로 뗀다 (`visibilitychange`)
- **화면이 가려질 때**: `document.visibilitychange` + `document.hidden`. Phaser도 같은 이벤트로 게임 루프를 재우고 깨우므로, 우리는 돌아왔을 때 바로 이어지지 않게 창만 띄운다
- **공통 컴포넌트로 묶기**: 동그란 아이콘 버튼이 세 곳(스피커, ❚❚, [←])이 되어 `RoundButton`으로 묶고 아이콘 그리는 함수만 넘긴다. 크림 판도 `drawCreamPanel`로 결과·일시정지가 같이 쓴다 (`src/view/ui/RoundButton.ts`, `src/view/ui/Panel.ts`)

### W4-07 Android 앱 설정
- **적응형 아이콘**: Android 8 이상은 앞면(투명 + 그림)과 뒷면(단색) 두 장을 108dp 캔버스에 겹치고, 런처가 원·둥근 사각형 등으로 잘라 가운데 72dp만 보여 준다. 그래서 중요한 그림은 가운데에 둔다. `mipmap-anydpi-v26/ic_launcher.xml`이 두 장을 묶고, 옛 기기는 `mipmap-*dpi/ic_launcher.png` 한 장짜리를 쓴다 (`assets/app-icon/`, `src/dev/appIcon.ts`, `android/app/src/main/res/mipmap-*`)
- **같은 그림 재사용**: 아이콘을 따로 그리지 않고 게임 블록을 그리는 함수(`drawBlockOnCanvas`, `src/view/textures.ts`)로 1024px 캔버스에 그린다. DEV 전용 `?icon` 페이지는 배포 빌드에서 tree-shake로 빠진다
- **screenOrientation**: Activity 단위 설정. 시스템 회전 설정과 상관없이 세로로 고정한다 (Android 16은 600dp 이상 큰 화면에서 이 값을 무시할 수 있다) (`android/app/src/main/AndroidManifest.xml`)
- **뒤로 가기 버튼**: `@capacitor/app`의 `App.addListener('backButton')`을 등록하면 WebView 기본 동작(뒤로·종료)이 꺼지고 앱이 정한다. 웹에서는 `Capacitor.isNativePlatform()`으로 건너뛴다. "지금 무엇을 할지"는 순수 함수 `backAction`으로 판단해 테스트하고, 실행(씬 호출)은 `backButton.ts`가 한다. 일시정지는 ❚❚와 같은 `GameScene.requestPause`, 계속은 [계속]과 같은 `PauseScene.resumeGame` 경로를 탄다 (`src/scenes/backAction.ts`, `src/scenes/backButton.ts`, `tests/scenes/backAction.test.ts`)
- **edge-to-edge와 안전 영역**: targetSdk 35 이상 앱은 Android 15부터 화면이 상태바·내비바 밑까지 그려지는 게 강제된다. Capacitor 8 SystemBars는 `index.html`에 `viewport-fit=cover`가 없으면 바 크기만큼 native padding을 줘서 막고, 있으면 inset 값을 CSS `env(safe-area-inset-*)`로 넘겨 웹이 처리하게 한다. 지금은 padding 방식이라 게임이 바와 겹치지 않는다 (`node_modules/@capacitor/android/.../SystemBars.java`, `index.html`)
- **시작 화면(Android 12+)**: 테마의 `windowSplashScreenBackground`(배경색) + 앱 아이콘이 자동으로 뜨고, 끝나면 `postSplashScreenTheme`로 바뀐다. 예전 splash.png 11장은 지웠다 (`android/app/src/main/res/values/styles.xml`, `values/splash.xml`)
- **줄바꿈 정규화**: `.gitattributes`의 `*.bat text eol=crlf`는 git 안에는 LF로, 작업 폴더에는 CRLF로 둔다. Windows에서 `gradlew.bat`가 깨지지 않게 한다 (`git ls-files --eol`로 확인)

### W4-08 앱 전용 저장소
- **SharedPreferences와 WebView localStorage**: localStorage는 WebView(Chromium) 데이터 폴더에 있어서 저장 공간이 모자라거나 WebView 데이터가 초기화되면 날아갈 수 있다. `@capacitor/preferences`는 Android `SharedPreferences`(앱 전용 XML `shared_prefs/CapacitorStorage.xml`)라 앱을 지울 때까지 남는다. 같은 키(`ddooby-pang/save`)를 쓰고, Preferences가 비어 있을 때만 localStorage 값을 한 번 옮긴다
- **플랫폼에 따라 구현 고르기**: 저장 규칙(`SaveStorage` 인터페이스)은 하나, 구현은 둘. `Capacitor.isNativePlatform()`이 참이면 Preferences, 아니면 localStorage. 다른 씬은 어느 쪽인지 모른다 (`src/scenes/BootScene.ts`)
- **비동기 저장 순서 보장**: `pending = pending.then(write)` 사슬로 앞 쓰기가 끝난 뒤 다음 쓰기를 시작한다. 각 쓰기에 `catch`를 달아 한 번 실패해도 사슬이 끊기지 않는다. 그래서 결과 저장 직후 음소거를 눌러도 나중 값이 남는다
- **의존성 주입으로 테스트**: storage는 Capacitor를 import하지 않고 `PreferencesLike`·`KeyValueStore` 모양만 받는다. 진짜는 BootScene이 넣고, 테스트는 Map으로 만든 가짜와 늦게 끝나는 가짜를 넣어 순서와 실패를 재현한다 (`src/storage/progress.ts`, `tests/storage/preferencesStorage.test.ts`)
