# 작업 방식 (Claude 세션 운영)

> Claude 세션을 하나만 쓸지 여러 개로 나눠 쓸지에 대한 규칙. 어느 PC에서 clone해도 이 문서를 따른다.
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
3. `TASKS.md` 체크, `DEVELOPMENT.md` 4절(확인 방법)·6절(Study for App) 추가 → `[docs]` 커밋·push
4. 사용자에게 무엇이 바뀌었고 무엇을 직접 확인하면 되는지 알린다

## 7. 모델 고르기

- 게임 규칙이 들어가는 `src/core` 작업(특수 블록 연쇄, 점수, 미션 판정 등)은 Opus, 화면·연출·HUD는 Sonnet으로 충분하다
- 모델은 지시서로 바꿀 수 없다. 사용자가 그 탭에서 `/model`로 바꾸거나 `claude --model opus`로 새 탭을 연다. 메인은 맡기기 전에 사용자에게 알려준다
