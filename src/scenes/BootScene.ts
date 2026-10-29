import Phaser from 'phaser';
import { GAME, VIEW } from '../config';
import { createInitialState } from '../core/engine';
import { BlockSprite } from '../view/BlockSprite';
import { cellCenter, createLayout } from '../view/layout';

/** 임시: 블록 미리보기 (W1-18에서 GameScene으로 바뀐다) */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.add
      .text(GAME.width / 2, 100, 'ddooby-pang', { fontSize: '48px', color: '#ffffff' })
      .setOrigin(0.5);

    const { board } = createInitialState({ rows: 8, cols: 8, colors: 6, seed: 1001 });
    const layout = createLayout(board.rows, board.cols);
    this.add
      .rectangle(layout.x, layout.y, layout.width, layout.height, VIEW.boardBackground)
      .setOrigin(0);

    board.cells.forEach((block, i) => {
      if (!block) return;
      const { x, y } = cellCenter(layout, { r: Math.floor(i / board.cols), c: i % board.cols });
      new BlockSprite(this, x, y, block, layout.cell);
    });

    // 특수 블록 표시 미리보기
    const specials = [
      { id: -1, color: 0, special: 'lineH' },
      { id: -2, color: 3, special: 'lineV' },
      { id: -3, color: 2, special: 'bomb' },
      { id: -4, color: 4, special: 'super' },
      { id: -5, color: null, special: 'color' },
    ] as const;
    specials.forEach((block, i) => {
      new BlockSprite(this, 160 + i * 100, layout.y + layout.height + 80, block, layout.cell);
    });
  }
}
