// core가 준 이벤트(steps)를 애니메이션으로 재생한다 (PLAN 6.1).
// 게임 상태를 직접 계산하지 않는다. 위치는 EventTracker로 이벤트만 따라간다.

import Phaser from 'phaser';
import { ANIM, VIEW } from '../config';
import type { Block, Board, GameEvent, Pos } from '../core/types';
import { BlockSprite } from './BlockSprite';
import { EventTracker } from './eventTracker';
import { cellAt, cellCenter, type Layout } from './layout';
import { tween } from './tween';

export class BoardView {
  private readonly sprites = new Map<number, BlockSprite>();
  private readonly layer: Phaser.GameObjects.Container;
  private tracker: EventTracker;

  constructor(
    private readonly scene: Phaser.Scene,
    board: Board,
    private readonly layout: Layout,
  ) {
    const { x, y, width, height } = layout;
    scene.add.rectangle(x, y, width, height, VIEW.boardBackground).setOrigin(0);

    // 보드 밖(위쪽)에서 떨어지는 리필 블록이 HUD 위에 보이지 않게 가린다
    this.layer = scene.add.container(0, 0);
    const maskShape = scene.make.graphics({}, false);
    maskShape.fillStyle(0xffffff).fillRect(x, y, width, height);
    this.layer.setMask(maskShape.createGeometryMask());

    this.tracker = new EventTracker(board);
    board.cells.forEach((block, i) => {
      if (block) this.addSprite(block, { r: Math.floor(i / board.cols), c: i % board.cols });
    });
  }

  /** step을 순서대로 재생한다. 한 step 안의 이벤트는 동시에 재생한다 */
  async play(steps: readonly (readonly GameEvent[])[]): Promise<void> {
    for (const step of steps) {
      await Promise.all(step.map((event) => this.playEvent(event)));
    }
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
        return Promise.all([
          this.moveTo(idA!, event.b, ANIM.swap, 'Sine.easeInOut'),
          this.moveTo(idB!, event.a, ANIM.swap, 'Sine.easeInOut'),
        ]).then(() => undefined);

      case 'remove':
        return Promise.all(event.blocks.map(({ id }) => this.removeSprite(id))).then(
          () => undefined,
        );

      case 'fall':
        return Promise.all(
          event.moves.map(({ id, from, to }) =>
            this.moveTo(id, to, ANIM.fallPerCell * (to.r - from.r), 'Quad.easeIn'),
          ),
        ).then(() => undefined);

      case 'refill':
        return Promise.all(
          event.blocks.map(({ block, at, dropFrom }) => {
            this.addSprite(block, { r: at.r - dropFrom, c: at.c });
            return this.moveTo(block.id, at, ANIM.refillPerCell * dropFrom, 'Quad.easeIn');
          }),
        ).then(() => undefined);

      case 'shuffle':
        return this.playShuffle(event);

      case 'create':
        this.addSprite(event.block, event.at);
        return Promise.resolve();

      case 'match':
      case 'activate':
      case 'score':
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

  private moveTo(id: number, pos: Pos, duration: number, ease: string): Promise<void> {
    const sprite = this.sprites.get(id);
    if (!sprite) throw new Error(`스프라이트 ${id}가 없다`);
    const { x, y } = cellCenter(this.layout, pos);
    return tween(this.scene, { targets: sprite, x, y, duration, ease }).then(() => {
      sprite.setPosition(x, y); // 시간이 0이라 트윈을 건너뛴 경우에도 위치를 맞춘다
    });
  }

  private removeSprite(id: number): Promise<void> {
    const sprite = this.sprites.get(id);
    if (!sprite) return Promise.resolve();
    this.sprites.delete(id);
    return tween(this.scene, {
      targets: sprite,
      scale: 0,
      alpha: 0,
      duration: ANIM.remove,
      ease: 'Back.easeIn',
    }).then(() => sprite.destroy());
  }
}
