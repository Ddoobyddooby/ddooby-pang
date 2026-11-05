# V2-W2-08 core 공유·리플레이 PoC 결과

> 2026-11-06, claude-1. 환경: macOS, Node v23.10.0, Deno 2.9.8 (V8 15.0, TS 6.0.3), rolldown 1.2.15 (vite 8에 포함), Phaser 3.90.0.
> Supabase 프로젝트·CLI·Docker 없이 로컬에서만 확인했다. 실제 Edge Function 배포는 시험하지 않았다 (확인 필요 항목은 C 끝).

| 파일 | 역할 |
|---|---|
| `scripts/server-poc/replay.ts` | `replayTimeAttack(seed, moves)` 리플레이 시제품. `src/core`·`src/modes`만 import |
| `scripts/server-poc/logs.ts` | seed RNG(`core/rng.ts`)로 만드는 결정적 랜덤 로그 |
| `scripts/server-poc/node-scores.poc.ts` | Node(Vitest)에서 seed 1~1000 로그·점수를 `out/node-scores.json`에 쓴다 |
| `scripts/server-poc/deno/compare.ts` | Deno에서 같은 로그를 리플레이해 대조. 가져올 replay 모듈 경로를 인자로 받는다 |
| `scripts/server-poc/browser/probe.js` | D 실측 프로브 (dev 페이지에 넣는다) |
| `tests/poc/replay.test.ts` | `npm test`에서 도는 리플레이 테스트 5개 |

실행: `npm run poc:deno` (Node 기록 → rolldown 번들 → Deno 직접 import 비교 → Deno 번들 비교). 결과물 `scripts/server-poc/out/`은 커밋하지 않는다.

## A. 리플레이 흐름과 게임 화면과의 차이

`createInitialState(8×8, 5색, seed)` → move마다 `TimeAttackMode.tick(t - 이전 t)` → `canInput()`이면 `resolveSwap`(무효면 상태·점수 그대로, `onResolve` 안 함) → 끝에 `resolveFinale` 한 번 → `mode.score()`.
반환: `{ score, validMoves, invalidMoves, lateMoves, finaleScore }` (`lateMoves`는 지시서에 없던 값을 더했다. 아래 1번).

게임(`GameScene.trySwap`·`playFinale`)과 같은 점·다른 점:

1. **시간 0 직전에 시작한 스왑**: 게임은 `canInput()`(남은 시간 > 0)일 때 시작한 스왑을 끝까지 재생하고 점수를 더한 뒤 마지막 팡으로 간다. 리플레이도 `t < 60000`이면 받고 끝까지 계산한다. `t ≥ 60000`인 move는 게임이 받지 않으므로 리플레이는 `lateMoves`로 세고 버린다 (서버에서는 거부 사유로 쓸지 정해야 한다)
2. **`t`의 뜻**: 리플레이는 `t`를 "게임 시간"(TimeAttackMode 타이머가 흐른 양)으로 본다. 게임 타이머는 일시정지 중에 멈추고(D 참고), Phaser가 200ms 넘는 프레임 delta를 잘라 내므로 벽시계보다 느리게 갈 수는 있어도 빠르게 가지는 않는다. 3주차 클라이언트는 `t = 제한 시간 − timeLeftMs()`를 `trySwap` 시작 때 기록해야 리플레이와 맞는다
3. **재생 중 입력**: 게임은 재생(busy) 동안 입력을 막아 스왑이 겹치지 않는다. 리플레이는 순서만 보고 간격은 보지 않는다 (같은 `t` 두 개도 받는다). 간격 검사는 서버 규칙으로 따로 둬야 한다 (D의 최소 간격 참고)
4. **셔플**: 수가 없을 때의 셔플은 core `resolveSwap` 안에서 seed RNG로 일어나 리플레이에서도 똑같이 재현된다. 차이 없음
5. **일시정지·힌트**: 상태를 바꾸지 않는다. 일시정지는 `t`(게임 시간)에 안 잡히고 벽시계에만 잡힌다
6. **무효 스왑**: 게임은 무효 스왑을 `moves`에 세지 않는다. 리플레이도 `validMoves`에서 빼고 `invalidMoves`로 따로 센다. 로그에 무효 스왑을 남길지는 3주차에 정한다 (남기지 않아도 점수는 같다)
7. **보드 크기**: 게임은 `public/stages/timeattack.json`(8×8, 5색, 60초)을 읽는다. 리플레이는 같은 값을 상수 `TIMEATTACK_BOARD`로 두고 테스트가 JSON과 대조한다. 서버는 JSON 값을 core 버전과 함께 묶어야 한다 (C의 버전 항목)
8. **DEV 전용 옵션**: `?specials`(특수 블록 배치), `?time=N`은 시작 상태·제한 시간을 바꾸므로 경쟁 기록 제출에서 빠져야 한다 (DEV에서만 동작하므로 배포본은 문제없음)

## B. 1000개 로그 Node ↔ Deno 점수 비교

- 로그: seed 1~1000, 수 37~61개(평균 간격 약 1.3초, 80ms~2.5s), 힌트 스왑 70% + 무작위 인접 스왑 30%. 전체 무효 스왑 11,890개, 마지막 팡이 점수를 낸 판 756개, 점수 1,005~14,160 (중앙 3,720)
- 결과 (`npm run poc:deno`):

| 비교 | 결과 | Deno 리플레이 시간 |
|---|---|---|
| Node v23.10.0 → Deno 2.9.8, `src` 직접 import (`--sloppy-imports`) | **1000/1000 일치** | 858ms (판당 0.86ms) |
| Node v23.10.0 → Deno 2.9.8, rolldown 번들 | **1000/1000 일치** | 842ms (판당 0.84ms) |

