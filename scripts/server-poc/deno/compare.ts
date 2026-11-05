// V2-W2-08: Node가 쓴 out/node-scores.json의 로그를 Deno에서 리플레이해 점수를 대조한다 (런타임 이식성).
// 이어서 실제 브라우저에서 기록한 fixtures/browser-runs.json을 리플레이해 결과 화면 점수와 대조한다 (화면 경로 일치).
// 사용: deno run --allow-read [--sloppy-imports] scripts/server-poc/deno/compare.ts <replay 모듈 경로> [이름]
// replay 모듈은 replayTimeAttack을 export해야 한다 (원본 replay.ts, 번들 .js 등 가져오는 방식별로 바꿔 넣는다).

declare const Deno: {
  args: string[];
  version: { deno: string; v8: string; typescript: string };
  readTextFile(path: string): Promise<string>;
  cwd(): string;
  exit(code: number): never;
};

interface Run {
  seed: number;
  moves: unknown[];
  result: Record<string, number>;
}

const [modulePath, label = modulePath] = Deno.args;
if (!modulePath) {
  console.error('replay 모듈 경로를 주세요');
  Deno.exit(2);
}

const nodeOut = new URL('../out/node-scores.json', import.meta.url);
const { runtime, runs } = JSON.parse(await Deno.readTextFile(nodeOut.pathname)) as {
  runtime: string;
  runs: Run[];
};
const moduleUrl = new URL(modulePath, `file://${Deno.cwd()}/`).href;
const { replayTimeAttack } = (await import(moduleUrl)) as {
  replayTimeAttack: (seed: number, moves: unknown[]) => Record<string, number>;
};

const started = performance.now();
const mismatches: string[] = [];
for (const run of runs) {
  const got = replayTimeAttack(run.seed, run.moves);
  const fields = Object.keys(run.result);
  const diff = fields.filter((k) => got[k] !== run.result[k]);
  if (diff.length > 0 || Object.keys(got).length !== fields.length) {
    mismatches.push(
      `seed ${run.seed}: ${diff.map((k) => `${k} node=${run.result[k]} deno=${got[k]}`).join(', ')}`,
    );
  }
}
const ms = performance.now() - started;
const ok = runs.length - mismatches.length;
console.log(
  `[${label}] ${runtime} vs deno ${Deno.version.deno}: ${ok}/${runs.length} 일치 (리플레이 ${ms.toFixed(0)}ms, 판당 ${(ms / runs.length).toFixed(2)}ms)`,
);
for (const line of mismatches.slice(0, 10)) console.log(`  ${line}`);

const fixture = new URL('../fixtures/browser-runs.json', import.meta.url);
const browser = JSON.parse(await Deno.readTextFile(fixture.pathname)) as {
  runs: { seed: number; kind: string; screenScore: number; moves: unknown[] }[];
};
const screen = browser.runs.map((run) => {
  const score = replayTimeAttack(run.seed, run.moves).score;
  return { ...run, score, ok: score === run.screenScore };
});
console.log(
  `[${label}] 브라우저 기록 ${screen.filter((r) => r.ok).length}/${screen.length} 화면 점수 일치: ` +
    screen
      .map((r) => `${r.kind} ${r.seed} ${r.score}${r.ok ? '' : `≠${r.screenScore}`}`)
      .join(', '),
);
const screenFail = screen.some((r) => !r.ok) || screen.length === 0;
if (mismatches.length > 0 || runs.length === 0 || screenFail) Deno.exit(1);
