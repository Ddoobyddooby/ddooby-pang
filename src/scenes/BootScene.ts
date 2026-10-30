import Phaser from 'phaser';
import { THEME } from '../config';
import { LocalStorageAdapter } from '../storage/progress';
import { previewResult } from './resultText';
import { putSave } from './saveRegistry';

/** 글꼴이 늦거나 실패해도 게임은 이 시간 안에 시작한다 (오프라인, 느린 휴대폰) */
const FONT_TIMEOUT_MS = 2000;

/** 에셋·데이터 로드 자리 (3주차에 스테이지 JSON, 저장 데이터 로드). 지금은 글꼴만 기다린다 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    void Promise.all([this.loadFont(), this.loadSave()]).then(() => {
      // DEV 미리보기: ?result=N(&best=M)이면 게임 대신 결과 화면을 바로 띄운다
      const preview = import.meta.env.DEV ? previewResult(window.location.search) : null;
      if (preview) this.scene.start('Result', { result: preview });
      else this.scene.start('Game');
    });
  }

  /** 저장 데이터를 한 번 불러와 registry에 둔다. localStorage는 여기서만 만진다 */
  private async loadSave(): Promise<void> {
    let store: Storage | undefined;
    try {
      store = window.localStorage; // 시크릿 모드 등에서는 접근만으로 throw할 수 있다
    } catch {
      store = undefined;
    }
    const storage = new LocalStorageAdapter(
      store ?? { getItem: () => null, setItem: () => undefined },
    );
    putSave(this.registry, storage, await storage.load());
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
