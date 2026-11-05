// core가 준 이벤트(steps)를 애니메이션으로 재생한다 (PLAN 6.1).
// 게임 상태를 직접 계산하지 않는다. 위치는 EventTracker로 이벤트만 따라간다.

import Phaser from 'phaser';
import { ANIM, FX, OBSTACLE, VIEW } from '../config';
import type { Block, Board, GameEvent, Pos, SpecialKind } from '../core/types';
import { BlockSprite } from './BlockSprite';
import { ObstacleView } from './ObstacleView';
import { obstacleActions, obstacleDelay, refillStart, type ObstacleMap } from './obstacleState';
import { EventTracker } from './eventTracker';
import { cellAt, cellCenter, type Layout } from './layout';
import { activateDelay, flashDelay, removeDelays, transformDelay } from './fx/chainTimeline';
import { cascadeToLevel } from './fx/fxLevels';
import { removedFromMatch, type RemovedCell } from './fx/matchInfo';
import { ensureTextures, type Face } from './theme/textures';
import { tween } from './tween';

export interface BoardViewHooks {
  /** match 이벤트를 재생하기 시작할 때 동기로 부른다. 연출은 기다리지 않는다 */
  onMatch?(level: number, removed: readonly RemovedCell[]): void;
  /** activate 이벤트(특수 블록 발동)의 차례가 되면 부른다 (차례 0은 재생 시작 때 동기로, PLAN 6.13. 변신이 있으면 변신 뒤, 6.18) */
  onActivate?(special: SpecialKind, at: Pos, cleared: readonly Pos[]): void;
  /** transform 이벤트(같은 색 블록이 특수 블록이 됨)를 재생하기 시작할 때 동기로 부른다 (PLAN 6.18) */
  onTransform?(count: number): void;
  /** score 이벤트(delta > 0)를 재생하기 시작할 때 동기로 부른다. 팝업은 기다리지 않는다 */
  onScore?(delta: number, level: number, at: Pos): void;
}

export class BoardView {
  private readonly sprites = new Map<number, BlockSprite>();
  private readonly layer: Phaser.GameObjects.Container;
  private tracker: EventTracker;
  private readonly highlight: Phaser.GameObjects.Graphics;
  private selectedId: number | null = null;
  /** 힌트로 깜빡이는 블록 id (없으면 빈 배열) */
  private hintIds: number[] = [];
  /** 재생 중인 step의 블록 id → 제거를 시작할 ms (연쇄 차례, PLAN 6.13) */
  private removeAt = new Map<number, number>();
  /** 재생 중인 step의 발동이 기다릴 ms (변신 연출, PLAN 6.18) */
  private activateOffset = 0;
  /** 재생 중인 step (obstacle 연출 시작 시각 계산용) */
  private step: readonly GameEvent[] = [];
  private readonly obstacles: ObstacleView;

  constructor(
    private readonly scene: Phaser.Scene,
    board: Board,
    private readonly layout: Layout,
    private readonly hooks: BoardViewHooks = {},
  ) {
    ensureTextures(scene);
    const { x, y, width, height } = layout;
    // 크림 바탕 + 한 칸 걸러 진한 칸 + 칸 경계선 (A안 그림책)
    const cells = scene.add
      .graphics()
      .fillStyle(VIEW.boardBackground)
      .fillRect(x, y, width, height);
    cells.fillStyle(VIEW.cellAlt);
    for (let r = 0; r < layout.rows; r++) {
      for (let c = (r + 1) % 2; c < layout.cols; c += 2) {
        cells.fillRect(x + c * layout.cell, y + r * layout.cell, layout.cell, layout.cell);
      }
    }
    cells.lineStyle(2, VIEW.cellLine.color, VIEW.cellLine.alpha);
    for (let i = 1; i < layout.cols; i++)
      cells.lineBetween(x + i * layout.cell, y, x + i * layout.cell, y + height);
    for (let i = 1; i < layout.rows; i++)
      cells.lineBetween(x, y + i * layout.cell, x + width, y + i * layout.cell);

    // 젤리·얼음벽은 블록 아래
    this.obstacles = new ObstacleView(scene, board, layout);

    // 보드 밖(위쪽)에서 떨어지는 리필 블록이 HUD 위에 보이지 않게 가린다
    this.layer = scene.add.container(0, 0);
    const maskShape = scene.make.graphics({}, false);
    maskShape.fillStyle(0xffffff).fillRect(x, y, width, height);
    this.layer.setMask(maskShape.createGeometryMask());

    // 선택 표시는 블록 뒤에 깐다 (블록보다 먼저 layer에 넣는다)
    this.highlight = scene.add.graphics().setVisible(false);
    this.layer.add(this.highlight);

    this.tracker = new EventTracker(board);
    board.cells.forEach((block, i) => {
      if (block) this.addSprite(block, { r: Math.floor(i / board.cols), c: i % board.cols });
    });
    // 잠금은 블록 위
    this.obstacles.addLocks(board);
  }

