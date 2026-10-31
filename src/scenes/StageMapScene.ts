// 스테이지 지도 (스토리 화면 설계 3절, A안): 아래(1번)에서 위로 올라가는 사탕 길 위의 동그라미 노드.
// 완료(분홍 + 별), 지금 할 곳(진한 분홍, 크게, 숨쉬기), 잠김(회보라 + 자물쇠, 누르면 흔들림).
// 방금 열린 스테이지는 한 번 크게 튀어나온다 (직전에 본 unlocked를 registry에 기억해 비교, 세션 안에서만).
//
// 개발 모드: U 키 = 다음 스테이지 열기(저장) 후 지도 다시 열기 → 튀어나오는 연출 확인

import Phaser from 'phaser';
import { GAME, MAP, THEME, UI } from '../config';
import { mapNodes, nodeStates, type NodeState } from '../view/mapLayout';
import { Background } from '../view/theme/Background';
import { addHills } from '../view/theme/Hills';
import { Sfx } from '../view/Sfx';
import type { PressLock } from '../view/ui/Button';
import { addSceneMuteButton } from './muteToggle';
import { commitSave, getSave } from './saveRegistry';
import type { GameData } from './sceneData';
import { getStages } from './stageRegistry';

/** 지도를 마지막으로 열었을 때의 unlocked (방금 열린 스테이지 연출용) */
const SEEN_KEY = 'stageMap.seenUnlocked';

export class StageMapScene extends Phaser.Scene {
  private lock: PressLock = { pressed: false };
  private sfx!: Sfx;

  constructor() {
    super('StageMap');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setScroll(-(width - GAME.width) / 2, 0); // 넓은 화면에서 가운데 맞춤
    this.lock = { pressed: false };
    this.sfx = new Sfx(this);

    new Background(this);
    addHills(this, width, height);

    const stages = getStages(this.registry).story;
    const save = getSave(this.registry);
    if (import.meta.env.DEV && stages.length > MAP.maxNodes) {
      console.warn(`[map] 스테이지 ${stages.length}개: 한 화면에 ${MAP.maxNodes}개까지만 맞춘다`);
    }
    const nodes = mapNodes(stages.length, height);
    const states = nodeStates(save.story.unlocked, stages.length);

    this.drawPath(nodes);
    const views = nodes.map((p, i) =>
      this.addNode(p.x, p.y, i + 1, states[i]!, save.story.bestStars[i + 1] ?? 0),
    );

    // 방금 열린 스테이지: 이 세션에서 지도를 본 적이 있고, 그때보다 더 열렸을 때만
    const seen = this.registry.get(SEEN_KEY) as number | undefined;
    const unlocked = save.story.unlocked;
    const fresh = views[unlocked - 1];
    if (seen !== undefined && unlocked > seen && fresh) this.popIn(fresh);
    this.registry.set(SEEN_KEY, unlocked);

    this.add
      .text(GAME.width / 2, MAP.title.y, MAP.title.text, {
        fontFamily: THEME.font,
        fontSize: `${MAP.title.fontSize}px`,
        color: THEME.title.fill,
        stroke: THEME.title.stroke,
        strokeThickness: MAP.title.strokeThickness,
      })
      .setOrigin(0.5);
    this.addBackButton();
    addSceneMuteButton(this);

    if (import.meta.env.DEV) {
      this.input.keyboard?.on('keydown-U', () => {
        const s = getSave(this.registry);
        commitSave(this.registry, { ...s, story: { ...s.story, unlocked: s.story.unlocked + 1 } });
        this.scene.restart();
      });
    }
  }

