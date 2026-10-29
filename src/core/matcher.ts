// 매치 판정 (PLAN 4.4)
// 1) 가로·세로로 같은 색 3개 이상 연속인 구간(run)을 모은다
// 2) 칸을 공유하는 run끼리 Union-Find로 합쳐 그룹을 만든다 (L / T / + 모양)
// 컬러 블록(color === null)은 매치에 참여하지 않는다.

import { posOf } from './board';
import type { Board, Color, MatchGroup } from './types';

export const MIN_RUN = 3;

interface Run {
  readonly dir: 'H' | 'V';
  readonly cells: readonly number[]; // board index
}

function collectRuns(board: Board): Run[] {
  const runs: Run[] = [];
  const { rows, cols, cells } = board;
  const colorAt = (i: number) => cells[i]?.color ?? null;

  const scan = (
    dir: 'H' | 'V',
    lines: number,
    length: number,
    at: (line: number, k: number) => number,
  ) => {
    for (let line = 0; line < lines; line++) {
      let start = 0;
      for (let k = 1; k <= length; k++) {
        const prev = colorAt(at(line, start));
        const same = k < length && prev !== null && colorAt(at(line, k)) === prev;
        if (same) continue;
        if (prev !== null && k - start >= MIN_RUN) {
          runs.push({
            dir,
            cells: Array.from({ length: k - start }, (_, j) => at(line, start + j)),
          });
        }
        start = k;
      }
    }
  };

  scan('H', rows, cols, (r, c) => r * cols + c);
  scan('V', cols, rows, (c, r) => r * cols + c);
  return runs;
}

/** Union-Find (경로 압축). parent[i] === i 이면 루트 */
function createUnionFind(size: number) {
  const parent = Array.from({ length: size }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  return { find, union };
}

export function findMatches(board: Board): MatchGroup[] {
  const runs = collectRuns(board);
  if (runs.length === 0) return [];

  const uf = createUnionFind(board.cells.length);
  for (const run of runs) {
    for (const i of run.cells) uf.union(run.cells[0]!, i);
  }

  // 루트별로 run을 모은다
  const byRoot = new Map<number, Run[]>();
  for (const run of runs) {
    const root = uf.find(run.cells[0]!);
    const list = byRoot.get(root);
    if (list) list.push(run);
    else byRoot.set(root, [run]);
  }

  const groups: { first: number; group: MatchGroup }[] = [];
  for (const groupRuns of byRoot.values()) {
    const cellSet = new Set<number>();
    const hCells = new Set<number>();
    let maxRunH = 0;
    let maxRunV = 0;
    for (const run of groupRuns) {
      for (const i of run.cells) cellSet.add(i);
      if (run.dir === 'H') {
        maxRunH = Math.max(maxRunH, run.cells.length);
        for (const i of run.cells) hCells.add(i);
      } else {
        maxRunV = Math.max(maxRunV, run.cells.length);
      }
    }
    const hasIntersection = groupRuns.some(
      (run) => run.dir === 'V' && run.cells.some((i) => hCells.has(i)),
    );

    const sorted = [...cellSet].sort((a, b) => a - b);
    groups.push({
      first: sorted[0]!,
      group: {
        color: board.cells[sorted[0]!]!.color as Color,
        cells: sorted.map((i) => posOf(board, i)),
        maxRunH,
        maxRunV,
        hasIntersection,
      },
    });
  }

  // 결정적 순서: 그룹의 첫 칸(왼쪽 위) 기준
  return groups.sort((a, b) => a.first - b.first).map((g) => g.group);
}
