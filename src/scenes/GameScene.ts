// 임시 GameScene (W1-18): 보드 표시 + 스와이프 입력 + resolve + 애니메이션 재생.
// 모드(이동 제한, 타이머), 점수, HUD는 2~3주차에 붙인다.
//
// URL 옵션 (개발용)
//   ?seed=1234  같은 시작 보드 재현 (화면 위에 seed가 표시된다)
//   ?demo       힌트 수를 자동으로 둔다
//   ?specials   (개발 모드) 시작 보드에 특수 블록 5종을 하나씩 놓는다

import Phaser from 'phaser';
import { BOARD } from '../config';
import { createInitialState, resolveSwap } from '../core/engine';
import { findHint } from '../core/moves';
import type { GameState, Pos, SpecialKind } from '../core/types';
import { BoardView, type BoardViewHooks } from '../view/BoardView';
import { Hud } from '../view/Hud';
import { FxDirector } from '../view/fx/FxDirector';
import { SwipeInput } from '../view/input';
import { createLayout } from '../view/layout';
import { Background } from '../view/theme/Background';
import { drawBoardFrame } from '../view/theme/BoardFrame';

const COLORS = 5;

/** 개발 모드 키 → 발동 연출 미리보기 */
const SPECIAL_PREVIEW_KEYS: Record<string, SpecialKind> = {
  q: 'lineH',
  w: 'lineV',
  e: 'bomb',
  r: 'super',
  t: 'color',
};

/** ?specials: 특수 블록을 놓을 칸 */
const SPECIAL_SAMPLES: [Pos, SpecialKind][] = [
  [{ r: 1, c: 1 }, 'lineH'],
  [{ r: 1, c: 6 }, 'lineV'],
  [{ r: 6, c: 1 }, 'bomb'],
  [{ r: 6, c: 6 }, 'super'],
  [{ r: 3, c: 3 }, 'color'],
];

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private view!: BoardView;
  private swipe!: SwipeInput;
  private hud!: Hud;
  private busy = false;
  private moves = 0;
  /** 누적 점수. HUD 표시는 W2-11, 지금은 DEV 확인용으로 __ddooby에만 노출 */
  private score = 0;
  private seed = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    this.seed = Number(params.get('seed')) || Date.now() % 1_000_000;
    this.moves = 0;
    this.score = 0;
    this.busy = false;

    this.state = createInitialState({
      rows: BOARD.rows,
      cols: BOARD.cols,
      colors: COLORS,
      seed: this.seed,
    });
    if (import.meta.env.DEV && params.has('specials')) this.placeSpecialSamples();
    const layout = createLayout(BOARD.rows, BOARD.cols);
    new Background(this);
    drawBoardFrame(this, layout);
    const hooks: BoardViewHooks = {}; // FxDirector가 BoardView를 필요로 해서 알림 연결은 나중에 채운다
    this.view = new BoardView(this, this.state.board, layout, hooks);
    const fx = new FxDirector(this, layout, this.view);
    hooks.onMatch = (level, removed) => fx.playMatch(level, removed);
    hooks.onActivate = (special, at, cleared) => fx.playActivate(special, at, cleared);

    this.hud = new Hud(this, 'Ddooby-Pang');
    this.updateInfo();

    this.swipe = new SwipeInput(this, layout, (a, b) => void this.trySwap(a, b));

    if (params.has('demo')) this.time.delayedCall(800, () => void this.demoLoop());
    if (import.meta.env.DEV) {
      this.exposeDebug();
      // 키 1~5: 그 연쇄 단계의 연출 미리보기, Q W E R T: 특수 블록 발동 연출 미리보기
      this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
        const n = Number(e.key);
        if (n >= 1 && n <= 5) fx.preview(n);
        const special = SPECIAL_PREVIEW_KEYS[e.key.toLowerCase()];
        if (special) fx.previewSpecial(special);
      });
    }
  }

  /**
   * 개발용: 시작 보드의 몇 칸을 같은 색의 특수 블록으로 바꾼다 (무지개는 색 없음).
   * 색이 같거나 없어지기만 하므로 시작 매치 0은 유지되고, 무지개 블록이 있어 가능한 수도 있다
   */
  private placeSpecialSamples(): void {
    const { board } = this.state;
    const cells = board.cells.slice();
    for (const [{ r, c }, special] of SPECIAL_SAMPLES) {
      const i = r * board.cols + c;
      const block = cells[i]!;
      cells[i] = { id: block.id, color: special === 'color' ? null : block.color, special };
    }
    this.state = { ...this.state, board: { ...board, cells } };
  }

  private async trySwap(a: Pos, b: Pos): Promise<void> {
    if (this.busy) return;
    this.setBusy(true);

    const result = resolveSwap(this.state, a, b);
    await this.view.play(result.steps);
    this.state = result.state;
    if (result.valid) {
      this.moves++;
      this.score += result.scoreDelta;
      const cascades = result.steps.flat().filter((e) => e.type === 'match').length;
      this.updateInfo(cascades);
    }
    if (import.meta.env.DEV) this.checkViewMatchesBoard();

    this.setBusy(false);
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.swipe.enabled = !busy; // 애니메이션 중 입력 차단
  }

  private updateInfo(lastCascades = 0): void {
    const combo = lastCascades > 1 ? ` · 연쇄 x${lastCascades}` : '';
    this.hud.setInfo(`seed ${this.seed} · 이동 ${this.moves}${combo}`);
  }

  private async demoLoop(): Promise<void> {
    if (!this.scene.isActive()) return;
    const hint = findHint(this.state.board);
    if (hint) await this.trySwap(hint.a, hint.b);
    this.time.delayedCall(600, () => void this.demoLoop());
  }

  /** 개발 모드: 스프라이트의 실제 위치가 core 보드와 같은지 매 턴 확인 (PLAN 10절) */
  private checkViewMatchesBoard(): void {
    const actual = this.view.spriteCells();
    const { board } = this.state;
    const wrong: string[] = [];
    board.cells.forEach((block, i) => {
      const key = `${Math.floor(i / board.cols)},${i % board.cols}`;
      if (actual.get(key) !== block?.id)
        wrong.push(`${key}: view=${actual.get(key)} board=${block?.id}`);
    });
    if (wrong.length > 0 || actual.size !== board.cells.length) {
      console.error('[game] view ≠ board', {
        seed: this.seed,
        moves: this.moves,
        wrong,
        sprites: actual.size,
      });
    }
  }

  private exposeDebug(): void {
    (window as unknown as { __ddooby?: unknown }).__ddooby = {
      state: () => this.state,
      busy: () => this.busy,
      moves: () => this.moves,
      score: () => this.score,
      seed: this.seed,
    };
  }
}
