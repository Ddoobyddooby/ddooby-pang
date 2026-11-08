import Phaser from 'phaser';
import { DECOR, SOUND, THEME } from '../config';
import { loadStages, type StageData } from '../data/stageLoader';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
  CapacitorPreferencesStorage,
  LocalStorageAdapter,
  continueUnlock,
  type SaveStorage,
} from '../storage/progress';
import { ensureAccount } from '../online';
import { Music, musicKey, musicUrls } from '../view/Music';
import { Sfx, sfxKey, type SfxName } from '../view/Sfx';
import { RIBBON_KEY } from '../view/Hud';
import { blockArtKey } from '../view/theme/textures';
import { backgroundKey, devTheme, setActiveTheme, THEMES } from '../view/theme/themes';
import { registerBackButton } from './backButton';
import { bootRoute, devUnlock } from './bootRoute';
import { commitSave, getSave, putSave } from './saveRegistry';
import { putDevStage, putStages } from './stageRegistry';

/** 글꼴이 늦거나 실패해도 게임은 이 시간 안에 시작한다 (오프라인, 느린 휴대폰) */
const FONT_TIMEOUT_MS = 2000;

/** 글꼴·저장 데이터·스테이지 JSON을 불러온다. 스테이지가 잘못되면 게임을 시작하지 않고 에러를 보여 준다 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  /**
   * 효과음, 메뉴 곡, 게임 배경을 미리 읽는다. 게임 곡 둘은 메뉴가 뜬 뒤 뒤에서 읽는다 (첫 화면이 늦어지지 않게).
   * 실패한 파일은 캐시에 없을 뿐이고 Sfx·Music이 조용히 넘어간다
   */
  preload(): void {
    this.load.on('loaderror', (file: Phaser.Loader.File) =>
      console.warn('[boot] 파일 로드 실패, 없이 진행', file.key),
    );
    // 모든 테마의 배경 1장 + 블록 몸통 7장. 배경이 실패하면 코드로 그리는 하늘 장식으로, 블록이 실패하면 코드 도형으로 대신한다
    for (const theme of THEMES) {
      this.load.image(backgroundKey(theme.id), theme.background.url);
      theme.blocks.forEach(({ url }, i) => this.load.image(blockArtKey(theme.id, i), url));
    }
    this.load.image(RIBBON_KEY, DECOR.ribbon.url); // 제목 리본. 실패하면 제목만
    for (const [name, { file }] of Object.entries(SOUND.effects)) {
      // [ogg, m4a]: Phaser가 이 브라우저가 재생할 수 있는 첫 형식을 고른다
      this.load.audio(
        sfxKey(name as SfxName),
        SOUND.formats.map((ext) => `audio/${file}.${ext}`),
      );
    }
    this.load.audio(musicKey('menu'), musicUrls('menu'));
  }

  create(): void {
    registerBackButton(this.game); // 앱(Android)에서만, 한 번만
    // 익명 계정 확인. 기다리지 않고, 실패·오프라인이어도 게임에 영향이 없다 (online은 throw하지 않는다)
    void ensureAccount();
    const stages = loadStages().then(
      (data): StageData | Error => data,
      (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
    );
    // DEV ?obstacles: 시험 스테이지. 배포 빌드에서는 분기째 빠져 dist에 들어가지 않는다
    const devStage =
      import.meta.env.DEV && new URLSearchParams(window.location.search).has('obstacles')
        ? import('../dev/obstacleStage').then((m) => m.obstacleStage())
        : Promise.resolve(undefined);
    void Promise.all([this.loadFont(), this.loadSave(), stages, devStage]).then(
      ([, , result, dev]) => {
        if (result instanceof Error) {
          this.showError(result.message);
          return;
        }
        putStages(this.registry, result);
        if (dev) putDevStage(this.registry, dev);
        // 스테이지가 늘었으면 마지막까지 깬 옛 저장도 다음 판을 연다 (W4-27)
        const loaded = getSave(this.registry);
        const continued = continueUnlock(loaded, result.story.length);
        if (continued !== loaded) commitSave(this.registry, continued);
        // DEV ?unlock=N: 열린 스테이지를 N으로 바꿔 저장한다 (지도 확인용, 되돌리려면 ?unlock=1)
        const unlock = devUnlock(window.location.search, import.meta.env.DEV);
        if (unlock !== null) {
          const save = getSave(this.registry);
          commitSave(this.registry, { ...save, story: { ...save.story, unlocked: unlock } });
        }
        // 기본은 메뉴. 개발 주소(?demo, ?stage=N, ?result=N 등)는 해당 화면으로 바로 (bootRoute.ts)
        const route = bootRoute(window.location.search, import.meta.env.DEV);
        if (route.scene === 'Menu' || route.scene === 'Ranking') this.scene.start(route.scene);
        else this.scene.start(route.scene, route.data);
      },
    );
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
    // 앱은 Preferences(앱을 지울 때까지 남는다), 웹은 localStorage. 앱에서도 옛 localStorage 기록은 한 번 옮겨 온다
    const storage: SaveStorage = Capacitor.isNativePlatform()
      ? new CapacitorPreferencesStorage(Preferences, store)
      : new LocalStorageAdapter(store ?? { getItem: () => null, setItem: () => undefined });
    const save = await storage.load();
    putSave(this.registry, storage, save);
    // 고른 테마. DEV ?theme=<id>는 저장하지 않고 이 판만 덮어쓴다
    setActiveTheme(devTheme(window.location.search, import.meta.env.DEV) ?? save.settings.theme);
    new Sfx(this).setMuted(save.settings.muted); // 효과음 끔 (모든 씬이 따른다)
    Music.of(this.game).setEnabled(save.settings.music);
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
