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
