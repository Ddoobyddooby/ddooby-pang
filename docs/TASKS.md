# ddooby-pang TASKS (v0.2)

> 기준 문서: [`SPEC.md`](../SPEC.md) "v0.2 확정 변경분", [`PLAN.md`](./PLAN.md)
> v0.1 태스크(W1-01 ~ W4-27)는 [`v0.1/TASKS.md`](./v0.1/TASKS.md)에 모두 끝난 상태로 보관한다.
> ID는 `V2-W<주차>-<번호>`. **완료 기준**을 만족해야 체크한다. 범례: 🧪 테스트 필수 · 👀 수동 확인 · ⛓ 선행 작업 · 🎨 Codex 그림
> 2~4주차는 그 주 시작 전에 PLAN을 자세히 쓰고 태스크를 나눈다.

---

## 1주차 — 특수 블록 조합 + 테마 시안

- [ ] **V2-W1-01** 🧪 조합 core: 특수 블록 둘을 스왑하면 7개 범주 조합 발동, `combo` 이벤트, 컬러 + 슈퍼를 `superAny`로 (SPEC 3절, PLAN2 3.1·3.2·3.4) — claude-1
  - 파일: `src/core/types.ts`, `engine.ts`, `specials.ts`, `src/config.ts`(`COMBO` 연출 값까지 이 태스크가 넣는다), 개발 옵션 `?specials=pairs`, `tests/core/combo.test.ts`
  - 완료 기준: 7개 범주 테스트·결정성 테스트·기존 테스트 통과. 서로 다른 색 특수 블록 둘 스왑이 유효. view는 아직 `combo` 이벤트를 몰라도 보드 대조가 깨지지 않는다 (지금처럼 `remove`로 사라짐)
- [ ] **V2-W1-02** 👀🧪 조합 연출: 모이기 → 슬로모션 → 이름 팝업 → 흔들림·파티클, 폭탄 + 폭탄 두 번 쾅, 전용 소리 (SPEC 3.1, PLAN2 3.3) ⛓ V2-W1-01 main 반영 후 — claude-2
  - 파일: `src/view/fx/`, `BoardView.ts`, `Sfx.ts`, `public/audio/combo.*`
  - 완료 기준: 390×844 `?specials=pairs`로 7개 조합 캡처, 콘솔 오류 0, 연출 값은 `COMBO`에서만
- [ ] **V2-W1-03** 🎨👀 테마 시안 5개: 사탕·우주·바다·공주·인형 키워드로 배경 + 블록 7개 시안 한 장씩 (SPEC 15절, PLAN2 4.1) — codex
  - 완료 기준: `assets/theme-src/drafts/` 5장을 사용자에게 보여 주고 **사용자가 3개를 고름** (고른 결과를 여기에 적는다)

## 2주차 — 장애물 + 테마 적용 (큰 틀, PLAN2 5절)

- [ ] **V2-W2-01** 🧪 장애물 core: 잠금·얼음벽·젤리, `layout`·`layers` 파서, 새 미션 `clearJelly`·`clearObstacle` (SPEC 4절)
- [ ] **V2-W2-02** 👀🧪 장애물 그림·연출 ⛓ V2-W2-01
- [ ] **V2-W2-03** 🎨 고른 테마 3개의 최종 그림: 블록 몸통 7장 + 배경 1장씩 (PLAN2 4.2) ⛓ V2-W1-03
- [ ] **V2-W2-04** 👀🧪 테마 구조와 메인 화면 선택, `settings.theme` 저장 (SPEC 15절, PLAN2 4.3) ⛓ V2-W2-03

## 3주차 — Supabase + 랭킹 (큰 틀)

- [ ] **V2-W3-01** core 공유 방식 PoC + 시간 검증 기준 (SPEC 11절 1·5번)
- [ ] 익명 로그인·닉네임, `start-run`·`submit-score`, 주간 랭킹 화면 (SPEC 5·7절) — PoC 뒤에 나눈다

## 4주차 — 스테이지 재조정 + 로그 (큰 틀)

- [ ] 1~30 재조정 (장애물 배치, 이동 수, 색), **별 3개 기준 상향 (FEEDBACK R6)** (SPEC 6절)
- [ ] `stage_attempts` 플레이 로그 (SPEC 6.1)
- [ ] 👀 조카 2차 테스트 → `docs/FEEDBACK.md`

## SPEC 10절 수용 기준 ↔ 태스크

| 수용 기준 | 태스크 |
|---|---|
| 7개 조합 범주 | V2-W1-01, V2-W1-02 |
| 잠금·얼음벽·젤리·`clearJelly`·v0.1 형식 호환 | V2-W2-01, V2-W2-02 |
| 리플레이 점수 일치, 조작 거부, 직접 쓰기 실패, 주 바뀜 | 3주차 |
| 오프라인 플레이 | 3주차 |
| 테마 바꾸기·유지·점수 무관 | V2-W2-04 |