  /** step을 순서대로 재생한다. 한 step 안의 이벤트는 동시에 재생한다 */
  async play(steps: readonly (readonly GameEvent[])[]): Promise<void> {
    for (const step of steps) {
      this.step = step;
      this.removeAt = removeDelays(step, ANIM.chainStep, ANIM.transform);
      this.activateOffset = transformDelay(step, ANIM.transform);
      await Promise.all(step.map((event) => this.playEvent(event)));
    }
  }

  /** 모든 블록의 표정을 바꾼다. 사라지는 중인 블록은 건너뛴다 */
  setFaces(face: Face): void {
    for (const sprite of this.sprites.values()) {
      if (!sprite.removing) sprite.setFace(face);
    }
  }

  /** 가능한 수의 두 칸을 깜빡인다 (scale만, 위치는 그대로). 재생 중이 아닐 때만 부른다 */
  showHint(a: Pos, b: Pos): void {
    this.hideHint();
    for (const pos of [a, b]) {
      const id = this.tracker.idAt(pos);
      if (id === undefined) continue;
      this.sprites.get(id)?.setHint(true);
      this.hintIds.push(id);
    }
  }

  /** 힌트를 끄고 원래 크기로. 그 사이 사라진 블록은 건너뛴다 */
  hideHint(): void {
    for (const id of this.hintIds) this.sprites.get(id)?.setHint(false);
    this.hintIds = [];
  }

  /** 탭으로 고른 칸을 표시한다. null이면 해제. 재생 중이 아닐 때만 부른다 */
  setSelected(pos: Pos | null): void {
    if (this.selectedId !== null) this.sprites.get(this.selectedId)?.setSelected(false);
    this.selectedId = pos ? (this.tracker.idAt(pos) ?? null) : null;
    this.highlight.clear().setVisible(pos !== null);
    if (!pos) return;
    this.sprites.get(this.selectedId ?? -1)?.setSelected(true);
    const { select } = VIEW;
    const size = this.layout.cell * select.size;
    const { x, y } = cellCenter(this.layout, pos);
    this.highlight
      .fillStyle(select.fill, select.fillAlpha)
      .fillRoundedRect(x - size / 2, y - size / 2, size, size, this.layout.cell * select.radius)
      .lineStyle(select.lineWidth, select.stroke)
      .strokeRoundedRect(x - size / 2, y - size / 2, size, size, this.layout.cell * select.radius);
  }

  /** 그 칸이 잠겨 있는가 (무효 입력 흔들림 판단용) */
  isLocked(pos: Pos): boolean {
    return this.obstacles.isLocked(pos);
  }

  /** 잠긴 칸을 밀었을 때: 자물쇠와 블록이 작게 흔들린다. 기다리지 않는다 */
  shakeLocked(pos: Pos): void {
    this.obstacles.shakeLock(pos);
    const sprite = this.sprites.get(this.tracker.idAt(pos) ?? -1);
    if (!sprite) return;
    const { dx, ms, repeat } = OBSTACLE.lockShake;
    const x = sprite.x;
    this.scene.tweens.killTweensOf(sprite);
    this.scene.tweens.add({
      targets: sprite,
      x: x + dx * this.layout.cell,
      duration: ms,
      yoyo: true,
      repeat,
      onComplete: () => sprite.setX(x),
    });
  }

