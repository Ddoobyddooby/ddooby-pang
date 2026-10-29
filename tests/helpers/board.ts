// 테스트용 보드 표기법 (PLAN 8절)
//
//   R Y G B P O   일반 블록 (Color 0~5: red, yellow, green, blue, purple, orange)
//   R- / R|       라인 블록 (lineH: 행 제거 / lineV: 열 제거)
//   R*            폭탄
//   R+            슈퍼
//   C             컬러 블록 (색 없음)
//   .             빈칸
//
// 블록 id는 왼쪽 위부터 행 순서로 1, 2, 3 … 을 붙인다.

import type { Block, Board, Color, SpecialKind } from '../../src/core/types';

const COLOR_CHARS = ['R', 'Y', 'G', 'B', 'P', 'O'] as const;

const SUFFIX_TO_SPECIAL: Record<string, SpecialKind> = {
  '-': 'lineH',
  '|': 'lineV',
  '*': 'bomb',
  '+': 'super',
};

const SPECIAL_TO_SUFFIX: Partial<Record<SpecialKind, string>> = {
  lineH: '-',
  lineV: '|',
  bomb: '*',
  super: '+',
};

function parseToken(token: string, id: number): Block | null {
  if (token === '.') return null;
  if (token === 'C') return { id, color: null, special: 'color' };

  const colorIndex = COLOR_CHARS.indexOf(token[0] as (typeof COLOR_CHARS)[number]);
  if (colorIndex < 0 || token.length > 2) throw new Error(`알 수 없는 블록 표기: "${token}"`);
  const color = colorIndex as Color;

  if (token.length === 1) return { id, color };
  const special = SUFFIX_TO_SPECIAL[token[1]!];
  if (!special) throw new Error(`알 수 없는 특수 블록 표기: "${token}"`);
  return { id, color, special };
}

export function parseBoard(text: string): Board {
  const rows = text
    .trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/));

  const cols = rows[0]!.length;
  rows.forEach((row, r) => {
    if (row.length !== cols) {
      throw new Error(`${r}행의 칸 수(${row.length})가 0행(${cols})과 다르다`);
    }
  });

  let nextId = 1;
  const cells = rows.flat().map((token) => {
    const block = parseToken(token, nextId);
    if (block) nextId++;
    return block;
  });

  return { rows: rows.length, cols, cells, nextId };
}

function tokenOf(block: Block | null): string {
  if (!block) return '.';
  if (block.special === 'color') return 'C';
  const ch = COLOR_CHARS[block.color!];
  return ch + (block.special ? SPECIAL_TO_SUFFIX[block.special]! : '');
}

/** parseBoard의 역함수. 칸은 2글자 폭으로 맞춘다 */
export function printBoard(board: Board): string {
  const lines: string[] = [];
  for (let r = 0; r < board.rows; r++) {
    const row = board.cells.slice(r * board.cols, (r + 1) * board.cols);
    lines.push(
      row
        .map((b) => tokenOf(b).padEnd(2))
        .join(' ')
        .trimEnd(),
    );
  }
  return lines.join('\n');
}
