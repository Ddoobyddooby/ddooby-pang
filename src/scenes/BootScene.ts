import Phaser from 'phaser';

/** 에셋·데이터 로드 자리 (3주차에 스테이지 JSON, 저장 데이터 로드). 지금은 바로 게임으로 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.scene.start('Game');
  }
}
