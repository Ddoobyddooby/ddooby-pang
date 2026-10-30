# ddooby-pang TASKS (v0.1 MVP)

> 기준 문서: [`SPEC.md`](../SPEC.md), [`PLAN.md`](./PLAN.md)
> 체크박스로 진행 상황을 관리한다. ID는 `주차-번호`. **완료 기준**을 만족해야 체크한다.
> 범례: 🧪 테스트 필수 · 👀 수동 확인 · ⛓ 선행 작업

---

## 1주차 — 코어 엔진

### 세팅
- [x] **W1-01** Vite + TypeScript(strict) 프로젝트 생성, Phaser 3 설치
  - 완료: `npm run dev`로 빈 Phaser 캔버스(720x1280, FIT) 표시
- [x] **W1-02** Vitest 설정, `npm test` 스크립트
  - 완료: 샘플 테스트 1개 통과
- [x] **W1-03** ESLint + Prettier, `src/core/**`에서 `phaser`·`view`·`scenes` import 금지 규칙
  - 완료: core에서 phaser import 시 lint 에러
- [x] **W1-04** 폴더 구조 생성 (`core/ modes/ scenes/ view/ data/ storage/`), `config.ts` 뼈대

### core
- [x] **W1-05** 🧪 `core/types.ts` — Color, Block, Pos, Board, GameState, GameEvent, MatchGroup
- [x] **W1-06** 🧪 `core/rng.ts` — mulberry32 순수 함수 `next(state) → [value, state]`
  - 완료: 같은 seed → 같은 수열
- [x] **W1-07** 🧪 테스트 헬퍼 `parseBoard()` / `printBoard()` (문자열 ↔ Board)
- [x] **W1-08** 🧪 `core/board.ts` — 초기 생성(매치 회피), get/set/clone, 인접 판정 ⛓W1-06
- [x] **W1-09** 🧪 `core/matcher.ts` — 가로·세로 run 수집 + Union-Find 그룹 병합, `maxRunH/V`, `hasIntersection`
  - 테스트: 3I, 4I(H/V), 5I, L, T, +, 6+, 칸을 공유하지 않는 같은 색 두 그룹
- [x] **W1-10** 🧪 `core/gravity.ts` — 낙하(`fall` 이벤트), 리필(`refill` 이벤트)
  - 테스트: 한 열 여러 빈칸, 빈칸 사이에 블록, 리필 후 빈칸 0
- [x] **W1-11** 🧪 `core/moves.ts` — `hasAnyMove`, `findHint`, `shuffle`
  - 테스트: 수 없는 보드 → 셔플 후 매치 0 + 수 ≥ 1
- [x] **W1-12** 🧪 `core/engine.ts` — `resolveSwap` (특수 블록 없이): 스왑 → 매치 → 제거 → 낙하 → 리필 → 연쇄 → 셔플 ⛓W1-08~11
  - 테스트: 매치 없는 스왑은 `valid:false` + `swapBack`, 연쇄 단계 수, cascade 상한 assert
- [x] **W1-13** 🧪 seed 1~1000 초기 보드 테스트: 매치 0, 가능한 수 ≥ 1, 같은 seed 재생성 결과 동일
- [x] **W1-14** 🧪 퍼즈 테스트: 랜덤 seed + 랜덤 유효 스왑 1000회 → 예외·빈칸 없음, resolve 후 매치 0

### view (최소)
- [x] **W1-15** `view/BlockSprite.ts` — 색별 단색 도형
- [x] **W1-16** `view/BoardView.ts` — `Map<id, sprite>`, `play(steps)` (swap / swapBack / remove / fall / refill 트윈)
- [x] **W1-17** `view/input.ts` — 스와이프 입력 → `{a, b}`
- [x] **W1-18** 👀 `GameScene` 임시 버전: 보드 표시 + 입력 + resolve + 재생, 애니메이션 중 입력 차단

**1주차 완료 기준**: 브라우저에서 3매치·연쇄가 돈다 + `npm test` 전부 통과

---

## 디자인 — 테마 + 연쇄 이펙트

> 설계: [`docs/superpowers/specs/2026-10-29-theme-and-fx-design.md`](./superpowers/specs/2026-10-29-theme-and-fx-design.md). 경쟁 / 스토리 모드가 공통으로 쓰는 화면 바탕.
> 결정: 달콤 디저트 테마 · 솜사탕 하늘 배경 · 웨이퍼 보드판 · 말랑 친구들 블록(얼굴 3표정) · 코드로 그리기 · Jua 글꼴

