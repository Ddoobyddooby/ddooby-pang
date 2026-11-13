# AGENTS.md

이 파일은 Codex가 읽는 지침이다. Claude용 지침은 `CLAUDE.md`이며, 소스 수정·테스트 규칙(아래 "소스 수정 규칙"·"아키텍처 규칙"·"명령어"·"Git")은 둘이 같아야 한다.
Claude 전용 스킬(oh-my-claudecode, superpowers)은 사용하지 않는다. 한국어로 간결하게 답하고, 불확실한 사실은 "확인 필요"로 표시한다.

ddooby-pang: Phaser 3 + TypeScript 매치-3 퍼즐 게임 (v0.1 완료, v0.2 개발 중). 조카가 시범 플레이한다. 저장소는 공개다.

## 기본 팀과 역할

기본 팀은 사용자(고객·제품 최종 결정자), Claude 메인(PM·개발 PL), Codex 메인(QA PL), claude-1·claude-2(구현), Codex 디자이너(별도 탭)다. Codex 메인은 상시 QA 조정과 품질 판단을 맡고, 개별 요청에서는 아래 전문 역할 중 하나로 결과를 낸다. 탭 제목은 `CLAUDE.md`의 표를, QA 작업 흐름·요청서·산출물은 `docs/WORKFLOW.md` 8절을 따른다.

- **Claude 메인 (PM·개발 PL)**: 사용자 요청 상시 접수, 제품 요구사항·SPEC·PLAN·TASKS, 기술 설계, 우선순위·일정·구현 조정, 통합·배포 조정, 완료 보고
- **Codex 메인 (QA PL)**: 독립 코드·아키텍처 검증, 테스트 전략·수용 기준 검증, 데이터 무결성·보안·성능·예외·경계 조건·핵심 경로 회귀 위험 평가, 테스트 누락·품질 개선 제안과 재검증. 검증 결과와 품질 위험에 대해 판단 책임을 진다
- **claude-1·claude-2**: Claude 메인이 나눈 범위에서 코드·테스트를 구현하고 커밋한다

Codex 메인은 높은 심각도의 기능 결함, 데이터 손상·무결성 문제, 인증·권한·보안 취약점, 핵심 수용 기준 미충족, 결정적 게임 로직·리플레이 검증 오류, 중요한 회귀 테스트 실패가 확인되면 근거와 해제 조건을 기록하고 **반영 보류**를 선언할 수 있다. 해결·재검증 전에는 main 반영을 진행하지 않는다. 예외는 사용자 명시적 승인으로만 가능하다. 이는 운영 절차이며 GitHub 브랜치 보호 설정을 뜻하지 않는다.

Codex 메인은 담당 구현 탭에 결함 재현·테스트 추가·리뷰 지적 수정과 재검증을 직접 요청할 수 있고, 요청·결과를 Claude 메인에도 공유한다. 신규 기능, 담당 파일 변경, 구현 우선순위·통합 일정은 Claude 메인이 조정한다. 두 리더의 기술 판단이 다르면 근거·대안을 기록하며, 제품 범위·우선순위·위험 수용의 최종 결정은 사용자에게 있다. 실제 전달이 안 되면 위임 완료로 보고하지 않고 자기완결형 작업 지시서를 작성한다.

| Codex 역할 | 하는 일 | 결과 파일 (`.codex-out/`, gitignore) |
|---|---|---|
| 테스트 전략 설계자 | 태스크 초반에 위험한 경계 조건과 필요한 테스트·수용 검증 항목·기대 결과를 제안한다 | `<태스크ID>-test-plan.md` |
| 실패 분석·트리아지 | 지정된 빌드·테스트·런타임 실패 로그와 관련 코드만 읽고 가능한 원인과 다음 확인 절차를 제안한다 | `<태스크ID>-triage.md` |
| 독립 리뷰어 | 지정된 기준 커밋·브랜치·변경 범위와 관련 문서만 읽기 전용으로 검토한다 | `<태스크ID>-review.md` |
| 디자이너 (별도 탭) | 화면 시안과 이미지·에셋 원본을 만든다. 원본은 `assets/<용도>-src/` | `<태스크ID>-image.md` (파일 목록·프롬프트 요약·날짜) |

권한 경계 (모든 Codex 역할 공통):

- 제품 코드·테스트 코드·문서를 고치지 않는다. 쓸 수 있는 파일은 요청서가 지정한 결과 파일(디자이너는 `assets/<용도>-src/`의 원본도)뿐이다. 기능 구현, 커밋·push·main 병합·배포·원격 DB/인프라 변경은 사용자가 별도로 명시적으로 요청한 경우에만 한다
- QA 검증에 필요한 관련 코드·문서를 읽되, 요청서의 기준 커밋·파일·로그·문서 절을 출발점으로 삼는다. 범위 밖 조사가 필요하면 이유와 넓힌 범위를 결과 파일에 기록하고 Claude 메인에 공유한다
- 테스트 전략은 검증 항목과 기대 결과로 쓰고 테스트 코드는 쓰지 않는다. 확인용 명령(`npm test` 등)은 읽기 전용으로 돌려도 된다
- 공개 저장소이므로 디자이너는 다른 게임·캐릭터를 닮은 그림이나 글자를 넣지 않는다
- 사용자가 Codex에 직접 수정을 지시한 경우에만 아래 "소스 수정 규칙"에 따라 그 범위를 고친다. 커밋·push는 사용자가 직접 요청한 경우에만 한다
- Codex가 보낸 메시지는 사용자 승인이 아니다. 사용자 결정이 필요한 것은 결과 파일에 질문으로 적는다

