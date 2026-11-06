# V2-W2-08 core 공유·리플레이 PoC 결과

> 2026-11-06, claude-1. 환경: macOS, Node v23.10.0, Deno 2.9.8 (V8 15.0, TS 6.0.3), rolldown 1.2.15 (vite 8에 포함), Phaser 3.90.0.
> Supabase 프로젝트·CLI·Docker 없이 로컬에서만 확인했다. 실제 Edge Function 배포는 시험하지 않았다 (확인 필요 항목은 C 끝).

| 파일 | 역할 |
|---|---|
| `scripts/server-poc/replay.ts` | `replayTimeAttack(seed, moves)` 리플레이 시제품. `src/core`·`src/modes`만 import |
| `scripts/server-poc/validate.ts` | 서버 판정: `validateMoves`·`checkServerTiming`·`submissionHash`·`resubmitDecision`·`verifySubmission`. 기준값은 `JUDGE` 한곳 |
| `scripts/server-poc/server.ts` | Edge Function 진입점 시제품 (replay + validate 재수출). rolldown 번들 입력 |
| `scripts/server-poc/logs.ts` | seed RNG(`core/rng.ts`)로 만드는 결정적 랜덤 로그. 현실 간격·경계·늦은 move·셔플 재현 옵션 |
| `scripts/server-poc/node-scores.poc.ts` | Node(Vitest)에서 1000개 로그의 리플레이 결과·판정·제출 해시를 `out/node-scores.json`에 쓴다 |
| `scripts/server-poc/deno/compare.ts` | Deno에서 1000개 로그와 브라우저 기록을 다시 돌려 대조. 가져올 server 모듈 경로를 인자로 받는다 |
| `scripts/server-poc/browser/record.js` | 실제 게임 입력 기록기 (GameScene `trySwap`·`finish`를 감싼다. src 수정 없음) |
| `scripts/server-poc/browser/drive.js` | 경쟁 모드 한 판을 실제 마우스 드래그(또는 `?demo`)로 끝까지 두는 Playwright 드라이버 |
| `scripts/server-poc/fixtures/browser-runs.json` | 브라우저에서 기록한 6판 (move·t·결과 화면 점수). t는 정수 ms로 내림 |
| `scripts/server-poc/browser/probe.js` | D 실측 프로브 (dev 페이지에 넣는다) |
| `tests/poc/replay.test.ts` | `npm test`에서 도는 리플레이 테스트 14개 |
| `tests/poc/validate.test.ts` | `npm test`에서 도는 서버 판정 테스트 23개 |

실행: `npm run poc:deno` (Node 기록 → rolldown으로 `server.ts` 번들 → Deno 직접 import 비교 → Deno 번들 비교, 각각 브라우저 기록 대조 포함). 결과물 `scripts/server-poc/out/`은 커밋하지 않는다.

## A. 리플레이 흐름과 게임 화면과의 차이

`createInitialState(8×8, 5색, seed)` → move마다 `resolveSwap`(무효면 상태·점수 그대로, `onResolve` 안 함) → 끝에 `resolveFinale` 한 번 → `TimeAttackMode.score()`.
반환: `{ score, validMoves, invalidMoves, finaleScore }`. 시각·간격·좌표는 리플레이 전에 `validateMoves`가 판정한다 (E절). 1차의 `lateMoves`(늦은 move를 세고 버림)는 없앴다. 늦은 move는 이제 거부한다.

게임(`GameScene.trySwap`·`playFinale`)과 같은 점·다른 점:

