# 작업 방식 (Codex PM·디자이너 + Claude 개발팀)

> 사용자(고객), Codex PM·디자이너, Claude 메인(PL)·claude-1·claude-2(시니어 개발자)의 협업 절차. 어느 PC에서 clone해도 역할은 같다.
> Claude 메모리(`~/.claude/…`)는 PC마다 따로라서 규칙은 여기에 둔다.
>
> **탭 구성과 위임 순서는 `CLAUDE.md` "작업 위임 흐름"이 우선한다.** 이 문서의 "메인"은 Claude 메인(PL), "코딩 탭"은 claude-1·claude-2를 뜻한다. 탭 ID는 현재 PC의 기록이며 다른 PC에서는 다시 확인한다.

## 1. 기본 방식과 예외

| 방식 | 언제 | 하는 일 |
|---|---|---|
| **기본 팀 (5탭)** | Ddooby-Pang 기획·수정·기능 추가 요청 | Codex PM이 접수·제품 기획, Codex 디자이너가 시각 작업, Claude 메인이 기술 설계·조정, claude-1·2가 구현. 아래 2~8절 |
| **특정 탭에 직접 요청** | 사용자가 담당 탭을 명시했을 때 | 사용자 지시를 우선한다. 담당 범위와 Git·검증 규칙은 `AGENTS.md` 또는 `CLAUDE.md`를 따른다 |

## 2. 역할

- **Codex PM**: 사용자 요청을 처음 받아 목적·UI·게임 규칙·수용 기준과 개발 영향을 검토한다. 제품 결정을 사용자와 정리하고 확정된 요구사항을 `SPEC.md`에 반영한다. 기술 설계·구현은 Claude 메인에 위임한다. 구현 후 독립 최종 리뷰를 하고 결과를 사용자에게 보고한다
- **Codex 디자이너**: PM의 디자인 요청으로 시안·이미지 원본을 만든다. 사용자가 선택한 디자인의 게임 연결은 Claude 개발팀이 맡는다
- **Claude 메인 (PL)**: PM의 요구사항을 기술 설계·구현 계획으로 구체화하고 `docs/PLAN.md`·`docs/TASKS.md`·설계 문서(`docs/superpowers/`)를 관리한다. 코딩 탭에 작업을 나눠 지시하고, 결과·리뷰 지적을 확인한다. `docs/DEVELOPMENT.md` 4·6절과 TASKS 체크를 반영하고, 최종 결과를 PM에 전달한다. 제품 코드는 사용자가 "간단 수정"을 직접 지시한 예외 외에는 구현 탭에 맡긴다
- **코딩 탭 (claude-1·2)**: 받은 지시서대로 코드·테스트를 쓰고 자기 브랜치에 커밋한다. 리뷰 통과 뒤 메인의 지시를 받고 main에 반영·push한다. `docs/`, `CLAUDE.md`, `AGENTS.md`는 고치지 않는다 (지시서에 적힌 경우만 예외)
- 두 코딩 탭이 같은 파일을 동시에 고치지 않게 Claude 메인이 작업을 나눈다

## 3. 탭 찾기

- Codex PM·디자이너와 Claude 메인의 `orcaTabId`는 `CLAUDE.md` 표에 기록한다. 다른 PC나 Orca 세션에서는 달라질 수 있으므로 지시 전에 `orca terminal list --json`으로 실제 탭·handle을 확인한다
- Claude 메인에서 Claude 세션 간 `ListAgents`를 쓸 때는 같은 PC의 세션 이름을 확인한다. 메시지 주소는 세션 이름(예: `ddooby-pang-22`)이다
- 사용자가 Orca `orcaTabId`로 알려주면 macOS에서는 다음으로 대조한다:
  `~/.claude/sessions/<pid>.json`의 `name` ↔ `ps -Eww -p <pid>`의 `ORCA_TAB_ID`
