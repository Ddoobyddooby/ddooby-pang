// `npm run stages:sim`: public/stages/story.json의 스테이지마다 자동 플레이를 여러 판 돌려 표로 찍는다 (W4-19).
// 판 수: SIM_GAMES=500 npm run stages:sim (기본 300). 일부만: SIM_STAGES=11-20
// vitest로 돌리는 이유: TypeScript(src/core)를 따로 빌드하지 않고 그대로 읽는다. 테스트가 아니라 측정 도구라 tests/ 밖에 둔다.

import { it } from 'vitest';
import storyRaw from '../../public/stages/story.json?raw';
import { colorName, parseStory, type Goal, type StageDef } from '../../src/data/stageSchema';
import { greedyBot } from './greedyBot';
import { firstHintBot, measureStage, summarizeObstacles, type StageStats } from './stageSim';

const env = import.meta.env as Record<string, string | undefined>;
const games = Number(env.SIM_GAMES) || 300;
const [from, to] = (env.SIM_STAGES ?? '1-999').split('-').map(Number) as [number, number];

// SIM_BOT=first|greedy|both (기본 both). both면 클리어율·남은 장애물·별 비율을 두 봇 나란히, 점수 지점은 탐욕 봇 기준
const botEnv = env.SIM_BOT ?? 'both';
if (!['first', 'greedy', 'both'].includes(botEnv))
  throw new Error(`SIM_BOT=${botEnv}: first|greedy|both`);
const useFirst = botEnv !== 'greedy';
const useGreedy = botEnv !== 'first';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const num = (x: number) => Math.round(x).toLocaleString('en-US');
const goalText = (g: Goal) => {
  if (g.type === 'score') return `${num(g.target)}점`;
  if (g.type === 'collect') return `${colorName(g.color)} ${g.count}`;
  if (g.type === 'clearJelly') return '젤리 전부';
  return `${g.obstacle} ${g.count}`;
};

it(`스토리 자동 플레이 ${games}판씩 (봇 ${botEnv})`, { timeout: 3_600_000 }, () => {
  const stages: StageDef[] = parseStory(JSON.parse(storyRaw)).filter(
    (s) => s.id >= from && s.id <= (to || from),
  );
  // 스테이지마다 같은 seed 목록 (1..games)
  const seeds = Array.from({ length: games }, (_, i) => i + 1);
  const pair = (a: string, b: string) => (useFirst && useGreedy ? `${a} / ${b}` : useFirst ? a : b);
  const left = (s?: StageStats) =>
    s?.avgObstacleLeft === undefined ? '-' : s.avgObstacleLeft.toFixed(1);
  const stars = (s: StageStats) => s.starRates.map(pct).join('·');
  const tag = pair('첫', '탐욕');
  const rows = [
    `| # | 색 | 이동 | 미션 | 장애물 | 클리어율 (${tag}) | 남은 장애물 (${tag}) | 전체 중간값 | 클리어 판 50% / 80% | 70% / 95% | 별 (1 / 2 / 3) | 별 ≥1·≥2·≥3 (${tag}) |`,
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  const t0 = Date.now();
  for (const stage of stages) {
    const first = useFirst ? measureStage(stage, seeds, firstHintBot) : undefined;
    const greedy = useGreedy ? measureStage(stage, seeds, greedyBot) : undefined;
    const main = (greedy ?? first)!; // 점수 지점은 탐욕 봇 기준 (한 봇만 고르면 그 봇)
    const both = (f: (s: StageStats) => string) =>
      [first, greedy]
        .filter((s) => s)
        .map((s) => f(s!))
        .join(' / ');
    rows.push(
      `| ${stage.id} | ${stage.colors} | ${stage.moves} | ${stage.goals.map(goalText).join(' + ')} | ` +
        `${summarizeObstacles(stage.layers)} | ${both((s) => pct(s.clearRate))} | ${both((s) => left(s))} | ` +
        `${num(main.medianScore)} | ${num(main.clearP50)} / ${num(main.clearP80)} | ` +
        `${num(main.clearP70)} / ${num(main.clearP95)} | ${stage.stars.map(num).join(' / ')} | ` +
        `${both(stars)} |`,
    );
  }
  const sec = (Date.now() - t0) / 1000;
  const played = stages.length * games * (Number(useFirst) + Number(useGreedy));
  console.log(
    `\n자동 플레이 ${games}판 (seed 1~${games}, 봇 ${botEnv})\n\n${rows.join('\n')}\n\n` +
      `${played}판 ${sec.toFixed(1)}초 (판당 ${((sec / played) * 1000).toFixed(1)}ms)\n`,
  );
});
