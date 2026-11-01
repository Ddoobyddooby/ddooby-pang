// 스테이지 지도 (스토리 화면 설계 3절, A안): 아래(1번)에서 위로 올라가는 사탕 길 위의 동그라미 노드.
// 완료(분홍 + 별), 지금 할 곳(진한 분홍, 크게, 숨쉬기), 잠김(회보라 + 자물쇠, 누르면 흔들림).
// 방금 열린 스테이지는 한 번 크게 튀어나온다 (직전에 본 unlocked를 registry에 기억해 비교, 세션 안에서만).
// 길이 화면보다 길면 위로 스크롤한다 (PLAN 6.12): 노드·길·바닥 언덕은 내용 묶음(content)에 넣어 같이 움직이고,
// 하늘·구름·제목·[←]·♪·스피커는 화면에 고정. 끌기(문턱 넘게 움직임)로 놓은 손은 노드를 누르지 않는다.
//
// 개발 모드: U 키 = 다음 스테이지 열기(저장) 후 지도 다시 열기 → 튀어나오는 연출 확인

import Phaser from 'phaser';
import { GAME, MAP, THEME, UI } from '../config';
import {
  clampScroll,
  contentY,
  isDrag,
  mapFocus,
  mapNodes,
  maxScroll,
  nodeStates,
  scrollToCenter,
  type NodeState,
} from '../view/mapLayout';
import { Background } from '../view/theme/Background';
import { addHills } from '../view/theme/Hills';
import { Sfx } from '../view/Sfx';
import type { PressLock } from '../view/ui/Button';
import { Music } from '../view/Music';
import { musicFor } from './musicRules';
import { addSceneMusicButton, addSceneMuteButton } from './muteToggle';
import { commitSave, getSave } from './saveRegistry';
import type { GameData } from './sceneData';
import { getStages } from './stageRegistry';

/** 지도를 마지막으로 열었을 때의 unlocked (방금 열린 스테이지 연출용) */
const SEEN_KEY = 'stageMap.seenUnlocked';

export class StageMapScene extends Phaser.Scene {
  private lock: PressLock = { pressed: false };
  private sfx!: Sfx;
  /** 노드·길·언덕 묶음과 스크롤 상태 */
  private content!: Phaser.GameObjects.Container;
  private worldHeight = 0;
  private scroll = 0;
  /** 이번 누름이 끌기가 됐는지 (그러면 놓아도 노드·[←]를 누르지 않는다) */
  private dragged = false;

  constructor() {
    super('StageMap');
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setScroll(-(width - GAME.width) / 2, 0); // 넓은 화면에서 가운데 맞춤
    this.lock = { pressed: false };
    this.sfx = new Sfx(this);

    new Background(this);

    const stages = getStages(this.registry).story;
    const save = getSave(this.registry);
    const { nodes, worldHeight } = mapNodes(stages.length, height);
    const states = nodeStates(save.story.unlocked, stages.length);
    this.worldHeight = worldHeight;
    this.dragged = false;
    // 언덕(바닥 장식과 같은 깊이) 위에 길, 그 위에 노드. 묶음 안에서는 넣은 순서가 앞뒤
    this.content = this.add.container(0, 0).setDepth(-90);
    this.content.add(addHills(this, width, worldHeight));

    this.drawPath(nodes);
    const views = nodes.map((p, i) =>
      this.addNode(p.x, p.y, i + 1, states[i]!, save.story.bestStars[i + 1] ?? 0),
    );

    // 처음 위치: 지금 할 곳이 화면 가운데 근처. 방금 열린 스테이지(이 세션에서 지도를 본 뒤 더 열림)가 있으면
    // 직전에 할 곳에서 시작해 그곳으로 부드럽게 옮겨 간 뒤 튀어나온다
    const seen = this.registry.get(SEEN_KEY) as number | undefined;
    const focus = mapFocus(save.story.unlocked, seen, stages.length);
    this.registry.set(SEEN_KEY, save.story.unlocked);
    this.setScroll(scrollToCenter(nodes[focus.from]?.y ?? 0, worldHeight, height));
    const fresh = views[focus.to];
    if (focus.fresh && fresh) this.revealFresh(fresh, nodes[focus.to]!.y);
    this.enableDrag();

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
    addSceneMusicButton(this);
    const music = Music.of(this.game);
    music.play(musicFor('StageMap')); // 메뉴에서 왔으면 같은 곡이 이어진다
    music.load(this, ['story']);

    if (import.meta.env.DEV) {
      // 확인용: 스크롤 양과 노드의 화면 위치
      (window as unknown as { __map?: unknown }).__map = {
        scroll: () => this.scroll,
        maxScroll: () => maxScroll(this.worldHeight, this.scale.height),
        nodeY: (id: number) => (views[id - 1]?.y ?? NaN) + this.content.y,
        nodeX: (id: number) => views[id - 1]?.x ?? NaN,
        scene: () => this.scene.key,
      };
      this.input.keyboard?.on('keydown-U', () => {
        const s = getSave(this.registry);
        commitSave(this.registry, { ...s, story: { ...s.story, unlocked: s.story.unlocked + 1 } });
        this.scene.restart();
      });
    }
  }

