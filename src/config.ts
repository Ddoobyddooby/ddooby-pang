// 게임 수치는 전부 여기서 관리한다 (SPEC 5절, PLAN 4.8). 플레이 테스트 후 조정.

export const GAME = {
  width: 720,
  height: 1280,
} as const;

export const BOARD = {
  rows: 8,
  cols: 8,
  /** 한 번의 resolve에서 허용하는 최대 연쇄 수. 넘으면 버그로 보고 assert (3색은 정상으로도 56까지, PLAN 4.3) */
  maxCascade: 200,
  /** 초기 생성·셔플 재시도 상한 */
  maxGenerateAttempts: 100,
} as const;

export const SCORE = {
  perBlock: 10,
  match4: 120,
  match5: 200,
  match6Base: 300,
  match6Extra: 50,
  bySpecial: 20,
  cascadeStep: 0.5,
  /** 스토리 클리어 후 남은 이동 1회당 */
  movesLeftBonus: 300,
} as const;

/** 타임어택 모드 (PLAN 5절). W3-04에서 timeLimitMs를 timeattack.json으로 옮긴다 */
export const TIMEATTACK = {
  timeLimitMs: 60000,
  /** 남은 시간이 이 아래면 HUD 시간 강조 (W2-11) */
  warnMs: 10000,
} as const;

export const SPECIAL = {
  /** 'perpendicular': 가로 4매치 → 세로줄 제거 (캔디크러시). 'parallel': 같은 방향 */
  lineDirection: 'perpendicular' as 'perpendicular' | 'parallel',
  /** 새 특수 블록 칸이 같은 턴의 발동 범위에 걸리면. 'keep': 남김 (캔디크러시). 'explode': 바로 발동 */
  newSpecialInBlast: 'keep' as 'keep' | 'explode',
} as const;

/** 애니메이션 시간 (ms) */
export const ANIM = {
  swap: 120,
  remove: 150,
  fallPerCell: 60,
  refillPerCell: 60,
  shuffle: 300,
  /** 착지 눌림 (ms) */
  squish: 160,
  /** 스왑 때 커지는 배율 */
  swapPop: 1.1,
  /** remove 안에서 `><` 표정 유지 시간 (ms) */
  squintHold: 80,
} as const;

/** 화면 배치와 블록 모양 (설계: 2026-10-30-screen-layout-design.md) */
export const VIEW = {
  /** 기준 높이 1280 기준의 구역 배치 (px). 더 긴 화면의 늘어난 높이는 screenLayout이 나눈다 */
  screen: {
    baseHeight: 1280,
    titleY: 90,
    boardX: 20,
    boardY: 170,
    boardSize: 680,
    /** 정보 패널: 보드 판(DECOR.frame.pad 포함)과 같은 폭 */
    panelY: 870,
    panelH: 170,
    /** 바닥 장식 높이 (화면 맨 아래에 붙는다) */
    decorH: 220,
    /** 늘어난 높이 중 타이틀~보드 사이에 주는 비율 (나머지는 패널~장식 사이) */
    topShare: 0.3,
  },
  /** 칸 대비 블록 크기 */
  blockScale: 0.95,
  boardBackground: 0xfff8ec,
  /** 칸 크기 대비 이만큼 끌면 스와이프로 본다 */
  swipeThreshold: 0.3,
  /** 탭으로 고른 칸의 표시 (탭-탭 입력) */
  select: {
    /** 고른 블록이 커지는 배율 */
    scale: 1.12,
    /** 커지고 돌아오는 시간 (ms) */
    ms: 140,
    /** 칸 뒤 둥근 테두리: 칸 대비 크기, 모서리 반지름(칸 대비), 선 두께(px) */
    size: 0.96,
    radius: 0.28,
    lineWidth: 5,
    fill: 0xfff3d6,
    fillAlpha: 0.9,
    stroke: 0xff7fa8,
  },
} as const;