1. **시간 0 직전에 시작한 스왑**: 게임은 `canInput()`(남은 시간 > 0)일 때 시작한 스왑을 끝까지 재생하고 점수를 더한 뒤 마지막 팡으로 간다. 서버는 `0 ≤ t < 60000`인 move만 받고 끝까지 계산한다. `t ≥ 60000`인 move는 화면이 만들지 않으므로 하나라도 있으면 제출을 거부한다 (PLAN2 5.8)
2. **`t`의 뜻**: 리플레이는 `t`를 "게임 시간"(TimeAttackMode 타이머가 흐른 양)으로 본다. 게임 타이머는 일시정지 중에 멈추고(D 참고), Phaser가 200ms 넘는 프레임 delta를 잘라 내므로 벽시계보다 느리게 갈 수는 있어도 빠르게 가지는 않는다. 3주차 클라이언트는 `t = 제한 시간 − timeLeftMs()`를 `trySwap` 시작 때 **정수 ms로 내림해** 기록한다 (내림해도 60000 미만은 유지된다)
3. **재생 중 입력**: 게임은 재생(busy) 동안 입력을 막아 스왑이 겹치지 않는다. 리플레이는 순서만 본다. 간격은 `validateMoves`가 연속 200ms 이상(같은 `t`·역순 거부)으로 판정한다
4. **셔플**: 수가 없을 때의 셔플은 core `resolveSwap` 안에서 seed RNG로 일어나 리플레이에서도 똑같이 재현된다. 차이 없음 (실제 브라우저에서 셔플이 난 2판으로 확인, B.2)
5. **일시정지·힌트**: 상태를 바꾸지 않는다. 일시정지는 `t`(게임 시간)에 안 잡히고 벽시계에만 잡힌다
6. **무효 스왑**: 게임은 무효 스왑을 `moves`에 세지 않는다. 리플레이도 `validMoves`에서 빼고 `invalidMoves`로 따로 센다. 클라이언트는 무효 스왑도 기록한다 (PLAN2 5.8. 무효도 재생 약 240ms 동안 입력이 막혀 200ms 간격을 지킨다)
7. **보드 크기**: 게임은 `public/stages/timeattack.json`(8×8, 5색, 60초)을 읽는다. 리플레이는 같은 값을 상수 `TIMEATTACK_BOARD`로 두고 테스트가 JSON과 대조한다. 서버는 JSON 값을 core 버전과 함께 묶어야 한다 (C의 버전 항목)
8. **DEV 전용 옵션**: `?specials`(특수 블록 배치), `?time=N`은 시작 상태·제한 시간을 바꾸므로 경쟁 기록 제출에서 빠져야 한다 (DEV에서만 동작하므로 배포본은 문제없음)

## B. 점수 일치 확인

두 비교는 확인하는 것이 다르다.

| 비교 | 확인하는 것 | 확인하지 못하는 것 |
|---|---|---|
| B.1 1000개 랜덤 로그 Node ↔ Deno | **런타임 이식성**: 같은 `replayTimeAttack`·`verifySubmission`·`submissionHash`가 Node와 Deno(직접 import·번들)에서 같은 값을 낸다 | 기준 점수도 `replayTimeAttack`이 낸 값이라, 리플레이가 게임 화면과 같은지는 보지 못한다 |
| B.2 실제 브라우저 기록 → 리플레이 | **화면 경로 일치**: 실제 `GameScene`(입력 → `trySwap` → 재생 → 마지막 팡 → 결과 화면)의 점수와 리플레이 점수가 같고, 그 기록이 서버 판정을 통과한다 | 판 수가 적다 (6판). 다양한 경우는 B.1이 맡는다 |

### B.1 1000개 랜덤 로그 Node ↔ Deno (런타임 이식성)

- 로그 (`logs.ts` `realistic`): 다음 move까지 유효 스왑 뒤 433ms + 0~0.9초, 무효 스왑 뒤 240ms + 0~0.6초 (D절 재생 시간 하한). 힌트 스왑 70% + 무작위 인접 스왑 30%. 수 65~91개, 무효 스왑 19,204개, 마지막 팡이 점수를 낸 판 819개, 점수 2,220~21,245 (중앙 6,205. 늦은 move까지 리플레이한 값)
- 일부러 넣은 경우 (`node-scores.poc.ts`가 세어 출력하고, 0판이면 실패):
  - **늦은 move** (t ≥ 60000): 10번째 판마다 1~3개 → **100판, 200개**. 첫 늦은 move는 t = 60000 (직전 move의 간격 하한이 더 늦으면 그 시각). 이 100판은 판정에서 모두 `t-out-of-range`로 거부된다
  - **t = 59999 경계**: 10번째 판 + 5마다 시도 → **58판** (나머지 42판은 직전 move의 간격 하한 때문에 59999에 둘 수 없어 빠짐)
  - **셔플**: **2판** (보드 seed 4860·16824, `pick: 'rngValid'`). 셔플은 이 설정(8×8, 5색)에서 매우 드물다. 데모 봇(첫 힌트)으로는 seed 1~3000 × 40수에서 0회, 무작위 유효 수로는 2만 판(약 120만 수)에서 2회였고, 그 두 판을 그대로 넣었다
  - 최소 간격 실측: 유효 뒤 433ms, 무효 뒤 240ms (하한을 지킨다)
