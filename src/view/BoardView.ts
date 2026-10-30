// core가 준 이벤트(steps)를 애니메이션으로 재생한다 (PLAN 6.1).
// 게임 상태를 직접 계산하지 않는다. 위치는 EventTracker로 이벤트만 따라간다.

import Phaser from 'phaser';
import { ANIM, VIEW } from '../config';
import type { Block, Board, GameEvent, Pos, SpecialKind } from '../core/types';
import { BlockSprite } from './BlockSprite';
import { EventTracker } from './eventTracker';
import { cellAt, cellCenter, type Layout } from './layout';
import { cascadeToLevel } from './fx/fxLevels';
import { removedFromMatch, type RemovedCell } from './fx/matchInfo';
import { ensureTextures, type Face } from './theme/textures';
import { tween } from './tween';

export interface BoardViewHooks {
  /** match 이벤트를 재생하기 시작할 때 동기로 부른다. 연출은 기다리지 않는다 */
  onMatch?(level: number, removed: readonly RemovedCell[]): void;
  /** activate 이벤트(특수 블록 발동)를 재생하기 시작할 때 동기로 부른다 */
  onActivate?(special: SpecialKind, at: Pos, cleared: readonly Pos[]): void;
}

export class BoardView {
  private readonly sprites = new Map<number, BlockSprite>();
  private readonly layer: Phaser.GameObjects.Container;
  private tracker: EventTracker;
  private readonly highlight: Phaser.GameObjects.Graphics;
  private selectedId: number | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    board: Board,
    private readonly layout: Layout,
    private readonly hooks: BoardViewHooks = {},
  ) {
    ensureTextures(scene);
    const { x, y, width, height } = layout;
    scene.add.rectangle(x, y, width, height, VIEW.boardBackground).setOrigin(0);

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
  }

  /** step을 순서대로 재생한다. 한 step 안의 이벤트는 동시에 재생한다 */
  async play(steps: readonly (readonly GameEvent[])[]): Promise<void> {
    for (const step of steps) {
      await Promise.all(step.map((event) => this.playEvent(event)));
    }
  }

  /** 모든 블록의 표정을 바꾼다. 사라지는 중인 블록은 건너뛴다 */
  setFaces(face: Face): void {
    for (const sprite of this.sprites.values()) {
      if (!sprite.removing) sprite.setFace(face);
    }
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
        return Promise.all(event.blocks.map(({ id }) => this.removeSprite(id))).then(
          () => undefined,
        );

      case 'fall':
        return Promise.all(
          event.moves.map(({ id, from, to }) =>
            this.moveTo(id, to, ANIM.fallPerCell * (to.r - from.r), 'Quad.easeIn', true),
          ),
        ).then(() => undefined);

      case 'refill':
        return Promise.all(
          event.blocks.map(({ block, at, dropFrom }) => {
            this.addSprite(block, { r: at.r - dropFrom, c: at.c });
            return this.moveTo(block.id, at, ANIM.refillPerCell * dropFrom, 'Quad.easeIn', true);
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

      case 'activate':
        this.hooks.onActivate?.(event.special, event.at, event.cleared);
        return Promise.resolve();

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

  private removeSprite(id: number): Promise<void> {
    const sprite = this.sprites.get(id);
    if (!sprite) return Promise.resolve();
    this.sprites.delete(id);
    sprite.removing = true;
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
