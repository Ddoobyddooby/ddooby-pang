import { describe, expect, it } from 'vitest';
import { parseStory, parseTimeAttack } from '../../src/data/stageSchema';
// 실제 파일을 문자열로 읽는다 (Vite ?raw, node 타입 없이)
import storyRaw from '../../public/stages/story.json?raw';
import timeattackRaw from '../../public/stages/timeattack.json?raw';

describe('public/stages/story.json (W3-03)', () => {
  const story = parseStory(JSON.parse(storyRaw)); // 검증에 실패하면 여기서 던진다

  it('스테이지 10개, id는 1~10', () => {
    expect(story).toHaveLength(10);
    expect(story.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('색 수는 4 → 6으로 줄지 않는다', () => {
    const colors = story.map((s) => s.colors);
    expect(colors[0]).toBe(4);
    expect(colors.at(-1)).toBe(6);
    colors.slice(1).forEach((c, i) => expect(c).toBeGreaterThanOrEqual(colors[i]!));
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