- 대조 필드: `score, validMoves, invalidMoves, lateMoves, finaleScore` 전부
- 불일치를 실제로 잡는지 확인: `node-scores.json`에서 seed 42의 점수를 +10, seed 100의 4번째 move 좌표를 바꾸면 `998/1000 일치`, 두 seed를 출력하고 exit 1 (seed 100은 move 하나로 점수 1410 → 435, 유효 30 → 10으로 뒤 수가 전부 어긋난다)
- `tests/poc/replay.test.ts` (5개): JSON 보드 값 일치 / 같은 seed·로그 → 같은 로그·점수 / 무효 스왑(인접 무매치, 보드 밖)은 점수·상태 그대로이고 무효 수만 +1 / 스왑 scoreDelta 합 → `resolveFinale` 한 번 순서로 합산 (seed 1~20, 마지막 팡 점수가 있는 판 포함) / `t = 59999`는 받고 `t = 60000`은 `lateMoves`

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

**코어 `version` 맞추기**: 번들 파일의 sha256 앞 12자리를 쓰는 안을 추천한다.

- 번들에는 리플레이에 쓰이는 코드·config 값만 남는다 (트리 셰이킹). 그래서 애니메이션 시간·색 같은 화면 값을 바꿔도 버전이 안 바뀌고, 점수·규칙이 바뀌면 반드시 바뀐다. `src/core/**` + `src/config.ts` 원본 해시는 화면 값 변경에도 버전이 올라 불필요한 "새로고침 안내"가 생긴다
- 주석만 바꿔도 해시가 바뀐다 (번들이 JSDoc을 남김). 싫으면 `--minify`로 만든 번들을 해시한다
- 생성 스크립트 하나가 번들 + 해시를 같이 만들고, 클라이언트 빌드는 같은 해시를 상수로 넣는다 (예: vite `define`). `public/stages/timeattack.json`의 보드 값도 리플레이 입력이라 해시에 포함되게 번들 입력에 넣어야 한다

**추천: 2. 빌드 복사.** `npm run server:core`(가칭)가 rolldown으로 리플레이 진입점을 `supabase/functions/_shared/replay.js`로 번들하고 `version`(번들 sha256)을 함께 쓴다. CI(`pages.yml`)에서 다시 만들어 커밋본과 다르면 실패시켜 어긋남을 막는다.
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

- **스왑 간격**: 데모는 재생이 끝난 뒤 600ms 쉬고 다음 수를 두므로 간격 ≈ 재생 + 600ms다. 사람이 낼 수 있는 하한은 **재생 시간**(입력이 막힘)이다: 유효 스왑 최소 433ms, 중앙 약 560ms. 무효 스왑은 데모에 없어 코드로 계산하면 `swap` + `swapBack` 각 `ANIM.swap`(120ms) ≈ 240ms + 프레임. SPEC 5.3 예시의 "80ms 미만 연속"은 실제 하한보다 한참 낮다 (더 올려도 사람을 거부하지 않는다)
- **타이머 vs 벽시계**: 시작→타임 업 59,968~59,985ms (시작 시각을 첫 프레임 감소분으로 추정해서 생기는 프레임 단위 오차). 일시정지·끊김이 없으면 게임 타이머 ≈ 벽시계
- **타임 업→결과**: 2.2~6.1초. "타임 업!" 배너 800ms + 마지막 팡 재생 + 쉼 1,000ms + (시간이 끝날 때 재생 중이던 스왑의 나머지). 남은 특수 블록이 많을수록 길다 (seed 397)
- **시작→결과**: 62.1~66.0초 (데모 기준. 표의 "시작"은 게임 타이머 시작이며 메뉴·로딩 시간은 빠짐)
- 표의 스왑 수는 `moves()` 기준. 프로브의 스왑 기록은 타임 업 때 재생 중이던 마지막 1수를 놓쳐 1 적다 (재생 끝과 마지막 팡 시작이 같은 프레임이라 busy가 false로 안 보임)
- **일시정지**: `?seed=1`에서 2초 뒤 화면 가림(`visibilitychange`)을 보내 일시정지 → 5초 대기: 벽시계 5,004ms 동안 `timeLeft` 변화 0ms. 코드로도 일시정지는 `scene.pause()`라 `update`(= `mode.tick`)가 멈추고, Phaser는 창 blur 때 루프를 멈췄다가 focus 때 delta를 리셋한다. 즉 **일시정지 시간만큼 벽시계가 게임 시간보다 길어지고 상한이 없다**
- 캡처: `.playwright-mcp/v2-w2-08-result-seed1000.png`(결과 화면), `.playwright-mcp/v2-w2-08-pause.png`(일시정지), 메인 저장소 경로 (gitignore)

### 시간 판정에 쓸 수 있는 값 (제안, 결정은 PLAN에서)

- 서버 벽시계 `submit 시각 − start-run 시각`의 하한: 60초 − 허용 오차(네트워크 왕복·시작 전 로딩 편차, 예: 2초). 게임 타이머는 벽시계보다 빨리 갈 수 없으므로 정상 플레이는 이 아래로 내려가지 않는다
- 상한(run 유효기간): 60초 + 마지막 팡(실측 최대 6.1초) + 결과 화면·닉네임 입력 + **일시정지(상한 없음)**. 일시정지를 허용하는 한 촘촘한 상한은 불가능하므로 넉넉하게(예: 30분) 두고 run 1회 사용으로 재사용을 막는 쪽이 현실적이다
- move 간격: 직전 스왑이 유효였으면 그 재생 시간만큼은 다음 입력이 불가능하다. 서버가 `resolveSwap`의 steps로 재생 시간 하한을 계산할 수도 있지만 config 애니메이션 값이 리플레이 입력이 되므로(버전 해시에 포함 필요) 단순 하한(예: 200ms)부터 검토
