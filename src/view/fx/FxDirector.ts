// 연쇄 연출(파티클, 칭찬 문구, 흔들림, 웃음)을 재생한다. 기다리게 하지 않는다 (play 완료와 무관).
// 어떤 모드인지 모른다. GameScene이 BoardView의 onMatch에 연결해 준다.

import type Phaser from 'phaser';
import type { Layout } from '../layout';
import type { Face } from '../theme/textures';
import type { RemovedCell } from './matchInfo';

export class FxDirector {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: Layout,
    private readonly faces: { setFaces(face: Face): void },
  ) {}

  playMatch(level: number, removed: readonly RemovedCell[]): void {
    void [this.scene, this.layout, this.faces, level, removed]; // D-08, D-09에서 채운다
  }

  preview(level: number): void {
    void level; // D-11
  }
}
