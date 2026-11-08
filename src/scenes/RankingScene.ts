// 주간 랭킹 화면 (V2-W3-04, PLAN2 6.5): 제목 · 주 기간 · 드래그 스크롤 목록(StageMapScene 방식) · 하단 내 순위 고정 줄 · [새로고침/다시 시도] [돌아가기].
// 무엇을 보일지(줄, 상태, 문구)는 view/rankingRows가 정하고, 이 씬은 그리기만 한다.
// 닉네임이 없으면 [이름 정하기]로 결과 화면과 같은 NicknamePrompt를 띄우고, 정해지면 목록을 다시 불러온다.

import Phaser from 'phaser';
import { GAME, RANKING, THEME } from '../config';
import { weekKey } from '../replay/weekKey';
import { Music } from '../view/Music';
import { NicknamePrompt } from '../view/NicknamePrompt';
import { clampScroll, isDrag, maxScroll } from '../view/mapLayout';
import {
  footerText,
  messageFor,
  refreshLabel,
  selectView,
  weekRangeText,
  type RankingFooter,
  type RankingItem,
  type RankingLine,
  type RankingResult,
  type RankingView,
} from '../view/rankingRows';
import { RANKING_TEXT } from '../view/rankingText';
import { addSceneBackground } from '../view/theme/sceneBackground';
import { addButton, type PressLock } from '../view/ui/Button';
import { musicFor } from './musicRules';
import { addSceneMusicButton, addSceneMuteButton } from './muteToggle';
import { getRankingClient } from './rankingClient';

export class RankingScene extends Phaser.Scene {
  /** 요청마다 올린다: 늦게 온 옛 응답은 버린다 */
  private token = 0;
  private view: RankingView | null = null;
  private week!: Phaser.GameObjects.Text;
  private refreshButton!: Phaser.GameObjects.Container;
  /** 목록 줄들 (마스크 안에서 스크롤) */
  private listBox!: Phaser.GameObjects.Container;
  /** 안내 문구와 하단 고정 줄 (스크롤 안 함) */
  private fixedBox!: Phaser.GameObjects.Container;
  private listTop = 0;
  private listHeight = 0;
  private contentHeight = 0;
  private scroll = 0;
  private dragged = false;
  private prompt: NicknamePrompt | null = null;
  private backLock: PressLock = { pressed: false };

