// seed 기반 PRNG (mulberry32). 상태가 number 하나라 GameState에 그대로 넣는다 (PLAN 4.9).
// 모든 함수는 순수 함수: 상태를 받아 [값, 새 상태]를 돌려준다.

export type RngState = number;

/** seed(정수)로 초기 상태를 만든다 */
export function createRng(seed: number): RngState {
  return seed | 0;
}

/** [0, 1) 실수 */
export function next(state: RngState): [value: number, state: RngState] {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

/** [0, n) 정수 */
export function nextInt(state: RngState, n: number): [value: number, state: RngState] {
  const [v, s] = next(state);
  return [Math.floor(v * n), s];
}
