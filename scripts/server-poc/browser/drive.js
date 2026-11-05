// V2-W2-08 리뷰 반영: 경쟁 모드 한 판을 실제 마우스 드래그로 끝까지 두고 record.js의 기록을 돌려준다.
// Playwright `browser_run_code`(MCP) 등에 `async (page) => drive(page, { seed, strategy })` 형태로 붙여 쓴다.
// 입력은 화면 좌표 드래그라 BoardInput → GameScene.trySwap 경로를 그대로 탄다.
//
// strategy
// - 'hand': 사람 흉내. 입력이 열리면 150~700ms 생각한 뒤 75% 힌트 수, 25% 아무 인접 칸(대부분 무효).
//   시간이 거의 끝나면 남은 시간 250ms 전에 힌트 수를 둬서 "재생 중에 타임 업"을 만든다
// - 'rngValid': 가능한 유효 스왑 목록(행 우선, 칸마다 오른쪽 → 아래)에서 seed RNG(seed*7+1)로 고른다.
//   셔플이 일어나는 seed(4860: 29번째 수, 16824: 26번째 수)를 core 탐색과 같은 순서로 재현한다
// - 'demo': `?demo` 자동 플레이를 그대로 기록만 한다 (입력하지 않음)
// postUrl을 주면 기록을 그 주소로 POST한다 (MCP 샌드박스는 파일을 쓸 수 없어 로컬 수집 서버로 받는다)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function drive(page, { seed, strategy, recordPath, postUrl }) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript({ path: recordPath });
  await page.goto(`http://localhost:5173/?${strategy === 'demo' ? 'demo&' : ''}seed=${seed}`);
  await page.waitForFunction(() => window.__rec?.scene && window.__ddooby, null, {
    timeout: 20000,
  });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  while (strategy !== 'demo') {
    // 입력이 열릴 때까지 (재생 중·시간 종료면 닫혀 있다)
    const state = await page.evaluate(() => {
      const s = window.__rec.scene;
      return {
        open: s.boardInput.enabled && !s.busy,
        left: s.mode.timeLeftMs(),
        over: s.finale || s.finished,
      };
    });
    if (state.over || state.left === 0) break;
    if (!state.open) {
      await sleep(16);
      continue;
    }
    let think = strategy === 'hand' ? 150 + Math.random() * 550 : 120 + Math.random() * 200;
    const endgame = state.left - think < 300;
    if (endgame) think = Math.max(0, state.left - 250);
    await sleep(think);

    const move = await page.evaluate(
      async ({ seed, strategy, random, endgame }) => {
        const s = window.__rec.scene;
        const { findHint, isValidSwap } = await import('/src/core/moves.ts');
        const { createRng, next, nextInt } = await import('/src/core/rng.ts');
        const board = s.state.board;
        let a;
        let b;
        if (strategy === 'rngValid') {
          const valid = [];
          for (let r = 0; r < board.rows; r++) {
            for (let c = 0; c < board.cols; c++) {
              if (c + 1 < board.cols && isValidSwap(board, { r, c }, { r, c: c + 1 }))
                valid.push([
                  { r, c },
                  { r, c: c + 1 },
                ]);
              if (r + 1 < board.rows && isValidSwap(board, { r, c }, { r: r + 1, c }))
                valid.push([
                  { r, c },
                  { r: r + 1, c },
                ]);
            }
          }
          let rng = createRng(seed * 7 + 1);
          for (let i = 0; i < s.moves; i++) rng = next(rng)[1];
          [a, b] = valid[nextInt(rng, valid.length)[0]];
        } else if (endgame || random[0] < 0.75) {
          const hint = findHint(board);
          [a, b] = random[1] < 0.5 ? [hint.a, hint.b] : [hint.b, hint.a];
        } else {
          a = { r: Math.floor(random[2] * board.rows), c: Math.floor(random[3] * board.cols) };
          const dirs = [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ].filter(([dr, dc]) => {
            const r = a.r + dr;
            const c = a.c + dc;
            return r >= 0 && r < board.rows && c >= 0 && c < board.cols;
          });
          const [dr, dc] = dirs[Math.floor(random[1] * dirs.length)];
          b = { r: a.r + dr, c: a.c + dc };
        }
        // 게임 좌표 → 페이지 좌표 (카메라 가운데 맞춤 scroll, 캔버스 표시 배율)
        const L = s.view.layout;
        const rect = s.game.canvas.getBoundingClientRect();
        const k = rect.width / s.scale.width;
        const cam = s.cameras.main;
        const at = (p) => ({
          x: rect.left + (L.x + (p.c + 0.5) * L.cell - cam.scrollX) * k,
          y: rect.top + (L.y + (p.r + 0.5) * L.cell - cam.scrollY) * k,
        });
        return { a, b, from: at(a), to: at(b) };
      },
      {
        seed,
        strategy,
        random: [Math.random(), Math.random(), Math.random(), Math.random()],
        endgame,
      },
    );
    // 드래그: 누른 칸에서 이웃 칸 방향으로 0.6칸 (스와이프 문턱 0.3칸)
    const { from, to } = move;
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + (to.x - from.x) * 0.6, from.y + (to.y - from.y) * 0.6, {
      steps: 3,
    });
    await page.mouse.up();
    await sleep(30);
  }

  await page.waitForFunction(() => window.__rec.screenScore !== null, null, {
    timeout: strategy === 'demo' ? 100000 : 30000,
    polling: 500,
  });
  return page.evaluate(
    async ({ seed, strategy, postUrl }) => {
      const { moves, screenScore, rejected, inFlightAtTimeUp, limitMs } = window.__rec;
      const run = { seed, kind: strategy, limitMs, screenScore, rejected, inFlightAtTimeUp, moves };
      if (postUrl) await fetch(postUrl, { method: 'POST', body: JSON.stringify(run) });
      return { seed, kind: strategy, screenScore, moves: moves.length, inFlightAtTimeUp };
    },
    { seed, strategy, postUrl },
  );
}
