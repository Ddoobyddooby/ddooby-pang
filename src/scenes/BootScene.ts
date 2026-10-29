import Phaser from 'phaser';
import { GAME } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.add
      .text(GAME.width / 2, GAME.height / 2, 'ddooby-pang', { fontSize: '48px', color: '#ffffff' })
      .setOrigin(0.5);
  }
}
