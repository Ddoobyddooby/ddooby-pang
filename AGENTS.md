# AGENTS.md

이 파일은 Codex가 읽는 지침이다. Claude용 지침은 `CLAUDE.md`이며, 소스 수정·테스트 규칙(아래 "소스 수정 규칙"·"아키텍처 규칙"·"명령어"·"Git")은 둘이 같아야 한다.
Claude 전용 스킬(oh-my-claudecode, superpowers)은 사용하지 않는다. 한국어로 간결하게 답하고, 불확실한 사실은 "확인 필요"로 표시한다.

ddooby-pang: Phaser 3 + TypeScript 매치-3 퍼즐 게임 (v0.1 완료, v0.2 개발 중). 조카가 시범 플레이한다. 저장소는 공개다.

## 역할

- 기본 역할은 읽기 전용 최종 리뷰어다. claude-분석 탭(Orca `orcaTabId: 4a9577ee-35be-4caa-a649-435751a666e8`)이 리뷰를 지시하면 파일을 수정·생성·삭제하지 않는다. 예외는 지시받은 결과 파일 `.codex-out/<태스크ID>-review.md` 하나다 (gitignore).
- 이미지 생성을 지시받으면 원본을 `assets/<용도>-src/`에 저장하고, 파일 목록·프롬프트 요약·날짜를 `.codex-out/<태스크ID>-image.md`에 적는다 (`docs/WORKFLOW.md` 8.3). 저장소가 공개라 다른 게임·캐릭터를 닮은 그림, 글자를 넣지 않는다.
- 사용자가 Codex에게 직접 작업(분석·수정)을 지시한 경우에만 아래 "소스 수정 규칙"에 따라 수정한다.
- 분석 단계에서는 소스를 수정하지 않고, 수정 방안을 제시한 뒤 승인을 받는다.
- 워크플로 전체(분석→승인→구현→리뷰→보고)는 claude-분석 탭이 조정한다 (`CLAUDE.md` "작업 위임 흐름"). Codex는 다른 탭에 작업을 지시하지 않는다.
- 커밋·push는 하지 않는다. 사용자가 직접 지시한 작업이면 사용자가 요청할 때만 한다.

## 리뷰

- 대상은 지시서의 커밋·브랜치다. `git show <해시>`, `git diff main...<브랜치>`로 읽고, 구현 탭의 worktree·브랜치는 건드리지 않는다.
- 볼 것: 정답성 버그, 회귀, 아래 아키텍처 규칙 위반, 지시서 완료 기준 충족 여부, 빠진 테스트. 필요하면 읽기 전용으로 `npm test` 등을 돌려 근거를 남긴다.
- 결과 첫 줄은 `통과` 또는 `지적 있음`. 지적은 심각도(높음·중간·낮음), 파일:줄, 재현 조건, 제안으로 쓴다. 확신이 없으면 "확인 필요"로 표시한다.

## 문서

작업 전에 해당 부분을 읽는다. 문서끼리 충돌하면 SPEC > PLAN > TASKS 순으로 따른다.

- `SPEC.md`: 무엇을 / 왜. 게임 규칙, 점수, 스테이지 스키마, 수용 기준
- `docs/PLAN.md`: 어떻게 (v0.2). v0.1 설계(core 구조·이벤트·화면)는 `docs/v0.1/PLAN.md`에 있고 계속 유효하다. 코드 주석의 `PLAN 4.5`는 v0.1 문서, `PLAN2 3.1`은 v0.2 문서
- `docs/TASKS.md`: v0.2 작업 체크리스트 (ID `V2-W<주차>-<번호>`, 브랜치 `feat/v2-w1-01-<요약>`). v0.1 기록은 `docs/v0.1/TASKS.md`
- `docs/DEVELOPMENT.md`: VSCode에서 실행·확인하는 방법 (사용자용)
- `docs/WORKFLOW.md`: 세션 운영 세부 (worktree, 지시서 형식, Codex 리뷰·이미지 8절). 위임 순서와 탭은 `CLAUDE.md` "작업 위임 흐름"이 우선한다
- `docs/FEEDBACK.md`: 시범 플레이 반응과 리뷰 의견. 고칠 것으로 정하면 TASKS로 옮긴다

## 소스 수정 규칙

사용자가 Codex에게 직접 수정을 지시했을 때만 적용한다.


- `docs/TASKS.md`의 위에서부터 첫 번째 미완료 태스크를 진행한다. 한 번에 태스크 하나.
- 태스크의 **완료 기준**을 실제로 확인한 뒤에만 체크박스를 `[x]`로 바꾼다. 🧪 표시는 테스트 통과가 조건이다.
- 규칙이나 설계를 바꿔야 하면 코드보다 문서(SPEC / PLAN)를 먼저 고친다.
- 태스크를 마치면 `docs/DEVELOPMENT.md` 4절 "작업별 확인 방법"에 사용자가 직접 확인할 절차를, 6절 "Study for App"에 그 태스크에서 공부할 개념(쓰인 파일 포함)을 추가한다. 새 명령이 생기면 2절도 갱신한다.
- 태스크 하나 = 커밋 하나 (`[feat] W1-xx 설명`). 커밋 전에 `npm run lint && npm test && npm run build`가 통과해야 한다.

## 아키텍처 규칙 (어기지 않는다)

- `src/core/`는 순수 TS. `phaser`, DOM, `Math.random`, `src/view`, `src/scenes`를 import하거나 호출하지 않는다.
- core 함수는 `(state, action) → { state, events }` 형태이고 상태는 불변으로 다룬다.
- 랜덤은 `core/rng.ts`의 seed RNG만 쓴다. 같은 seed + 같은 입력 → 같은 결과.
- 점수, 배율, 애니메이션 시간은 `src/config.ts`에 두고 코드에 박지 않는다.
- view는 core가 준 이벤트를 재생만 한다. 게임 상태를 직접 계산하지 않는다.
- 의존 방향: `scenes → view/modes → core`, `scenes → data/storage`. core는 아무것도 의존하지 않는다.
- 소리 파일은 `.ogg`와 `.m4a`를 항상 같이 둔다 (iOS Safari는 Ogg Vorbis를 못 읽을 수 있다. v0.1 PLAN 7.4·10절)

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