/** 달콤 디저트 테마 색·글꼴 (스펙 2절) */
export const THEME = {
  font: 'Jua',
  /** 실제 하늘은 index.html의 CSS 그라데이션. 값을 바꿀 땐 둘 다 */
  sky: { top: 0xbfe4ff, bottom: 0xffd9ea },
  cloud: 0xffffff,
  star: 0xffe27a,
  wafer: { fill: 0xf3d29b, stroke: 0xd9a866, grain: 0xe8bf80, inner: 0xfff8ec },
  /** index = Color */
  blocks: [
    { fill: 0xff7b88, stroke: 0xe45a6b },
    { fill: 0xffdb5e, stroke: 0xe8b622 },
    { fill: 0x6be0a4, stroke: 0x34b877 },
    { fill: 0x78b6ff, stroke: 0x3f88e6 },
    { fill: 0xbc8af2, stroke: 0x8f55d6 },
    { fill: 0xffab69, stroke: 0xee8031 },
  ],
  face: { ink: 0x3b2b3a, cheek: 0xff7fa8 },
  title: { fill: '#ff6b9a', stroke: '#ffffff' },
  /** 정보 패널 글자·막대 색 */
  info: {
    text: '#8a7aa8',
    score: '#e45a6b',
    warn: '#ff4d5e',
    bar: { bg: 0xffffff, fill: 0xff9cc0, warn: 0xff5a6a },
  },
  /** 바닥 장식 (언덕 두 겹, 막대사탕, 컵케이크) */
  hills: {
    back: 0xffe3ef,
    front: 0xfff3d9,
    stick: 0xe9c48a,
    candy: [0xff7b88, 0xbc8af2],
    cupWrap: 0xe9c48a,
    cupFrosting: 0xffb3d0,
    cherry: 0xff7b88,
  },
  /** 칭찬 문구 색 (단계 2~5) */
  praiseColors: { 2: '#ff6b9a', 3: '#ff9a3c', 4: '#4d96ff', 5: '#b37cf0' },
} as const;

/** 연쇄 단계별 이펙트 (단계 = match 이벤트의 cascade + 1) */
export const FX = {
  maxLevel: 5,
  /** 키 = 연쇄 단계 */
  praise: { 2: '이안팡!', 3: '이서팡!', 4: '보라팡!!', 5: '사랑해!!!' } as Record<
    2 | 3 | 4 | 5,
    string
  >,
  praiseScale: { 2: 1, 3: 1.2, 4: 1.4, 5: 1.6 },
  /** index = 단계 - 1 */
  particlesPerBlock: [1, 2, 3, 3, 4],
  maxParticles: 60,
  starsFromLevel: 2,
  shakeFromLevel: 3,
  shake: {
    3: { duration: 150, intensity: 0.004 },
    4: { duration: 220, intensity: 0.008 },
    5: { duration: 260, intensity: 0.01 },
  },
  happyFromLevel: 3,
  happyMs: 600,
  /** 파티클 크기 (이미터 scale: 텍스처 대비 배율, 시작 → 끝) */
  heartScale: { start: 0.525, end: 0.15 },
  starScale: { start: 0.45, end: 0.15 },
  /** 칭찬 문구 모양과 움직임 (ms, px). 문구·색·크기 배율은 위의 praise / praiseScale / THEME에 있다 */
  praiseStyle: {
    fontSize: 72,
    strokeThickness: 12,
    /** 보드 높이 대비 문구 y 위치 */
    yRatio: 0.3,
    popScale: 1.25,
    popMs: 150,
    settleMs: 100,
    holdMs: 500,
    riseMs: 400,
    rise: 30,
  },
  /** 특수 블록 발동 연출 (W2-07). 크기는 칸 대비 배율, 시간은 ms */
  special: {
    /** 빛줄기 두께 (칸 대비), 시작 → 끝 */
    beamWidth: { start: 0.9, end: 0.1 },
    beamMs: 320,
    beamColor: 0xffffff,
    beamAlpha: 0.85,
    /** 원이 퍼지는 시간과 색. 반지름은 specialFx.ts의 종류별 값 */
    ringMs: 340,
    ringColor: 0xfff3b0,
    ringAlpha: 0.7,
    superShake: { duration: 200, intensity: 0.008 },
    /** 무지개 발동 때 반짝임을 띄우는 칸 수 상한, 칸마다 별 개수 */
    maxSparkles: 24,
    starsPerSparkle: 2,
  },
} as const;

