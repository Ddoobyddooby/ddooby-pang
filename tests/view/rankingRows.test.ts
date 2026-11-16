import { describe, expect, it } from 'vitest';
import {
  footerText,
  formatPoints,
  mergeRows,
  messageFor,
  refreshLabel,
  selectView,
  weekRangeText,
  type RankingItem,
  type RankingLine,
  type RankingResult,
  type RankingRow,
} from '../../src/view/rankingRows';
import { weekKey } from '../../src/replay/weekKey';

/** 순번 seq의 줄: 점수는 내려가고 순위는 순번과 같다(공동 순위가 필요하면 덮어쓴다) */
const row = (seq: number, extra: Partial<RankingRow> = {}): RankingRow => ({
  seq,
  rank: seq,
  nickname: `이름${seq}`,
  tag: seq,
  score: 100_000 - seq * 10,
  isMe: false,
  ...extra,
});
const range = (from: number, to: number, me?: number): RankingRow[] =>
  Array.from({ length: to - from + 1 }, (_, i) => row(from + i, { isMe: from + i === me }));

const ok = (
  top: RankingRow[],
  around: RankingRow[],
  me: RankingResult extends infer R ? (R extends { me: infer M } ? M : never) : never,
): RankingResult => ({ kind: 'ok', weekKey: '2026-W45', top, around, me });

const lines = (items: RankingItem[]): RankingLine[] =>
  items.filter((i): i is RankingLine => i.kind === 'row');
const shape = (items: RankingItem[]): string =>
  items.map((i) => (i.kind === 'gap' ? '⋯' : i.rank)).join(',');

describe('rankingRows: mergeRows', () => {
  it('TOP 50만 있으면 그대로 50줄, ⋯ 없음', () => {
    const items = mergeRows(range(1, 50), []);
    expect(items).toHaveLength(50);
    expect(items.some((i) => i.kind === 'gap')).toBe(false);
  });

  it('내가 7위: around(2~12)가 top과 겹쳐도 중복 없이 한 번씩, ⋯ 없음', () => {
    const items = mergeRows(range(1, 50), range(2, 12, 7));
    expect(items).toHaveLength(50);
    expect(
      lines(items)
        .filter((l) => l.isMe)
        .map((l) => l.rank),
    ).toEqual(['7']);
  });

  it('내가 50위: around(45~55) → 51~55가 이어 붙고 ⋯ 없음', () => {
    const items = mergeRows(range(1, 50), range(45, 55, 50));
    expect(items).toHaveLength(55);
    expect(items.some((i) => i.kind === 'gap')).toBe(false);
  });

  it('내가 51위: around(46~56)라 50과 51이 붙는다 → ⋯ 없음', () => {
    const items = mergeRows(range(1, 50), range(46, 56, 51));
    expect(items).toHaveLength(56);
    expect(items.some((i) => i.kind === 'gap')).toBe(false);
  });

  it('내가 56위: around(51~61) → 50 다음 51이라 ⋯ 없음', () => {
    const items = mergeRows(range(1, 50), range(51, 61, 56));
    expect(items).toHaveLength(61);
    expect(items.some((i) => i.kind === 'gap')).toBe(false);
  });

  it('내가 57위: around(52~62) → 50과 52 사이(51 빠짐)에 ⋯ 하나', () => {
    const items = mergeRows(range(1, 50), range(52, 62, 57));
    expect(items).toHaveLength(50 + 1 + 11);
    expect(items[50]).toEqual({ kind: 'gap' });
    expect(items.filter((i) => i.kind === 'gap')).toHaveLength(1);
  });

  it('내가 200위: top 50 → ⋯ → 195~205, 내 줄 표시', () => {
    const items = mergeRows(range(1, 50), range(195, 205, 200));
    expect(shape(items)).toBe(
      [
        ...Array.from({ length: 50 }, (_, i) => i + 1),
        '⋯',
        ...range(195, 205).map((r) => r.rank),
      ].join(','),
    );
    expect(
      lines(items)
        .filter((l) => l.isMe)
        .map((l) => l.rank),
    ).toEqual(['200']);
  });

  it('꼴찌(70위)면 아래 줄이 없어도 앞 5줄까지', () => {
    const items = mergeRows(range(1, 50), range(65, 70, 70));
    expect(items.filter((i) => i.kind === 'gap')).toHaveLength(1);
    expect(items.at(-1)).toMatchObject({ kind: 'row', rank: '70', isMe: true });
  });

  it('순번 순서로 정렬하고 같은 seq는 한 줄 (around가 먼저 와도)', () => {
    const items = mergeRows(range(3, 5), range(1, 4));
    expect(shape(items)).toBe('1,2,3,4,5');
  });

  it('공동 순위 2·2·4: 순위 글자는 서버가 준 rank 그대로, 순번은 줄 수', () => {
    const top = [
      row(1),
      row(2, { rank: 2, score: 900 }),
      row(3, { rank: 2, score: 900 }),
      row(4, { rank: 4, score: 800 }),
    ];
    expect(shape(mergeRows(top, []))).toBe('1,2,2,4');
  });

  it('1~3위만 medal, 공동 2위 둘 다 은, 4위부터 null', () => {
    const top = [
      row(1),
      row(2, { rank: 2 }),
      row(3, { rank: 2 }),
      row(4, { rank: 4 }),
      row(5, { rank: 5 }),
    ];
    expect(lines(mergeRows(top, [])).map((l) => l.medal)).toEqual([1, 2, 2, null, null]);
  });

  it('줄 글자: 쉼표 점수·4자리 태그·10자 닉네임', () => {
    const [line] = lines(
      mergeRows([row(1, { nickname: '가나다라마바사아자차', tag: 427, score: 15_320 })], []),
    );
    expect(line).toMatchObject({
      rank: '1',
      nickname: '가나다라마바사아자차',
      tag: '#0427',
      score: '15,320',
    });
    expect(line!.nickname).toHaveLength(10);
  });
});