  /** 내용 묶음을 scroll만큼 올린다 (끝에서 막는다) */
  private setScroll(value: number): void {
    const height = this.scale.height;
    this.scroll = clampScroll(value, this.worldHeight, height);
    this.content.y = contentY(this.scroll, this.worldHeight, height);
  }

  /** 끌어서 스크롤. 길이 화면보다 짧으면 아무것도 하지 않는다 */
  private enableDrag(): void {
    if (maxScroll(this.worldHeight, this.scale.height) === 0) return;
    let start: { y: number; scroll: number } | null = null;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragged = false;
      start = { y: pointer.y, scroll: this.scroll };
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!start || !pointer.isDown) return;
      const dy = pointer.y - start.y;
      if (!this.dragged && !isDrag(pointer.x - pointer.downX, dy, MAP.dragThreshold)) return;
      this.dragged = true;
      this.setScroll(start.scroll + dy); // 손가락을 내리면 위쪽(높은 번호)이 내려와 보인다
    });
    this.input.on('pointerup', () => {
      start = null;
    });
  }

  /** 방금 열린 노드: 숨겨 두고 그 자리로 옮겨 간 뒤 튀어나온다 */
  private revealFresh(node: Phaser.GameObjects.Container, worldY: number): void {
    this.tweens.killTweensOf(node);
    node.setScale(0);
    const target = scrollToCenter(worldY, this.worldHeight, this.scale.height);
    const move = { scroll: this.scroll };
    this.tweens.add({
      targets: move,
      scroll: target,
      delay: MAP.scrollTo.delayMs,
      duration: target === this.scroll ? 0 : MAP.scrollTo.ms,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (!this.dragged) this.setScroll(move.scroll); // 옮겨 가는 중에 끌면 손가락이 이긴다
      },
      onComplete: () => this.popIn(node),
    });
  }

  /** 노드를 잇는 흰 점선 사탕 길 */
  private drawPath(nodes: { x: number; y: number }[]): void {
    if (nodes.length < 2) return;
    const spline = new Phaser.Curves.Spline(nodes.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
    const p = MAP.path;
    const dots = Math.max(2, Math.floor(spline.getLength() / p.spacing));
    const g = this.add.graphics().fillStyle(p.color, p.alpha);
    for (const pt of spline.getSpacedPoints(dots)) g.fillCircle(pt.x, pt.y, p.dot);
    this.content.add(g);
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

    this.content.add(node);
    if (state === 'done') this.addStars(x, y + MAP.stars.dy, stars);
    if (state === 'current') {
      node.setScale(n.currentScale);
      this.breathe(node);
    }

    node.on('pointerup', () => {
      if (this.dragged) return;
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
      const star = this.add
        .star(cx + (k - 1) * s.gap, y, 5, s.r * 0.45, s.r, k < count ? THEME.star : s.empty)
        .setStrokeStyle(2, THEME.wafer.stroke);
      this.content.add(star);
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
      if (this.lock.pressed || this.dragged) return;
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