- 판정 입력: `clientScore` = 리플레이 점수, `version`·서버 시각은 정상 값 (`node-scores.json`의 `server`). 그래서 **통과 900판, 거부 100판(모두 늦은 move 판, `t-out-of-range`)** 이어야 하고 Node 테스트가 이를 확인한다
- 결과 (`npm run poc:deno`):

| 비교 | 리플레이·판정·해시 | 거부 | Deno 처리 시간 |
|---|---|---|---|
| Node v23.10.0 → Deno 2.9.8, `server.ts` 직접 import (`--sloppy-imports`) | **1000/1000 일치** | 100판 (Node와 같음) | 2,664ms (판당 2.66ms) |
| Node v23.10.0 → Deno 2.9.8, rolldown 번들 (`server.bundle.js` 37KB) | **1000/1000 일치** | 100판 (Node와 같음) | 2,548ms (판당 2.55ms) |

- 대조: 리플레이 `score, validMoves, invalidMoves, finaleScore` 전부 + `verifySubmission` 결과 전체(통과면 점수·리플레이, 거부면 사유·move 번호) + `submissionHash`(sha256, Web Crypto). 판당 시간에는 판정 안의 리플레이 1회와 해시가 더해졌다
- 판정·해시 불일치도 잡는지 확인: `node-scores.json`에서 seed 10(늦은 move 판)의 판정을 통과로, seed 21의 해시를 바꾸면 `998/1000 일치`, `seed 10: verdict node={"ok":true} deno={"ok":false,"reason":"t-out-of-range","index":78}`와 해시 차이를 출력하고 exit 1
- 불일치를 실제로 잡는지 확인 (1차 로그 기준): `node-scores.json`에서 seed 42의 점수를 +10, seed 100의 4번째 move 좌표를 바꾸면 `998/1000 일치`, 두 seed를 출력하고 exit 1 (seed 100은 move 하나로 점수 1410 → 435, 유효 30 → 10으로 뒤 수가 전부 어긋난다)

### B.2 실제 브라우저 기록 → 리플레이 (화면 경로 일치)

- 기록 방법: 사용자의 dev 서버(5173, main과 같은 코드), 390×844. `browser/record.js`를 init script로 넣고, 앱이 실제로 불러온 `GameScene.ts` 모듈(HMR 뒤에는 `?t=…`가 붙은 URL)을 다시 import해 같은 클래스의 `trySwap`·`finish`를 감쌌다. `trySwap` 첫 줄과 같은 조건(busy·끝남·시간 종료가 아님)일 때만 `{ from, to, t = 제한 시간 − timeLeftMs() }`를 남기고 (fixture의 t는 정수 ms로 내림. 기록기도 이제 내림한다), `finish`가 결과 화면으로 넘기는 `mode.result().score`를 화면 점수로 남겼다
- 입력: `browser/drive.js`가 칸 좌표를 화면 좌표로 바꿔 **실제 마우스 드래그**를 보낸다 (BoardInput → `trySwap` 경로 그대로). `demo`는 `?demo` 자동 플레이를 기록만 한다
- 결과 (Node `tests/poc`와 Deno `poc:deno` 직접 import·번들 모두 같은 값):

| 판 | 방식 | 수 (유효 / 무효) | 셔플 | 재생 중 타임 업 (마지막 수 t) | 마지막 팡 | 화면 점수 | 리플레이 |
|---|---|---|---|---|---|---|---|
| seed 397 | `?demo` | 45 (45 / 0) | - | 45번째 (59,204ms) | 2,210 | 8,410 | **8,410** |
| seed 1000 | `?demo` | 45 (45 / 0) | - | 45번째 (59,580ms) | 700 | 7,015 | **7,015** |
| seed 2 | 손 흉내 드래그 | 57 (45 / 12) | - | 57번째 (59,852ms) | 2,085 | 5,210 | **5,210** |
| seed 5 | 손 흉내 드래그 | 57 (49 / 8) | - | 57번째 (59,360ms) | 1,525 | 5,840 | **5,840** |
| seed 4860 | rngValid 드래그 | 58 (58 / 0) | 29번째 수 | 58번째 (59,842ms) | 465 | 9,325 | **9,325** |
| seed 16824 | rngValid 드래그 | 59 (59 / 0) | 26번째 수 | 59번째 (59,866ms) | 165 | 7,575 | **7,575** |

