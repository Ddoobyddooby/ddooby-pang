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
} as const;

/** 화면 배치와 블록 모양 (PLAN 6.3: 상단 HUD 200px, 보드 680x680) */
export const VIEW = {
  board: { x: 20, y: 200, size: 680 },
  /** 칸 대비 블록 크기 */
  blockScale: 0.84,
  /** Color 0~5: red, yellow, green, blue, purple, orange */
  blockColors: [0xff5a5f, 0xffd23f, 0x3ecf8e, 0x4d96ff, 0x9b5de5, 0xff8c42],
  boardBackground: 0x1f1f33,
  /** 칸 크기 대비 이만큼 끌면 스와이프로 본다 */
  swipeThreshold: 0.3,
} as const;