### 시안 / 기반
- [x] **D-01** 디자인 시안 결정 (테마, 배경, 보드판, 블록, 연쇄 연출, 칭찬 문구) + 설계 문서
- [x] **D-02** 🧪 `config.THEME` / `config.FX` + `view/fx/fxLevels.ts` (연쇄 단계 → 연출 세기, 칭찬 문구 표)
  - 테스트: 1~10단계 조각 수 증가·상한, 문구 선택(1단계 없음, 5+는 5단계), 흔들림·웃음 시작 단계
- [x] **D-03** Jua 글꼴 포함(`public/fonts`, OFL) + BootScene에서 로딩 대기
  - 후속: 상용 한글 2,350자 + 영문·기호 WOFF2 서브셋 2.1MB → 343KB (`npm run fonts:subset`, b296eb0)

### 화면
- [x] **D-04** 👀 배경: 솜사탕 하늘 그라데이션, 흘러가는 구름, 반짝이는 별 + 웨이퍼 보드판
  - 후속: 캔버스 밖 여백(letterbox)도 같은 하늘 그라데이션 (`index.html`, c44f22f) → 하늘은 페이지 CSS 하나로, 캔버스는 투명 (554047f)
- [x] **D-05** 👀 블록 텍스처 생성(6색 × 3표정 + 특수 표시 + 파티클), `BlockSprite`를 이미지 기반으로 교체
  - 완료: 개발 모드 `view ≠ board` 에러 0, `npm test` 통과
- [x] **D-06** 👀 말랑 움직임: 착지 눌림, 스왑 때 살짝 커짐, 터지기 전 `><`
- [x] **D-10** 👀 HUD 새 스타일 (Jua 타이틀, 정보 표시줄)

### 이펙트
- [x] **D-07** `FxDirector` + `BoardView` 알림(hooks) 연결 — 연출이 재생 완료·입력 잠금을 늦추지 않는다
- [x] **D-08** 👀 조각 파티클: 하트·별, 단계별 양, 상한
- [x] **D-09** 👀 칭찬 문구(2단계~) + 화면 흔들림(3단계~) + 남은 블록 `^^`(3단계~)
- [x] **D-11** 👀 개발용 이펙트 미리보기: 키보드 2~5로 그 단계 연출 재생
- [x] **D-12** 👀 다듬기: 블록 크게(`VIEW.blockScale` 0.95), 하트·별 조각 1.5배, 칭찬 문구 스타일을 `FX.praiseStyle`로

**디자인 완료 기준**: `?demo`에서 연쇄 단계별 연출 확인 + 휴대폰 브라우저에서 끊김 없음 + `npm test` 전부 통과 → ✅ 완료 (2026-10-30, 휴대폰 확인)

---

## 2주차 — 특수 블록 + 경쟁 모드

### 특수 블록
- [x] **W2-01** 🧪 `core/specials.ts` — `decideSpecial(group)` (PLAN 4.5 테이블). 생성 위치(`swapPos`)는 W2-02
  - 테스트: 테이블 기반, 4I-H → lineV, 4I-V → lineH, 5L/5T → bomb, 5I → color, 6+ → super
- [x] **W2-02** 🧪 생성 위치 규칙: 첫 cascade는 스왑 위치, 이후 cascade는 그룹 중앙 (`specialPosition`, 중앙 정의는 PLAN 4.5)
- [x] **W2-03** 🧪 `blastArea(kind, at, board, targetColor?)` — line / bomb 3x3 / super 5x5+십자 / color
  - 테스트: 보드 모서리·가장자리에서 범위 잘림
- [x] **W2-04** 🧪 연쇄 발동 BFS (`chainActivate`) — 범위 안 특수 블록 재발동, 중복 발동 없음
- [x] **W2-05** 🧪 engine 통합 — `activate`, `create` 이벤트, 특수 블록이 낙하·셔플에서 유지
  - 새 특수 블록이 같은 턴 발동 범위에 걸릴 때: `SPECIAL.newSpecialInBlast` (`'keep'` 기본 / `'explode'`, PLAN 4.5)
  - 3색 보드는 연쇄가 정상적으로도 길어 `BOARD.maxCascade`를 50 → 200 (PLAN 4.3)
