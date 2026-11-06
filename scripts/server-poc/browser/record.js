// V2-W2-08 리뷰 반영: 경쟁 모드 한 판의 실제 입력 기록기. dev 서버(`npm run dev`) 페이지에 Playwright
// `page.addInitScript({ path })`로 넣는다. src는 고치지 않고, 앱과 같은 URL로 GameScene 모듈을 가져와(같은 인스턴스)
// trySwap·finish를 감싼다. 결과는 `window.__rec`:
// - moves: 게임이 받은 스왑만 { from, to, t } (t = 제한 시간 − timeLeftMs()를 내림한 정수 ms, trySwap 시작 순간)
// - rejected: busy·시간 종료로 게임이 무시한 입력 수 / inFlightAtTimeUp: 재생 중에 시간이 끝난 스왑의 순번
// - screenScore: 결과 화면으로 넘긴 점수 (GameScene.finish → mode.result().score)
// - scene: GameScene 인스턴스 (driver가 칸 좌표를 구할 때 쓴다)
(() => {
  const rec = {
    ready: false,
    error: null,
    scene: null,
    limitMs: null,
    moves: [],
    rejected: 0,
    inFlightAtTimeUp: [],
    screenScore: null,
  };
  window.__rec = rec;

  // 앱이 실제로 불러온 URL(수정 뒤에는 `?t=…`가 붙는다)이어야 같은 모듈이다. main.ts가 불러올 때까지 기다린다
  const moduleUrl = () =>
    new Promise((resolve) => {
      const find = () => {
        const url = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .find((n) => new URL(n).pathname === '/src/scenes/GameScene.ts');
        if (url) resolve(url);
        else setTimeout(find, 5);
      };
      find();
    });

  moduleUrl()
    .then((url) => import(url))
    .then(({ GameScene }) => {
      const proto = GameScene.prototype;
      const create = proto.create;
      proto.create = function (...args) {
        rec.scene = this;
        const out = create.apply(this, args);
        rec.limitMs = this.mode.timeLeftMs?.() ?? null;
        return out;
      };
      const trySwap = proto.trySwap;
      proto.trySwap = function (a, b) {
        // GameScene.trySwap 첫 줄과 같은 조건: 이때만 게임이 스왑을 받는다
        if (this.busy || this.finished || !this.mode.canInput()) {
          rec.rejected++;
          return trySwap.call(this, a, b);
        }
        const index = rec.moves.length;
        rec.moves.push({
          from: { r: a.r, c: a.c },
          to: { r: b.r, c: b.c },
          t: Math.floor(rec.limitMs - this.mode.timeLeftMs()), // 정수 ms (PLAN2 5.8)
        });
        return trySwap.call(this, a, b).then((v) => {
          if (this.mode.timeLeftMs() === 0) rec.inFlightAtTimeUp.push(index);
          return v;
        });
      };
      const finish = proto.finish;
      proto.finish = function (...args) {
        const already = this.finished;
        const out = finish.apply(this, args);
        if (!already) rec.screenScore = this.mode.result().score;
        return out;
      };
      rec.ready = true;
    })
    .catch((e) => {
      rec.error = String(e);
    });
})();
