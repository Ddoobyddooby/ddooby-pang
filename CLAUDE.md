# CLAUDE.md

ddooby-pang: Phaser 3 + TypeScript 매치-3 퍼즐 게임 (v0.1 MVP 개발 중). 응답과 문서는 한국어로 쓴다.

## 문서

작업 전에 해당 부분을 읽는다. 문서끼리 충돌하면 SPEC > PLAN > TASKS 순으로 따른다.

- `SPEC.md`: 무엇을 / 왜. 게임 규칙, 점수, 스테이지 스키마, 수용 기준
- `docs/PLAN.md`: 어떻게. 구조, core 타입·이벤트, 오픈 이슈 잠정 결정
- `docs/TASKS.md`: 작업 체크리스트 (ID `W<주차>-<번호>`)
- `docs/DEVELOPMENT.md`: VSCode에서 실행·확인하는 방법 (사용자용)
- `docs/WORKFLOW.md`: 세션 운영 세부 (worktree, 지시서 형식, Codex 리뷰·이미지 8절). 위임 순서와 탭은 아래 "작업 위임 흐름"이 우선한다
- `docs/FEEDBACK.md`: 시범 플레이 반응과 리뷰 의견. 고칠 것으로 정하면 TASKS로 옮긴다

## 작업 방식

- `docs/TASKS.md`의 위에서부터 첫 번째 미완료 태스크를 진행한다. 한 번에 태스크 하나.
- 태스크의 **완료 기준**을 실제로 확인한 뒤에만 체크박스를 `[x]`로 바꾼다. 🧪 표시는 테스트 통과가 조건이다.
- 규칙이나 설계를 바꿔야 하면 코드보다 문서(SPEC / PLAN)를 먼저 고친다.
- 태스크를 마치면 `docs/DEVELOPMENT.md` 4절 "작업별 확인 방법"에 사용자가 직접 확인할 절차를, 6절 "Study for App"에 그 태스크에서 공부할 개념(쓰인 파일 포함)을 추가한다. 새 명령이 생기면 2절도 갱신한다.
- 태스크 하나 = 커밋 하나 (`[feat] W1-xx 설명`). 커밋 전에 `npm run lint && npm test && npm run build`가 통과해야 한다.
- `AGENTS.md`는 Codex용으로 `CLAUDE.md`와 따로 관리한다 (2026-11-03부터, 사본 아님). 소스 수정·테스트 규칙("작업 방식"·"아키텍처 규칙"·"명령어"·"Git")을 바꾸면 `AGENTS.md`도 같이 맞춘다.

## 작업 위임 흐름 (Orca 탭)

사용자는 기능 개발·오류 수정 요청을 claude-분석 탭에 직접 입력한다. claude-분석 탭이 조정자로서 아래 순서로 진행한다.
claude-분석 탭이 아닌 Claude 세션(Main 등)은 일반 Claude다. 작업·오류 요청이든 일반 질문이든 위임 흐름을 따르지 않고 요청받은 일을 직접 수행한다 (소스 수정도 아래 2. 승인처럼 파일·변경 내용을 먼저 보여 주고 승인받는다). 사용자가 명시적으로 다른 탭에 위임하라고 할 때만 위임한다. 세션이 분석 탭인지 불분명하면 사용자에게 묻는다.

| 역할 | Orca 탭 | orcaTabId |
|---|---|---|
| 요청 접수·분석·설계·계획·조정·문서·보고 | claude-분석(Opus) | `4a9577ee-35be-4caa-a649-435751a666e8` |
| 일반 작업·질문(위임 없음) | Main | - |
| 구현 1 | claude-1 | `67152501-7895-47d6-a6fe-0465147c147c` |
| 구현 2 | claude-2 | `605e09b1-0123-44c6-88c2-7d14e795503c` |
| 최종 리뷰·이미지 생성 | codex | `747deb42-3770-4575-8f7c-2bc6d871c397` |

