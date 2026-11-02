# 작업 방식 (Claude 세션 운영 + Codex)

> Claude 세션을 하나만 쓸지 여러 개로 나눠 쓸지, Codex에 무엇을 맡길지에 대한 규칙. 어느 PC에서 clone해도 이 문서를 따른다.
> Claude 메모리(`~/.claude/…`)는 PC마다 따로라서 규칙은 여기에 둔다.

## 1. 두 가지 방식

| 방식 | 언제 | 하는 일 |
|---|---|---|
| **혼자 (세션 1개)** | 탭을 하나만 열었을 때 | `CLAUDE.md`의 작업 방식·Git 흐름을 그대로 따른다. 코드, 문서, 커밋을 한 세션이 모두 한다 |
| **나눠서 (메인 + 코딩 탭)** | 사용자가 "코딩은 다른 탭에 맡겨"라고 하거나 탭을 알려줬을 때 | 아래 2~6절 |

## 2. 역할 (나눠서 할 때)

- **메인 세션**: 사용자와 설계·컨셉·방향을 정한다. SPEC / PLAN / TASKS / 설계 문서(`docs/superpowers/`)를 쓴다. 코딩 탭에 작업 지시서를 보내고, 결과를 검토하고, `docs/DEVELOPMENT.md` 4·6절과 `TASKS.md` 체크를 반영한다. **제품 코드는 직접 고치지 않는다**
- **코딩 탭**: 받은 지시서대로 코드·테스트를 쓰고 커밋·push한다. `docs/`, `CLAUDE.md`, `AGENTS.md`는 고치지 않는다 (지시서에 적힌 경우만 예외)
- 두 코딩 탭이 같은 파일을 동시에 고치지 않게 메인이 작업을 나눈다

## 3. 코딩 탭 찾기

- 메인 세션에서 `ListAgents`로 같은 PC의 Claude 세션 이름을 본다. 메시지 주소는 세션 이름(예: `ddooby-pang-22`)이다
- 사용자가 Orca `orcaTabId`로 알려주면 macOS에서는 다음으로 대조한다:
  `~/.claude/sessions/<pid>.json`의 `name` ↔ `ps -Eww -p <pid>`의 `ORCA_TAB_ID`
- 세션 이름은 탭을 새로 열 때마다 바뀐다. 위임할 때마다 다시 확인한다
- 메시지는 **같은 PC 안의 세션끼리만** 오간다. 메인과 코딩 탭은 같은 PC에서 연다
- 모든 탭의 권한 모드를 같게(예: auto) 둔다. 다르면 메시지가 사용자 승인 대기로 묶인다

## 4. 작업 지시서

메인이 `SendMessage`로 보낸다. 첫 줄은 한 문장 요약. 담을 것:

1. **태스크 ID와 범위**: `TASKS.md`의 ID, 관련 설계 문서 경로
2. **작업 폴더·브랜치·포트**: 아래 5절
3. **할 일**: 파일, 함수 이름·시그니처, config에 둘 값. 건드리지 말 곳(`src/core` 등)
4. **확인**: `npm run lint && npm run typecheck && npm test && npm run build`, 브라우저 확인 항목(`?demo`, `?seed=N`, DEV 키), DEV `view ≠ board` 에러 0
5. **커밋·push**: 커밋 메시지, push 여부 (지시서에 있으면 해도 된다, `CLAUDE.md` Git 절)
6. **보고 내용**: 바뀐 값, 커밋 해시, 스크린샷 경로, 사용자 확인 절차, 공부 포인트(메인이 6절에 옮긴다)

## 5. 코딩 탭의 Git 흐름

메인 폴더는 `main`을 쓰고 사용자의 dev 서버(5173)가 떠 있을 수 있다. 코딩 탭은 **자기 worktree**에서 일한다.

```bash
# 처음 한 번 (메인 폴더에서)
git worktree add ../ddooby-pang-A -b feat/w2-08-scoring origin/main

# 태스크마다 (worktree 안에서)
git fetch origin && git switch -C feat/<태스크ID>-<요약> origin/main
# … 작업 → 커밋
git fetch origin && git rebase origin/main
npm run lint && npm run typecheck && npm test && npm run build
git push origin HEAD:main
```

- worktree에서는 `main`을 체크아웃할 수 없어서(메인 폴더가 쓰는 중) `CLAUDE.md`의 "main에 병합 → push" 대신 rebase 후 `HEAD:main`으로 push한다. 결과는 같다
- dev 서버 포트: 탭 A `5174`, 탭 B `5175`. 5173은 사용자 것이라 끄지 않는다
- 브라우저 자동화(Playwright)는 프로필을 같이 쓴다. 확인이 끝나면 브라우저를 닫는다
- 일이 끝나면 메인이 worktree와 브랜치를 지운다: `git worktree remove ../ddooby-pang-A && git branch -D <브랜치>`

## 6. 메인의 검토

