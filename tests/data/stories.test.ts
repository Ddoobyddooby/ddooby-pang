import { describe, expect, it } from 'vitest';
import { parseStory, parseTimeAttack } from '../../src/data/stageSchema';
// 실제 파일을 문자열로 읽는다 (Vite ?raw, node 타입 없이)
import storyRaw from '../../public/stages/story.json?raw';
import timeattackRaw from '../../public/stages/timeattack.json?raw';

describe('public/stages/story.json (W3-03, W4-19, W4-27, V2-W4-01)', () => {
  const story = parseStory(JSON.parse(storyRaw)); // 검증에 실패하면 여기서 던진다

  it('스테이지 30개, id는 1~30 (W4-27)', () => {
    expect(story).toHaveLength(30);
    expect(story.map((s) => s.id)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  // 색 수·이동 수·장애물 순서는 storyStages.test.ts (PLAN2 6.6)

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