  /** 디버그용: 지금 화면에 보이는 장애물 (보드 층과 대조) */
  obstacleCells(): ObstacleMap {
    return this.obstacles.state();
  }

  /** 디버그용: 스프라이트의 실제 화면 위치로 본 "r,c" → id */
  spriteCells(): Map<string, number> {
    const out = new Map<string, number>();
    for (const [id, sprite] of this.sprites) {
      const pos = cellAt(this.layout, sprite.x, sprite.y);
      if (pos) out.set(`${pos.r},${pos.c}`, id);
    }
    return out;
  }

  private playEvent(event: GameEvent): Promise<void> {
    // 위치 정보는 애니메이션을 시작하기 전에 즉시 갱신한다 (같은 step의 다음 이벤트가 쓸 수 있게)
    const idA = 'a' in event ? this.tracker.idAt(event.a) : undefined;
    const idB = 'b' in event ? this.tracker.idAt(event.b) : undefined;
    this.tracker.apply(event);

    switch (event.type) {
      case 'swap':
      case 'swapBack':
        this.sprites.get(idA!)?.pop(ANIM.swapPop, ANIM.swap);
        this.sprites.get(idB!)?.pop(ANIM.swapPop, ANIM.swap);
        return Promise.all([
          this.moveTo(idA!, event.b, ANIM.swap, 'Sine.easeInOut'),
          this.moveTo(idB!, event.a, ANIM.swap, 'Sine.easeInOut'),
        ]).then(() => undefined);

      case 'remove':
        return Promise.all(
          event.blocks.map(({ id }) => this.removeSprite(id, this.removeAt.get(id) ?? 0)),
        ).then(() => undefined);

      case 'fall':
        return Promise.all(
          event.moves.map(({ id, from, to }) =>
            this.moveTo(id, to, ANIM.fallPerCell * (to.r - from.r), 'Quad.easeIn', true),
          ),
        ).then(() => undefined);

      case 'refill':
        return Promise.all(
          event.blocks.map(({ block, at, dropFrom, spawnTop }) => {
            const start = refillStart(at, dropFrom, spawnTop);
            const sprite = this.addSprite(block, { r: start.row, c: at.c });
            let duration = ANIM.refillPerCell * (at.r - start.row);
            if (start.grow) {
              // 고정 칸 아래에서 작게 나타나 커지며 내려간다
              sprite.setScale(OBSTACLE.spawn.startScale);
              duration = Math.max(duration, OBSTACLE.spawn.growMs);
              void tween(this.scene, {
                targets: sprite,
                scale: 1,
                duration: OBSTACLE.spawn.growMs,
                ease: 'Back.easeOut',
              });
            }
            return this.moveTo(block.id, at, duration, 'Quad.easeIn', true);
          }),
        ).then(() => undefined);

      case 'shuffle':
        return this.playShuffle(event);

      case 'create':
        this.addSprite(event.block, event.at);
        return Promise.resolve();

      case 'match':
        this.hooks.onMatch?.(cascadeToLevel(event.cascade), removedFromMatch(event.groups));
        return Promise.resolve();

      case 'activate': {
        // 휘말린 특수 블록은 앞 차례에 번쩍·부풀고, 자기 차례에 발동한다. 블록 제거는 remove가 같은 시간표로 맞춘다
        const flashAt = flashDelay(event, ANIM.chainStep, this.activateOffset);
        const sprite = this.sprites.get(this.tracker.idAt(event.at) ?? -1);
        if (flashAt !== null && sprite) {
          const { scale, whiteMs } = FX.special.chainFlash;
          this.later(flashAt, () => sprite.flash(scale, ANIM.chainStep, whiteMs));
        }
        this.later(activateDelay(event, ANIM.chainStep, this.activateOffset), () =>
          this.hooks.onActivate?.(event.special, event.at, event.cleared),
        );
        return Promise.resolve();
      }

      case 'transform': {
        const { scale, whiteMs } = FX.special.transformFlash;
        for (const { block } of event.changes) {
          this.sprites.get(block.id)?.transformTo(block.special!, ANIM.transform, scale, whiteMs);
        }
        this.hooks.onTransform?.(event.changes.length);
        return Promise.resolve();
      }

      case 'obstacle':
        return Promise.all(
          obstacleActions(event).map((action) => {
            const delay = obstacleDelay(this.step, action, this.removeAt, OBSTACLE.hitOffset);
            if (action.op === 'release') {
              const sprite = this.sprites.get(this.tracker.idAt(action.at) ?? -1);
              this.later(delay, () =>
                sprite?.pop(OBSTACLE.lockRelease.blockPop, OBSTACLE.lockRelease.popMs),
              );
            }
            return this.obstacles.play(action, delay);
          }),
        ).then(() => undefined);

      case 'score':
        if (event.delta > 0)
          this.hooks.onScore?.(event.delta, cascadeToLevel(event.cascade), event.at);
        return Promise.resolve();
    }
  }