1. `git pull` → `npm run lint && npm run typecheck && npm test && npm run build`
2. 보고의 스크린샷을 보고, 설계 문서·`CLAUDE.md` 아키텍처 규칙과 맞는지 diff를 확인한다
3. 8.2의 Codex 리뷰를 돌릴 태스크면 돌리고 결과를 거른다
4. `TASKS.md` 체크, `DEVELOPMENT.md` 4절(확인 방법)·6절(Study for App) 추가 → `[docs]` 커밋·push
5. 사용자에게 무엇이 바뀌었고 무엇을 직접 확인하면 되는지 알린다

## 7. 모델 고르기

- 게임 규칙이 들어가는 `src/core` 작업(특수 블록 연쇄, 점수, 미션 판정 등)은 Opus, 화면·연출·HUD는 Sonnet으로 충분하다
- 모델은 지시서로 바꿀 수 없다. 사용자가 그 탭에서 `/model`로 바꾸거나 `claude --model opus`로 새 탭을 연다. 메인은 맡기기 전에 사용자에게 알려준다

## 8. Codex 함께 쓰기

2026-11-02 사용자 결정 (Codex Plus 구독). **코드 리뷰와 이미지 생성은 Codex에 맡긴다.** 설계·문서는 메인(Claude), 코드는 코딩 탭(Claude)이 그대로 한다.

### 8.1 역할

| 누구 | 하는 일 | 하지 않는 일 |
|---|---|---|
| **Codex** | 커밋 리뷰 (읽기 전용), 게임에 쓸 이미지 원본 생성 | 코드·문서 수정, 커밋, push |
| **메인 (Claude)** | Codex에 리뷰·이미지 요청을 만들고, 결과를 검증해서 고를 것을 정한다 | Codex 지적을 확인 없이 그대로 고치게 하기 |
| **코딩 탭 (Claude)** | 메인이 고른 리뷰 지적을 고친다. 사용자가 고른 이미지를 `public/`에 넣고 코드에 연결한다 | |

- Codex는 저장소 루트의 `AGENTS.md`를 자동으로 읽는다. 그래서 `AGENTS.md`(= `CLAUDE.md` 사본)의 아키텍처 규칙이 Codex 리뷰의 기준이 된다
- Codex의 지적이나 결과물은 **사용자 승인이 아니다**. 사용자가 정할 일(규칙·난이도·그림 느낌)은 메인이 사용자에게 묻는다

### 8.2 코드 리뷰

- **언제**: 코딩 탭이 push한 태스크 커밋을 메인이 검토할 때(6절). `src/core`, `src/modes`, 큰 리팩터, 저장 데이터를 건드린 커밋은 꼭 돌린다. 문서·에셋만 바뀐 커밋은 건너뛴다
- **어떻게**: 메인이 메인 폴더에서 돌린다. 쓰기를 막는다

  ```bash
  codex exec -s read-only -o <결과.md> \
    "커밋 <해시>(<태스크ID> <요약>)를 코드 리뷰해 줘. git show <해시>로 변경을 보고 필요한 주변 코드를 읽어라. \
  기준: AGENTS.md 아키텍처 규칙, SPEC <절>, docs/PLAN.md <절>. 찾을 것: 버그, 회귀, 엣지 케이스, 빠진 테스트. \
  파일은 고치지 마라. 한국어로, 지적마다 심각도(높음/중간/낮음)·파일:줄·근거·재현 조건. 문제가 없으면 없다고."
  ```

  `codex review --commit <해시>`는 지시문(PROMPT)을 같이 받지 못해서(CLI 0.165) 기준을 줄 수 있는 `codex exec`를 쓴다. 한 번에 몇 분 걸린다

  사용자가 Codex 앱이나 터미널에서 직접 돌려 결과를 붙여 줘도 된다
- **거르기**: 메인이 지적마다 코드를 열어 확인한다
  - 맞고 바로 고칠 것 → 코딩 탭에 수정 지시 (`[fix] <태스크ID> ...`)
  - 맞지만 지금 안 고칠 것 → `docs/FEEDBACK.md` 2절에 `R<번호>`로 적고 근거에 "Codex 리뷰"
  - 틀린 지적 → 버린다 (이유를 사용자 보고에 한 줄)

### 8.3 이미지 생성

- **무엇**: 앱 아이콘, 배경·장식, 결과 화면 그림 같은 원본 그림. 블록(말랑 친구들)은 지금처럼 코드로 그린다 (PLAN 2절 3번)
- **요청**: 메인이 프롬프트를 쓴다. 담을 것: 쓰는 곳, 크기(px)·비율, 투명 배경 여부, 테마(달콤 디저트, 말랑하고 둥근 파스텔, `THEME` 색), 글자 넣지 않기, 다른 게임·캐릭터를 닮게 하지 않기 (저장소가 공개라서 저작권 있는 그림은 안 된다)
- **흐름**: Codex가 만든 원본 → `assets/<용도>-src/`에 저장 → 사용자가 보고 고름 → 코딩 탭이 크기를 맞춰 `public/`에 넣고 연결 → 출처를 그 폴더의 `CREDITS.md`에 "Codex(OpenAI) 생성, 날짜, 프롬프트 요약"으로 적는다
- 고르지 않은 후보는 저장소에 넣지 않는다

### 8.4 쓰는 양

- Plus 요금제 한도가 있다. 리뷰는 태스크 커밋 하나씩, 이미지는 한 번에 후보 2~4장으로 요청한다

