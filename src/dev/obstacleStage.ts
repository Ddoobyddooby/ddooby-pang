// DEV 전용 ?obstacles: 장애물 시험 스테이지 (PLAN2 5.4). 잠금, 얼음벽 1~3겹, 젤리 1~2겹, 잠금 + 젤리를 다 넣는다.
// story.json과 같은 검증(parseStory)을 거친다. 결과는 저장하지 않는다 (GameScene).

import { parseStory, type StageDef } from '../data/stageSchema';

const RAW = {
  id: 1,
  rows: 8,
  cols: 8,
  colors: 5,
  moves: 30,
  layout: [
    '........',
    '.L....L.',
    '..1..2..',
    '...3....',
    'jjjjJJJJ',
    'KK....KK',
    'jjjjJJJJ',
    '........',
  ],
  layers: {
    L: { type: 'lock' },
    '1': { type: 'frost', hp: 1 },
    '2': { type: 'frost', hp: 2 },
    '3': { type: 'frost', hp: 3 },
    j: { type: 'jelly', hp: 1 },
    J: { type: 'jelly', hp: 2 },
    K: [{ type: 'lock' }, { type: 'jelly', hp: 1 }],
  },
  goals: [{ type: 'clearJelly' }],
  stars: [3000, 6000, 9000],
  seed: 2001,
};

export function obstacleStage(): StageDef {
  return parseStory([RAW])[0]!;
}
