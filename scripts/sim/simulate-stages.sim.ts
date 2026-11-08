// `npm run stages:sim`: public/stages/story.json의 스테이지마다 자동 플레이를 여러 판 돌려 표로 찍는다 (W4-19).
// 판 수: SIM_GAMES=500 npm run stages:sim (기본 300). 일부만: SIM_STAGES=11-20
// vitest로 돌리는 이유: TypeScript(src/core)를 따로 빌드하지 않고 그대로 읽는다. 테스트가 아니라 측정 도구라 tests/ 밖에 둔다.

import { it } from 'vitest';
import storyRaw from '../../public/stages/story.json?raw';
import { colorName, parseStory, type Goal, type StageDef } from '../../src/data/stageSchema';
import { measureStage, summarizeObstacles } from './stageSim';

const env = import.meta.env as Record<string, string | undefined>;
const games = Number(env.SIM_GAMES) || 300;
const [from, to] = (env.SIM_STAGES ?? '1-999').split('-').map(Number) as [number, number];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const num = (x: number) => Math.round(x).toLocaleString('en-US');
const goalText = (g: Goal) => {
  if (g.type === 'score') return `${num(g.target)}점`;
  if (g.type === 'collect') return `${colorName(g.color)} ${g.count}`;
  if (g.type === 'clearJelly') return '젤리 전부';
  return `${g.obstacle} ${g.count}`;
};

it(`스토리 자동 플레이 ${games}판씩`, { timeout: 600_000 }, () => {
  const stages: StageDef[] = parseStory(JSON.parse(storyRaw)).filter(
    (s) => s.id >= from && s.id <= (to || from),
  );
  // 스테이지마다 같은 seed 목록 (1..games)
  const seeds = Array.from({ length: games }, (_, i) => i + 1);
  const rows = [
    '| # | 색 | 이동 | 미션 | 장애물 | 클리어율 | 남은 장애물 | 전체 중간값 | 클리어 판 50% / 80% | 70% / 95% | 별 (1 / 2 / 3) | 별 ≥1 / ≥2 / ≥3 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const stage of stages) {
    const s = measureStage(stage, seeds);
    rows.push(
      `| ${stage.id} | ${stage.colors} | ${stage.moves} | ${stage.goals.map(goalText).join(' + ')} | ` +
        `${summarizeObstacles(stage.layers)} | ${pct(s.clearRate)} | ` +
        `${s.avgObstacleLeft === undefined ? '-' : s.avgObstacleLeft.toFixed(1)} | ` +
        `${num(s.medianScore)} | ${num(s.clearP50)} / ${num(s.clearP80)} | ` +
        `${num(s.clearP70)} / ${num(s.clearP95)} | ` +
        `${stage.stars.map(num).join(' / ')} | ${s.starRates.map(pct).join(' / ')} |`,
    );
  }
  console.log(`\n자동 플레이 ${games}판 (seed 1~${games})\n\n${rows.join('\n')}\n`);
});
