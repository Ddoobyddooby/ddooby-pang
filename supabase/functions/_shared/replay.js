// 자동 생성: npm run server:shared (src/replay/index.ts). 직접 고치지 않는다
// @ts-self-types="./replay.d.ts"
// src/config.ts
const BOARD = {
	/** 한 번의 resolve에서 허용하는 최대 연쇄 수. 넘으면 버그로 보고 assert (3색은 정상으로도 56까지, PLAN 4.3) */
	maxCascade: 200,
	/** 초기 생성·셔플 재시도 상한 */
	maxGenerateAttempts: 100
};
const SCORE = {
	perBlock: 10,
	match4: 120,
	match5: 200,
	match6Base: 300,
	match6Extra: 50,
	bySpecial: 20,
	/** 장애물 1겹(잠금 해제 1회, 얼음 1겹, 젤리 1겹)당. 연쇄 배율 적용 (PLAN2 5.2, V2-W2-02~04에서 쓴다) */
	obstacle: 50,
	cascadeStep: .5,
	/** 스토리 클리어 후 남은 이동 1회당 */
	movesLeftBonus: 300
};
/** 타임어택 모드 (PLAN 5절). W3-04에서 timeLimitMs를 timeattack.json으로 옮긴다 */
const TIMEATTACK = {
	timeLimitMs: 6e4,
	/** 남은 시간이 이 아래면 HUD 시간 강조 (W2-11) */
	warnMs: 1e4,
	/** 시간 0 뒤 마지막 팡 (SPEC 3.3, PLAN 6.14): 자동 발동 라운드 상한, 글자를 띄우고 기다리는 시간 (ms) */
	finale: {
		maxRounds: 20,
		bannerMs: 800,
		text: "타임 업!",
		endHoldMs: 1e3
	}
};
const SPECIAL = {
	/** 'perpendicular': 가로 4매치 → 세로줄 제거 (캔디크러시). 'parallel': 같은 방향 */
	lineDirection: "perpendicular",
	/** 새 특수 블록 칸이 같은 턴의 발동 범위에 걸리면. 'keep': 남김 (캔디크러시). 'explode': 바로 발동 */
	newSpecialInBlast: "keep"
};
// src/core/rng.ts
/** seed(정수)로 초기 상태를 만든다 */
function createRng(seed) {
	return seed | 0;
}
/** [0, 1) 실수 */
function next(state) {
	const s = state + 1831565813 | 0;
	let t = Math.imul(s ^ s >>> 15, 1 | s);
	t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
	return [((t ^ t >>> 14) >>> 0) / 4294967296, s];
}
/** [0, n) 정수 */
function nextInt(state, n) {
	const [v, s] = next(state);
	return [Math.floor(v * n), s];
}
// src/core/board.ts
function inBounds(board, { r, c }) {
	return r >= 0 && r < board.rows && c >= 0 && c < board.cols;
}
function indexOf(board, { r, c }) {
	return r * board.cols + c;
}
function posOf(board, index) {
	return {
		r: Math.floor(index / board.cols),
		c: index % board.cols
	};
}
/** 보드 밖이거나 빈칸이면 null */
function getBlock(board, pos) {
	if (!inBounds(board, pos)) return null;
	return board.cells[indexOf(board, pos)] ?? null;
}
function swapBlocks(board, a, b) {
	const cells = board.cells.slice();
	const ia = indexOf(board, a);
	const ib = indexOf(board, b);
	[cells[ia], cells[ib]] = [cells[ib], cells[ia]];
	return {
		...board,
		cells
	};
}
/** 그 칸의 장애물 층 (없으면 null) */
function layerAt(board, pos) {
	if (!board.layers || !inBounds(board, pos)) return null;
	return board.layers[indexOf(board, pos)] ?? null;
}
/** 얼음벽 칸인가 (블록이 없고 낙하·리필이 지나가지 못한다) */
function isFrost(board, pos) {
	return (layerAt(board, pos)?.frost ?? 0) > 0;
}
function isLocked(board, pos) {
	return layerAt(board, pos)?.lock === true;
}
/** 스왑할 수 있는 블록이 있는 칸인가 (블록이 있고 잠기지 않았다) */
function isMovable(board, pos) {
	return getBlock(board, pos) !== null && !isLocked(board, pos);
}
/** 상하좌우로 한 칸 차이 */
function isAdjacent(a, b) {
	return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}