- **6/6 일치, 6/6 판정 통과** (화면 점수를 `clientScore`로 제출, Node `validate.test.ts`와 Deno 직접 import·번들 모두). 6판 모두 마지막 스왑이 재생 중에 시간이 끝났고(그 스왑 점수가 들어간 뒤 마지막 팡), 리플레이도 같은 점수를 냈다
- 손 흉내: 입력이 열리면 150~700ms 생각한 뒤 75% 힌트 수, 25% 아무 인접 칸(대부분 무효). 남은 시간이 짧으면 0.25초 전에 힌트 수를 둬 "재생 중 타임 업"을 만든다
- 데모 판의 `rejected`(6·8): 시간이 끝난 뒤 데모 루프가 부른 `trySwap`을 게임이 무시한 횟수. 기록에는 들어가지 않는다
- 재기록: `drive.js` 주석 참고 (Playwright MCP는 파일을 쓸 수 없어 `postUrl`로 로컬 수집 서버에 POST해 받았다). 손 흉내 판은 `Math.random`을 써서 다시 돌리면 다른 판이 나온다. 그래서 fixture로 고정했다

### 테스트

`tests/poc/replay.test.ts` (14개):

- JSON 보드 값 일치 / 같은 seed·로그 → 같은 로그·점수 / 무효 스왑(인접 무매치, 보드 밖)은 점수·상태 그대로이고 무효 수만 +1
- 스왑 scoreDelta 합 → `resolveFinale` 한 번 순서로 합산 (seed 1~20, 마지막 팡 점수가 있는 판 포함)
- 브라우저 기록 6판 각각 리플레이 점수 == 화면 점수 / 5판 이상·셔플 판(적힌 순번)·무효 스왑이 있는 손 흉내 판·재생 중 타임 업이 들어 있다
- `realistic` 간격 하한 / `boundary`(마지막 move 59999)·`late`(끝에 60000 이후 move) / `rngValid`가 4860·16824에서 적힌 순번에 셔플

`tests/poc/validate.test.ts` (23개): E절 표의 거부 사유마다 경계 양쪽, codex 재현 로그, 늦은 move·경계 로그, 브라우저 6판 통과

## C. Deno에서 `src/core`를 가져오는 방식

| | 1. 경로 직접 import | 2. 빌드 복사 (번들) | 3. `.ts` 확장자 명시 |
|---|---|---|---|
| 방법 | `../../src/core/...`를 그대로 import | rolldown으로 `replay.ts` → ESM 한 파일 (`-f esm -p neutral`) | 상대 import에 `.ts`를 붙인 복사본 (`/private/tmp`에서만 시험) |
| Deno 동작 | ○ (조건부, 아래) | ○ | ○ (`deno check`도 통과) |
| 점수 일치 | 1000/1000 | 1000/1000 (rolldown, `deno bundle` 둘 다) | 1000/1000 |
| 필요한 설정 | `--sloppy-imports`(또는 `--unstable-sloppy-imports`, deno.json `"unstable": ["sloppy-imports"]`) | 빌드 명령 1줄. Deno 설정 없음 | src 전체 import 수정 + tsconfig `allowImportingTsExtensions` |
| 결과물 | 원본 11개 파일 | 33KB 한 파일, 점수 관련 config(`BOARD`·`SCORE`·`TIMEATTACK`·`SPECIAL`)만 남음 | 원본과 같음 |
| Supabase 배포 걱정 | `supabase/functions/` 밖 파일 → 기본 배포 경로에서 보장 안 됨. `--use-api` 배포(실험 기능)가 "supabase/ 밖 파일 import"를 지원한다고 발표됨. 런타임이 sloppy import를 켜는지 문서에 없음 (확인 필요) | `_shared/` 안 일반 JS 한 파일이라 공식 권장 구조 그대로. 어떤 배포 방식이든 같음 | 확장자는 해결되지만 `supabase/functions/` 밖 문제는 1과 같다 |
| src 변경 | 없음 | 없음 | 큼 (모든 상대 import) |

