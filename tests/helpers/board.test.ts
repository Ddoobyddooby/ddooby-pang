import { describe, expect, it } from 'vitest';
import { parseBoard, printBoard } from './board';

describe('parseBoard', () => {
  it('크기와 색을 읽는다', () => {
    const board = parseBoard(`
      R Y G
      B P O
    `);
    expect(board.rows).toBe(2);
    expect(board.cols).toBe(3);
    expect(board.cells.map((b) => b?.color)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('id는 왼쪽 위부터 1, 2, 3 … 이고 nextId는 다음 번호', () => {
    const board = parseBoard(`
      R .
      . G
    `);
    expect(board.cells.map((b) => b?.id ?? null)).toEqual([1, null, null, 2]);
    expect(board.nextId).toBe(3);
  });

  it('특수 블록 표기를 읽는다', () => {
    const board = parseBoard('R- G| B* Y+ C');
    expect(board.cells).toEqual([
      { id: 1, color: 0, special: 'lineH' },
      { id: 2, color: 2, special: 'lineV' },
      { id: 3, color: 3, special: 'bomb' },
      { id: 4, color: 1, special: 'super' },
      { id: 5, color: null, special: 'color' },
    ]);
  });

  it('행마다 칸 수가 다르면 에러', () => {
    expect(() => parseBoard('R G\nR')).toThrow('1행');
  });

  it('모르는 표기는 에러', () => {
    expect(() => parseBoard('R X')).toThrow('"X"');
    expect(() => parseBoard('R R?')).toThrow('"R?"');
  });
});

describe('printBoard', () => {
  it('parseBoard의 역함수다', () => {
    const text = ['R  Y- G| .', 'B* C  P+ O'].join('\n');
    expect(printBoard(parseBoard(text))).toBe(text);
  });

  it('들여쓰기·공백이 달라도 같은 모양으로 출력한다', () => {
    const board = parseBoard(`
        R   G
      B    Y
    `);
    expect(printBoard(board)).toBe('R  G\nB  Y');
  });
});
