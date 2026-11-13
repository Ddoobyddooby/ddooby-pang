# ddooby-pang

스테이지형 매치-3 퍼즐 게임. 같은 색 블록 3개 이상을 맞춰 터뜨린다.

> **상태**: v0.1 완료(2026-11-05), v0.2 개발 중 (특수 블록 조합, 장애물, 테마, 주간 랭킹). 진행 상황은 [docs/TASKS.md](docs/TASKS.md)

## 주요 기능 (v0.2 기준)

- **스토리 모드**: 이동 횟수 제한, 스테이지 30개, 미션(점수 달성 / 색 수집 / 젤리 지우기), 별 1~3개
- **경쟁 모드**: 60초 타임어택, 로컬 최고 점수 + **주간 랭킹** (익명 로그인 + 닉네임, 서버가 리플레이로 점수 검증)
- **특수 블록**: 라인(4개) · 폭탄(5개 L/T) · 컬러(5개 일직선) · 슈퍼(6개 이상)
- **장애물** (v0.2): 잠금 · 얼음벽 · 젤리
- **테마** (v0.2): 그림책 · 사탕 · 우주 · 바다 중 메인 화면에서 고른다 (블록·배경·배경음악)
- 웹(GitHub Pages)과 Android 앱(APK). 네트워크가 없어도 스토리·경쟁 모드를 플레이할 수 있다

## 개발 스펙

| 항목 | 내용 |
|---|---|
| 언어 | TypeScript (strict) |
| 게임 엔진 | Phaser 3 |
| 빌드 / 개발 서버 | Vite |
| 실행 환경 | 브라우저 (GitHub Pages) + Capacitor로 Android 앱 패키징 |
| 백엔드 (v0.2) | Supabase: 익명 로그인, Postgres(RLS), Edge Function(Deno) |
| 테스트 | Vitest (게임 로직·화면 계산 단위 테스트), ESLint로 계층 의존 규칙 검사 |

### 아키텍처

게임 로직(`core`)과 화면(Phaser)을 분리한다. `core`는 Phaser 없이 동작하는 순수 TypeScript로, 보드 상태와 입력을 받아 새 상태와 **이벤트 목록**(제거, 낙하, 생성 등)을 돌려준다. 화면 쪽은 그 이벤트를 받아 애니메이션만 재생한다. 덕분에 로직은 브라우저 없이 테스트할 수 있고, 서버가 같은 코드로 경쟁 모드 점수를 다시 계산해 검증한다.

```
scenes ─→ view ───→ core
   │  ├─→ modes ──→ core
   │  ├─→ replay ─→ core, modes
   │  └─→ online ─→ (replay/coreVersion만)
   └────→ data, storage
```

| 폴더 | 역할 |
|---|---|
| `src/core/` | 순수 게임 로직: 매치 판정, 특수 블록, 장애물, 낙하·리필, 셔플, 점수 |
| `src/modes/` | 스토리 / 경쟁 모드의 규칙 차이 |
| `src/replay/` | 경쟁 모드 기록(seed + move 로그)을 다시 계산해 점수를 판정. 서버 번들에도 들어가는 순수 TS |
| `src/online/` | Supabase 연결: 익명 로그인, 닉네임, 점수 제출, 주간 랭킹, 플레이 로그 |
| `src/view/` | 블록 스프라이트, 트윈, 입력, 이펙트, 테마 |
| `src/scenes/` | Phaser 화면 (메뉴, 스테이지 맵, 게임, 결과, 랭킹) |
| `src/data/` | 스테이지 JSON 로더·검증, 테마 ID |
| `src/storage/` | 진행 상황 저장 |
| `src/dev/` | 개발 전용 도구 (가짜 서버 응답, 미리보기) |
| `supabase/` | DB 마이그레이션, Edge Function ([supabase/README.md](supabase/README.md)) |

> 자세한 설계: v0.1(core 구조·이벤트·화면)은 [docs/v0.1/PLAN.md](docs/v0.1/PLAN.md) 3~4절, v0.2(장애물·랭킹·테마)는 [docs/PLAN.md](docs/PLAN.md).

## 시작하기

Node.js 20.19 이상이 필요하다.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # Vitest
npm run build   # 타입체크 + dist/ 빌드
```

온라인 기능(닉네임, 주간 랭킹)을 쓰려면 `.env.example`을 `.env.local`로 복사해 Supabase URL과 publishable key를 넣는다. 없어도 게임은 돌아가고 온라인 기능만 꺼진다.

자세한 사용법은 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## 문서

| 문서 | 내용 |
|---|---|
| [SPEC.md](SPEC.md) | 무엇을 / 왜: 게임 규칙, 점수, 스테이지 스키마, 수용 기준 |
| [docs/PLAN.md](docs/PLAN.md) | 어떻게: v0.2 구현 계획 (v0.1은 [docs/v0.1/](docs/v0.1/)) |
| [docs/TASKS.md](docs/TASKS.md) | v0.2 작업 단위 (v0.1은 [docs/v0.1/TASKS.md](docs/v0.1/TASKS.md)) |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 개발 가이드: VSCode에서 실행하고 확인하는 방법 |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Claude·Codex 세션 운영 (역할, 지시서, 품질 게이트) |
| [docs/FEEDBACK.md](docs/FEEDBACK.md) | 시범 플레이 반응과 리뷰 의견 |
| [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) | Claude / Codex 작업 규칙 |
| [docs/v0.1/](docs/v0.1/) | v0.1 기록. v0.2 문서 갱신(2026-11-13) 전의 README·CLAUDE·AGENTS·DEVELOPMENT 사본도 여기에 있다 |
