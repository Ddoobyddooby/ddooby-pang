# CLAUDE.md

ddooby-pang: Phaser 3 + TypeScript 매치-3 퍼즐 게임 (v0.1 MVP 개발 중). 응답과 문서는 한국어로 쓴다.

## 문서

작업 전에 해당 부분을 읽는다. 문서끼리 충돌하면 SPEC > PLAN > TASKS 순으로 따른다.

- `SPEC.md`: 무엇을 / 왜. 게임 규칙, 점수, 스테이지 스키마, 수용 기준
- `docs/PLAN.md`: 어떻게. 구조, core 타입·이벤트, 오픈 이슈 잠정 결정
- `docs/TASKS.md`: 작업 체크리스트 (ID `W<주차>-<번호>`)
- `docs/DEVELOPMENT.md`: VSCode에서 실행·확인하는 방법 (사용자용)

## 작업 방식

- `docs/TASKS.md`의 위에서부터 첫 번째 미완료 태스크를 진행한다. 한 번에 태스크 하나.
- 태스크의 **완료 기준**을 실제로 확인한 뒤에만 체크박스를 `[x]`로 바꾼다. 🧪 표시는 테스트 통과가 조건이다.
- 규칙이나 설계를 바꿔야 하면 코드보다 문서(SPEC / PLAN)를 먼저 고친다.
- 태스크를 마치면 `docs/DEVELOPMENT.md` 4절 "작업별 확인 방법"에 사용자가 직접 확인할 절차를, 6절 "Study for App"에 그 태스크에서 공부할 개념(쓰인 파일 포함)을 추가한다. 새 명령이 생기면 2절도 갱신한다.
- 태스크 하나 = 커밋 하나 (`[feat] W1-xx 설명`). 커밋 전에 `npm run lint && npm test && npm run build`가 통과해야 한다.
- `AGENTS.md`는 `CLAUDE.md`와 첫 줄 제목만 다른 사본이다. `CLAUDE.md`를 고치면 같이 맞춘다.

## 아키텍처 규칙 (어기지 않는다)

- `src/core/`는 순수 TS. `phaser`, DOM, `Math.random`, `src/view`, `src/scenes`를 import하거나 호출하지 않는다.
- core 함수는 `(state, action) → { state, events }` 형태이고 상태는 불변으로 다룬다.
- 랜덤은 `core/rng.ts`의 seed RNG만 쓴다. 같은 seed + 같은 입력 → 같은 결과.
- 점수, 배율, 애니메이션 시간은 `src/config.ts`에 두고 코드에 박지 않는다.
- view는 core가 준 이벤트를 재생만 한다. 게임 상태를 직접 계산하지 않는다.
- 의존 방향: `scenes → view/modes → core`, `scenes → data/storage`. core는 아무것도 의존하지 않는다.

## 명령어

- `npm run dev`: 개발 서버 (http://localhost:5173)
- `npm run typecheck`: `tsc --noEmit`
- `npm run build`: 타입체크 + 프로덕션 빌드 (`dist/`)
- `npm test`: Vitest 한 번 실행 (`tests/**/*.test.ts`) / `npm run test:watch`: 감시 모드
- `npm run lint`: ESLint (`src/core/**`의 phaser·view·scenes import, `Math.random`, DOM 사용을 에러로 막는다)
- `npm run format`: Prettier (`*.md`는 제외)

버전 고정 이유: Phaser는 SPEC대로 3.x(최신은 4.x). TypeScript는 typescript-eslint가 `<6.1`만 지원해서 `~6.0`.

## Git

- 커밋 메시지: `[type] 설명` (예: `[feat] Add matcher`, `[docs] Update TASKS`). type은 `feat`, `fix`, `test`, `refactor`, `docs`, `chore`.
- 커밋과 push는 사용자가 요청할 때만 한다.
