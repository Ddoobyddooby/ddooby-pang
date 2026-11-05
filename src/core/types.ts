// core 전체가 공유하는 타입 (PLAN 4.1, 4.2). 런타임 코드 없음.

/** 블록 색. 스테이지의 `colors` 수만큼 0부터 사용한다 */
export type Color = 0 | 1 | 2 | 3 | 4 | 5;

export type SpecialKind = 'lineH' | 'lineV' | 'bomb' | 'color' | 'super';

export interface Block {
  /** view가 스프라이트를 추적하는 고유 ID */
  readonly id: number;
  /** 컬러 블록은 null */
  readonly color: Color | null;
  readonly special?: SpecialKind;
}

export interface Pos {
  readonly r: number;
  readonly c: number;
}

/** 한 칸의 장애물 층 (PLAN2 5.1). 얼음벽 칸에는 블록·잠금·젤리가 없다 */
export interface CellLayer {
  /** 블록에 씌운 잠금 */
  readonly lock?: true;
  /** 블록 없는 칸을 차지하는 얼음벽 겹수 */
  readonly frost?: 1 | 2 | 3;
  /** 블록 아래 젤리 겹수 */
  readonly jelly?: 1 | 2;
}

export type ObstacleKind = 'lock' | 'frost' | 'jelly';

export interface Board {
  readonly rows: number;
  readonly cols: number;
  /** 1차원 배열, index = r * cols + c. null은 빈칸 (resolve 도중, 또는 얼음벽 칸) */
  readonly cells: readonly (Block | null)[];
  /** 다음에 만들 블록의 id */
  readonly nextId: number;
  /** 칸마다 장애물 층 (index는 cells와 같다). 없으면 장애물 없음 (v0.1과 같다) */
  readonly layers?: readonly (CellLayer | null)[];
}

export interface GameState {
  readonly board: Board;
  /** RNG도 상태의 일부 → 완전 결정적 */
  readonly rngState: number;
  /** 사용하는 색 수 (3~6) */
  readonly colors: number;
}

/** 칸을 공유하는 run(같은 색 3개 이상 연속)들을 합친 그룹 */
export interface MatchGroup {
  readonly color: Color;
  readonly cells: readonly Pos[];
  /** 가장 긴 가로 run 길이 (가로 run이 없으면 0) */
  readonly maxRunH: number;
  /** 가장 긴 세로 run 길이 (세로 run이 없으면 0) */
  readonly maxRunV: number;
  /** 가로 run과 세로 run이 교차하는지 (L / T / + 판별) */
  readonly hasIntersection: boolean;
}

export type GameEvent =
  | { readonly type: 'swap'; readonly a: Pos; readonly b: Pos }
  | { readonly type: 'swapBack'; readonly a: Pos; readonly b: Pos }
  | { readonly type: 'match'; readonly groups: readonly MatchGroup[]; readonly cascade: number }
  | {
      readonly type: 'activate';
      readonly special: SpecialKind;
      readonly at: Pos;
      readonly cleared: readonly Pos[];
      /** 연쇄 차례 (PLAN 6.13). 0 = 매치·스왑으로 바로 발동, n = 차례 n-1의 범위에 휘말림 */
      readonly depth: number;
    }
  | {
      /** 컬러 + 특수 블록 스왑으로 같은 색 블록이 특수 블록이 된다 (PLAN 6.18). id는 그대로, special만 바뀐다 */
      readonly type: 'transform';
      readonly changes: readonly { at: Pos; block: Block }[];
    }
  | {
      readonly type: 'remove';
      readonly blocks: readonly { id: number; at: Pos; bySpecial: boolean }[];
    }
  | { readonly type: 'create'; readonly block: Block; readonly at: Pos }
  | { readonly type: 'fall'; readonly moves: readonly { id: number; from: Pos; to: Pos }[] }
  | {
      readonly type: 'refill';
      /**
       * dropFrom: 구간 위 몇 칸에서 떨어지는지 (1 = 구간 바로 위).
       * spawnTop: 구간 맨 위 행. 0이면 보드 위에서, 아니면 고정 칸 바로 아래에서 생긴다 (PLAN2 5.2)
       */
      readonly blocks: readonly { block: Block; at: Pos; dropFrom: number; spawnTop: number }[];
    }
  | {
      /** 장애물 피해 (PLAN2 5.3). hp는 피해 뒤 남은 겹, 0이면 사라짐 (잠금은 항상 0). remove와 같은 step */
      readonly type: 'obstacle';
      readonly changes: readonly { at: Pos; kind: ObstacleKind; hp: number }[];
    }
  | { readonly type: 'score'; readonly delta: number; readonly cascade: number; readonly at: Pos }
  | {
      readonly type: 'shuffle';
      /** 셔플 후 전체 배치. 셔플 상한을 넘어 새로 생성하면 새 id가 들어 있다 (없어진 id는 제거) */
      readonly mapping: readonly { block: Block; to: Pos }[];
    };

export type GameEventType = GameEvent['type'];

export interface ResolveResult {
  readonly state: GameState;
  /** 같은 step 안의 이벤트는 동시에 재생한다 */
  readonly steps: readonly (readonly GameEvent[])[];
  readonly scoreDelta: number;
  /** 색별 제거 수 (index = Color). 미션 '색 수집' 집계용 */
  readonly removedByColor: readonly number[];
  /** 이번 수로 완전히 없어진 장애물 수 (잠금 해제, 얼음벽 0겹, 젤리 0겹. PLAN2 5.3) */
  readonly clearedObstacles: Readonly<Record<ObstacleKind, number>>;
  /** false면 steps에 swap / swapBack만 들어 있다 */
  readonly valid: boolean;
}
