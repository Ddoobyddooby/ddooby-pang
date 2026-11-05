// 장애물 그림을 칸 위치에 놓고 obstacle 이벤트(피해·해제)를 재생한다 (PLAN2 5.5).
// 젤리·얼음벽은 블록 아래(under), 잠금은 블록 위(over)에 겹친다. 게임 상태는 계산하지 않고
// 처음 보드의 층 + 이벤트만 따라간다. 그림은 theme/obstacleArt.ts, 크기·시간은 config.ts OBSTACLE.

import Phaser from 'phaser';
import { OBSTACLE } from '../config';
import type { Board, Pos } from '../core/types';
import { posKey, shakeTween, type ObstacleAction, type ObstacleMap } from './obstacleState';
import { cellCenter, type Layout } from './layout';
import {
  ensureObstacleTextures,
  frostKey,
  jellyKey,
  LOCK_KEY,
  SHARD_KEY,
} from './theme/obstacleArt';
import { tween } from './tween';

const FROST_SHARD = 0xcdeeff;
const LOCK_SHARD = 0xffd45e;

export class ObstacleView {
  private readonly under: Phaser.GameObjects.Container;
  private over!: Phaser.GameObjects.Container;
  private readonly jelly = new Map<string, Phaser.GameObjects.Image>();
  private readonly frost = new Map<string, Phaser.GameObjects.Image>();
  private readonly locks = new Map<string, Phaser.GameObjects.Image>();

  /** 젤리·얼음벽을 깐다 (블록 층보다 먼저 만든다). 잠금은 addLocks로 블록 층 뒤에 얹는다 */
  constructor(
    private readonly scene: Phaser.Scene,
    board: Board,
    private readonly layout: Layout,
  ) {
    ensureObstacleTextures(scene);
    this.under = scene.add.container(0, 0);
    this.forEachLayer(board, (pos, layer) => {
      if (layer.jelly)
        this.jelly.set(
          posKey(pos),
          this.place(this.under, pos, jellyKey(layer.jelly), OBSTACLE.size.jelly),
        );
      if (layer.frost)
        this.frost.set(
          posKey(pos),
          this.place(this.under, pos, frostKey(layer.frost), OBSTACLE.size.frost),
        );
    });
  }

  /** 잠금을 블록 층 위에 얹는다 (BoardView가 블록 층을 만든 뒤에 부른다) */
  addLocks(board: Board): void {
    this.over = this.scene.add.container(0, 0);
    this.forEachLayer(board, (pos, layer) => {
      if (layer.lock) this.locks.set(posKey(pos), this.lockImage(pos));
    });
  }

  isLocked(pos: Pos): boolean {
    return this.locks.has(posKey(pos));
  }

  /** 지금 화면에 보이는 장애물 (DEV view ↔ board 대조용) */
  state(): ObstacleMap {
    const out: ObstacleMap = new Map();
    const cell = (key: string) => out.get(key) ?? out.set(key, {}).get(key)!;
    for (const key of this.locks.keys()) cell(key).lock = true;
    for (const [key, img] of this.frost) cell(key).frost = img.getData('hp') as number;
    for (const [key, img] of this.jelly) cell(key).jelly = img.getData('hp') as number;
    return out;
  }

  /** 잠긴 칸을 밀었을 때 자물쇠가 작게 흔들린다 (블록 흔들림은 BoardView). 기다리지 않는다 */
  shakeLock(pos: Pos): void {
    const img = this.locks.get(posKey(pos));
    if (!img) return;
    this.scene.tweens.killTweensOf(img);
    const x = cellCenter(this.layout, pos).x;
    img.setX(x);
    this.scene.tweens.add({
      targets: img,
      ...shakeTween(x, this.layout.cell),
      onComplete: () => img.setX(x),
    });
  }

  /** 피해·해제를 delay ms 뒤에 재생한다. 연출이 끝나면 resolve */
  async play(action: ObstacleAction, delay: number): Promise<void> {
    if (delay > 0)
      await new Promise<void>((resolve) => this.scene.time.delayedCall(delay, resolve));
    switch (action.kind) {
      case 'lock':
        return this.releaseLock(action.at);
      case 'frost':
        return action.op === 'clear'
          ? this.breakFrost(action.at)
          : this.hitFrost(action.at, action.hp);
      case 'jelly':
        return action.op === 'clear'
          ? this.clearJelly(action.at)
          : this.hitJelly(action.at, action.hp);
    }
  }

