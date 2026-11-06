// 닉네임 입력 창 (V2-W3-02, PLAN2 6.3). Phaser에는 글자 입력이 없어 HTML <input>을 게임 캔버스 위에 띄운다.
// 캔버스가 화면에 그려진 크기·위치를 따라가며 배치하고(폭 720 기준 배율), 창이 닫히면 DOM을 모두 지운다.
// 판정(길이·글자·금칙어)과 서버 호출은 주입받는 submit이 한다. 이 파일은 Phaser·src/online을 모른다.

import { THEME } from '../config';
import {
  applyResult,
  chooseLater,
  initialPromptState,
  isLocked,
  shouldSubmitOnEnter,
  startSubmit,
  type NicknameResult,
  type PromptOutcome,
  type PromptState,
} from './nicknamePromptState';
import { NICKNAME_TEXT, type NicknamePromptText } from './nicknameText';

export interface NicknamePromptOptions {
  /** 게임 캔버스 (scene.game.canvas). 이 위에 겹쳐 배치한다 */
  canvas: HTMLElement;
  submit: (name: string) => Promise<NicknameResult>;
  onClose: (result: PromptOutcome) => void;
  text?: NicknamePromptText;
}

/** 값은 게임 좌표(폭 720) 기준 px. 화면에는 캔버스 폭/720 배율로 그린다 */
const STYLE = {
  designWidth: 720,
  zIndex: 1000,
  text: '#8a5a24',
  dim: 'rgba(59, 43, 58, 0.55)',
  /** 가상 키보드가 칸을 가리지 않게 창을 캔버스 위쪽에 둔다 (캔버스 높이 대비) */
  top: 0.1,
  panel: { width: 640, pad: 36, radius: 36, border: 6, gap: 22 },
  title: { fontSize: 46, color: '#ff6b9a', outline: '#ffffff' },
  input: { fontSize: 44, height: 96, radius: 48, border: 5 },
  notice: { fontSize: 28, color: '#8a7aa8' },
  message: { fontSize: 34, height: 48, error: '#d94a6a', info: '#8a5a24' },
  button: { fontSize: 44, height: 92, gap: 20, later: '#fbe9c8' },
  /** iOS Safari는 16px 미만 입력칸에 초점을 주면 화면을 확대한다 */
  minInputPx: 16,
  maxLength: 20,
} as const;

const BLOCKED_EVENTS = [
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'touchstart',
  'touchend',
  'click',
] as const;

export class NicknamePrompt {
  private readonly text: NicknamePromptText;
  private state: PromptState = initialPromptState();
  private root: HTMLDivElement | null = null;
  private panel!: HTMLDivElement;
  private input!: HTMLInputElement;
  private messageEl!: HTMLDivElement;
  private noticeEl!: HTMLDivElement;
  private confirmBtn!: HTMLButtonElement;
  private laterBtn!: HTMLButtonElement;
  private closeTimer: number | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private done = false;

