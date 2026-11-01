import { describe, expect, it } from 'vitest';
import { parseStory, parseTimeAttack } from '../../src/data/stageSchema';
// 실제 파일을 문자열로 읽는다 (Vite ?raw, node 타입 없이)
import storyRaw from '../../public/stages/story.json?raw';
import timeattackRaw from '../../public/stages/timeattack.json?raw';

describe('public/stages/story.json (W3-03, W4-19)', () => {
  const story = parseStory(JSON.parse(storyRaw)); // 검증에 실패하면 여기서 던진다

  it('스테이지 20개, id는 1~20 (W4-19)', () => {
    expect(story).toHaveLength(20);
    expect(story.map((s) => s.id)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('1~10: 색 수는 4 → 6으로 줄지 않는다', () => {
    const colors = story.slice(0, 10).map((s) => s.colors);
    expect(colors[0]).toBe(4);
    expect(colors.at(-1)).toBe(6);
    colors.slice(1).forEach((c, i) => expect(c).toBeGreaterThanOrEqual(colors[i]!));
  });

  // PLAN 6.12: 11~13 쉬어 가는 판(5색, 미션 하나), 14~17 두 미션, 18~20 6색 + 두 미션, 이동 18~25
  it.each([
    [11, 13, 5, 1],
    [14, 17, 5, 2],
    [18, 20, 6, 2],
  ])('%i~%i: %i색, 미션 %i개', (first, last, colors, goals) => {
    for (const s of story.slice(first - 1, last)) {
      expect(s.colors, `${s.id}번`).toBe(colors);
      expect(s.goals, `${s.id}번`).toHaveLength(goals);
    }
  });

  it('11~20: 이동 18~25', () => {
    for (const s of story.slice(10)) {
      expect(s.moves).toBeGreaterThanOrEqual(18);
      expect(s.moves).toBeLessThanOrEqual(25);
    }
  });

  it('별 기준은 오름차순, 점수 미션이 있으면 별 1 = 미션 점수', () => {
    for (const s of story) {
      const [a, b, c] = s.stars;
      expect(a, `${s.id}번`).toBeLessThan(b);
      expect(b, `${s.id}번`).toBeLessThan(c);
      const score = s.goals.find((g) => g.type === 'score');
      if (score?.type === 'score') expect(a, `${s.id}번`).toBe(score.target);
    }
  });

  it('seed는 넣지 않는다 (다시 할 때마다 다른 보드)', () => {
    expect(story.every((s) => s.seed === undefined)).toBe(true);
  });
});

describe('public/stages/timeattack.json', () => {
  it('검증을 통과한다', () => {
    expect(parseTimeAttack(JSON.parse(timeattackRaw)).timeLimit).toBeGreaterThan(0);
  });
});