  private async releaseLock(pos: Pos): Promise<void> {
    const key = posKey(pos);
    const img = this.locks.get(key);
    if (!img) return;
    this.locks.delete(key);
    const { ms, rise, fall, spin } = OBSTACLE.lockRelease;
    const cell = this.layout.cell;
    this.burst(pos, OBSTACLE.frostHit.shards, LOCK_SHARD);
    // 위로 튕기고(rise) 떨어지며(fall) 돌고 사라진다
    const y = img.y;
    this.scene.tweens.add({
      targets: img,
      y: y - rise * cell,
      duration: ms * 0.4,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: img,
      y: y + fall * cell * 0.3,
      delay: ms * 0.4,
      duration: ms * 0.6,
      ease: 'Quad.easeIn',
    });
    await tween(this.scene, {
      targets: img,
      angle: spin,
      alpha: 0,
      scale: img.scale * 1.2,
      duration: ms,
      ease: 'Sine.easeIn',
    });
    img.destroy();
  }

  private async hitFrost(pos: Pos, hp: number): Promise<void> {
    const img = this.frost.get(posKey(pos));
    if (!img) return;
    img.setTexture(frostKey(hp)).setData('hp', hp);
    this.burst(pos, OBSTACLE.frostHit.shards, FROST_SHARD);
    await this.pulse(img, OBSTACLE.frostHit.pulse, OBSTACLE.frostHit.ms);
  }

  private async breakFrost(pos: Pos): Promise<void> {
    const key = posKey(pos);
    const img = this.frost.get(key);
    if (!img) return;
    this.frost.delete(key);
    this.burst(pos, OBSTACLE.frostBreak.shards, FROST_SHARD);
    await tween(this.scene, {
      targets: img,
      scale: img.scale * 1.15,
      alpha: 0,
      duration: OBSTACLE.frostBreak.ms,
      ease: 'Quad.easeOut',
    });
    img.destroy();
  }

  private async hitJelly(pos: Pos, hp: number): Promise<void> {
    const img = this.jelly.get(posKey(pos));
    if (!img) return;
    img.setTexture(jellyKey(hp)).setData('hp', hp);
    await this.pulse(img, OBSTACLE.jellyHit.dip, OBSTACLE.jellyHit.ms);
  }

  private async clearJelly(pos: Pos): Promise<void> {
    const key = posKey(pos);
    const img = this.jelly.get(key);
    if (!img) return;
    this.jelly.delete(key);
    await tween(this.scene, {
      targets: img,
      scale: img.scale * OBSTACLE.jellyHit.dip,
      alpha: 0,
      duration: OBSTACLE.jellyGone.ms,
      ease: 'Back.easeIn',
    });
    img.destroy();
  }

  /** 지금 크기의 scale배까지 갔다 돌아온다 (duration 전체) */
  private pulse(img: Phaser.GameObjects.Image, scale: number, duration: number): Promise<void> {
    const base = img.scale;
    this.scene.tweens.killTweensOf(img);
    return tween(this.scene, {
      targets: img,
      scale: base * scale,
      duration: duration / 2,
      yoyo: true,
      ease: 'Sine.easeOut',
    }).then(() => {
      img.setScale(base);
    });
  }

  /** 조각이 사방으로 튀며 떨어지고 사라진다. 각도는 고르게 나눠 같은 입력이면 같은 모양 */
  private burst(pos: Pos, count: number, tint: number): void {
    const { x, y } = cellCenter(this.layout, pos);
    const { size, dist, ms } = OBSTACLE.shard;
    const cell = this.layout.cell;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + pos.r + pos.c;
      const shard = this.scene.add
        .image(x, y, SHARD_KEY)
        .setTint(tint)
        .setDisplaySize(size * cell, size * cell)
        .setAngle((i * 47) % 360);
      this.over.add(shard);
      const reach = dist * cell * (0.6 + 0.4 * ((i % 3) / 2));
      this.scene.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * reach,
        y: y + Math.sin(angle) * reach + cell * 0.25,
        angle: shard.angle + 120,
        alpha: 0,
        scale: 0.3 * shard.scale,
        duration: ms,
        ease: 'Quad.easeOut',
        onComplete: () => shard.destroy(),
      });
    }
  }

  private lockImage(pos: Pos): Phaser.GameObjects.Image {
    const img = this.place(this.over, pos, LOCK_KEY, OBSTACLE.size.lock);
    return img;
  }

  /** 칸 가운데에 size(칸 대비)로 놓은 이미지. hp는 getData('hp')로 읽는다 */
  private place(
    parent: Phaser.GameObjects.Container,
    pos: Pos,
    key: string,
    size: number,
  ): Phaser.GameObjects.Image {
    const { x, y } = cellCenter(this.layout, pos);
    const px = this.layout.cell * size;
    const hp = /-(\d)(-|$)/.exec(key)?.[1];
    const img = this.scene.add.image(x, y, key).setDisplaySize(px, px);
    if (hp) img.setData('hp', Number(hp));
    parent.add(img);
    return img;
  }

  private forEachLayer(
    board: Board,
    fn: (pos: Pos, layer: NonNullable<NonNullable<Board['layers']>[number]>) => void,
  ): void {
    board.layers?.forEach((layer, i) => {
      if (layer) fn({ r: Math.floor(i / board.cols), c: i % board.cols }, layer);
    });
  }
}
