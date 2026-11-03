// 물결(가리비) 테두리의 바깥 윤곽. Phaser·캔버스 없는 순수 함수라 테스트할 수 있다.
// 변마다 둥근 혹이 이어지고 모서리는 둥글게 돌아간다. 안쪽(칸 쪽) 가장자리는 곧아서 여기 없다.

export type PathCmd =
  { op: 'M'; x: number; y: number } | { op: 'Q'; cx: number; cy: number; x: number; y: number };

export interface ScallopOptions {
  /** 혹이 튀어나온 깊이 (px) */
  depth: number;
  /** 혹 하나의 목표 폭 (px). 변 길이에 맞춰 개수를 정수로 맞춘다 */
  bump: number;
  /** 모서리 둥근 정도 (px) */
  corner: number;
  /** 윤곽이 가장자리에서 떨어진 거리 (테두리 선이 잘리지 않게) */
  inset: number;
}

/** 한 변에 들어갈 혹 개수. 모서리를 뺀 직선 길이를 bump로 나눠 반올림, 최소 1 */
export function bumpCount(length: number, bump: number): number {
  return Math.max(1, Math.round(length / bump));
}

/** w x h 판의 물결 윤곽을 위쪽 가운데 왼쪽에서 시계 방향으로 한 바퀴. 마지막은 시작점으로 닫힌다 */
export function scallopOutline(w: number, h: number, opt: ScallopOptions): PathCmd[] {
  const { depth, bump, corner, inset } = opt;
  const left = inset + depth;
  const right = w - inset - depth;
  const top = inset + depth;
  const bottom = h - inset - depth;
  const cmds: PathCmd[] = [{ op: 'M', x: left + corner, y: top }];

  // 혹 하나: 기준선에서 depth만큼 바깥으로 불룩. 2차 곡선의 꼭대기는 제어점의 절반이라 제어점은 2배
  const side = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    out: { x: number; y: number },
  ): void => {
    const n = bumpCount(Math.hypot(to.x - from.x, to.y - from.y), bump);
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n;
      const b = (i + 1) / n;
      cmds.push({
        op: 'Q',
        cx: from.x + (to.x - from.x) * a + out.x * depth * 2,
        cy: from.y + (to.y - from.y) * a + out.y * depth * 2,
        x: from.x + (to.x - from.x) * b,
        y: from.y + (to.y - from.y) * b,
      });
    }
  };
  const turn = (cx: number, cy: number, x: number, y: number): void => {
    cmds.push({ op: 'Q', cx, cy, x, y });
  };

  side({ x: left + corner, y: top }, { x: right - corner, y: top }, { x: 0, y: -1 });
  turn(right, top, right, top + corner);
  side({ x: right, y: top + corner }, { x: right, y: bottom - corner }, { x: 1, y: 0 });
  turn(right, bottom, right - corner, bottom);
  side({ x: right - corner, y: bottom }, { x: left + corner, y: bottom }, { x: 0, y: 1 });
  turn(left, bottom, left, bottom - corner);
  side({ x: left, y: bottom - corner }, { x: left, y: top + corner }, { x: -1, y: 0 });
  turn(left, top, left + corner, top);
  return cmds;
}