- [x] **W2-06** 🧪 컬러 블록 스왑 발동 (매치 없이), 상대가 특수 블록 / 컬러 블록인 경우
- [x] **W2-07** 👀 특수 블록 표시 (아이콘/줄무늬) + 발동 이펙트 기본형
  - 표시: 오른쪽 위 배지 (↔ ↕ 폭탄 ★). 발동: 빛줄기 / 퍼지는 원 / 섬광 + 반짝임 (`FX.special`)
  - 개발 모드 확인 도구: `?specials`(특수 블록 5종 배치), 키 Q W E R T(발동 연출 미리보기)

### 점수
- [x] **W2-08** 🧪 `core/scoring.ts` + `config.SCORE` — 그룹 점수, 특수 제거 점수, cascade 배율
  - 연쇄 단계마다 `score` 이벤트(점수 팝업 위치 포함), 턴 합계 `scoreDelta`. 확인용 `window.__ddooby.score()`
  - 테스트: SPEC 5절 표의 각 행

### 경쟁 모드
- [x] **W2-09** 🧪 `modes/GameMode.ts` 인터페이스
- [x] **W2-10** 🧪 `modes/TimeAttackMode.ts` — 60초 타이머, 시간 종료 시 진행 중 연쇄는 끝까지 처리
- [x] **W2-10a** 👀 화면 배치 정하기 (시안 2~3안 → 선택 → 설계 문서). W2-11과 함께 진행
  - 결정: A안 "아래 정보 패널" + `Scale.EXPAND` (`docs/superpowers/specs/2026-10-30-screen-layout-design.md`)
  - 세 구역: 위(타이틀), 가운데(보드), 아래(정보 패널: 점수·시간, 나중에 미션·일시정지 버튼 자리)
  - 지금 보드 아래 약 1/3이 비어 있음 (2026-10-30 휴대폰 캡처). 화면이 길면 남는 공간은 아래 장식(디저트 언덕·구름)으로 채운다
  - 안전 영역(노치·홈 바) 고려, Capacitor 앱에서도 같은 규칙
  - HUD 가운뎃점 `·`이 Jua에 없어 기본 글꼴로 보임 → 이때 구분 기호를 바꾼다
- [x] **W2-11** 👀 HUD: 점수, 남은 시간을 W2-10a에서 정한 아래 패널에 (마지막 10초 강조)
  - 같이 할 것: 화면 배치(`screenLayout`, EXPAND, 안전 영역, 바닥 장식), GameScene에 `TimeAttackMode` 연결
- [x] **W2-12** 👀 임시 결과 화면 (점수, 다시하기)
  - `ResultScene`: 점수, 최고 점수(새 기록이면 이번 점수), "최고 기록!" 배지. 개발용 미리보기 `?result=N&best=M`
- [x] **W2-13** 👀 탭-탭 입력 (선택 하이라이트, 인접 아니면 선택 변경)

**2주차 완료 기준**: 4I / 5L / 5I / 6+ 특수 블록이 생성·발동되고, 60초 타임어택 한 판을 끝까지 플레이할 수 있다 → ✅ 완료 (2026-10-30, 휴대폰 확인)

---

## 3주차 — 스토리 모드

### 데이터
- [x] **W3-01** 🧪 `data/stageSchema.ts` — 타입 + 런타임 검증 (필수 필드, colors 4~6, stars 오름차순, 색 이름)
  - 최소 색 수는 4로 결정 (2026-10-30, 3색은 연쇄가 수십 번 이어짐. PLAN 4.3 측정값)
- [ ] **W3-02** `data/stageLoader.ts` — `public/stages/story.json`, `timeattack.json` 로드, 실패 시 에러 표시
- [ ] **W3-03** 스테이지 1~10 JSON 작성 (점수 미션 → 색 수집 → 복합 순, colors 4→6, moves 25→15)
- [ ] **W3-04** 경쟁 모드 설정을 `timeattack.json`으로 이동 (`timeLimit: 60`)

### 모드 / 저장
- [ ] **W3-05** 🧪 `modes/StoryMode.ts` — 유효 스왑만 이동 차감, 미션 2종 집계(특수 제거 포함), 클리어/실패 판정
- [ ] **W3-06** 🧪 남은 이동 보너스 + 별 계산
- [x] **W3-07** 🧪 `storage/progress.ts` — `Storage` 인터페이스 + `LocalStorageAdapter`, `SaveData v1`
  - 테스트: 저장 → 로드 왕복, 손상된 JSON이면 기본값