- 세션 이름은 탭을 새로 열 때마다 바뀐다. 위임할 때마다 다시 확인한다
- 메시지는 **같은 PC 안의 세션끼리만** 오간다. 메인과 코딩 탭은 같은 PC에서 연다
- 모든 탭의 권한 모드를 같게(예: auto) 둔다. 다르면 메시지가 사용자 승인 대기로 묶인다

## 4. 작업 지시서

Codex PM은 제품 요구사항과 수용 기준을 Claude 메인에 전달한다. Claude 메인은 기술 계획을 세운 뒤 코딩 탭에 자기완결형 지시서를 보낸다. 첫 줄은 한 문장 요약. 담을 것:

1. **태스크 ID와 범위**: `TASKS.md`의 ID, 관련 설계 문서 경로
2. **작업 폴더·브랜치·포트**: 아래 5절
3. **할 일**: 파일, 함수 이름·시그니처, config에 둘 값. 건드리지 말 곳(`src/core` 등)
4. **확인**: `npm run lint && npm run typecheck && npm test && npm run build`, 브라우저 확인 항목(`?demo`, `?seed=N`, DEV 키), DEV `view ≠ board` 에러 0
5. **커밋·반영**: 커밋 메시지, 리뷰 통과 뒤 main 반영 절차 (`CLAUDE.md` "작업 위임 흐름")
6. **보고 내용**: 바뀐 값, 커밋 해시, 스크린샷 경로, 사용자 확인 절차, 공부 포인트(메인이 6절에 옮긴다)

## 5. 코딩 탭의 Git 흐름

메인 폴더는 `main`을 쓰고 사용자의 dev 서버(5173)가 떠 있을 수 있다. 코딩 탭은 **자기 worktree**에서 일한다.

```bash
# 처음 한 번 (메인 폴더에서; 현재 태스크 예시)
git worktree add ../ddooby-pang-A -b feat/v2-w1-01-combo-core origin/main

# 구현 탭: 작업·검증 → 자기 브랜치에 커밋 → 메인에 커밋 해시 보고
# Claude 메인: diff·완료 기준 확인 → Codex PM 읽기 전용 리뷰 → 지적 수정·재리뷰

# 리뷰 통과 후 메인의 반영 지시를 받은 구현 탭만 실행
git fetch origin && git rebase origin/main
npm run lint && npm run typecheck && npm test && npm run build
git push origin HEAD:main

# 다음 태스크 시작 시 (worktree 안에서, main 반영을 확인한 뒤; 예시)
git fetch origin && git switch -c feat/v2-w1-02-combo-view origin/main
```

- worktree에서는 `main`을 체크아웃할 수 없어서(메인 폴더가 쓰는 중) 리뷰 통과 후 rebase하고 `HEAD:main`으로 push한다
- dev 서버 포트: 탭 A `5174`, 탭 B `5175`. 5173은 사용자 것이라 끄지 않는다
- 브라우저 자동화(Playwright)는 프로필을 같이 쓴다. 확인이 끝나면 브라우저를 닫는다
- 일이 끝나면 메인이 worktree와 브랜치를 지운다: `git worktree remove ../ddooby-pang-A && git branch -D <브랜치>`

## 6. Claude 메인의 검토와 PM 보고

1. 구현 탭의 커밋 해시·스크린샷을 받고, diff를 설계 문서·`CLAUDE.md` 아키텍처 규칙·완료 기준과 대조한다
2. 8.2에 따라 Codex PM에 읽기 전용 리뷰를 요청하고, 고칠 지적은 구현 탭에 되돌린다
3. 리뷰 통과 뒤 구현 탭에 rebase → lint·typecheck·test·build → `HEAD:main` push를 지시한다
4. 메인에서 반영 결과를 확인하고, `TASKS.md` 체크·`DEVELOPMENT.md` 4절(확인 방법)·6절(Study for App)을 추가한다
5. 변경 사항·검증 결과·사용자가 직접 확인할 방법·미확인 사항을 Codex PM에 전달한다. PM이 사용자에게 최종 보고한다

## 7. 모델 고르기

