import Phaser from 'phaser';
import { GAME } from '../config';
import { createInitialState, resolveSwap } from '../core/engine';
import { findHint } from '../core/moves';
import type { GameState } from '../core/types';
import { BoardView } from '../view/BoardView';
import { createLayout } from '../view/layout';

/** 임시: 힌트 수를 자동으로 두며 애니메이션을 확인하는 데모 (W1-18에서 GameScene으로 바뀐다) */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.add
      .text(GAME.width / 2, 100, 'ddooby-pang (demo)', { fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5);

    let state: GameState = createInitialState({ rows: 8, cols: 8, colors: 5, seed: 1001 });
    const view = new BoardView(this, state.board, createLayout(8, 8));

    let turns = 0;
    const loop = async () => {
      const hint = findHint(state.board)!;
      const result = resolveSwap(state, hint.a, hint.b);
      await view.play(result.steps);
      state = result.state;
      turns++;
      const actual = view.spriteCells();
      const expected = state.board.cells.map((b, i) => `${Math.floor(i / 8)},${i % 8}=${b!.id}`);
      const mismatch = expected.filter((e) => {
        const [pos, id] = e.split('=');
        return actual.get(pos!) !== Number(id);
      });
      if (mismatch.length > 0 || actual.size !== 64) {
        console.error('[demo] view ≠ board', { turns, mismatch, sprites: actual.size });
      } else {
        console.log(`[demo] turn ${turns} ok`);
      }
      this.time.delayedCall(600, loop);
    };
    this.time.delayedCall(800, loop);
  }
}