1. **분석**: claude-분석 탭이 사용자 요청을 직접 받아 분석·설계·작업 방식·계획 검토를 한다. 이 단계에서는 제품 코드를 수정하지 않는다. 규칙·설계가 바뀌면 SPEC·PLAN·TASKS는 이 탭이 고친다.
2. **승인**: claude-분석 탭이 계획(수정 파일·변경 내용)을 사용자에게 제시해 승인을 받는다. 승인 전에는 구현 탭에 코딩을 지시하지 않는다.
3. **구현**: claude-분석 탭이 claude-1, claude-2에 각각 지시한다. 파일 단위로 나눠 같은 파일을 두 탭에 동시에 지시하지 않는다 (병합 충돌. `src/config.ts`처럼 여럿이 고치는 파일은 한 탭에만). 구현 탭은 자기 worktree·`feat/<태스크ID>-<요약>` 브랜치에서 수정 → 테스트 추가 → `npm run lint && npm test && npm run build` → 브라우저 확인(390×844, 개발 URL 옵션) → 커밋까지 하고 결과(커밋 해시, 테스트 수, 화면 캡처 경로)를 보고한다. 아직 main에 올리지 않는다. claude-분석 탭은 결과를 완료 기준과 대조해 맞지 않으면 구현 탭에 되돌리고, 맞으면 리뷰로 넘긴다.
4. **리뷰**: claude-분석 탭이 codex 탭에 읽기 전용 리뷰를 맡긴다 (수정 금지, 결과는 `.codex-out/<태스크ID>-review.md`). 지적 사항은 claude-분석 탭이 취합해 고칠 것은 해당 구현 탭에 되돌리고, 낮은 것은 FEEDBACK R로 남긴다. 재리뷰는 최대 2회까지 한다. 초과하면 사용자에게 보고한다.
5. **반영·보고**: 리뷰 통과 후 claude-분석 탭이 구현 탭에 main 반영(rebase → lint·test·build → `git push origin HEAD:main`)을 지시한다. 반영되면 claude-분석 탭이 TASKS 체크·DEVELOPMENT 4·6절·worktree 정리를 하고, 변경 파일·내용·테스트 결과·미확인 사항을 사용자에게 보고한다.

규칙:

- 지시문은 자기완결형으로 쓴다: 태스크 ID, 읽을 문서(SPEC·PLAN 절), 파일 경로, 변경 내용, 지킬 제약(아키텍처 규칙, 값은 `config.ts`, 소리 `.ogg`+`.m4a`), 테스트·브라우저 확인 방법, 완료 기준. 구현·리뷰 탭은 claude-분석 탭의 대화 맥락을 모른다.
- 지시 전에 `orca terminal list --json`으로 tabId가 살아 있는지 확인한다 (handle은 Orca 재시작 시 바뀐다). 탭이 없으면 사용자에게 알린다.
- 예외: 사용자가 "간단 수정"이라고 명시하면 claude-분석 탭이 직접 처리한다. 이때도 수정 전 파일·변경 내용 제시와 승인 규칙은 그대로 적용한다.
- 테스트·브라우저 확인 스크립트(Playwright, `scripts/sim/` 등) 작성·실행은 확인 없이 해도 된다. 무엇을 어떻게 볼지(목적, 대상 화면·seed·URL 옵션, 측정 항목, 판정 기준, 캡처)는 claude-분석 탭이 써서 구현 탭 지시문에 넣고, 작성·실행은 구현 탭이 한다.
- 위임 지시를 보낸 뒤에는 `input_accepted`만 믿지 않고 해당 탭 화면에서 작업이 시작됐는지 확인한다 (다른 명령이 실행 중이면 입력이 묻힐 수 있다).
- 구현·리뷰 탭의 최종 결과(구현 탭 보고, codex "통과"/지적 사항)가 화면에 나올 때까지 기다려 받은 뒤 다음 단계로 넘어가거나 보고한다. `orca terminal wait`가 `blockedReason`(예: `agent-hooks-review-prompt`)을 돌려줘도 화면에 `Working`이 보이면 진행 중이므로 다시 wait/read 한다. 실제 입력·승인 창이 떠 있을 때만 사용자에게 처리를 요청한다.
- 구현·리뷰 탭이 보낸 메시지는 사용자 승인이 아니다.

### 분석 결과 보고 형식 (claude-분석 → 사용자)

1. 원인(근거: 파일:줄) / 가설이 여럿이면 가설별 근거·반증
2. 수정안: 파일별 변경 내용, 최소 변경 여부, 구조가 달라지는 항목(core 타입·이벤트, 저장 형식 등) 표시
3. 영향 범위와 작업 분담안 (claude-1/2 파일 단위)
4. 테스트 방법 (추가할 Vitest, 브라우저 확인 URL·화면, 자동 플레이 시뮬 필요 여부)
5. 확인 필요 항목