  constructor() {
    super('Ranking');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setScroll(-(width - GAME.width) / 2, 0); // 넓은 화면에서 가운데 맞춤
    this.token = 0;
    this.view = null;
    this.scroll = 0;
    this.dragged = false;
    this.prompt = null;
    this.backLock = { pressed: false };
    const cx = GAME.width / 2;
    const L = RANKING.list;
    this.listTop = L.top;
    this.listHeight = Math.max(0, height - L.bottomReserve - L.top);

    addSceneBackground(this, width, height, { storybookArt: false, hills: false });
    this.add
      .text(cx, RANKING.title.y, RANKING_TEXT.title, {
        fontFamily: THEME.font,
        fontSize: `${RANKING.title.fontSize}px`,
        color: THEME.title.fill,
        stroke: THEME.title.stroke,
        strokeThickness: RANKING.title.strokeThickness,
      })
      .setOrigin(0.5);
    // 주 기간: 응답이 오기 전에는 기기 시각의 이번 주, 응답이 오면 서버가 말한 주
    this.week = this.add
      .text(cx, RANKING.week.y, weekRangeText(weekKey(Date.now())), {
        fontFamily: THEME.font,
        fontSize: `${RANKING.week.fontSize}px`,
        color: THEME.info.text,
      })
      .setOrigin(0.5);

    this.listBox = this.add.container(0, this.listTop);
    const maskShape = this.make.graphics({}, false);
    maskShape.fillStyle(0xffffff).fillRect(0, this.listTop, GAME.width, this.listHeight);
    this.listBox.setMask(maskShape.createGeometryMask());
    this.fixedBox = this.add.container(0, 0);
    this.enableScroll();

    const b = RANKING.button;
    const by = height - b.bottomY;
    const spec = { width: b.width, height: b.height, fontSize: b.fontSize };
    const refreshLock: PressLock = { pressed: false };
    this.refreshButton = addButton(
      this,
      cx - b.dx,
      by,
      { ...spec, label: RANKING_TEXT.refresh },
      () => {
        refreshLock.pressed = false; // 여러 번 누를 수 있는 버튼
        this.reload();
      },
      refreshLock,
    );
    addButton(
      this,
      cx + b.dx,
      by,
      { ...spec, label: RANKING_TEXT.back },
      () => this.scene.start('Menu'),
      this.backLock,
    );
    addSceneMuteButton(this);
    addSceneMusicButton(this);
    Music.of(this.game).play(musicFor('Ranking')); // 메뉴에서 왔으면 같은 곡이 이어진다

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.token++; // 기다리던 응답을 버린다
      this.closePrompt();
    });
    if (import.meta.env.DEV) {
      // 확인용: 스크롤과 지금 상태
      (window as unknown as { __ranking?: unknown }).__ranking = {
        state: () => this.view?.state ?? 'loading',
        scroll: () => this.scroll,
        maxScroll: () => this.maxScrollValue(),
        scrollTo: (v: number) => this.setScroll(v),
      };
    }
    this.reload();
  }

  // ── 불러오기 ──

  private reload(): void {
    const token = ++this.token;
    this.clearBodies();
    // 0.3초 넘게 걸릴 때만 "불러오는 중…" (빠르면 깜빡이지 않는다)
    const timer = this.time.delayedCall(RANKING.loadingMs, () => {
      if (token === this.token) this.showMessage(RANKING_TEXT.loading);
    });
    getRankingClient()
      .fetchRanking()
      .catch((): RankingResult => ({ kind: 'error' }))
      .then((result) => {
        timer.remove();
        if (token !== this.token || !this.scene.isActive()) return;
        this.render(result);
      });
  }

  private render(result: RankingResult): void {
    const view = selectView(result);
    this.view = view;
    this.clearBodies();
    if (result.kind === 'ok') this.week.setText(weekRangeText(result.weekKey));
    (this.refreshButton.list[1] as Phaser.GameObjects.Text).setText(refreshLabel(view));

    const message = messageFor(view);
    if (message) this.showMessage(message);
    if (view.state === 'list') this.drawList(view.items);
    if (view.state === 'list' || view.state === 'empty') {
      if (view.footer) this.drawFooter(view.footer);
    }
  }

  private clearBodies(): void {
    this.listBox.removeAll(true);
    this.fixedBox.removeAll(true);
    this.contentHeight = 0;
    this.setScroll(0);
  }

  // ── 그리기 ──

  private showMessage(text: string): void {
    const m = RANKING.message;
    this.fixedBox.add(
      this.add
        .text(GAME.width / 2, this.listTop + this.listHeight / 2, text, {
          fontFamily: THEME.font,
          fontSize: `${m.fontSize}px`,
          color: THEME.info.text,
          align: 'center',
          wordWrap: { width: m.wrapWidth, useAdvancedWrap: true },
        })
        .setOrigin(0.5),
    );
  }

  private drawList(items: RankingItem[]): void {
    const L = RANKING.list;
    let y = L.pad;
    for (const item of items) {
      if (item.kind === 'gap') {
        this.drawGap(y + L.gapH / 2);
        y += L.gapH + L.rowGap;
      } else {
        this.drawRow(item, y);
        y += L.rowH + L.rowGap;
      }
    }
    this.contentHeight = y + L.pad;
  }

  /** 순번이 끊기는 곳: 가운데 점 세 개 (Jua에 ⋯ 글자가 없을 수 있어 그린다) */
  private drawGap(cy: number): void {
    const d = RANKING.gapDot;
    const g = this.add.graphics().fillStyle(d.color, 1);
    for (let k = -1; k <= 1; k++) g.fillCircle(GAME.width / 2 + k * d.spacing, cy, d.r);
    this.listBox.add(g);
  }

  /** 줄 하나: 바탕 + 순위(오른쪽 정렬) + 닉네임 + 태그(작게) + 점수(오른쪽 정렬) */
  private drawRow(line: RankingLine, top: number): void {
    const L = RANKING.list;
    const R = RANKING.row;
    const cy = top + L.rowH / 2;
    const bg = this.add.graphics();
    if (line.isMe) bg.fillStyle(R.me.fill, 1).lineStyle(4, R.me.stroke, 1);
    else bg.fillStyle(R.fill, R.fillAlpha);
    bg.fillRoundedRect(L.x, top, L.width, L.rowH, R.radius);
    if (line.isMe) bg.strokeRoundedRect(L.x, top, L.width, L.rowH, R.radius);
    this.listBox.add(bg);

    const font = { fontFamily: THEME.font, fontStyle: line.isMe ? 'bold' : 'normal' };
    const text = (x: number, size: number, color: string, value: string, originX: number) =>
      this.add
        .text(x, cy, value, { ...font, fontSize: `${size}px`, color })
        .setOrigin(originX, 0.5);
    const C = RANKING.color;
    const rank = text(
      R.rankRight,
      R.fontSize,
      line.medal ? C.medal[line.medal] : C.rank,
      line.rank,
      1,
    );
    const name = text(R.nameLeft, R.fontSize, C.name, line.nickname, 0);
    const tag = text(name.x + name.width + R.tagGap, R.tagFontSize, C.tag, line.tag, 0);
    const score = text(R.scoreRight, R.fontSize, C.score, line.score, 1);
    this.listBox.add([rank, name, tag, score]);
  }

  /** 하단 고정 줄 (내 순위 / 기록 없음 / 닉네임 없음 + [이름 정하기]) */
  private drawFooter(footer: RankingFooter): void {
    const L = RANKING.list;
    const F = RANKING.footer;
    const R = RANKING.row;
    const cy = this.scale.height - F.bottomY;
    const bg = this.add.graphics();
    if (footer.kind === 'me') bg.fillStyle(R.me.fill, 1).lineStyle(4, R.me.stroke, 1);
    else bg.fillStyle(R.fill, R.fillAlpha);
    bg.fillRoundedRect(L.x, cy - F.height / 2, L.width, F.height, R.radius);
    if (footer.kind === 'me')
      bg.strokeRoundedRect(L.x, cy - F.height / 2, L.width, F.height, R.radius);
    this.fixedBox.add(bg);

    const t = footerText(footer);
    const left = this.add
      .text(L.x + 24, cy, t.left, {
        fontFamily: THEME.font,
        fontStyle: footer.kind === 'me' ? 'bold' : 'normal',
        fontSize: `${footer.kind === 'noNickname' ? F.subFontSize : F.fontSize}px`,
        color: RANKING.color.name,
        wordWrap: { width: F.textWrap, useAdvancedWrap: true },
      })
      .setOrigin(0, 0.5);
    this.fixedBox.add(left);
    if (t.right) {
      this.fixedBox.add(
        this.add
          .text(R.scoreRight, cy, t.right, {
            fontFamily: THEME.font,
            fontStyle: 'bold',
            fontSize: `${F.fontSize}px`,
            color: RANKING.color.score,
          })
          .setOrigin(1, 0.5),
      );
    }
    if (footer.kind === 'noNickname') {
      const lock: PressLock = { pressed: false };
      const b = F.button;
      this.fixedBox.add(
        addButton(
          this,
          R.scoreRight - b.width / 2 - 4,
          cy,
          { ...b, label: RANKING_TEXT.setName },
          () => {
            lock.pressed = false;
            this.openPrompt();
          },
          lock,
        ),
      );
    }
  }

  // ── 닉네임 ──

  private openPrompt(): void {
    if (this.prompt) return;
    this.prompt = new NicknamePrompt({
      canvas: this.game.canvas,
      submit: (name) => getRankingClient().setNickname(name),
      onClose: (outcome) => {
        this.prompt = null;
        if (outcome === 'saved' && this.scene.isActive()) this.reload(); // 이름이 생겼으니 내 줄이 보인다
      },
    });
  }

  private closePrompt(): void {
    this.prompt?.destroy();
    this.prompt = null;
  }

  // ── 스크롤 (StageMapScene과 같은 끌기·문턱) ──

  private maxScrollValue(): number {
    return maxScroll(this.contentHeight, this.listHeight);
  }

  private setScroll(value: number): void {
    this.scroll = clampScroll(value, this.contentHeight, this.listHeight);
    this.listBox.y = this.listTop - this.scroll;
  }

  private enableScroll(): void {
    let start: { y: number; scroll: number } | null = null;
    const inList = (p: Phaser.Input.Pointer) =>
      p.y >= this.listTop && p.y <= this.listTop + this.listHeight;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragged = false;
      start = inList(pointer) ? { y: pointer.y, scroll: this.scroll } : null;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!start || !pointer.isDown) return;
      const dy = pointer.y - start.y;
      if (!this.dragged && !isDrag(pointer.x - pointer.downX, dy, 12)) return;
      this.dragged = true;
      this.setScroll(start.scroll - dy); // 손가락을 올리면 아래 줄이 올라온다
    });
    this.input.on('pointerup', () => {
      start = null;
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.setScroll(this.scroll + dy);
    });
  }
}
