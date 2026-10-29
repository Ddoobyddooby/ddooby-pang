# ddooby-pang

스테이지형 매치-3 퍼즐 게임. 같은 색 블록 3개 이상을 맞춰 터뜨린다.

> **상태**: v0.1 MVP 개발 중 (1주차: 코어 엔진)

## 주요 기능 (v0.1)

- **스토리 모드**: 이동 횟수 제한, 스테이지 10개, 미션(점수 달성 / 색 수집), 별 1~3개
- **경쟁 모드**: 60초 타임어택, 로컬 최고 점수 기록
- **특수 블록**: 라인(4개) · 폭탄(5개 L/T) · 컬러(5개 일직선) · 슈퍼(6개 이상)
- Android 실기기 플레이 (APK)

## 기술 스택

Phaser 3 · TypeScript (strict) · Vite · Capacitor (Android) · Vitest

## 시작하기

Node.js 20.19 이상이 필요하다.

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # 타입체크 + dist/ 빌드
```

## 문서

| 문서 | 내용 |
|---|---|
| [SPEC.md](SPEC.md) | 무엇을 / 왜: 게임 규칙, 점수, 스테이지 스키마, 수용 기준 |
| [docs/PLAN.md](docs/PLAN.md) | 어떻게: 구현 계획 |
| [docs/TASKS.md](docs/TASKS.md) | 작업 단위 |
