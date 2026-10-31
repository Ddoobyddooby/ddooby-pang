import Phaser from 'phaser';
import { SOUND, THEME } from '../config';
import { loadStages, type StageData } from '../data/stageLoader';
import { LocalStorageAdapter } from '../storage/progress';
import { Sfx, sfxKey, type SfxName } from '../view/Sfx';
import { bootRoute, devUnlock } from './bootRoute';
import { commitSave, getSave, putSave } from './saveRegistry';
import { putStages } from './stageRegistry';

/** 글꼴이 늦거나 실패해도 게임은 이 시간 안에 시작한다 (오프라인, 느린 휴대폰) */
const FONT_TIMEOUT_MS = 2000;

/** 글꼴·저장 데이터·스테이지 JSON을 불러온다. 스테이지가 잘못되면 게임을 시작하지 않고 에러를 보여 준다 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  /** 효과음을 미리 읽는다. 실패한 파일은 캐시에 없을 뿐이고 Sfx가 조용히 넘어간다 */
  preload(): void {
    this.load.on('loaderror', (file: Phaser.Loader.File) =>
      console.warn('[boot] 효과음 로드 실패, 소리 없이 진행', file.key),
    );
    for (const [name, { file }] of Object.entries(SOUND.effects)) {
      this.load.audio(sfxKey(name as SfxName), `audio/${file}`);
    }
  }

  create(): void {
    const stages = loadStages().then(
      (data): StageData | Error => data,
      (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
    );
    void Promise.all([this.loadFont(), this.loadSave(), stages]).then(([, , result]) => {
      if (result instanceof Error) {
        this.showError(result.message);
        return;
      }
      putStages(this.registry, result);
      // DEV ?unlock=N: 열린 스테이지를 N으로 바꿔 저장한다 (지도 확인용, 되돌리려면 ?unlock=1)
      const unlock = devUnlock(window.location.search, import.meta.env.DEV);
      if (unlock !== null) {
        const save = getSave(this.registry);
        commitSave(this.registry, { ...save, story: { ...save.story, unlocked: unlock } });
      }
      // 기본은 메뉴. 개발 주소(?demo, ?stage=N, ?result=N 등)는 해당 화면으로 바로 (bootRoute.ts)
      const route = bootRoute(window.location.search, import.meta.env.DEV);
      if (route.scene === 'Menu') this.scene.start('Menu');
      else this.scene.start(route.scene, route.data);
    });
  }

  /** 조용히 넘어가지 않는다: 메시지 전체를 화면에 보여 준다 */
  private showError(message: string): void {
    console.error('[boot]', message);
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, `데이터를 불러오지 못했어요\n\n${message}`, {
        fontFamily: THEME.font,
        fontSize: '32px',
        color: THEME.info.warn,
        align: 'center',
        wordWrap: { width: width - 80, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
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
    const save = await storage.load();
    putSave(this.registry, storage, save);
    new Sfx(this).setMuted(save.settings.muted); // 게임 전체 음소거 (모든 씬이 따른다)
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