  private playShuffle(event: Extract<GameEvent, { type: 'shuffle' }>): Promise<void> {
    const keep = new Set(event.mapping.map((m) => m.block.id));
    const gone = [...this.sprites.keys()].filter((id) => !keep.has(id));
    const moves = event.mapping.map(({ block, to }) => {
      if (this.sprites.has(block.id))
        return this.moveTo(block.id, to, ANIM.shuffle, 'Back.easeInOut');
      const sprite = this.addSprite(block, to).setScale(0);
      return tween(this.scene, { targets: sprite, scale: 1, duration: ANIM.shuffle });
    });
    return Promise.all([...moves, ...gone.map((id) => this.removeSprite(id))]).then(
      () => undefined,
    );
  }

  private addSprite(block: Block, pos: Pos): BlockSprite {
    const { x, y } = cellCenter(this.layout, pos);
    const sprite = new BlockSprite(this.scene, x, y, block, this.layout.cell);
    this.layer.add(sprite);
    this.sprites.set(block.id, sprite);
    return sprite;
  }

  /** landing: 도착하는 순간 말랑하게 눌린다 (기다리지 않는다) */
  private moveTo(
    id: number,
    pos: Pos,
    duration: number,
    ease: string,
    landing = false,
  ): Promise<void> {
    const sprite = this.sprites.get(id);
    if (!sprite) throw new Error(`스프라이트 ${id}가 없다`);
    const { x, y } = cellCenter(this.layout, pos);
    return tween(this.scene, { targets: sprite, x, y, duration, ease }).then(() => {
      sprite.setPosition(x, y); // 시간이 0이라 트윈을 건너뛴 경우에도 위치를 맞춘다
      if (landing) sprite.squish();
    });
  }

  /** ms 뒤에 부른다. 0이면 바로 (씬이 멈추면 같이 멈춘다) */
  private later(ms: number, fn: () => void): void {
    if (ms > 0) this.scene.time.delayedCall(ms, fn);
    else fn();
  }

  /** delay: 연쇄 차례를 기다렸다가 터진다 (그동안 그 칸에 그대로 보인다) */
  private removeSprite(id: number, delay = 0): Promise<void> {
    const sprite = this.sprites.get(id);
    if (!sprite) return Promise.resolve();
    this.sprites.delete(id);
    sprite.removing = true;
    if (delay > 0) {
      return new Promise<void>((resolve) => this.scene.time.delayedCall(delay, resolve)).then(() =>
        this.shrinkAway(sprite),
      );
    }
    return this.shrinkAway(sprite);
  }

  private shrinkAway(sprite: BlockSprite): Promise<void> {
    this.scene.tweens.killTweensOf(sprite); // 착지 눌림·스왑 팝이 남아 있으면 끊고 이어서 줄어든다
    sprite.setFace('squint'); // 터지기 직전 `><`
    return tween(this.scene, {
      targets: sprite,
      scale: 0,
      alpha: 0,
      delay: ANIM.squintHold,
      duration: ANIM.remove,
      ease: 'Back.easeIn',
    }).then(() => {
      this.scene.tweens.killTweensOf(sprite);
      sprite.destroy();
    });
  }
}