describe('rankingRows: selectView', () => {
  it('offline·error는 그대로 상태만', () => {
    expect(selectView({ kind: 'offline' })).toEqual({ state: 'offline' });
    expect(selectView({ kind: 'error' })).toEqual({ state: 'error' });
  });

  it('빈 주 + 기록 없음: empty, 하단 줄 없음', () => {
    expect(selectView(ok([], [], null))).toEqual({ state: 'empty', footer: null });
  });

  it('빈 주지만 닉네임 없는 내 기록은 있음: empty + 이름 정하기 줄', () => {
    expect(selectView(ok([], [], { rank: null, score: 1234 }))).toEqual({
      state: 'empty',
      footer: { kind: 'noNickname', score: '1,234' },
    });
  });

  it('내가 있으면 list + 내 순위 줄', () => {
    const v = selectView(ok(range(1, 50), range(52, 62, 57), { rank: 57, score: 15_320 }));
    expect(v.state).toBe('list');
    if (v.state === 'list') expect(v.footer).toEqual({ kind: 'me', rank: 57, score: '15,320' });
  });

  it('기록 없음(me null, anon 포함): list + noRecord, around 없이도 그려진다', () => {
    const v = selectView(ok(range(1, 3), [], null));
    expect(v).toMatchObject({ state: 'list', footer: { kind: 'noRecord' } });
    if (v.state === 'list') expect(v.items).toHaveLength(3);
  });

  it('닉네임 없음(rank null): list + noNickname(점수), 내 줄 표시 없음', () => {
    const v = selectView(ok(range(1, 5), [], { rank: null, score: 700 }));
    expect(v).toMatchObject({ state: 'list', footer: { kind: 'noNickname', score: '700' } });
    if (v.state === 'list') expect(lines(v.items).some((l) => l.isMe)).toBe(false);
  });
});