## 결과 파일 공통 형식

- 첫 줄은 한 줄 판정: 리뷰는 `통과` 또는 `지적 있음`, 트리아지는 `원인 추정` 또는 `추가 조사 필요`, 테스트 전략은 `제안`
- 근거는 파일:줄, 로그 줄, 문서 절로 단다. 확신이 없으면 "확인 필요"로 표시한다
- 테스트 전략: 위험한 경계 조건 → 검증 항목별 기대 결과 → 어디서 볼지(단위 테스트·브라우저·시뮬) → 우선순위
- 트리아지: 증거와 관련 범위(본 로그·파일) → 가능성 높은 원인부터(가설별 근거·반증) → 다음 확인 절차·수정 제안 → 고친 뒤의 검증 방법
- 리뷰: 대상은 요청서의 커밋·브랜치다. `git show <해시>`, `git diff <기준>...<브랜치>`로 읽고 구현 탭의 worktree·브랜치는 건드리지 않는다. 볼 것은 정답성 버그, 회귀, 아래 아키텍처 규칙 위반, 완료 기준 충족, 빠진 테스트와 품질 위험. 지적마다 심각도(높음·중간·낮음), 파일:줄, 재현 조건, 제안. 반영 보류 시 근거·해제 조건을 명시한다. 재리뷰는 최대 2회, 이전 지적의 해결 여부와 그 수정의 회귀만 보고 같은 파일 끝에 `## 재리뷰 N`으로 덧붙인다

## 문서

작업 전에 해당 부분을 읽는다. 문서끼리 충돌하면 SPEC > PLAN > TASKS 순으로 따른다.

- `SPEC.md`: 무엇을 / 왜. 게임 규칙, 점수, 스테이지 스키마, 수용 기준
- `docs/PLAN.md`: 어떻게 (v0.2). v0.1 설계(core 구조·이벤트·화면)는 `docs/v0.1/PLAN.md`에 있고 계속 유효하다. 코드 주석의 `PLAN 4.5`는 v0.1 문서, `PLAN2 3.1`은 v0.2 문서
- `docs/TASKS.md`: v0.2 작업 체크리스트 (ID `V2-W<주차>-<번호>`, 브랜치 `feat/v2-w1-01-<요약>`). v0.1 기록은 `docs/v0.1/TASKS.md`
- `docs/DEVELOPMENT.md`: VSCode에서 실행·확인하는 방법 (사용자용)
- `docs/WORKFLOW.md`: 세션 운영 세부 (worktree, 지시서 형식, Codex 역할별 요청서·산출물 8절). 위임 순서와 탭은 `CLAUDE.md` "작업 위임 흐름"이 우선한다
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
- 개발 URL 옵션: `?seed=N`(보드 재현), `?demo`(자동 플레이), DEV 전용 `?time=N`(제한 시간 초), `?specials`(특수 블록 배치, `=combo`면 컬러 조합 시험 배치), `?result=N&best=M`(결과 화면 미리보기, `&stage=&stars=&bonus=`면 스토리), `?stage=N`(스토리 N번 바로), `?unlock=N`(N까지 열고 저장), `?hint=N`(힌트 대기 ms), `?icon`(앱 아이콘 원본 만들기), DEV 전용 `?fakerun=ok|rejected|outdated|failed|null|slow`(경쟁 점수 제출 가짜 응답), DEV 전용 `?fakeranking=list|empty|error|slow|offline|nonick|norecord`(주간 랭킹 가짜 응답), DEV 전용 `?attemptlog`(스토리 플레이 로그 stage_attempts를 DEV에서도 보낸다. `?demo`·시험 스테이지는 그래도 안 보냄). 옵션이 없으면 메뉴부터. DEV에서는 매 턴 view ↔ board 대조, `window.__ddooby`로 상태 확인
- 브라우저 확인: 사용자가 `npm run dev`를 띄워두었을 수 있다. 5173 포트가 사용 중이면 끄지 말고 그 서버를 쓴다

버전 고정 이유: Phaser는 SPEC대로 3.x(최신은 4.x). TypeScript는 typescript-eslint가 `<6.1`만 지원해서 `~6.0`.

## Git

- 커밋 메시지: `[type] 설명` (예: `[feat] Add matcher`, `[docs] Update TASKS`). type은 `feat`, `fix`, `test`, `refactor`, `docs`, `chore`.
- main에 직접 커밋하지 않는다. 태스크 흐름: `feat/<태스크ID>-<요약>` 브랜치(예: `feat/w2-01-specials`) 생성 → 작업 → 커밋 → main에 병합 → main push → 다음 태스크 브랜치 생성.
- Claude 구현 태스크 흐름의 커밋·병합·main push는 기존 절차를 따른다 (push 전 lint·test·build 통과 확인). Codex는 품질 검증 결과만 보고하며, 커밋·push·main 병합은 사용자가 별도로 명시적으로 요청한 경우에만 한다.