### 화면
- [ ] **W3-08** 👀 `MenuScene` — 스토리 / 경쟁 버튼
- [ ] **W3-09** 👀 `StageMapScene` — 스테이지 1~10, 잠금 표시, 최고 별 표시
- [ ] **W3-10** 👀 HUD 스토리 버전 — 남은 이동, 점수, 미션 진행도
- [ ] **W3-11** 👀 `ResultScene` — 클리어/실패, 별, 점수, [다시하기] [다음 스테이지] [메뉴]
- [ ] **W3-12** 👀 해금 흐름: 클리어 시 다음 스테이지 해금, 최고 별·점수 갱신
- [ ] **W3-13** Capacitor로 빈 Android 앱 APK 빌드 한 번 시험 (4주차 리스크 선제 확인)

**3주차 완료 기준**: 스테이지 1~10을 순서대로 해금하며 플레이, 새로고침 후에도 진행 유지

---

## 4주차 — 폴리싱 + APK

### 폴리싱
- [ ] **W4-01** 👀 이펙트: 제거 파티클, 특수 발동 화면 흔들림, 점수 팝업, 연쇄 텍스트
  - 제거 파티클·연쇄 텍스트·흔들림은 디자인 묶음(D-08, D-09)에서 처리. 남은 것: 점수 팝업, 특수 발동 흔들림
- [ ] **W4-02** 👀 사운드: 스왑, 매치, 특수 발동, 연쇄, 클리어/실패 (무료 효과음), 음소거 토글
- [ ] **W4-03** 👀 힌트: 5초 무입력 시 `findHint` 결과 깜빡임
- [ ] **W4-04** 👀 일시정지 메뉴 (계속 / 다시하기 / 메뉴), 타임어택 타이머 정지
- [x] **W4-05** 👀 블록 그래픽 교체 검토 (Kenney 에셋 또는 단색 유지)
  - 디자인 묶음 D-01에서 결정: 코드로 그린 '말랑 친구들' 블록 (D-05에서 구현)
- [ ] **W4-06** 👀 `TitleScene` (또는 BootScene에 타이틀 표시)

### 모바일
- [ ] **W4-07** Capacitor Android 프로젝트 정식 설정, 세로 고정, 앱 이름·아이콘
- [ ] **W4-08** 🧪 `CapacitorPreferencesStorage` 구현, `isNativePlatform()`으로 선택
- [ ] **W4-09** 👀 실기기 설치, 터치 입력 확인, 앱 재시작 후 진행·최고 점수 유지 확인
- [ ] **W4-10** 👀 성능 확인 (60fps 근접, 긴 연쇄·슈퍼 블록 발동 시 끊김 여부)
- [ ] **W4-11** 👀 **조카 시범 플레이** → 피드백 기록 (`docs/FEEDBACK.md`)

**4주차 완료 기준**: Android 실기기에서 두 모드 모두 플레이 가능 + 시범 플레이 완료

---

## SPEC 10절 수용 기준 ↔ 태스크

| 수용 기준 | 태스크 |
|---|---|
| 시작 보드 매치 0, 가능한 수 ≥ 1 (seed 1~1000) | W1-08, W1-13 |
| 매치 없는 스왑은 되돌아가고 이동 미차감 | W1-12, W3-05 |
| L / T / + 하나의 그룹 | W1-09 |
| 4 / 5L / 5I / 6+ → 정해진 특수 블록 | W2-01 |
| 수 없으면 셔플 | W1-11, W1-12 |
| 같은 seed → 같은 보드 | W1-06, W1-13 |
| 스토리 1~10 순차 해금, 재시작 후 유지 | W3-12, W4-08, W4-09 |
| 경쟁 최고 점수 재시작 후 유지 | W3-07, W4-08, W4-09 |
| 실기기 60fps 근접 | W4-10 |

## 백로그 (v0.2 이후)

- 특수 블록끼리 조합 효과 (line+line, bomb+line, color+X …)
- 장애물: 얼음, 잠금, 초콜릿
- Sugar Crush 연출 (남은 이동을 특수 블록으로 바꿔 터뜨리기)
- 경쟁 모드 시간 추가 아이템
- 난이도 곡선 정밀 설계
- 오리지널 캐릭터 / 테마
- iOS 빌드
