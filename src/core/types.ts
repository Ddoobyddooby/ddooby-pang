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

export interface Board {
  readonly rows: number;
  readonly cols: number;
  /** 1차원 배열, index = r * cols + c. null은 빈칸 (resolve 도중에만 존재) */
  readonly cells: readonly (Block | null)[];
  /** 다음에 만들 블록의 id */
  readonly nextId: number;
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
    }
  | {
      readonly type: 'remove';
      readonly blocks: readonly { id: number; at: Pos; bySpecial: boolean }[];
    }
  | { readonly type: 'create'; readonly block: Block; readonly at: Pos }
  | { readonly type: 'fall'; readonly moves: readonly { id: number; from: Pos; to: Pos }[] }
  | {
      readonly type: 'refill';
      /** dropFrom: 화면 위 몇 칸에서 떨어지는지 (1 = 보드 바로 위) */
      readonly blocks: readonly { block: Block; at: Pos; dropFrom: number }[];
    }
  | { readonly type: 'score'; readonly delta: number; readonly cascade: number; readonly at: Pos }
  | { readonly type: 'shuffle'; readonly mapping: readonly { id: number; to: Pos }[] };

export type GameEventType = GameEvent['type'];

export interface ResolveResult {
  readonly state: GameState;
  /** 같은 step 안의 이벤트는 동시에 재생한다 */
  readonly steps: readonly (readonly GameEvent[])[];
  readonly scoreDelta: number;
  /** 색별 제거 수 (index = Color). 미션 '색 수집' 집계용 */
  readonly removedByColor: readonly number[];
  /** false면 steps에 swap / swapBack만 들어 있다 */
  readonly valid: boolean;
}