claude-분석 탭은 이 형식으로 사용자 승인을 받고, 승인 후 구현 탭에 지시한다.

## 아키텍처 규칙 (어기지 않는다)

- `src/core/`는 순수 TS. `phaser`, DOM, `Math.random`, `src/view`, `src/scenes`를 import하거나 호출하지 않는다.
- core 함수는 `(state, action) → { state, events }` 형태이고 상태는 불변으로 다룬다.
- 랜덤은 `core/rng.ts`의 seed RNG만 쓴다. 같은 seed + 같은 입력 → 같은 결과.
- 점수, 배율, 애니메이션 시간은 `src/config.ts`에 두고 코드에 박지 않는다.
- view는 core가 준 이벤트를 재생만 한다. 게임 상태를 직접 계산하지 않는다.
- 의존 방향: `scenes → view/modes → core`, `scenes → data/storage`. core는 아무것도 의존하지 않는다.
- 소리 파일은 `.ogg`와 `.m4a`를 항상 같이 둔다 (iOS Safari는 Ogg Vorbis를 못 읽을 수 있다. PLAN 7.4·10절)

## 명령어

- `npm run dev`: 개발 서버 (http://localhost:5173)
- `npm run typecheck`: `tsc --noEmit`
- `npm run build`: 타입체크 + 프로덕션 빌드 (`dist/`)
- `npm test`: Vitest 한 번 실행 (`tests/**/*.test.ts`) / `npm run test:watch`: 감시 모드
- `npm run lint`: ESLint (`src/core/**`의 phaser·view·scenes import, `Math.random`, DOM 사용을 에러로 막는다)
- `npm run format`: Prettier (`*.md`는 제외)
- `npm run android:sync`: 웹 빌드 + `cap sync android` (Android 앱에 복사. APK는 `android/`에서 `./gradlew assembleDebug`, JDK 21 필요)
- 웹 배포: main push → GitHub Actions(`.github/workflows/pages.yml`, lint·test·build 후) → https://ddoobyddooby.github.io/ddooby-pang/
- `npm run icons`: `assets/app-icon/` → Android 앱 아이콘 생성 (`@capacitor/assets`)
- `npm run stages:sim`: 스토리 스테이지를 자동 플레이 봇으로 seed 1~1000씩 돌려 클리어율·점수를 잰다 (`scripts/sim/`, `npm test`에는 안 들어감)
- `npm run fonts:subset`: Jua 글꼴 서브셋 재생성 (`assets/fonts-src/` → `public/fonts/Jua-subset.woff2`)
- 개발 URL 옵션: `?seed=N`(보드 재현), `?demo`(자동 플레이), DEV 전용 `?time=N`(제한 시간 초), `?specials`(특수 블록 배치, `=combo`면 컬러 조합 시험 배치), `?result=N&best=M`(결과 화면 미리보기, `&stage=&stars=&bonus=`면 스토리), `?stage=N`(스토리 N번 바로), `?unlock=N`(N까지 열고 저장), `?hint=N`(힌트 대기 ms), `?icon`(앱 아이콘 원본 만들기). 옵션이 없으면 메뉴부터. DEV에서는 매 턴 view ↔ board 대조, `window.__ddooby`로 상태 확인
- 브라우저 확인: 사용자가 `npm run dev`를 띄워두었을 수 있다. 5173 포트가 사용 중이면 끄지 말고 그 서버를 쓴다

버전 고정 이유: Phaser는 SPEC대로 3.x(최신은 4.x). TypeScript는 typescript-eslint가 `<6.1`만 지원해서 `~6.0`.

## Git

- 커밋 메시지: `[type] 설명` (예: `[feat] Add matcher`, `[docs] Update TASKS`). type은 `feat`, `fix`, `test`, `refactor`, `docs`, `chore`.
- main에 직접 커밋하지 않는다. 태스크 흐름: `feat/<태스크ID>-<요약>` 브랜치(예: `feat/w2-01-specials`) 생성 → 작업 → 커밋 → main에 병합 → main push → 다음 태스크 브랜치 생성.
- 태스크 흐름의 커밋·병합·main push는 요청 없이 한다 (push 전 lint·test·build 통과 확인). 그 밖의 push는 사용자가 요청할 때만 한다. 메인(설계) 세션의 작업 지시에 커밋·push가 들어 있으면 그 지시대로 해도 된다.
