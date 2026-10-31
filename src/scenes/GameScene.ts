// GameScene: 보드 표시 + 입력 + resolve + 애니메이션 재생 + 모드(타임어택 또는 스토리) + HUD.
// 시작 데이터: { mode: 'timeattack' } | { mode: 'story', stageId } (없으면 타임어택).
// 매 프레임 mode.tick, 스왑 전에 mode.canInput, 재생이 끝난 뒤 mode.isOver면 결과 화면('Result')으로 간다.
// 화면 배치는 screenLayout(this.scale.height). 폭이 720보다 넓은 화면은 카메라로 가운데에 맞춘다.
//
// URL 옵션 (개발용)
//   ?seed=1234  같은 시작 보드 재현 (패널 구석에 seed가 표시된다)
//   ?demo       힌트 수를 자동으로 둔다 (시간이 끝나면 결과 화면으로)
//   ?time=15    (개발 모드) 제한 시간을 15초로 줄인다 (없으면 stages/timeattack.json의 timeLimit)
//   ?specials   (개발 모드) 시작 보드에 특수 블록 5종을 하나씩 놓는다

import Phaser from 'phaser';
import { GAME } from '../config';
import { createInitialState, resolveSwap } from '../core/engine';
import { findHint } from '../core/moves';
import type { GameState, Pos, SpecialKind } from '../core/types';
import { BoardView, type BoardViewHooks } from '../view/BoardView';
import { Hud } from '../view/Hud';
import { StoryPanel } from '../view/StoryPanel';
import { TimePanel } from '../view/TimePanel';
import { FxDirector } from '../view/fx/FxDirector';
import { BoardInput } from '../view/input';
import { createLayout, screenLayout } from '../view/layout';
import { addHills } from '../view/theme/Hills';
import { applyModeResult } from '../storage/progress';
import { commitSave, getSave } from './saveRegistry';
import type { GameData } from './sceneData';
import { getStages } from './stageRegistry';
import type { GameMode } from '../modes/GameMode';
import { StoryMode } from '../modes/StoryMode';
import { TimeAttackMode } from '../modes/TimeAttackMode';
import { Background } from '../view/theme/Background';
import { drawBoardFrame } from '../view/theme/BoardFrame';

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
  private startData: GameData = { mode: 'timeattack' };
  private state!: GameState;
  private view!: BoardView;
  private boardInput!: BoardInput;
  private hud!: Hud;
  private mode!: GameMode;
  /** 모드별 패널과 모드 객체 (둘 중 하나만 있다) */
  private timePanel?: TimePanel;
  private storyPanel?: StoryPanel;
  private storyMode?: StoryMode;
  private busy = false;
  private moves = 0;
  private seed = 0;
  private timeLimitMs = 0;
  /** 결과 화면으로 넘어갔는지 (한 번만) */
  private finished = false;

  constructor() {
    super('Game');
  }

  init(data?: GameData): void {
    this.startData = data?.mode === 'story' ? data : { mode: 'timeattack' };
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    const stages = getStages(this.registry);
    const stage =
      this.startData.mode === 'story' ? stages.story[this.startData.stageId - 1] : undefined;
    if (this.startData.mode === 'story' && !stage) {
      throw new Error(`스테이지 ${this.startData.stageId}가 없다`);
    }
    // 보드 모양과 seed는 스테이지(스토리) 또는 timeattack.json(타임어택)에서 온다
    const setting = stage ?? stages.timeattack;
    this.seed = Number(params.get('seed')) || setting.seed || Date.now() % 1_000_000;
    this.storyMode = undefined;
    this.timePanel = undefined;
    this.storyPanel = undefined;
    this.moves = 0;
    this.busy = false;
    this.finished = false;
    if (stage) {
      this.storyMode = new StoryMode(stage); // 스토리는 시간 제한이 없다
      this.mode = this.storyMode;
    } else {
      const time = Number(params.get('time'));
      // DEV의 ?time=N(초)이 JSON 값보다 먼저다
      this.timeLimitMs =
        import.meta.env.DEV && time > 0 ? time * 1000 : stages.timeattack.timeLimit * 1000;
      this.mode = new TimeAttackMode({
        bestScore: getSave(this.registry).timeattack.bestScore,
        timeLimitMs: this.timeLimitMs,
      });
    }

    this.state = createInitialState({
      rows: setting.rows,
      cols: setting.cols,
      colors: setting.colors,
      seed: this.seed,
    });
    if (import.meta.env.DEV && params.has('specials')) this.placeSpecialSamples();
    const { width, height } = this.scale;
    this.cameras.main.setScroll(-(width - GAME.width) / 2, 0); // 넓은 화면에서 가운데 맞춤
    const screen = screenLayout(height);
    const layout = createLayout(setting.rows, setting.cols, screen.board);
    new Background(this);
    addHills(this, width, height);
    drawBoardFrame(this, layout);
    const hooks: BoardViewHooks = {}; // FxDirector가 BoardView를 필요로 해서 알림 연결은 나중에 채운다
    this.view = new BoardView(this, this.state.board, layout, hooks);
    const fx = new FxDirector(this, layout, this.view);
    hooks.onMatch = (level, removed) => fx.playMatch(level, removed);
    hooks.onActivate = (special, at, cleared) => fx.playActivate(special, at, cleared);
    hooks.onScore = (delta, level, at) => fx.playScore(delta, level, at);

    this.hud = new Hud(this, 'Ddooby-Pang', screen);
    if (import.meta.env.DEV) this.hud.setSeed(this.seed);
    if (stage && this.storyMode) {
      this.storyPanel = new StoryPanel(this, screen, this.storyMode.goalProgress());
    } else {
      this.timePanel = new TimePanel(this, screen);
    }
    this.updateHud();

    this.boardInput = new BoardInput(
      this,
      layout,
      (a, b) => void this.trySwap(a, b),
      (pos) => this.view.setSelected(pos),
    );

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

  override update(_time: number, delta: number): void {
    if (this.finished) return;
    this.mode.tick(delta);
    this.updateHud();
    // 시간이 0이 되면 입력을 막는다 (재생 중이면 setBusy가 이미 막고 있고, 끝난 뒤 trySwap이 결과로 보낸다)
    if (!this.mode.canInput()) this.boardInput.enabled = false;
    if (this.mode.isOver() && !this.busy) this.finish();
  }

  /** 재생이 끝난 상태에서 끝났으면(시간·이동·미션) 결과를 저장하고 결과 화면으로 */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const result = this.mode.result();
    // 결과 화면이 열린 스테이지를 보고 버튼을 정하므로 registry 갱신(commitSave)이 Result 시작보다 먼저다
    const stageCount = getStages(this.registry).story.length;
    commitSave(this.registry, applyModeResult(getSave(this.registry), result, stageCount));
    this.scene.start('Result', { result });
  }

  private async trySwap(a: Pos, b: Pos): Promise<void> {
    if (this.busy || this.finished || !this.mode.canInput()) return;
    this.setBusy(true);

    const result = resolveSwap(this.state, a, b);
    await this.view.play(result.steps);
    this.state = result.state;
    if (result.valid) {
      this.moves++;
      this.mode.onResolve(result);
      this.updateHud();
    }
    if (import.meta.env.DEV) this.checkViewMatchesBoard();

    this.setBusy(false);
    if (this.mode.isOver()) this.finish();
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.boardInput.enabled = !busy && this.mode.canInput(); // 애니메이션 중·시간 종료 후 입력 차단
  }

  private updateHud(): void {
    if (this.storyMode && this.storyPanel) {
      this.storyPanel.setProgress(this.storyMode.goalProgress(), this.storyMode.score());
      this.storyPanel.setMoves(this.storyMode.movesLeft());
    } else if (this.mode instanceof TimeAttackMode && this.timePanel) {
      this.timePanel.setScore(this.mode.score());
      this.timePanel.setTime(this.mode.timeLeftMs(), this.timeLimitMs);
    }
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
      score: () => this.mode.score(),
      seed: this.seed,
    };
  }
}