  constructor(private readonly opts: NicknamePromptOptions) {
    this.text = opts.text ?? NICKNAME_TEXT;
    this.build();
    this.layout();
    window.addEventListener('resize', this.layout);
    window.addEventListener('orientationchange', this.layout);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.layout);
      this.resizeObserver.observe(opts.canvas);
    }
    this.input.focus({ preventScroll: true });
  }

  /** 지금 창이 DOM에 떠 있는지 */
  get isOpen(): boolean {
    return this.root !== null;
  }

  /** 씬이 끝나거나 바뀔 때 부른다. onClose 없이 DOM·타이머·리스너만 지운다 */
  destroy(): void {
    this.done = true;
    this.teardown();
  }

  private build(): void {
    const t = this.text;
    const root = document.createElement('div');
    root.setAttribute('data-nickname-prompt', '');
    root.style.cssText = `position:fixed;inset:0;z-index:${STYLE.zIndex};background:${STYLE.dim};touch-action:none;`;
    // 뒤 화면 버튼이 눌리지 않게 막는다. 막을 눌러도 닫히지 않는다 (실수로 이름 입력을 놓치지 않게)
    // Phaser는 마우스·터치 이벤트를 window에서도 듣는다. 창 위의 입력이 게임에 닿지 않게 모두 여기서 끊는다
    for (const type of BLOCKED_EVENTS) root.addEventListener(type, (e) => e.stopPropagation());

    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:absolute',
      'box-sizing:border-box',
      `background:#${THEME.wafer.inner.toString(16).padStart(6, '0')}`,
      `border:solid #${THEME.wafer.stroke.toString(16).padStart(6, '0')}`,
      `font-family:'${THEME.font}',sans-serif`,
      'display:flex',
      'flex-direction:column',
      'align-items:stretch',
      'text-align:center',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = t.title;
    title.style.cssText = `color:${STYLE.title.color};font-weight:400;-webkit-text-stroke:0;text-shadow:-2px 0 ${STYLE.title.outline},2px 0 ${STYLE.title.outline},0 -2px ${STYLE.title.outline},0 2px ${STYLE.title.outline},-2px -2px ${STYLE.title.outline},2px 2px ${STYLE.title.outline},-2px 2px ${STYLE.title.outline},2px -2px ${STYLE.title.outline};`;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = STYLE.maxLength;
    input.placeholder = t.placeholder;
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.enterKeyHint = 'done';
    input.setAttribute('aria-label', t.title);
    input.style.cssText = `box-sizing:border-box;width:100%;text-align:center;outline:none;font-family:inherit;color:${STYLE.text};background:#fff;border:solid #${THEME.wafer.stroke.toString(16).padStart(6, '0')};`;
    input.addEventListener('keydown', (e) => {
      if (shouldSubmitOnEnter(e)) {
        e.preventDefault();
        this.submit();
      }
    });

    const notice = document.createElement('div');
    notice.textContent = t.notice;
    notice.style.cssText = `color:${STYLE.notice.color};`;
    this.noticeEl = notice;

    const message = document.createElement('div');
    message.setAttribute('role', 'status');
    message.style.cssText =
      'display:flex;align-items:center;justify-content:center;text-wrap:balance;word-break:keep-all;';

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;';
    const confirm = this.makeButton(
      t.confirm,
      `#${THEME.wafer.fill.toString(16).padStart(6, '0')}`,
    );
    const later = this.makeButton(t.later, STYLE.button.later);
    confirm.addEventListener('click', () => this.submit());
    later.addEventListener('click', () => this.later());
    buttons.append(confirm, later);

    panel.append(title, input, notice, message, buttons);
    root.append(panel);
    document.body.append(root);

    this.root = root;
    this.panel = panel;
    this.input = input;
    this.messageEl = message;
    this.confirmBtn = confirm;
    this.laterBtn = later;
  }

  private makeButton(label: string, bg: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `flex:1;font-family:inherit;color:${STYLE.text};background:${bg};border:solid #${THEME.wafer.stroke.toString(16).padStart(6, '0')};cursor:pointer;-webkit-tap-highlight-color:transparent;`;
    return b;
  }

  /** 캔버스가 화면에 그려진 자리·크기에 맞춰 창을 놓는다 */
  private readonly layout = (): void => {
    if (!this.root) return;
    const rect = this.opts.canvas.getBoundingClientRect();
    const k = rect.width / STYLE.designWidth;
    const px = (v: number): string => `${Math.round(v * k * 10) / 10}px`;
    const { panel: p, title, input, message, button } = STYLE;
    const ps = this.panel.style;
    ps.width = px(p.width);
    ps.left = `${rect.left + (rect.width - p.width * k) / 2}px`;
    ps.top = `${rect.top + rect.height * STYLE.top}px`;
    ps.padding = px(p.pad);
    ps.borderWidth = px(p.border);
    ps.borderRadius = px(p.radius);
    ps.gap = px(p.gap);
    const fit = (v: number): string => `${Math.max(STYLE.minInputPx, Math.round(v * k))}px`;
    (this.panel.firstElementChild as HTMLElement).style.fontSize = px(title.fontSize);
    const is = this.input.style;
    is.fontSize = fit(input.fontSize);
    is.height = px(input.height);
    is.borderRadius = px(input.radius);
    is.borderWidth = px(input.border);
    this.noticeEl.style.fontSize = px(STYLE.notice.fontSize);
    this.noticeEl.style.marginTop = px(-p.gap / 2);
    const ms = this.messageEl.style;
    ms.fontSize = px(message.fontSize);
    ms.minHeight = px(message.height);
    for (const b of [this.confirmBtn, this.laterBtn]) {
      b.style.fontSize = px(button.fontSize);
      b.style.height = px(button.height);
      b.style.borderRadius = px(button.height / 2);
      b.style.borderWidth = px(input.border);
    }
    (this.confirmBtn.parentElement as HTMLElement).style.gap = px(button.gap);
  };

  private render(): void {
    const locked = isLocked(this.state);
    this.input.disabled = locked;
    this.confirmBtn.disabled = locked;
    this.laterBtn.disabled = locked;
    const m = this.state.message;
    this.messageEl.textContent = m ? m.text : '';
    this.messageEl.style.color = m?.kind === 'error' ? STYLE.message.error : STYLE.message.info;
    this.confirmBtn.style.opacity = locked ? '0.6' : '1';
    this.laterBtn.style.opacity = locked ? '0.6' : '1';
  }

  private submit(): void {
    if (this.done) return;
    const next = startSubmit(this.state);
    if (next === this.state) return;
    this.state = next;
    this.render();
    this.opts
      .submit(this.input.value)
      .catch((): NicknameResult => ({ ok: false, code: 'network' }))
      .then((result) => {
        if (this.done) return;
        this.state = applyResult(this.state, result, this.text);
        this.render();
        if (this.state.phase === 'closing') this.scheduleClose();
        else this.input.focus({ preventScroll: true });
      });
  }

  private later(): void {
    if (this.done) return;
    const next = chooseLater(this.state, this.text);
    if (next === this.state) return;
    this.state = next;
    this.render();
    this.scheduleClose();
  }

  private scheduleClose(): void {
    const { outcome, closeAfterMs } = this.state;
    if (!outcome) return;
    if (closeAfterMs <= 0) {
      this.finish(outcome);
      return;
    }
    this.closeTimer = window.setTimeout(() => this.finish(outcome), closeAfterMs);
  }

  private finish(outcome: PromptOutcome): void {
    if (this.done) return;
    this.done = true;
    this.teardown();
    this.opts.onClose(outcome);
  }

  private teardown(): void {
    window.clearTimeout(this.closeTimer);
    window.removeEventListener('resize', this.layout);
    window.removeEventListener('orientationchange', this.layout);
    this.resizeObserver?.disconnect();
    this.root?.remove();
    this.root = null;
  }
}