관찰:

- **방식 1의 함정**: 저장소 안에서는 플래그 없이도 동작했다. 원인을 좁혀 보니 Deno는 `package.json` + `tsconfig.json`(`moduleResolution: "bundler"`)이 **둘 다** 있을 때 확장자 없는 import를 자동으로 풀었다 (package.json만, tsconfig만, 빈 node_modules만으로는 실패: `Module not found ... Maybe add a '.ts' extension or run with --sloppy-imports`). 배포 번들에 이 두 파일이 같이 들어가는지에 따라 동작이 달라질 수 있어 믿기 어렵다
- **`deno bundle`**(Deno 2.4+)도 `--sloppy-imports`로 30KB 한 파일을 만들고 1000/1000 일치했다. 다만 rolldown은 이미 의존성에 있고(vite 8은 esbuild 대신 rolldown을 쓴다. 지시서의 "vite의 esbuild"는 이 저장소에 없음) Node 쪽 CI에서 바로 돌릴 수 있다
- rolldown 번들은 같은 입력이면 같은 파일이다 (두 번 빌드한 sha256 같음)

**코어 `version` 맞추기**: 번들 파일의 sha256 앞 12자리를 쓴다 (PLAN2 5.8 확정).

- 번들에는 리플레이에 쓰이는 코드·config 값만 남는다 (트리 셰이킹). 그래서 애니메이션 시간·색 같은 화면 값을 바꿔도 버전이 안 바뀌고, 점수·규칙이 바뀌면 반드시 바뀐다. `src/core/**` + `src/config.ts` 원본 해시는 화면 값 변경에도 버전이 올라 불필요한 "새로고침 안내"가 생긴다
- 주석만 바꿔도 해시가 바뀐다 (번들이 JSDoc을 남김). 싫으면 `--minify`로 만든 번들을 해시한다
- 생성 스크립트 하나가 번들 + 해시를 같이 만들고, 클라이언트 빌드는 같은 해시를 상수로 넣는다 (예: vite `define`). `public/stages/timeattack.json`의 보드 값도 리플레이 입력이라 해시에 포함되게 번들 입력에 넣어야 한다

**결정: 2. 빌드 복사** (추천안 그대로 [PLAN2 5.8](../../docs/PLAN.md)에 확정). `npm run server:core`(가칭)가 rolldown으로 리플레이 진입점을 `supabase/functions/_shared/replay.js`로 번들하고 `version`(번들 sha256)을 함께 쓴다. CI(`pages.yml`)에서 다시 만들어 커밋본과 다르면 실패시켜 어긋남을 막는다.
이유: src를 고치지 않고, Deno의 암묵 규칙(sloppy import)이나 실험 기능(`--use-api`)에 기대지 않으며, Supabase 공식 권장 구조(`_shared/` 폴더)와 기본 배포 방식 그대로 동작한다. 리플레이 비용도 판당 1ms 미만이다.

근거 링크:

- Supabase Edge Functions 공유 코드는 `_`로 시작하는 폴더(`_shared`)에 둔다: https://supabase.com/docs/guides/functions/development-tips
- 함수마다 `deno.json`을 두는 것이 배포 권장 방식, `functions/` 전체 공용 `deno.json`은 배포에 비권장: https://supabase.com/docs/guides/functions/dependencies
- `--use-api`(실험 기능, CLI 2.13.3 beta, 2025-02-14)로 Docker 없이 배포하며 `supabase/` 밖 파일 import를 지원. `functions serve`는 여전히 Docker 필요: https://supabase.com/changelog/33613-deploy-edge-functions-from-cli-without-needing-docker-import-files-outside-of-supabase-directory
- 확인 필요: Supabase Edge Runtime의 Deno 버전과 sloppy import 지원 여부(문서에서 찾지 못함), `--use-api`가 지금은 기본값인지, 실제 배포 시험(3주차 프로젝트 생성 후)

## D. 시간 판정 기준용 실측 (브라우저)

