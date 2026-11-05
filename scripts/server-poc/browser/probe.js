// V2-W2-08 D: 경쟁 모드 시간 실측 프로브. dev 서버(`npm run dev`)의 `/?demo&seed=N` 페이지에 넣어 돌린다.
// 사용: Playwright `page.addInitScript({ path })`로 페이지 로드 전에 넣거나, DevTools 콘솔에 붙여 넣는다 (그때는 시작 직후).
// 끝나면 `window.__probe.summary()`가 측정값을 돌려준다. DEV 전용 `window.__ddooby`(GameScene.exposeDebug)만 읽는다.
//
// 재는 것 (performance.now 기준 벽시계 ms):
// - 스왑: busy가 false→true가 된 순간을 스왑 시작, true→false를 재생 끝으로 본다 (입력은 busy 동안 막힌다)
// - 타임 업: timeLeft()가 처음 0이 된 프레임 / 결과 화면: scene.start('Result')가 불린 순간
// - 게임 시작: timeLeft()가 처음 제한 시간 아래로 내려간 프레임에서 줄어든 만큼을 빼서 추정
(() => {
  const probe = {
    patched: false,
    startWall: null,
    limitMs: null,
    swaps: [],
    timeUpWall: null,
    resultWall: null,
    timerAtResult: null,
    frames: 0,
  };
  window.__probe = probe;
  let prevBusy = false;
  let open = null;

  // 앱이 쓰는 phaser 모듈(같은 URL이면 같은 인스턴스)을 가져와 씬 전환을 기록한다
  const patch = async () => {
    const url = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((n) => n.includes('/deps/phaser.js'));
    if (!url) return;
    probe.patched = true;
    const mod = await import(url);
    const Phaser = mod.default ?? mod;
    const proto = Phaser.Scenes.ScenePlugin.prototype;
    const start = proto.start;
    proto.start = function (key, data) {
      if (key === 'Result' && probe.resultWall === null) probe.resultWall = performance.now();
      return start.call(this, key, data);
    };
  };

  const loop = () => {
    const now = performance.now();
    if (!probe.patched) void patch();
    const d = window.__ddooby;
    if (d && typeof d.timeLeft === 'function' && probe.resultWall === null) {
      probe.frames++;
      const left = d.timeLeft();
      if (probe.limitMs === null && left !== null) probe.limitMs = left;
      if (probe.startWall === null && left !== null && left < probe.limitMs) {
        probe.startWall = now - (probe.limitMs - left);
      }
      const busy = d.busy();
      if (!prevBusy && busy && left > 0) {
        open = { start: now, gameT: probe.limitMs - left, moves: d.moves() };
      } else if (prevBusy && !busy && open) {
        probe.swaps.push({ ...open, end: now, valid: d.moves() > open.moves });
        open = null;
      }
      prevBusy = busy;
      if (left === 0 && probe.timeUpWall === null) probe.timeUpWall = now;
    }
    if (probe.resultWall === null) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const stats = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const r = (v) => Math.round(v);
    return s.length === 0
      ? null
      : { n: s.length, min: r(s[0]), median: r(s[s.length >> 1]), max: r(s[s.length - 1]) };
  };
  probe.summary = () => {
    const starts = probe.swaps.map((s) => s.start);
    return {
      seed: window.__ddooby?.seed,
      swaps: probe.swaps.length,
      valid: probe.swaps.filter((s) => s.valid).length,
      /** 연속 스왑 시작 사이 간격 (데모는 재생 끝 + 600ms 뒤 다음 수) */
      startGap: stats(starts.slice(1).map((t, i) => t - starts[i])),
      /** 재생(입력 막힘) 시간: 사람이 다음 스왑을 시작할 수 있는 하한 */
      busy: stats(probe.swaps.map((s) => s.end - s.start)),
      busyInvalid: stats(probe.swaps.filter((s) => !s.valid).map((s) => s.end - s.start)),
      /** 게임 시작 → 타임 업 (벽시계, 제한 시간과의 차이가 타이머 오차) */
      startToTimeUp:
        probe.timeUpWall && probe.startWall && Math.round(probe.timeUpWall - probe.startWall),
      /** 타임 업 → 결과 화면 (마무리 재생 + 마지막 팡 + endHold) */
      timeUpToResult:
        probe.resultWall && probe.timeUpWall && Math.round(probe.resultWall - probe.timeUpWall),
      startToResult:
        probe.resultWall && probe.startWall && Math.round(probe.resultWall - probe.startWall),
      score: window.__ddooby?.score(),
      moves: window.__ddooby?.moves(),
    };
  };
})();