- 게임 규칙이 들어가는 `src/core` 작업(특수 블록 연쇄, 점수, 미션 판정 등)은 Opus, 화면·연출·HUD는 Sonnet으로 충분하다
- 모델은 지시서로 바꿀 수 없다. 사용자가 그 탭에서 `/model`로 바꾸거나 `claude --model opus`로 새 탭을 연다. 메인은 맡기기 전에 사용자에게 알려준다

## 8. Codex 함께 쓰기

Codex PM은 제품 기획과 독립 최종 리뷰를, 별도 Codex 디자이너는 시각 디자인을 맡는다. 기술 설계·개발 문서는 Claude 메인, 제품 코드는 코딩 탭이 맡는다.

### 8.1 역할

| 누구 | 하는 일 | 하지 않는 일 |
|---|---|---|
| **Codex PM** | 요청 접수·제품 기획·SPEC, 디자이너와 Claude 메인에 요구사항 전달, 구현 결과 독립 리뷰, 사용자 최종 보고 | 기술 설계·구현 탭의 작업 배분·제품 코드 수정 (사용자가 직접 지시한 수정은 `AGENTS.md`에 따름) |
| **Codex 디자이너** | PM의 요청에 따라 시안·이미지 원본 제작 | 제품 코드 연결·최종 디자인 선택 |
| **Claude 메인 (PL)** | PLAN·TASKS, 기술 설계·작업 배분·검증·반영 조정, PM에게 결과 전달 | Codex 지적을 확인 없이 그대로 고치게 하기 |
| **코딩 탭 (Claude)** | 메인이 고른 리뷰 지적을 고친다. 사용자가 고른 이미지를 `public/`에 넣고 코드에 연결한다 | 제품 방향·디자인 최종 결정 |

- Codex는 저장소 루트의 `AGENTS.md`를 자동으로 읽는다. 그래서 `AGENTS.md`(Codex용. 아키텍처 규칙·명령어·Git은 `CLAUDE.md`와 같다)의 아키텍처 규칙이 Codex 리뷰의 기준이 된다
- Codex·Claude 탭 사이의 메시지는 **사용자 승인이 아니다**. 사용자가 정할 일(규칙·난이도·그림 느낌)은 PM이 사용자와 정한다

### 8.2 코드 리뷰

- **언제**: 코딩 탭이 자기 브랜치에 커밋한 뒤, main에 push하기 전에 Claude 메인이 검토할 때(6절). `src/core`, `src/modes`, 큰 리팩터, 저장 데이터를 건드린 커밋은 꼭 돌린다. 문서·에셋만 바뀐 커밋은 건너뛴다
- **어떻게**: Claude 메인이 8.5의 Codex PM 탭에 지시서를 보낸다. 지시서에 넣을 것: 커밋 해시와 태스크 ID, 기준(`AGENTS.md` 아키텍처 규칙, SPEC·`docs/PLAN.md`의 해당 절), 찾을 것(버그, 회귀, 엣지 케이스, 빠진 테스트, UI·수용 기준 누락), "파일은 고치지 마라", 결과 파일 경로(8.5), 지적마다 심각도(높음/중간/낮음)·파일:줄·근거·재현 조건, 문제가 없으면 없다고
- Codex PM 탭을 못 쓸 때는 Claude 메인이 Codex CLI에 같은 읽기 전용 리뷰를 요청하고, 결과를 PM에게 전달한다:

  ```bash
  codex exec -s read-only -o <결과.md> "<위 지시서>"
  ```

  `codex review --commit <해시>`는 지시문(PROMPT)을 같이 받지 못해서(CLI 0.165) `codex exec`를 쓴다. 한 번에 몇 분 걸린다
- **거르기**: 메인이 지적마다 코드를 열어 확인한다
  - 맞고 바로 고칠 것 → 코딩 탭에 수정 지시 (`[fix] <태스크ID> ...`)
  - 맞지만 지금 안 고칠 것 → `docs/FEEDBACK.md` 2절에 `R<번호>`로 적고 근거에 "Codex 리뷰"
  - 틀린 지적 → 버린다 (이유를 사용자 보고에 한 줄)