방법: 사용자의 dev 서버(5173, main과 같은 코드)에 Playwright(MCP)로 390×844 페이지를 열고 `page.addInitScript({ path: 'scripts/server-poc/browser/probe.js' })`로 프로브를 넣은 뒤 `/?demo&seed=N`을 끝까지 돌렸다. 프로브는 `window.__ddooby`의 `busy()`·`timeLeft()`·`moves()`를 매 프레임 읽고, 앱이 쓰는 phaser 모듈을 같은 URL로 다시 import해 `ScenePlugin.start('Result')` 시각을 잡는다. 끝나면 `window.__probe.summary()`.

| seed | 스왑(유효) | 연속 스왑 시작 간격 최소 / 중앙 (ms) | 재생(입력 막힘) 최소 / 중앙 / 최대 (ms) | 시작→타임 업 | 타임 업→결과 | 시작→결과 | 점수 |
|---|---|---|---|---|---|---|---|
| 1 | 46 | 1041 / 1167 | 433 / 558 / 1725 | 59,985 | 2,160 | 62,145 | 3,910 |
| 2 | 45 | 1033 / 1167 | 433 / 559 / 1933 | 59,976 | 2,892 | 62,869 | 4,130 |
| 3 | 46 | 1033 / 1167 | 433 / 558 / 2775 | 59,968 | 2,993 | 62,960 | 3,740 |
| 397 | 45 | 1040 / 1166 | 439 / 558 / 2060 | 59,980 | 6,051 | 66,031 | 8,410 |
| 1000 | 45 | 1033 / 1158 | 433 / 557 / 2025 | 59,979 | 3,834 | 63,813 | 7,015 |

- **스왑 간격**: 데모는 재생이 끝난 뒤 600ms 쉬고 다음 수를 두므로 간격 ≈ 재생 + 600ms다. 사람이 낼 수 있는 하한은 **재생 시간**(입력이 막힘)이다: 유효 스왑 최소 433ms, 중앙 약 560ms. 무효 스왑은 데모에 없어 코드로 계산하면 `swap` + `swapBack` 각 `ANIM.swap`(120ms) ≈ 240ms + 프레임. 1차 SPEC 예시였던 "80ms 미만 연속"은 실제 하한보다 한참 낮아서 200ms로 확정했다 (아래 확정 기준)
- **타이머 vs 벽시계**: 시작→타임 업 59,968~59,985ms (시작 시각을 첫 프레임 감소분으로 추정해서 생기는 프레임 단위 오차). 일시정지·끊김이 없으면 게임 타이머 ≈ 벽시계
- **타임 업→결과**: 2.2~6.1초. "타임 업!" 배너 800ms + 마지막 팡 재생 + 쉼 1,000ms + (시간이 끝날 때 재생 중이던 스왑의 나머지). 남은 특수 블록이 많을수록 길다 (seed 397)
- **시작→결과**: 62.1~66.0초 (데모 기준. 표의 "시작"은 게임 타이머 시작이며 메뉴·로딩 시간은 빠짐)
- 표의 스왑 수는 `moves()` 기준. 프로브의 스왑 기록은 타임 업 때 재생 중이던 마지막 1수를 놓쳐 1 적다 (재생 끝과 마지막 팡 시작이 같은 프레임이라 busy가 false로 안 보임)
- **일시정지**: `?seed=1`에서 2초 뒤 화면 가림(`visibilitychange`)을 보내 일시정지 → 5초 대기: 벽시계 5,004ms 동안 `timeLeft` 변화 0ms. 코드로도 일시정지는 `scene.pause()`라 `update`(= `mode.tick`)가 멈추고, Phaser는 창 blur 때 루프를 멈췄다가 focus 때 delta를 리셋한다. 즉 **일시정지 시간만큼 벽시계가 게임 시간보다 길어지고 상한이 없다**
- 캡처: `.playwright-mcp/v2-w2-08-result-seed1000.png`(결과 화면), `.playwright-mcp/v2-w2-08-pause.png`(일시정지), 메인 저장소 경로 (gitignore)

### 시간 판정 기준 (확정)

위 실측을 근거로 2026-11-06 사용자가 확정했다. 기준 원문은 [docs/PLAN.md 5.8절](../../docs/PLAN.md) "서버 판정" 표와 SPEC 5.3·11절 5번이다. 구현과 검증은 E절.

