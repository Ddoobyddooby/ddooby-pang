// DEV 전용 ?icon 페이지: 앱 아이콘 원본 PNG(1024px)를 게임 블록과 같은 그리기 함수로 만든다 (PLAN 7.3 W4-07).
// 분홍 배경 + 빨강 말랑이 normal 표정. 받은 파일을 assets/app-icon/에 두고 `npm run icons`로 Android 아이콘을 만든다.
// 절차는 assets/app-icon/README.md.

import { THEME } from '../config';
import { drawBlockOnCanvas } from '../view/theme/textures';

const SIZE = 1024;
/** 시안 블록은 100칸 중 80칸을 쓴다. 블록 지름 = 캔버스 × 이 비율 */
const BLOCK_RATIO = {
  /** 통짜 아이콘(옛 기기): 꽉 차 보이게 */
  only: 0.74,
  /**
   * 적응형 앞면. @capacitor/assets가 앞면에 16.7% 여백(inset)을 넣어 이 그림을 보이는 72dp 영역에 맞추므로
   * 그 안의 원 마스크에 잘리지 않을 만큼만 줄인다
   */
  foreground: 0.7,
} as const;

const css = (hex: number): string => `#${hex.toString(16).padStart(6, '0')}`;
export const ICON_BACKGROUND = css(THEME.sky.bottom);

type Layer = 'icon-only' | 'icon-foreground' | 'icon-background';

function draw(layer: Layer): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d를 쓸 수 없다');
  if (layer !== 'icon-foreground') {
    ctx.fillStyle = ICON_BACKGROUND;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  if (layer !== 'icon-background') {
    // 블록 그림(80/100)이 원하는 지름이 되도록 그릴 칸 크기를 정해 가운데에 둔다
    const ratio = layer === 'icon-only' ? BLOCK_RATIO.only : BLOCK_RATIO.foreground;
    const box = (SIZE * ratio) / 0.8;
    ctx.save();
    ctx.translate((SIZE - box) / 2, (SIZE - box) / 2);
    drawBlockOnCanvas(ctx, box, 0, 'normal');
    ctx.restore();
  }
  return canvas;
}

export function renderAppIconPage(): void {
  document.body.style.cssText = 'margin:0;padding:16px;font-family:sans-serif;background:#eee';
  for (const layer of ['icon-only', 'icon-foreground', 'icon-background'] as const) {
    const canvas = draw(layer);
    canvas.id = layer;
    canvas.style.cssText = 'width:256px;height:256px;margin:8px;background:#ccc';
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${layer}.png`;
    link.textContent = `${layer}.png`;
    link.style.cssText = 'display:block;margin:0 8px 16px';
    document.body.append(canvas, link);
  }
}
