// V2-W2-08: Node가 쓴 out/node-scores.json의 로그를 Deno에서 다시 돌려 리플레이 결과·서버 판정·제출 해시를
// 대조한다 (런타임 이식성). 이어서 실제 브라우저 기록 fixtures/browser-runs.json을 리플레이해 결과 화면 점수와
// 대조하고 서버 판정 통과를 본다 (화면 경로 일치).
// 사용: deno run --allow-read [--sloppy-imports] scripts/server-poc/deno/compare.ts <server 모듈 경로> [이름]
// server 모듈은 replayTimeAttack·verifySubmission·submissionHash를 export한다 (배포 번들 supabase/functions/_shared/replay.js).

declare const Deno: {
  args: string[];
  version: { deno: string; v8: string; typescript: string };
  readTextFile(path: string): Promise<string>;
  cwd(): string;
  exit(code: number): never;
};

type Verdict = Record<string, unknown>;
interface Run {
  seed: number;
  moves: unknown[];
  result: Record<string, number>;
  verdict: Verdict;
  hash: string;
}
interface Server {
  version: string;
  issuedAtMs: number;
  submittedAtMs: number;
}

const [modulePath, label = modulePath] = Deno.args;
if (!modulePath) {
  console.error('server 모듈 경로를 주세요');
  Deno.exit(2);
}

const nodeOut = new URL('../out/node-scores.json', import.meta.url);
const { runtime, server, runs } = JSON.parse(await Deno.readTextFile(nodeOut.pathname)) as {
  runtime: string;
  server: Server;
  runs: Run[];
};
const moduleUrl = new URL(modulePath, `file://${Deno.cwd()}/`).href;
const { replayTimeAttack, verifySubmission, submissionHash } = (await import(moduleUrl)) as {
  replayTimeAttack: (seed: number, moves: unknown[]) => Record<string, number>;
  verifySubmission: (
    submission: { seed: number; moves: unknown; clientScore: unknown; version: unknown },
    server: Server,
  ) => Verdict;
  submissionHash: (payload: {
    moves: unknown[];
    clientScore: number;
    version: string;
  }) => Promise<string>;
};

const started = performance.now();
const mismatches: string[] = [];
let rejected = 0;
for (const run of runs) {
  const got = replayTimeAttack(run.seed, run.moves);
  const fields = Object.keys(run.result);
  const diff = fields.filter((k) => got[k] !== run.result[k]);
  if (Object.keys(got).length !== fields.length) diff.push('필드 수');
  const submission = { moves: run.moves, clientScore: run.result.score!, version: server.version };
  const verdict = verifySubmission({ seed: run.seed, ...submission }, server);
  if (JSON.stringify(verdict) !== JSON.stringify(run.verdict)) diff.push('verdict');
  const hash = await submissionHash(submission);
  if (hash !== run.hash) diff.push('hash');
  if (verdict.ok !== true) rejected++;
  if (diff.length > 0) {
    mismatches.push(
      `seed ${run.seed}: ${diff.map((k) => `${k} node=${JSON.stringify(k in run ? run[k as keyof Run] : run.result[k])} deno=${JSON.stringify(k === 'verdict' ? verdict : k === 'hash' ? hash : got[k])}`).join(', ')}`,
    );
  }
}
const ms = performance.now() - started;
const ok = runs.length - mismatches.length;
console.log(
  `[${label}] ${runtime} vs deno ${Deno.version.deno}: ${ok}/${runs.length} 일치 (리플레이·판정·해시, 거부 ${rejected}판, ${ms.toFixed(0)}ms, 판당 ${(ms / runs.length).toFixed(2)}ms)`,
);
for (const line of mismatches.slice(0, 10)) console.log(`  ${line}`);

const fixture = new URL('../fixtures/browser-runs.json', import.meta.url);
const browser = JSON.parse(await Deno.readTextFile(fixture.pathname)) as {
  runs: { seed: number; kind: string; screenScore: number; moves: unknown[] }[];
};
const screen = browser.runs.map((run) => {
  const score = replayTimeAttack(run.seed, run.moves).score;
  const verdict = verifySubmission(
    { seed: run.seed, moves: run.moves, clientScore: run.screenScore, version: server.version },
    server,
  );
  return { ...run, score, ok: score === run.screenScore && verdict.ok === true, verdict };
});
console.log(
  `[${label}] 브라우저 기록 ${screen.filter((r) => r.ok).length}/${screen.length} 화면 점수 일치·판정 통과: ` +
    screen
      .map(
        (r) =>
          `${r.kind} ${r.seed} ${r.score}${r.score === r.screenScore ? '' : `≠${r.screenScore}`}` +
          (r.verdict.ok === true ? '' : ` 거부 ${String(r.verdict.reason)}`),
      )
      .join(', '),
);
const screenFail = screen.some((r) => !r.ok) || screen.length === 0;
if (mismatches.length > 0 || runs.length === 0 || screenFail) Deno.exit(1);
