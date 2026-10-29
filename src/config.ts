// 게임 수치는 전부 여기서 관리한다 (SPEC 5절, PLAN 4.8). 플레이 테스트 후 조정.

export const GAME = {
  width: 720,
  height: 1280,
  backgroundColor: '#2d2d44',
} as const;

export const BOARD = {
  rows: 8,
  cols: 8,
  /** 한 번의 resolve에서 허용하는 최대 연쇄 수. 넘으면 버그로 보고 assert */
  maxCascade: 50,
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

export const SPECIAL = {
  /** 'perpendicular': 가로 4매치 → 세로줄 제거 (캔디크러시). 'parallel': 같은 방향 */
  lineDirection: 'perpendicular' as 'perpendicular' | 'parallel',
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

/** 화면 배치와 블록 모양 (PLAN 6.3: 상단 HUD 200px, 보드 680x680) */
export const VIEW = {
  board: { x: 20, y: 200, size: 680 },
  /** 칸 대비 블록 크기 */
  blockScale: 0.84,
  /** Color 0~5: red, yellow, green, blue, purple, orange */
  blockColors: [0xff5a5f, 0xffd23f, 0x3ecf8e, 0x4d96ff, 0x9b5de5, 0xff8c42],
  boardBackground: 0xfff8ec,
  /** 칸 크기 대비 이만큼 끌면 스와이프로 본다 */
  swipeThreshold: 0.3,
} as const;

/** 달콤 디저트 테마 색·글꼴 (스펙 2절) */
export const THEME = {
  font: 'Jua',
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
  info: { bg: 0xffffff, bgAlpha: 0.85, text: '#8a7aa8' },
  /** 칭찬 문구 색 (단계 2~5) */
  praiseColors: { 2: '#ff6b9a', 3: '#ff9a3c', 4: '#4d96ff', 5: '#b37cf0' },
} as const;

/** 연쇄 단계별 이펙트 (단계 = match 이벤트의 cascade + 1) */
export const FX = {
  maxLevel: 5,
  /** 키 = 연쇄 단계 */
  praise: { 2: '이안팡!', 3: '이서팡!', 4: '보라팡!!', 5: '사랑해!!!' } as Record<2 | 3 | 4 | 5, string>,
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
} as const;