  /** 노드를 잇는 흰 점선 사탕 길 */
  private drawPath(nodes: { x: number; y: number }[]): void {
    if (nodes.length < 2) return;
    const spline = new Phaser.Curves.Spline(nodes.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
    const p = MAP.path;
    const dots = Math.max(2, Math.floor(spline.getLength() / p.spacing));
    const g = this.add.graphics().fillStyle(p.color, p.alpha);
    for (const pt of spline.getSpacedPoints(dots)) g.fillCircle(pt.x, pt.y, p.dot);
  }

  private addNode(
    x: number,
    y: number,
    id: number,
    state: NodeState,
    stars: number,
  ): Phaser.GameObjects.Container {
    const n = MAP.node;
    const fill = state === 'done' ? n.done : state === 'current' ? n.current : n.locked;
    const circle = this.add
      .graphics()
      .fillStyle(fill, 1)
      .fillCircle(0, 0, n.r)
      .lineStyle(n.border, 0xffffff, 1)
      .strokeCircle(0, 0, n.r);
    const parts: Phaser.GameObjects.GameObject[] = [circle];
    if (state === 'locked') parts.push(this.lockIcon());
    else {
      parts.push(
        this.add
          .text(0, 0, String(id), {
            fontFamily: THEME.font,
            fontSize: `${n.fontSize}px`,
            color: '#ffffff',
          })
          .setOrigin(0.5),
      );
    }
    const node = this.add
      .container(x, y, parts)
      .setSize(n.r * 2, n.r * 2)
      .setInteractive({ useHandCursor: true });

    if (state === 'done') this.addStars(x, y + MAP.stars.dy, stars);
    if (state === 'current') {
      node.setScale(n.currentScale);
      this.breathe(node);
    }

    node.on('pointerup', () => {
      if (state === 'locked') this.shake(node, x);
      else this.startStage(node, id);
    });
    return node;
  }

  /** 자물쇠: 고리(반원) + 몸통 (Jua에 자물쇠 글자가 없어서 그린다) */
  private lockIcon(): Phaser.GameObjects.Graphics {
    const ink = MAP.node.lockInk;
    return this.add
      .graphics()
      .lineStyle(5, ink, 1)
      .beginPath()
      .arc(0, -4, 9, Math.PI, 0)
      .strokePath()
      .fillStyle(ink, 1)
      .fillRoundedRect(-14, -4, 28, 20, 5);
  }

  /** 받은 별은 노랑, 못 받은 칸은 흰색 */
  private addStars(cx: number, y: number, count: number): void {
    const s = MAP.stars;
    for (let k = 0; k < 3; k++) {
      this.add
        .star(cx + (k - 1) * s.gap, y, 5, s.r * 0.45, s.r, k < count ? THEME.star : s.empty)
        .setStrokeStyle(2, THEME.wafer.stroke);
    }
  }

  private breathe(node: Phaser.GameObjects.Container): void {
    this.tweens.add({
      targets: node,
      scale: MAP.node.breatheScale,
      duration: MAP.node.breatheMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** 방금 열린 노드: 작게 시작해 크게 튀어나왔다가 지금 할 곳 크기로 돌아온 뒤 숨쉬기 */
  private popIn(node: Phaser.GameObjects.Container): void {
    const p = MAP.pop;
    this.tweens.killTweensOf(node);
    node.setScale(p.from);
    this.tweens.chain({
      targets: node,
      tweens: [
        { scale: p.peak, duration: p.ms * 0.6, ease: 'Back.easeOut' },
        { scale: MAP.node.currentScale, duration: p.ms * 0.4, ease: 'Quad.easeIn' },
      ],
      onComplete: () => this.breathe(node),
    });
  }

  /** 잠긴 노드: 좌우로 흔들림. 흔들리는 중에 또 누르면 무시 (트윈이 쌓이지 않게) */
  private shake(node: Phaser.GameObjects.Container, x: number): void {
    if (this.tweens.isTweening(node)) return;
    const s = MAP.shake;
    this.tweens.add({
      targets: node,
      x: x + s.dx,
      duration: s.ms,
      yoyo: true,
      repeat: s.repeat,
      ease: 'Sine.easeInOut',
      onComplete: () => node.setX(x),
    });
  }

  private startStage(node: Phaser.GameObjects.Container, stageId: number): void {
    if (this.lock.pressed) return;
    this.lock.pressed = true;
    this.sfx.play('button');
    this.tweens.killTweensOf(node);
    this.tweens.add({
      targets: node,
      scale: node.scale * UI.button.pressScale,
      duration: UI.button.pressMs,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => this.scene.start('Game', { mode: 'story', stageId } satisfies GameData),
    });
  }

  /** 왼쪽 위 [←] 동그란 버튼 → 메뉴 */
  private addBackButton(): void {
    const b = MAP.back;
    const g = this.add
      .graphics()
      .fillStyle(0xffffff, 1)
      .fillCircle(0, 0, b.r)
      .lineStyle(5, THEME.wafer.stroke, 1)
      .strokeCircle(0, 0, b.r)
      .lineStyle(6, b.arrow, 1)
      .beginPath()
      .moveTo(12, 0)
      .lineTo(-12, 0)
      .moveTo(-2, -11)
      .lineTo(-13, 0)
      .lineTo(-2, 11)
      .strokePath();
    const button = this.add
      .container(b.x, b.y, [g])
      .setSize(b.r * 2, b.r * 2)
      .setInteractive({ useHandCursor: true });
    button.on('pointerup', () => {
      if (this.lock.pressed) return;
      this.lock.pressed = true;
      this.sfx.play('button');
      this.tweens.add({
        targets: button,
        scale: UI.button.pressScale,
        duration: UI.button.pressMs,
        yoyo: true,
        onComplete: () => this.scene.start('Menu'),
      });
    });
  }
}