/** 배경 장식 (구름·별)과 웨이퍼 보드판 모양 */
export const DECOR = {
  /** x = 화면 좌표, y = 위에서 (fromBottom이 있으면 아래에서) 떨어진 거리, scale = 크기 배율, drift = 좌우 이동 거리(px), ms = 왕복 시간 */
  clouds: [
    { x: 130, y: 90, scale: 1.0, drift: 60, ms: 24000 },
    { x: 560, y: 150, scale: 0.8, drift: 50, ms: 32000 },
    { x: 300, fromBottom: 280, scale: 1.2, drift: 70, ms: 38000 },
    { x: 620, fromBottom: 340, scale: 0.9, drift: 55, ms: 28000 },
  ] as readonly {
    x: number;
    y?: number;
    fromBottom?: number;
    scale: number;
    drift: number;
    ms: number;
  }[],
  cloudAlpha: 0.9,
  stars: [
    { x: 80, y: 250 },
    { x: 650, y: 60 },
    { x: 400, fromBottom: 230 },
    { x: 60, fromBottom: 300 },
    { x: 670, fromBottom: 310 },
    { x: 220, y: 40 },
  ] as readonly { x: number; y?: number; fromBottom?: number }[],
  starRadius: 10,
  twinkleMs: 1400,
  twinkleAlpha: { min: 0.3, max: 1 },
  /** 보드판: 칸 영역보다 사방으로 이만큼 크다 */
  frame: { pad: 10, radius: 18, border: 4, grainLines: 4, grainAlpha: 0.6 },
} as const;

/** HUD 배치와 글자 크기 (px). 정보 패널 안쪽 위치는 패널 왼쪽 위 기준 */
export const HUD = {
  title: { fontSize: 56, strokeThickness: 10 },
  panel: {
    padX: 36,
    /** 오른쪽 열(일시정지·미션) 자리. 지금은 비워 둔다 */
    rightReserve: 170,
    label: { y: 12, fontSize: 24 },
    score: { y: 28, fontSize: 56 },
    time: { y: 112, fontSize: 24 },
    bar: { y: 132, height: 18, border: 3 },
    /** 마지막 10초에 1초마다 통통 튀는 시간 글자 */
    pulse: { scale: 1.25, ms: 140 },
    seed: { fontSize: 18, inset: 12 },
  },
} as const;

/** 결과 화면 (W2-12). dy = 화면 가운데 기준 세로 위치(px), 시간은 ms */
export const RESULT = {
  panel: { width: 560, height: 680, alpha: 0.92 },
  title: { text: '끝!', dy: -250, fontSize: 96, strokeThickness: 12 },
  scoreLabel: { text: '점수', dy: -130, fontSize: 40 },
  score: { dy: -40, fontSize: 108, strokeThickness: 10 },
  best: { label: '최고 점수', dy: 70, fontSize: 36 },
  badge: {
    text: '최고 기록!',
    dy: 140,
    fontSize: 40,
    padX: 28,
    height: 64,
    /** 통통 튀는 크기와 한 번 커졌다 돌아오는 시간 */
    bounceScale: 1.12,
    bounceMs: 420,
  },
  button: {
    text: '다시하기',
    dy: 250,
    width: 300,
    height: 100,
    fontSize: 48,
    textColor: '#8a5a24',
    /** 누르면 이만큼 줄었다가 돌아온 뒤 게임을 다시 시작한다 */
    pressScale: 0.88,
    pressMs: 90,
  },
} as const;

/** 저장 (PLAN 7.2) */
export const SAVE = {
  /** localStorage 키 하나에 JSON 통째로 저장 */
  key: 'ddooby-pang/save',
} as const;