function samePos(a, b) {
	return a.r === b.r && a.c === b.c;
}
/**
* 매치가 없는 보드를 만든다. 왼쪽 위부터 채우며, 왼쪽 2칸 또는 위쪽 2칸과 같은 색이면 후보에서 뺀다.
* layers가 있으면 얼음벽 칸은 비우고(RNG를 쓰지 않는다) 층을 보드에 붙인다. 잠긴 칸도 색은 seed로 정한다.
* 가능한 수가 있는지는 보장하지 않는다 (moves.ts의 createPlayableBoard가 담당).
*/
function createBoard(rows, cols, colors, rng, layers) {
	if (colors < 3 || colors > 6) throw new RangeError(`colors는 3~6이어야 한다: ${colors}`);
	if (layers && layers.length !== rows * cols) throw new RangeError(`layers 길이는 ${rows * cols}이어야 한다: ${layers.length}`);
	const cells = [];
	const colorAt = (r, c) => cells[r * cols + c]?.color;
	let nextId = 1;
	for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
		if ((layers?.[r * cols + c]?.frost ?? 0) > 0) {
			cells.push(null);
			continue;
		}
		const banned = /* @__PURE__ */ new Set();
		if (c >= 2 && colorAt(r, c - 1) === colorAt(r, c - 2)) banned.add(colorAt(r, c - 1));
		if (r >= 2 && colorAt(r - 1, c) === colorAt(r - 2, c)) banned.add(colorAt(r - 1, c));
		const candidates = [];
		for (let k = 0; k < colors; k++) if (!banned.has(k)) candidates.push(k);
		let pick;
		[pick, rng] = nextInt(rng, candidates.length);
		cells.push({
			id: nextId++,
			color: candidates[pick]
		});
	}
	return [{
		rows,
		cols,
		cells,
		nextId,
		...layers ? { layers } : {}
	}, rng];
}
// src/core/gravity.ts
/** 고정 칸: 얼음벽 칸 또는 잠긴 블록 칸 */
const isFixedAt = (board, i) => {
	const layer = board.layers?.[i];
	return (layer?.frost ?? 0) > 0 || layer?.lock === true;
};
/** 구간마다 블록을 아래로 모은다 (고정 칸 위에서 멈춘다). 구간 위쪽에 빈칸이 남는다 */
function applyGravity(board) {
	const { rows, cols } = board;
	const cells = board.cells.slice();
	const moves = [];
	for (let c = 0; c < cols; c++) {
		let write = rows - 1;
		for (let r = rows - 1; r >= 0; r--) {
			if (isFixedAt(board, r * cols + c)) {
				write = r - 1;
				continue;
			}
			const block = cells[r * cols + c];
			if (!block) continue;
			if (r !== write) {
				cells[write * cols + c] = block;
				cells[r * cols + c] = null;
				moves.push({
					id: block.id,
					from: {
						r,
						c
					},
					to: {
						r: write,
						c
					}
				});
			}
			write--;
		}
	}
	return {
		board: {
			...board,
			cells
		},
		event: {
			type: "fall",
			moves
		}
	};
}
/**
* 빈칸을 새 블록으로 채운다. 한 열의 빈칸이 k개면 새 블록은 모두 k칸 위에서 떨어진다
* (맨 위 빈칸의 dropFrom = k, 맨 아래 빈칸 = 1). 고정 칸은 건너뛰고, 고정 칸으로 나뉜 구간마다 센다.
* spawnTop = 구간 맨 위 행 (0이면 보드 위에서, 아니면 고정 칸 바로 아래에서 생긴다).
* applyGravity 다음에 호출한다.
*/
function refill(board, colors, rng) {
	const { rows, cols } = board;
	const cells = board.cells.slice();
	const blocks = [];
	let nextId = board.nextId;
	for (let c = 0; c < cols; c++) for (let top = 0; top < rows;) {
		if (isFixedAt(board, top * cols + c)) {
			top++;
			continue;
		}
		let bottom = top;
		while (bottom < rows && !isFixedAt(board, bottom * cols + c)) bottom++;
		let empty = 0;
		for (let r = top; r < bottom; r++) if (!cells[r * cols + c]) empty++;
		for (let r = top, rank = 0; r < bottom; r++) {
			if (cells[r * cols + c]) continue;
			let color;
			[color, rng] = nextInt(rng, colors);
			const block = {
				id: nextId++,
				color
			};
			cells[r * cols + c] = block;
			blocks.push({
				block,
				at: {
					r,
					c
				},
				dropFrom: empty - rank,
				spawnTop: top
			});
			rank++;
		}
		top = bottom;
	}
	return {
		board: {
			...board,
			cells,
			nextId
		},
		event: {
			type: "refill",
			blocks
		},
		rng
	};
}
function collectRuns(board) {
	const runs = [];
	const { rows, cols, cells } = board;
	const colorAt = (i) => cells[i]?.color ?? null;
	const scan = (dir, lines, length, at) => {
		for (let line = 0; line < lines; line++) {
			let start = 0;
			for (let k = 1; k <= length; k++) {
				const prev = colorAt(at(line, start));
				if (k < length && prev !== null && colorAt(at(line, k)) === prev) continue;
				if (prev !== null && k - start >= 3) runs.push({
					dir,
					cells: Array.from({ length: k - start }, (_, j) => at(line, start + j))
				});
				start = k;
			}
		}
	};
	scan("H", rows, cols, (r, c) => r * cols + c);
	scan("V", cols, rows, (c, r) => r * cols + c);
	return runs;
}
/** Union-Find (경로 압축). parent[i] === i 이면 루트 */
function createUnionFind(size) {
	const parent = Array.from({ length: size }, (_, i) => i);
	const find = (i) => {
		while (parent[i] !== i) {
			parent[i] = parent[parent[i]];
			i = parent[i];
		}
		return i;
	};
	const union = (a, b) => {
		parent[find(a)] = find(b);
	};
	return {
		find,
		union
	};
}
function findMatches(board) {
	const runs = collectRuns(board);
	if (runs.length === 0) return [];
	const uf = createUnionFind(board.cells.length);
	for (const run of runs) for (const i of run.cells) uf.union(run.cells[0], i);
	const byRoot = /* @__PURE__ */ new Map();
	for (const run of runs) {
		const root = uf.find(run.cells[0]);
		const list = byRoot.get(root);
		if (list) list.push(run);
		else byRoot.set(root, [run]);
	}
	const groups = [];
	for (const groupRuns of byRoot.values()) {
		const cellSet = /* @__PURE__ */ new Set();
		const hCells = /* @__PURE__ */ new Set();
		let maxRunH = 0;
		let maxRunV = 0;
		for (const run of groupRuns) {
			for (const i of run.cells) cellSet.add(i);
			if (run.dir === "H") {
				maxRunH = Math.max(maxRunH, run.cells.length);
				for (const i of run.cells) hCells.add(i);
			} else maxRunV = Math.max(maxRunV, run.cells.length);
		}
		const hasIntersection = groupRuns.some((run) => run.dir === "V" && run.cells.some((i) => hCells.has(i)));
		const sorted = [...cellSet].sort((a, b) => a - b);
		groups.push({
			first: sorted[0],
			group: {
				color: board.cells[sorted[0]].color,
				cells: sorted.map((i) => posOf(board, i)),
				maxRunH,
				maxRunV,
				hasIntersection
			}
		});
	}
	return groups.sort((a, b) => a.first - b.first).map((g) => g.group);
}
// src/core/moves.ts
function isColorBomb(block) {
	return block?.special === "color";
}
/** pos를 지나는 가로 또는 세로 run이 MIN_RUN 이상인가 */
function hasMatchThrough(board, pos) {
	const color = getBlock(board, pos)?.color;
	if (color == null) return false;
	const same = (r, c) => getBlock(board, {
		r,
		c
	})?.color === color;
	const count = (dr, dc) => {
		let n = 0;
		for (let r = pos.r + dr, c = pos.c + dc; same(r, c); r += dr, c += dc) n++;
		return n;
	};
	return 1 + count(0, -1) + count(0, 1) >= 3 || 1 + count(-1, 0) + count(1, 0) >= 3;
}
/**
* a와 b를 바꾸면 유효한 수인가 (매치가 생기거나, 컬러 블록이 끼어 있다).
* 빈칸·얼음벽 칸·잠긴 블록은 스왑할 수 없다 (PLAN2 5.2)
*/
function isValidSwap(board, a, b) {
	if (!isMovable(board, a) || !isMovable(board, b)) return false;
	if (isColorBomb(getBlock(board, a)) || isColorBomb(getBlock(board, b))) return true;
	const swapped = swapBlocks(board, a, b);
	return hasMatchThrough(swapped, a) || hasMatchThrough(swapped, b);
}
/** 왼쪽 위부터 오른쪽·아래 이웃과의 스왑을 시험해 첫 번째 유효한 수를 돌려준다 */
function findHint(board) {
	for (let r = 0; r < board.rows; r++) for (let c = 0; c < board.cols; c++) {
		const a = {
			r,
			c
		};
		if (!isMovable(board, a)) continue;
		for (const b of [{
			r,
			c: c + 1
		}, {
			r: r + 1,
			c
		}]) if (isValidSwap(board, a, b)) return {
			a,
			b
		};
	}
	return null;
}
function hasAnyMove(board) {
	return findHint(board) !== null;
}
/** 매치 0 + 가능한 수 ≥ 1 */
function isPlayable(board) {
	return findMatches(board).length === 0 && hasAnyMove(board);
}
/**
* 매치가 없고 가능한 수가 있는 보드를 만든다. 상한까지 다시 생성한다.
* layers(장애물 층)는 위치 그대로 붙는다. 얼음벽이 너무 많아 수가 없으면 여기서 실패한다 (PLAN2 5.4)
*/
function createPlayableBoard(rows, cols, colors, rng, layers) {
	for (let attempt = 0; attempt < BOARD.maxGenerateAttempts; attempt++) {
		let board;
		[board, rng] = createBoard(rows, cols, colors, rng, layers);
		if (hasAnyMove(board)) return [board, rng];
	}
	throw new Error(`플레이 가능한 보드를 ${BOARD.maxGenerateAttempts}회 안에 만들지 못했다`);
}
/**
* 블록 위치를 Fisher-Yates로 섞는다 (특수 블록 포함, 빈칸은 그대로).
* 잠긴 블록과 얼음벽 칸은 그 자리에 두고 움직일 수 있는 블록만 섞는다 (PLAN2 5.2).
* 매치 0 + 가능한 수 ≥ 1이 될 때까지 반복하고, 상한을 넘으면 regenerate로 새로 만든다.
*/
function shuffle(board, colors, rng) {
	const slots = [];
	board.cells.forEach((b, i) => b && !board.layers?.[i]?.lock && slots.push(i));
	for (let attempt = 0; attempt < BOARD.maxGenerateAttempts; attempt++) {
		const blocks = slots.map((i) => board.cells[i]);
		for (let i = blocks.length - 1; i > 0; i--) {
			let j;
			[j, rng] = nextInt(rng, i + 1);
			[blocks[i], blocks[j]] = [blocks[j], blocks[i]];
		}
		const cells = board.cells.slice();
		slots.forEach((slot, k) => cells[slot] = blocks[k]);
		const candidate = {
			...board,
			cells
		};
		if (isPlayable(candidate)) return {
			board: candidate,
			event: toShuffleEvent(candidate),
			rng
		};
	}
	const regenerated = regenerate(board, colors, rng);
	return {
		...regenerated,
		event: toShuffleEvent(regenerated.board)
	};
}
/**
* 셔플 상한 초과: 일반 블록으로 새 보드 (id는 board.nextId부터 이어서 발급).
* 잠긴 칸은 기존 블록(id·색·특수)을 그대로 두고, 그 제약 아래 매치 0 + 가능한 수 ≥ 1을 찾는다.
* 잠긴 칸이 없으면 createPlayableBoard와 같은 RNG 순서·결과다 (createBoard가 매치 0을 보장)
*/
function regenerate(board, colors, rng) {
	const locked = (i) => board.layers?.[i]?.lock === true && board.cells[i] !== null;
	for (let attempt = 0; attempt < BOARD.maxGenerateAttempts; attempt++) {
		let fresh;
		[fresh, rng] = createBoard(board.rows, board.cols, colors, rng, board.layers);
		let nextId = board.nextId;
		const cells = fresh.cells.map((b, i) => locked(i) ? board.cells[i] : b && {
			...b,
			id: nextId++
		});
		const candidate = {
			...board,
			cells,
			nextId
		};
		if (isPlayable(candidate)) return {
			board: candidate,
			rng
		};
	}
	throw new Error(`셔플 보드를 ${BOARD.maxGenerateAttempts}회 안에 다시 만들지 못했다`);
}
function toShuffleEvent(board) {
	const mapping = [];
	board.cells.forEach((block, i) => {
		if (block) mapping.push({
			block,
			to: {
				r: Math.floor(i / board.cols),
				c: i % board.cols
			}
		});
	});
	return {
		type: "shuffle",
		mapping
	};
}
// src/core/scoring.ts
/** 그룹 하나의 기본 점수. 크기 = 칸 수 (L / T / + 모양도 칸 수로 센다) */
function groupBase(size) {
	if (size <= 3) return SCORE.perBlock * size;
	if (size === 4) return SCORE.match4;
	if (size === 5) return SCORE.match5;
	return SCORE.match6Base + (size - 6) * SCORE.match6Extra;
}
/** cascade는 0부터. 0 → 1배, 1 → 1.5배 … */
function cascadeMultiplier(cascade) {
	return 1 + cascade * SCORE.cascadeStep;
}
/**
* cascade 한 번의 점수. bySpecialCount = 그 cascade에서 특수 효과로 지워진 블록 수,
* obstacleHits = 장애물 피해 겹수 (잠금 해제 1회, 얼음 1겹, 젤리 1겹. PLAN2 5.2)
*/
function stepScore(groups, bySpecialCount, cascade, obstacleHits = 0) {
	const base = groups.reduce((sum, g) => sum + groupBase(g.cells.length), 0);
	const extra = bySpecialCount * SCORE.bySpecial + obstacleHits * SCORE.obstacle;
	return Math.floor((base + extra) * cascadeMultiplier(cascade));
}
// src/core/specials.ts
/** 그룹이 만드는 특수 블록. 없으면 undefined. 우선순위는 PLAN 4.5 테이블 위에서부터 */
function decideSpecial(group, lineDirection = SPECIAL.lineDirection) {
	const size = group.cells.length;
	if (size >= 6) return "super";
	if (group.maxRunH >= 5 || group.maxRunV >= 5) return "color";
	if (size === 5 && group.hasIntersection) return "bomb";
	const perpendicular = lineDirection === "perpendicular";
	if (group.maxRunH === 4) return perpendicular ? "lineV" : "lineH";
	if (group.maxRunV === 4) return perpendicular ? "lineH" : "lineV";
}
/**
* 특수 블록을 만들 칸. swapped는 첫 cascade면 스왑한 두 칸 [a, b], 이후 cascade면 [].
* 스왑 칸이 그룹에 없으면 그룹 중앙(무게중심에 가장 가까운 칸, 같으면 group.cells 순서가 먼저)
*/
function specialPosition(group, swapped) {
	const cells = group.cells;
	const hit = swapped.find((s) => cells.some((c) => samePos(c, s)));
	if (hit) return hit;
	const n = cells.length;
	const sumR = cells.reduce((sum, p) => sum + p.r, 0);
	const sumC = cells.reduce((sum, p) => sum + p.c, 0);
	const dist = (p) => (n * p.r - sumR) ** 2 + (n * p.c - sumC) ** 2;
	return cells.reduce((best, p) => dist(p) < dist(best) ? p : best);
}
/**
* 잠긴 칸을 뺀 그룹에서 specialPosition으로 고른 칸. 다 잠겼으면 null (특수 블록을 만들지 않는다, PLAN2 5.2)
*/
function unlockedSpecialPosition(group, swapped, board) {
	const free = group.cells.filter((p) => !isLocked(board, p));
	return free.length > 0 ? specialPosition({
		...group,
		cells: free
	}, swapped) : null;
}
/**
* 특수 블록이 at에서 발동할 때 제거되는 칸 (PLAN 4.5). 자기 칸 포함, 보드 밖은 잘림, 행 우선 정렬.
* color는 targetColor 색 블록 전체이고, targetColor가 null이면 보드 전체
*/
function blastArea(kind, at, board, targetColor = null) {
	const inArea = (p) => {
		const dr = Math.abs(p.r - at.r);
		const dc = Math.abs(p.c - at.c);
		switch (kind) {
			case "lineH": return dr === 0;
			case "lineV": return dc === 0;
			case "bomb": return dr <= 1 && dc <= 1;
			case "super": return dr <= 2 && dc <= 2 || dr === 0 || dc === 0;
			case "color": return targetColor === null || samePos(p, at) || getBlock(board, p)?.color === targetColor;
		}
	};
	const area = [];
	for (let i = 0; i < board.cells.length; i++) {
		const p = posOf(board, i);
		if (inArea(p)) area.push(p);
	}
	return area;
}
/** 보드에서 가장 많은 색. 동점이면 번호가 작은 색. 일반 블록이 없으면 null */
function mostCommonColor(board) {
	const counts = new Array(6).fill(0);
	for (const block of board.cells) if (block && block.color !== null) counts[block.color]++;
	const max = Math.max(...counts);
	return max > 0 ? counts.indexOf(max) : null;
}
/**
* start 칸들을 제거할 때 함께 발동하는 특수 블록을 BFS로 퍼뜨린다 (PLAN 4.5 연쇄 발동).
* 블록마다 최대 한 번 발동. cleared는 start와 모든 발동 범위의 합집합 (행 우선 정렬).
* activated: 이미 발동한 칸 (컬러 스왑 발동). 제거는 되지만 다시 발동하지 않는다.
* depth: start 칸에서 발동하는 블록의 차례. 휘말린 블록은 터뜨린 블록의 차례 + 1 (PLAN 6.13).
* 배열이면 start 칸마다 차례 (컬러 + 특수 블록 조합, PLAN 6.18). 차례가 이른 블록부터 발동하고
* 같으면 먼저 들어온 블록부터라, 시작 칸 차례가 모두 같으면 보통 BFS와 같다.
* 잠긴 특수 블록은 범위에 들어도 발동하지 않는다 (잠금만 풀린다, PLAN2 5.2)
*/
function chainActivate(board, start, activated = [], depth = 0) {
	const fired = new Set(activated.map((p) => indexOf(board, p)));
	const seen = /* @__PURE__ */ new Set();
	const queue = [];
	const add = (p, d) => {
		const i = indexOf(board, p);
		if (seen.has(i)) return;
		seen.add(i);
		if (getBlock(board, p)?.special && !fired.has(i) && !isLocked(board, p)) queue.push({
			at: p,
			depth: d
		});
	};
	start.forEach((p, k) => add(p, typeof depth === "number" ? depth : depth[k]));
	const activations = [];
	while (queue.length > 0) {
		let k = 0;
		for (let j = 1; j < queue.length; j++) if (queue[j].depth < queue[k].depth) k = j;
		const { at, depth: d } = queue.splice(k, 1)[0];
		const special = getBlock(board, at).special;
		const cleared = blastArea(special, at, board, special === "color" ? mostCommonColor(board) : null);
		activations.push({
			type: "activate",
			special,
			at,
			cleared,
			depth: d
		});
		cleared.forEach((p) => add(p, d + 1));
	}
	return {
		cleared: [...seen].sort((a, b) => a - b).map((i) => posOf(board, i)),
		activations
	};
}
// src/core/engine.ts
const COLOR_COUNT = 6;
const NEIGHBORS = [
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1]
];
const noObstacles = () => ({
	lock: 0,
	frost: 0,
	jelly: 0
});
/**
* 게임 시작 상태. 같은 seed면 항상 같은 보드 (SPEC 6절 seed, 10절 수용 기준).
* layers(장애물 층, PLAN2 5.1)가 있으면 그 위치 그대로 보드에 붙는다
*/
function createInitialState(options) {
	const [board, rngState] = createPlayableBoard(options.rows, options.cols, options.colors, createRng(options.seed), options.layers);
	return {
		board,
		rngState,
		colors: options.colors
	};
}
function invalid(state, steps) {
	return {
		state,
		steps,
		scoreDelta: 0,
		removedByColor: new Array(COLOR_COUNT).fill(0),
		clearedObstacles: noObstacles(),
		valid: false
	};
}
/** resolve가 끝난 보드는 빈칸은 얼음벽 칸뿐, 매치 0, 가능한 수 ≥ 1 이어야 한다 (PLAN 10절, PLAN2 5.1) */
function assertInvariants(board) {
	board.cells.forEach((block, i) => {
		const frost = (board.layers?.[i]?.frost ?? 0) > 0;
		if (block === null && !frost) throw new Error("resolve 후 빈칸이 남았다");
		if (block !== null && frost) throw new Error("resolve 후 얼음벽 칸에 블록이 있다");
	});
	if (findMatches(board).length > 0) throw new Error("resolve 후 매치가 남았다");
	if (!hasAnyMove(board)) throw new Error("resolve 후 가능한 수가 없다");
}
/**
* 컬러 블록 스왑 발동: at의 컬러 블록이 partner 블록의 색을 지운다. 둘 다 컬러면 보드 전체 (PLAN 4.3).
* partner가 줄·폭탄·슈퍼면 그 색의 일반 블록이 그 특수 블록으로 바뀌고, 같은 색 칸이
* 행 우선으로 한 차례씩(1, 2, 3 …) 발동한다 (PLAN 6.18)
*/
function colorSwapBurst(board, at, partner) {
	const other = getBlock(board, partner);
	const cleared = blastArea("color", at, board, other.color);
	const first = {
		type: "activate",
		special: "color",
		at,
		cleared,
		depth: 0
	};
	if (!other.special || other.special === "color") {
		const chain = chainActivate(board, cleared, other.special === "color" ? [at, partner] : [at], 1);
		return {
			cleared: chain.cleared,
			activations: [first, ...chain.activations]
		};
	}
	const kind = other.special;
	const changes = [];
	const cells = board.cells.slice();
	for (const p of cleared) {
		const block = getBlock(board, p);
		if (block.special || isLocked(board, p)) continue;
		const special = kind === "lineH" || kind === "lineV" ? lineAt(p) : kind;
		const changed = {
			...block,
			special
		};
		changes.push({
			at: p,
			block: changed
		});
		cells[indexOf(board, p)] = changed;
	}
	let turn = 0;
	const depths = cleared.map((p) => samePos(p, at) ? 0 : ++turn);
	const chain = chainActivate({
		...board,
		cells
	}, cleared, [at], depths);
	const transform = {
		type: "transform",
		changes
	};
	return {
		cleared: chain.cleared,
		activations: [first, ...chain.activations],
		transform
	};
}
const lineAt = (p) => (p.r + p.c) % 2 === 0 ? "lineH" : "lineV";
function resolveSwap(state, a, b, newSpecialInBlast = SPECIAL.newSpecialInBlast) {
	const start = state.board;
	if (!inBounds(start, a) || !inBounds(start, b) || !isAdjacent(a, b)) return invalid(state, []);
	if (!isMovable(start, a) || !isMovable(start, b)) return invalid(state, []);
	const board = swapBlocks(start, a, b);
	const burst = [b, a].find((p) => getBlock(board, p)?.special === "color");
	const groups = burst ? [] : findMatches(board);
	if (!burst && groups.length === 0) return invalid(state, [[{
		type: "swap",
		a,
		b
	}], [{
		type: "swapBack",
		a,
		b
	}]]);
	const removedByColor = new Array(COLOR_COUNT).fill(0);
	const clearedObstacles = noObstacles();
	const run = runCascades(board, state, burst ? {
		kind: "burst",
		at: burst,
		partner: samePos(burst, a) ? b : a
	} : {
		kind: "match",
		groups,
		swapped: [a, b]
	}, newSpecialInBlast, {
		removedByColor,
		clearedObstacles
	});
	return finishResolve(state, run.board, run.rng, [[{
		type: "swap",
		a,
		b
	}], ...run.steps], {
		scoreDelta: run.scoreDelta,
		removedByColor,
		clearedObstacles
	});
}
/**
* 경쟁 모드 마지막 팡 (SPEC 3.3, PLAN 6.14): 판에 남은 특수 블록을 한 라운드에 하나씩
* 행 우선 첫 블록부터 발동한다. 생긴 매치는 보통 연쇄처럼 끝까지 (라운드마다 cascade 0부터).
* 특수 블록이 없으면 valid: false, steps: [], 상태 그대로. 라운드는 maxRounds를 넘지 않는다
*/
function resolveFinale(state, maxRounds = TIMEATTACK.finale.maxRounds, newSpecialInBlast = SPECIAL.newSpecialInBlast) {
	const firstSpecial = (board) => board.cells.findIndex((block, i) => block?.special && !isLocked(board, posOf(board, i)));
	if (firstSpecial(state.board) < 0) return invalid(state, []);
	let board = state.board;
	let rng = state.rngState;
	const steps = [];
	const removedByColor = new Array(COLOR_COUNT).fill(0);
	const clearedObstacles = noObstacles();
	let scoreDelta = 0;
	for (let round = 0; round < maxRounds; round++) {
		const i = firstSpecial(board);
		if (i < 0) break;
		const trigger = {
			kind: "fire",
			at: posOf(board, i)
		};
		const run = runCascades(board, {
			...state,
			rngState: rng
		}, trigger, newSpecialInBlast, {
			removedByColor,
			clearedObstacles
		});
		board = run.board;
		rng = run.rng;
		steps.push(...run.steps);
		scoreDelta += run.scoreDelta;
	}
	return finishResolve(state, board, rng, steps, {
		scoreDelta,
		removedByColor,
		clearedObstacles
	});
}
/**
* 연쇄 루프 (PLAN 4.3): 매치·발동 → 제거 → 점수 → 낙하·리필을 매치가 없을 때까지.
* 보드·rng는 state 대신 인자로 받은 값부터, totals(색별 제거 수·없어진 장애물 수)는 그 값에 더한다.
* 잠긴 블록은 매치·특수 범위에 들면 잠금만 풀리고 남는다 (제거·색 수집·발동 없음, PLAN2 5.2).
* 얼음벽은 범위에 들거나 이웃이 매치로 제거되면 1겹 깎이고, 0겹이면 같은 step의 낙하·리필 대상이 된다
*/
function runCascades(start, state, trigger, newSpecialInBlast, totals) {
	const { removedByColor, clearedObstacles } = totals;
	const idx = (p) => indexOf(start, p);
	let board = start;
	let rng = state.rngState;
	const steps = [];
	let scoreDelta = 0;
	let first = trigger;
	let groups = trigger.kind === "match" ? trigger.groups : [];
	for (let cascade = 0; first || groups.length > 0; cascade++) {
		if (cascade >= BOARD.maxCascade) throw new Error(`연쇄가 ${BOARD.maxCascade}회를 넘었다 (무한 연쇄 의심)`);
		const swapped = first?.kind === "match" ? first.swapped : [];
		let nextId = board.nextId;
		let created = groups.flatMap((group) => {
			const special = decideSpecial(group);
			if (!special) return [];
			const at = unlockedSpecialPosition(group, swapped, board);
			if (!at) return [];
			const color = special === "color" ? null : group.color;
			return [{
				at,
				block: {
					id: nextId++,
					color,
					special
				}
			}];
		});
		const matched = groups.flatMap((g) => g.cells);
		const chain = first?.kind === "burst" ? colorSwapBurst(board, first.at, first.partner) : chainActivate(board, first?.kind === "fire" ? [first.at] : matched);
		const activations = [...chain.activations];
		let cleared = chain.cleared;
		if (newSpecialInBlast === "explode") {
			const blasted = new Set(chain.activations.flatMap((e) => e.cleared).map(idx));
			const hit = created.filter((n) => blasted.has(idx(n.at)));
			if (hit.length > 0) {
				const hitIdx = new Set(hit.map((n) => idx(n.at)));
				const depth = 1 + Math.min(...chain.activations.filter((e) => e.cleared.some((p) => hitIdx.has(idx(p)))).map((e) => e.depth));
				const placed = board.cells.slice();
				for (const at of cleared) if (!isLocked(board, at)) placed[idx(at)] = null;
				for (const n of created) placed[idx(n.at)] = n.block;
				const second = chainActivate({
					...board,
					cells: placed
				}, hit.map((n) => n.at), [], depth);
				activations.push(...second.activations);
				const gone = new Set(second.cleared.map(idx));
				created = created.filter((n) => !gone.has(idx(n.at)));
				cleared = [...new Set([...cleared, ...second.cleared].map(idx))].sort((x, y) => x - y).map((i) => posOf(board, i));
			}
		}
		const inGroup = new Set(matched.map(idx));
		const cells = board.cells.slice();
		const layers = board.layers?.slice();
		const removed = [];
		const obstacles = [];
		for (const at of cleared) {
			const i = idx(at);
			const block = cells[i];
			if (!block) continue;
			if (layers && isLocked(board, at)) {
				const rest = { ...layers[i] };
				delete rest.lock;
				layers[i] = Object.keys(rest).length > 0 ? rest : null;
				obstacles.push({
					at,
					kind: "lock",
					hp: 0
				});
				clearedObstacles.lock++;
				continue;
			}
			removed.push({
				id: block.id,
				at,
				bySpecial: !inGroup.has(i)
			});
			if (block.color !== null) removedByColor[block.color]++;
			cells[i] = null;
			const jelly = layers?.[i]?.jelly;
			if (layers && jelly) {
				const hp = jelly - 1;
				const rest = { ...layers[i] };
				if (hp > 0) rest.jelly = hp;
				else delete rest.jelly;
				layers[i] = Object.keys(rest).length > 0 ? rest : null;
				obstacles.push({
					at,
					kind: "jelly",
					hp
				});
				if (hp === 0) clearedObstacles.jelly++;
			}
		}
		if (layers) {
			const hit = new Set(cleared.filter((p) => isFrost(board, p)).map(idx));
			for (const r of removed) {
				if (r.bySpecial) continue;
				for (const [dr, dc] of NEIGHBORS) {
					const p = {
						r: r.at.r + dr,
						c: r.at.c + dc
					};
					if (isFrost(board, p)) hit.add(idx(p));
				}
			}
			for (const i of [...hit].sort((x, y) => x - y)) {
				const hp = layers[i].frost - 1;
				layers[i] = hp > 0 ? { frost: hp } : null;
				obstacles.push({
					at: posOf(board, i),
					kind: "frost",
					hp
				});
				if (hp === 0) clearedObstacles.frost++;
			}
		}
		for (const n of created) cells[idx(n.at)] = n.block;
		board = {
			...board,
			cells,
			nextId,
			...layers ? { layers } : {}
		};
		const bySpecialCount = removed.filter((r) => r.bySpecial).length;
		const delta = stepScore(groups, bySpecialCount, cascade, obstacles.length);
		scoreDelta += delta;
		const scoreAt = groups[0] ? specialPosition(groups[0], []) : first.at;
		steps.push([
			{
				type: "match",
				groups,
				cascade
			},
			...chain.transform ? [chain.transform] : [],
			...activations,
			{
				type: "remove",
				blocks: removed
			},
			...obstacles.length > 0 ? [{
				type: "obstacle",
				changes: obstacles
			}] : [],
			...created.map((n) => ({
				type: "create",
				block: n.block,
				at: n.at
			})),
			{
				type: "score",
				delta,
				cascade,
				at: scoreAt
			}
		]);
		const fallen = applyGravity(board);
		const filled = refill(fallen.board, state.colors, rng);
		board = filled.board;
		rng = filled.rng;
		steps.push([fallen.event, filled.event]);
		first = void 0;
		groups = findMatches(board);
	}
	return {
		board,
		rng,
		steps,
		scoreDelta
	};
}
/** 가능한 수가 없으면 셔플하고 불변식을 확인해 결과를 만든다 */
function finishResolve(state, resolved, rngState, steps, totals) {
	let board = resolved;
	let rng = rngState;
	if (!hasAnyMove(board)) {
		const shuffled = shuffle(board, state.colors, rng);
		board = shuffled.board;
		rng = shuffled.rng;
		steps.push([shuffled.event]);
	}
	assertInvariants(board);
	return {
		state: {
			...state,
			board,
			rngState: rng
		},
		steps,
		...totals,
		valid: true
	};
}
// src/modes/TimeAttackMode.ts
var TimeAttackMode = class {
	kind = "timeattack";
	bestScore;
	timeLeft;
	total = 0;
	/** bestScore: 이전 최고 점수 (저장은 W3-07). 기본 0 */
	constructor(options = {}) {
		this.bestScore = options.bestScore ?? 0;
		this.timeLeft = options.timeLimitMs ?? TIMEATTACK.timeLimitMs;
	}
	onResolve(result) {
		this.total += result.scoreDelta;
	}
	/** 0 이하이거나 유한수가 아닌 dtMs는 무시한다. 남은 시간은 0 아래로 내려가지 않는다 */
	tick(dtMs) {
		if (!Number.isFinite(dtMs) || dtMs <= 0) return;
		this.timeLeft = Math.max(0, this.timeLeft - dtMs);
	}
	timeLeftMs() {
		return this.timeLeft;
	}
	score() {
		return this.total;
	}
	canInput() {
		return this.timeLeft > 0;
	}
	isOver() {
		return this.timeLeft === 0;
	}
	result() {
		return {
			kind: "timeattack",
			score: this.total,
			bestScore: this.bestScore,
			newBest: this.total > this.bestScore
		};
	}
};
// src/replay/replay.ts
/** 경쟁 모드 보드. 화면이 읽는 public/stages/timeattack.json을 그대로 번들에 넣는다 (값을 따로 두지 않는다) */
const TIMEATTACK_BOARD = {
	rows: 8,
	cols: 8,
	colors: 5,
	timeLimitMs: 6e4
};
/** moves는 validateMoves를 통과했다고 본다 (모두 제한 시간 안이라 게임이 받은 스왑이다) */
function replayTimeAttack(seed, moves) {
	const { rows, cols, colors } = TIMEATTACK_BOARD;
	let state = createInitialState({
		rows,
		cols,
		colors,
		seed
	});
	const mode = new TimeAttackMode();
	let validMoves = 0;
	let invalidMoves = 0;
	for (const move of moves) {
		const result = resolveSwap(state, move.from, move.to);
		state = result.state;
		if (result.valid) {
			validMoves++;
			mode.onResolve(result);
		} else invalidMoves++;
	}
	const finale = resolveFinale(state);
	if (finale.valid) mode.onResolve(finale);
	return {
		score: mode.score(),
		validMoves,
		invalidMoves,
		finaleScore: finale.valid ? finale.scoreDelta : 0
	};
}
// src/replay/judge.ts
/** PLAN2 5.8 판정 기준 (한곳에 모은다) */
const JUDGE = {
	/** move 시각: 0 ≤ t < limitMs, 정수 ms */
	limitMs: TIMEATTACK_BOARD.timeLimitMs,
	/** 연속 두 move의 t 차이 하한 (유효·무효 구분 없이). 그래서 move 수는 최대 limitMs / minGapMs = 300개 */
	minGapMs: 200,
	/** 서버 시각 start-run 발급 → submit 도착 하한 (60초 − 오차 2초) */
	minServerElapsedMs: 58e3,
	/** run 유효기간. 발급 후 이 시간 이상이면 만료 */
	runTtlMs: 18e5
};
const isPos = (p, board) => {
	if (typeof p !== "object" || p === null) return false;
	const { r, c } = p;
	return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && r < board.rows && c >= 0 && c < board.cols;
};
/** move 시각·간격·좌표 (JSON에서 온 값이라 타입을 믿지 않고 하나씩 본다) */
function validateMoves(moves, board) {
	if (!Array.isArray(moves)) return {
		ok: false,
		reason: "moves-not-array"
	};
	let prev = null;
	for (let index = 0; index < moves.length; index++) {
		const move = moves[index];
		const t = move?.t;
		if (!Number.isInteger(t)) return {
			ok: false,
			reason: "t-not-integer",
			index
		};
		const time = t;
		if (time < 0 || time >= JUDGE.limitMs) return {
			ok: false,
			reason: "t-out-of-range",
			index
		};
		if (prev !== null && time - prev < JUDGE.minGapMs) return {
			ok: false,
			reason: "gap-too-short",
			index
		};
		prev = time;
		const { from, to } = move;
		if (!isPos(from, board) || !isPos(to, board)) return {
			ok: false,
			reason: "pos-invalid",
			index
		};
		if (Math.abs(from.r - to.r) + Math.abs(from.c - to.c) !== 1) return {
			ok: false,
			reason: "not-adjacent",
			index
		};
	}
	return { ok: true };
}
/** 서버 시각 (ms). 발급 → 도착이 58초 미만이면 거부, 30분 이상이면 만료 */
function checkServerTiming(issuedAtMs, submittedAtMs) {
	const elapsed = submittedAtMs - issuedAtMs;
	if (!(elapsed >= JUDGE.minServerElapsedMs)) return {
		ok: false,
		reason: "too-fast"
	};
	if (elapsed >= JUDGE.runTtlMs) return {
		ok: false,
		reason: "expired"
	};
	return { ok: true };
}
/**
* moves·clientScore·version을 키 순서를 고정한 JSON으로 만든 sha256 (hex). 다른 필드는 무시한다.
* 형식 검사(checkPayload)를 통과한 payload만 넣는다 (잘못된 moves면 예외가 난다)
*/
async function submissionHash(payload) {
	const canonical = JSON.stringify({
		clientScore: payload.clientScore,
		moves: payload.moves.map((m) => ({
			from: {
				r: m.from.r,
				c: m.from.c
			},
			t: m.t,
			to: {
				r: m.to.r,
				c: m.to.c
			}
		})),
		version: payload.version
	});
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
/** run에 저장된 해시와 비교: 처음이면 new, 같은 내용이면 same(이전 결과 반환), 다른 내용이면 conflict(거부) */
function resubmitDecision(storedHash, newHash) {
	if (storedHash === null) return "new";
	return storedHash === newHash ? "same" : "conflict";
}
/**
* 제출 형식: 객체, moves는 validateMoves 통과, clientScore는 0 이상 정수, version은 빈 문자열이 아닌 문자열.
* 통과하면 submissionHash에 넣어도 안전하다
*/
function checkPayload(payload) {
	if (typeof payload !== "object" || payload === null) return {
		ok: false,
		reason: "payload-invalid"
	};
	const { moves, clientScore, version } = payload;
	const checked = validateMoves(moves, TIMEATTACK_BOARD);
	if (!checked.ok) return checked;
	if (!Number.isInteger(clientScore) || clientScore < 0) return {
		ok: false,
		reason: "client-score-invalid"
	};
	if (typeof version !== "string" || version === "") return {
		ok: false,
		reason: "version-invalid"
	};
	return { ok: true };
}
/**
* 새 제출(resubmitDecision = new) 판정: 버전 → 서버 시각 → move 검사 → 리플레이 → 점수 비교.
* seed는 클라이언트 값이 아니라 runs 기록에서 읽은 값이다 (SPEC 5.3)
*/
function verifySubmission(submission, server) {
	if (submission.version !== server.version) return {
		ok: false,
		reason: "version-mismatch"
	};
	const timing = checkServerTiming(server.issuedAtMs, server.submittedAtMs);
	if (!timing.ok) return timing;
	const moves = validateMoves(submission.moves, TIMEATTACK_BOARD);
	if (!moves.ok) return moves;
	const replay = replayTimeAttack(submission.seed, submission.moves);
	if (replay.score !== submission.clientScore) return {
		ok: false,
		reason: "score-mismatch"
	};
	return {
		ok: true,
		score: replay.score,
		replay
	};
}
/**
* 새 제출(decision = new)의 해시·결과를 run에 저장할지 (PLAN2 6.4 "판정 저장").
* too-fast는 내용이 아니라 도착 시각 때문의 거부라 저장하지 않는다: 저장하면 같은 내용의 정상 재시도까지 영구히 막힌다.
* 통과·expired·내용 거부(점수 불일치 등)는 저장해 같은 내용이면 같은 결과를 돌려준다
*/
function shouldStore(result) {
	return result.ok || result.reason !== "too-fast";
}
/**
* submit-score 서버 판정 진입점 (PLAN2 5.8): 형식 검사 → 해시·재제출 판단 → 새 제출이면 verifySubmission.
* run: runs 기록 (서버 발급 seed, 저장된 해시·결과. 처음이면 storedHash null).
* 잘못된 형식은 해시를 만들기 전에 구조화된 거부로 돌려준다 (예외 없음)
*/
async function judgeSubmission(run, payload, server) {
	const format = checkPayload(payload);
	if (!format.ok) return {
		decision: "invalid",
		result: format
	};
	const submission = payload;
	const hash = await submissionHash(submission);
	const decision = resubmitDecision(run.storedHash, hash);
	if (decision === "conflict") return {
		decision,
		hash,
		result: {
			ok: false,
			reason: "resubmit-conflict"
		}
	};
	return {
		decision,
		hash,
		result: decision === "same" && run.storedResult ? run.storedResult : verifySubmission({
			seed: run.seed,
			...submission
		}, server)
	};
}
// src/replay/weekKey.ts
const KST_OFFSET_MS = 324e5;
const DAY_MS = 864e5;
/** ms(Unix 시각) → '2026-W45'. ISO 주차는 그 주 목요일이 속한 해를 쓴다 (연말·연초에 해가 바뀔 수 있다) */
function weekKey(ms) {
	const kst = new Date(ms + KST_OFFSET_MS);
	const day = kst.getUTCDay() || 7;
	const thursday = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 4 - day);
	const year = new Date(thursday).getUTCFullYear();
	const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
	return `${year}-W${String(week).padStart(2, "0")}`;
}
export { JUDGE, TIMEATTACK_BOARD, checkPayload, checkServerTiming, judgeSubmission, replayTimeAttack, resubmitDecision, shouldStore, submissionHash, validateMoves, verifySubmission, weekKey };

export const CORE_VERSION = '41b6264ceb8b';
