# ddooby-pang

스테이지형 매치-3 퍼즐 게임. 같은 색 블록 3개 이상을 맞춰 터뜨린다.

> **상태**: v0.1 MVP 개발 중 (1주차: 코어 엔진)

## 주요 기능 (v0.1)

- **스토리 모드**: 이동 횟수 제한, 스테이지 10개, 미션(점수 달성 / 색 수집), 별 1~3개
- **경쟁 모드**: 60초 타임어택, 로컬 최고 점수 기록
- **특수 블록**: 라인(4개) · 폭탄(5개 L/T) · 컬러(5개 일직선) · 슈퍼(6개 이상)
- Android 실기기 플레이 (APK)

## 개발 스펙

| 항목 | 내용 |
|---|---|
| 언어 | TypeScript (strict) |
| 게임 엔진 | Phaser 3 |
| 빌드 / 개발 서버 | Vite |
| 실행 환경 | 브라우저 (개발) → Capacitor로 Android 앱 패키징 |
| 테스트 | Vitest (게임 로직 단위 테스트) |

### 아키텍처

게임 로직(`core`)과 화면(Phaser)을 분리한다. `core`는 Phaser 없이 동작하는 순수 TypeScript로, 보드 상태와 입력을 받아 새 상태와 **이벤트 목록**(제거, 낙하, 생성 등)을 돌려준다. 화면 쪽은 그 이벤트를 받아 애니메이션만 재생한다. 덕분에 로직은 브라우저 없이 테스트할 수 있다.

```
scenes ─→ view ──→ core
   │  └─→ modes ─→ core
   └────→ data, storage
```

| 폴더 | 역할 |
|---|---|
| `src/core/` | 순수 게임 로직: 매치 판정, 특수 블록, 낙하·리필, 셔플, 점수 |
| `src/modes/` | 스토리 / 경쟁 모드의 규칙 차이 |
| `src/view/` | 블록 스프라이트, 트윈, 입력, 이펙트 |
| `src/scenes/` | Phaser 화면 (메뉴, 스테이지 맵, 게임, 결과) |
| `src/data/` | 스테이지 JSON 로더, 설정값 |
| `src/storage/` | 진행 상황 저장 |

> 폴더는 1주차 작업 중에 생긴다. 자세한 설계는 [docs/PLAN.md](docs/PLAN.md) 3~4절.

## 시작하기

Node.js 20.19 이상이 필요하다.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # Vitest
npm run build   # 타입체크 + dist/ 빌드
```

자세한 사용법은 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## 문서

| 문서 | 내용 |
|---|---|
| [SPEC.md](SPEC.md) | 무엇을 / 왜: 게임 규칙, 점수, 스테이지 스키마, 수용 기준 |
| [docs/PLAN.md](docs/PLAN.md) | 어떻게: 구현 계획 |
| [docs/TASKS.md](docs/TASKS.md) | 작업 단위 |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 개발 가이드: VSCode에서 실행하고 확인하는 방법 |