describe('rankingRows: 문구', () => {
  it('상태별 안내 문구 (PM 확정)', () => {
    expect(messageFor({ state: 'offline' })).toBe('인터넷에 연결되면 랭킹을 볼 수 있어요');
    expect(messageFor({ state: 'error' })).toBe('랭킹을 불러오지 못했어요');
    expect(messageFor({ state: 'empty', footer: null })).toBe('이번 주 첫 기록을 남겨 보세요!');
    expect(messageFor({ state: 'list', items: [], footer: { kind: 'noRecord' } })).toBeNull();
  });

  it('왼쪽 버튼: 연결 불가·오류는 다시 시도, 나머지는 새로고침', () => {
    expect(refreshLabel(null)).toBe('새로고침');
    expect(refreshLabel({ state: 'offline' })).toBe('다시 시도');
    expect(refreshLabel({ state: 'error' })).toBe('다시 시도');
    expect(refreshLabel({ state: 'empty', footer: null })).toBe('새로고침');
  });

  it('하단 고정 줄 글자', () => {
    expect(footerText({ kind: 'me', rank: 57, score: '15,320' })).toEqual({
      left: '내 순위 57위',
      right: '15,320',
    });
    expect(footerText({ kind: 'noRecord' })).toEqual({ left: '이번 주 기록이 없어요', right: '' });
    expect(footerText({ kind: 'noNickname', score: '700' })).toEqual({
      left: '700점 이름을 정하면 랭킹에 보여요',
      right: '',
    });
  });

  it('formatPoints: 쉼표, 6자리, 음수·NaN은 0', () => {
    expect(formatPoints(987_654)).toBe('987,654');
    expect(formatPoints(0)).toBe('0');
    expect(formatPoints(-5)).toBe('0');
    expect(formatPoints(Number.NaN)).toBe('0');
  });
});

describe('rankingRows: weekRangeText', () => {
  it('2026-W45 → 11월 2일(월) ~ 11월 8일(일)', () => {
    expect(weekRangeText('2026-W45')).toBe('11월 2일(월) ~ 11월 8일(일)');
  });

  it('W53(해를 넘는 주): 2026-W53 → 12월 28일 ~ 1월 3일', () => {
    expect(weekRangeText('2026-W53')).toBe('12월 28일(월) ~ 1월 3일(일)');
  });

  it('W01이 전해 12월에 시작: 2025-W01 → 12월 30일 ~ 1월 5일', () => {
    expect(weekRangeText('2025-W01')).toBe('12월 30일(월) ~ 1월 5일(일)');
  });

  it('2027-W01 → 1월 4일 ~ 1월 10일', () => {
    expect(weekRangeText('2027-W01')).toBe('1월 4일(월) ~ 1월 10일(일)');
  });

  it('weekKey()가 만든 키와 맞물린다: 일요일 23:59 KST와 월요일 00:00 KST', () => {
    const sunEnd = Date.UTC(2026, 10, 8, 14, 59, 59); // 11/8(일) 23:59:59 KST
    const monStart = Date.UTC(2026, 10, 8, 15, 0, 0); // 11/9(월) 00:00:00 KST
    expect(weekRangeText(weekKey(sunEnd))).toBe('11월 2일(월) ~ 11월 8일(일)');
    expect(weekRangeText(weekKey(monStart))).toBe('11월 9일(월) ~ 11월 15일(일)');
  });

  it('형식이 틀리면 빈 문자열', () => {
    expect(weekRangeText('')).toBe('');
    expect(weekRangeText('2026-45')).toBe('');
    expect(weekRangeText('2026-W00')).toBe('');
    expect(weekRangeText('2026-W54')).toBe('');
  });
});

// ── 스토리 별 탭 (V2-W5-02) ──
import {
  localStarTotal,
  type RankingFooter,
  type RankingView,
  type StoryRankingResult,
} from '../../src/view/rankingRows';

const STARS = { stageMin: 1, stageMax: 30, starMin: 1, starMax: 3 };
const starRow = (seq: number, stars: number, extra: Partial<RankingRow> = {}): RankingRow =>
  row(seq, { score: stars, ...extra });
const footerOf = (v: RankingView): RankingFooter => (v as { footer: RankingFooter }).footer;
const storyOk = (
  top: RankingRow[],
  around: RankingRow[],
  me: { rank: number | null; score: number } | null,
): StoryRankingResult => ({ kind: 'ok', top, around, me });

