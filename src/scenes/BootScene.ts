import Phaser from 'phaser';
import { THEME } from '../config';

/** 글꼴이 늦거나 실패해도 게임은 이 시간 안에 시작한다 (오프라인, 느린 휴대폰) */
const FONT_TIMEOUT_MS = 2000;

/** 에셋·데이터 로드 자리 (3주차에 스테이지 JSON, 저장 데이터 로드). 지금은 글꼴만 기다린다 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    void this.loadFont().then(() => this.scene.start('Game'));
  }

  private async loadFont(): Promise<void> {
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS));
    const load = document.fonts.load(`48px ${THEME.font}`).then(
      () => undefined,
      () => undefined, // 실패해도 기본 글꼴로 시작
    );
    await Promise.race([load, timeout]);
  }
}