### 8.3 이미지 생성

- **무엇**: 앱 아이콘, 배경·장식, 결과 화면 그림 같은 원본 그림. 블록(말랑 친구들)은 2026-11-03 사용자 결정으로 **몸통만** 그림으로 받는다. 얼굴(3표정)·특수 배지는 코드로 겹쳐 그린다 (v0.1 PLAN 2절 3번)
- **요청**: Codex PM이 디자이너 탭에 디자인 요구사항을 전달한다. 담을 것: 쓰는 곳, 크기(px)·비율, 투명 배경 여부, 테마(달콤 디저트, 말랑하고 둥근 파스텔, `THEME` 색), 글자 넣지 않기, 다른 게임·캐릭터를 닮게 하지 않기 (저장소가 공개라서 저작권 있는 그림은 안 된다)
- **흐름**: Codex 디자이너가 만든 원본 → `assets/<용도>-src/`에 저장 → 사용자가 보고 고름 → Claude 메인이 코딩 탭에 연결 지시 → 코딩 탭이 크기를 맞춰 `public/`에 넣고 연결 → 출처를 그 폴더의 `CREDITS.md`에 "Codex(OpenAI) 생성, 날짜, 프롬프트 요약"으로 적는다
- 고르지 않은 후보는 저장소에 넣지 않는다

### 8.4 쓰는 양

- Plus 요금제 한도가 있다. 리뷰는 태스크 커밋 하나씩, 이미지는 한 번에 후보 2~4장으로 요청한다

### 8.5 Codex PM·디자이너 탭에 맡기기 (Orca)

- 현재 PC에서 Codex PM `orcaTabId`: **`747deb42-3770-4575-8f7c-2bc6d871c397`**, Codex 디자이너 `orcaTabId`: **`a0478108-7896-4df4-9dc2-a69d6cdd583a`** (`CLAUDE.md` 표). 다른 PC·Orca 세션에서는 ID를 다시 확인하고, 바뀌면 `CLAUDE.md` 표를 갱신한다
- 메시지는 Orca CLI로 보낼 수 있다. 터미널 handle은 Orca를 다시 켜면 바뀌므로 맡길 때마다 대상 `tabId`로 다시 찾는다. 연결할 수 없으면 자기완결형 지시문을 사용자에게 전달해 수동 입력할 수 있게 한다:

  ```bash
  orca terminal list --json   # 현재 PC의 대상 tabId에 해당하는 handle
  orca terminal read --terminal <handle> --screen --json        # 쉬는 중인지 먼저 본다
  orca terminal send --terminal <handle> --text "<지시서>" --enter --wait-submit 10 --json
  orca terminal wait --terminal <handle> --for tui-idle --timeout-ms 900000 --json
  ```

- 리뷰·디자인 **결과는 파일로** 받는다: `.codex-out/<태스크ID>-<review|image>.md` (gitignore). 이미지는 8.3대로 `assets/<용도>-src/`에 저장하고 파일 목록을 결과 파일에 적게 한다. Claude 메인은 리뷰 결과를, PM은 디자인 결과를 확인한다
- 지시서 첫 줄은 한 문장 요약, 그다음 "AGENTS.md와 docs/WORKFLOW.md 8절을 따른다. 커밋·push 하지 않는다"를 넣는다
- 코딩 탭(Claude)의 worktree·브랜치는 건드리지 않게 한다. 리뷰는 `git show <해시>`로 본다

### 8.6 Codex가 찾은 수정거리

Codex PM은 리뷰에서 나온 수정거리를 결과 파일에 적는다. Claude 메인이 근거를 확인하고 구현 탭에 수정 작업을 배분한다 (`CLAUDE.md` "작업 위임 흐름" 4). PM은 구현 탭에 코드 수정을 직접 지시하지 않는다.