- 서버 시각 하한 58초: 게임 타이머는 벽시계보다 빨리 갈 수 없으므로(위 "타이머 vs 벽시계") 정상 플레이는 60초 − 오차 2초 아래로 내려가지 않는다
- run 유효기간 30분: 일시정지는 게임 시간만 멈추고 상한이 없으므로 촘촘한 상한은 불가능하다. 30분 안의 일시정지는 허용하고 run 1회 사용으로 재사용을 막는다
- move 간격 200ms: 유효 스왑 뒤 실측 최소 433ms, 무효 스왑 재생 약 240ms보다 낮아 사람 입력을 거부하지 않는다

## E. 서버 판정 (확정 기준, `validate.ts`)

기준값은 `JUDGE` 한곳에 모았다 (`validate.test.ts`가 PLAN 표 값과 대조한다).

| 항목 | 확정 기준 ([PLAN2 5.8](../../docs/PLAN.md)) | 함수 | 거부 사유 | 테스트한 경계 |
|---|---|---|---|---|
| 버전 | `version` ≠ 서버 번들 버전 → 거부 | `verifySubmission` | `version-mismatch` | 다른 버전 |
| 서버 시각 하한 | 발급 → 도착 < 58초 → 거부 | `checkServerTiming` | `too-fast` | 57,999ms 거부 / 58,000ms 통과, 음수·NaN 거부 |
| run 유효기간 | 발급 후 30분 이상 → 만료 | `checkServerTiming` | `expired` | 30분 − 1ms 통과 / 30분 만료 |
| move 시각 | 유한한 정수, `0 ≤ t < 60000` | `validateMoves` | `t-not-integer`, `t-out-of-range` | -1 거부, 0·59999 통과, 60000 거부, NaN·Infinity·1.5·문자열·없음 거부 |
| move 간격 | 연속 차이 ≥ 200ms (같은 `t`·역순 포함) | `validateMoves` | `gap-too-short` | 199 거부 / 200 통과, 같은 t, 역순, 300개(최대) 통과 |
| move 좌표 | 보드 안 정수, 상하좌우 이웃 | `validateMoves` | `pos-invalid`, `not-adjacent` | 보드 밖·음수·0.5·문자열·없음 / 대각선·두 칸·같은 칸 |
| 점수 | 리플레이 점수 ≠ `clientScore` → 거부 | `verifySubmission` | `score-mismatch` | +1점, 문자열 점수 |
| 재제출 | 제출 내용 해시를 run에 저장. 같으면 이전 결과 반환, 다르면 거부 | `submissionHash` + `resubmitDecision` | `same` / `conflict` | 키 순서·다른 필드만 다르면 same, 점수·버전·move 하나 다르면 conflict |

- 서버 순서: `resubmitDecision`(저장된 해시) → `same`이면 저장된 결과 반환, `conflict`면 거부, `new`면 `verifySubmission`(버전 → 서버 시각 → `validateMoves` → `replayTimeAttack` → 점수 비교). 첫 거부 사유와 move 번호(`index`)를 돌려준다
- 해시: `moves`(from·to·t만)·`clientScore`·`version`을 키 순서를 고정한 JSON으로 만든 sha256 (Web Crypto `crypto.subtle`). Node·Deno 값이 1000판 모두 같다 (B.1)
- **codex 재현 사례**: seed 1 로그의 `t`를 모두 0으로 바꾸면 리플레이 점수는 원래와 같지만 `gap-too-short`(move 1)로, 모두 -1로 바꾸면 `t-out-of-range`(move 0)로 거부된다
- 늦은 move가 든 랜덤 로그 100판은 Node·Deno 모두 `t-out-of-range`로 거부, t=59999 경계 로그와 브라우저 기록 6판은 통과
- move 개수 상한(300개)은 따로 검사하지 않는다. `0 ≤ t < 60000`과 200ms 간격이면 300개를 넘을 수 없다 (테스트로 확인)
- 서버 번들 버전 예시: 이번 `server.bundle.js`의 sha256 앞 12자리 `99883cb0e43c` (3주차에 `_shared/replay.js`로 옮길 때 다시 만든다)
