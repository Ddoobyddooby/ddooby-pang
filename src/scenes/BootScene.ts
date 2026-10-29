import Phaser from 'phaser';
import { GAME } from '../config';
import { createInitialState } from '../core/engine';
import { BoardView } from '../view/BoardView';
import { SwipeInput } from '../view/input';
import { createLayout } from '../view/layout';

/** 임시: 스와이프 입력 확인용 (W1-18에서 GameScene으로 바뀐다) */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const label = this.add
      .text(GAME.width / 2, 100, '블록을 밀어보세요', { fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5);

    const state = createInitialState({ rows: 8, cols: 8, colors: 5, seed: 1001 });
    const layout = createLayout(8, 8);
    new BoardView(this, state.board, layout);

    new SwipeInput(this, layout, (a, b) => {
      const text = `swap (${a.r},${a.c}) → (${b.r},${b.c})`;
      label.setText(text);
      console.log(`[input] ${text}`);
    });
  }
}