describe('rankingRows: 스토리 탭', () => {
  it('UI-02 줄의 점수 글자는 ★ N, 주간은 쉼표 점수 그대로 (REG-02)', () => {
    const story = selectView(storyOk([starRow(1, 90)], [], null), 'story', 0);
    expect(story).toMatchObject({ state: 'list' });
    expect(lines((story as { items: RankingItem[] }).items)[0]!.score).toBe('★ 90');
    const weekly = selectView(ok([row(1, { score: 15_320 })], [], null));
    expect(lines((weekly as { items: RankingItem[] }).items)[0]!.score).toBe('15,320');
  });

  it('UI-02 하단: 내 순위 / 닉네임 없음 / 기록 없음(기기 합계)', () => {
    const me = selectView(storyOk([starRow(1, 90)], [], { rank: 3, score: 57 }), 'story', 12);
    expect(me).toMatchObject({ footer: { kind: 'me', rank: 3, score: '★ 57' } });
    expect(footerText(footerOf(me), 'story')).toEqual({
      left: '내 순위 3위',
      right: '★ 57',
    });
    const nonick = selectView(storyOk([starRow(1, 90)], [], { rank: null, score: 57 }), 'story');
    expect(footerText(footerOf(nonick), 'story').left).toBe('★ 57 이름을 정하면 랭킹에 보여요');
    const none = selectView(storyOk([starRow(1, 90)], [], null), 'story', 12);
    expect(footerText(footerOf(none), 'story').left).toBe('내 별 ★ 12');
  });

  it('UI-02 빈 목록에서도 내 별(0 포함)이 보인다. 주간 빈 목록의 기록 없음 줄은 계속 숨긴다', () => {
    const zero = selectView(storyOk([], [], null), 'story', 0);
    expect(zero).toEqual({ state: 'empty', footer: { kind: 'noRecord', score: '★ 0' } });
    const weekly = selectView(ok([], [], null));
    expect(weekly).toEqual({ state: 'empty', footer: null });
  });

  it('SYNC-11/D-05 서버 me가 있으면 기기 합계보다 me가 먼저다 (빈 목록 포함)', () => {
    const v = selectView(storyOk([], [], { rank: null, score: 90 }), 'story', 0);
    expect(v).toMatchObject({ state: 'empty', footer: { kind: 'noNickname', score: '★ 90' } });
  });

  it('UI-03 공동 순위 1·1·3과 간격 ⋯, 본인 강조는 스토리에서도 같다', () => {
    const top = [
      starRow(1, 6, { rank: 1 }),
      starRow(2, 6, { rank: 1 }),
      starRow(3, 5, { rank: 3 }),
    ];
    const v = selectView(storyOk(top, [starRow(9, 4, { rank: 4, isMe: true })], null), 'story');
    const items = (v as { items: RankingItem[] }).items;
    expect(shape(items)).toBe('1,1,3,⋯,4');
    expect(lines(items).find((l) => l.isMe)!.score).toBe('★ 4');
    expect(lines(items)[0]!.medal).toBe(1);
  });

  it('UI-04 탭에 맞는 안내 문구와 offline·error 상태', () => {
    expect(messageFor({ state: 'empty', footer: null }, 'story')).toBe('첫 별을 모아 보세요!');
    expect(messageFor({ state: 'empty', footer: null })).toBe('이번 주 첫 기록을 남겨 보세요!');
    expect(messageFor({ state: 'error' }, 'story')).toContain('별 랭킹');
    expect(selectView({ kind: 'offline' }, 'story')).toEqual({ state: 'offline' });
    expect(selectView({ kind: 'error' }, 'story')).toEqual({ state: 'error' });
    expect(refreshLabel({ state: 'error' })).toBe('다시 시도');
  });

  it('UI-02 기기 별 합계: 1~30번·별 1~3만 더한다', () => {
    expect(localStarTotal({}, STARS)).toBe(0);
    expect(localStarTotal({ 1: 3, 2: 1 }, STARS)).toBe(4);
    expect(localStarTotal({ 0: 3, 31: 3, 999: 3, 5: 0, 6: 4, 7: 1.5, 8: 2 }, STARS)).toBe(2);
    const all = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i + 1, 3]));
    expect(localStarTotal(all, STARS)).toBe(90);
  });
});
