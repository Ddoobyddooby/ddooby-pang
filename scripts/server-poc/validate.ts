// V2-W2-08 PoC: submit-score 서버 판정 (SPEC 5.3·11절 5번, PLAN2 5.8 "서버 판정" 표). 순수 함수만 둔다.
// 서버 진입점은 judgeSubmission 하나: 형식 검사 → 해시·재제출 판단(same이면 저장된 결과, conflict면 거부) → 새 제출이면 verifySubmission.
// replay.ts를 거쳐 src/core·src/modes·src/config만 쓴다. 해시는 Web Crypto라 Node·Deno 둘 다 돈다.

import type { Pos } from '../../src/core/types';
import { replayTimeAttack, TIMEATTACK_BOARD, type ReplayMove, type ReplayResult } from './replay';

/** PLAN2 5.8 판정 기준 (한곳에 모은다) */
export const JUDGE = {
  /** move 시각: 0 ≤ t < limitMs, 정수 ms */
  limitMs: TIMEATTACK_BOARD.timeLimitMs,
  /** 연속 두 move의 t 차이 하한 (유효·무효 구분 없이). 그래서 move 수는 최대 limitMs / minGapMs = 300개 */
  minGapMs: 200,
  /** 서버 시각 start-run 발급 → submit 도착 하한 (60초 − 오차 2초) */
  minServerElapsedMs: 58_000,
  /** run 유효기간. 발급 후 이 시간 이상이면 만료 */
  runTtlMs: 30 * 60_000,
} as const;

export type RejectReason =
  | 'version-mismatch'
  | 'too-fast'
  | 'expired'
  | 'moves-not-array'
  | 't-not-integer'
  | 't-out-of-range'
  | 'gap-too-short'
  | 'pos-invalid'
  | 'not-adjacent'
  | 'score-mismatch'
  | 'payload-invalid'
  | 'client-score-invalid'
  | 'version-invalid'
  | 'resubmit-conflict';

export type Verdict = { ok: true } | { ok: false; reason: RejectReason; index?: number };

const isPos = (p: unknown, board: { rows: number; cols: number }): p is Pos => {
  if (typeof p !== 'object' || p === null) return false;
  const { r, c } = p as Record<string, unknown>;
  return (
    Number.isInteger(r) &&
    Number.isInteger(c) &&
    (r as number) >= 0 &&
    (r as number) < board.rows &&
    (c as number) >= 0 &&
    (c as number) < board.cols
  );
};

/** move 시각·간격·좌표 (JSON에서 온 값이라 타입을 믿지 않고 하나씩 본다) */
export function validateMoves(moves: unknown, board: { rows: number; cols: number }): Verdict {
  if (!Array.isArray(moves)) return { ok: false, reason: 'moves-not-array' };
  let prev: number | null = null;
  for (let index = 0; index < moves.length; index++) {
    const move = moves[index] as Partial<Record<'from' | 'to' | 't', unknown>> | null;
    const t = move?.t;
    if (!Number.isInteger(t)) return { ok: false, reason: 't-not-integer', index };
    const time = t as number;
    if (time < 0 || time >= JUDGE.limitMs) return { ok: false, reason: 't-out-of-range', index };
    // 같은 t·역순도 차이가 하한보다 작으므로 여기서 거부된다
    if (prev !== null && time - prev < JUDGE.minGapMs) {
      return { ok: false, reason: 'gap-too-short', index };
    }
    prev = time;
    const { from, to } = move!;
    if (!isPos(from, board) || !isPos(to, board))
      return { ok: false, reason: 'pos-invalid', index };
    if (Math.abs(from.r - to.r) + Math.abs(from.c - to.c) !== 1) {
      return { ok: false, reason: 'not-adjacent', index };
    }
  }
  return { ok: true };
}

/** 서버 시각 (ms). 발급 → 도착이 58초 미만이면 거부, 30분 이상이면 만료 */
export function checkServerTiming(issuedAtMs: number, submittedAtMs: number): Verdict {
  const elapsed = submittedAtMs - issuedAtMs;
  if (!(elapsed >= JUDGE.minServerElapsedMs)) return { ok: false, reason: 'too-fast' };
  if (elapsed >= JUDGE.runTtlMs) return { ok: false, reason: 'expired' };
  return { ok: true };
}

export interface SubmissionPayload {
  moves: readonly ReplayMove[];
  clientScore: number;
  version: string;
}

/**
 * moves·clientScore·version을 키 순서를 고정한 JSON으로 만든 sha256 (hex). 다른 필드는 무시한다.
 * 형식 검사(checkPayload)를 통과한 payload만 넣는다 (잘못된 moves면 예외가 난다)
 */
export async function submissionHash(payload: SubmissionPayload): Promise<string> {
  const canonical = JSON.stringify({
    clientScore: payload.clientScore,
    moves: payload.moves.map((m) => ({
      from: { r: m.from.r, c: m.from.c },
      t: m.t,
      to: { r: m.to.r, c: m.to.c },
    })),
    version: payload.version,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** run에 저장된 해시와 비교: 처음이면 new, 같은 내용이면 same(이전 결과 반환), 다른 내용이면 conflict(거부) */
export function resubmitDecision(
  storedHash: string | null,
  newHash: string,
): 'new' | 'same' | 'conflict' {
  if (storedHash === null) return 'new';
  return storedHash === newHash ? 'same' : 'conflict';
}

/**
 * 제출 형식: 객체, moves는 validateMoves 통과, clientScore는 0 이상 정수, version은 빈 문자열이 아닌 문자열.
 * 통과하면 submissionHash에 넣어도 안전하다
 */
export function checkPayload(payload: unknown): Verdict {
  if (typeof payload !== 'object' || payload === null)
    return { ok: false, reason: 'payload-invalid' };
  const { moves, clientScore, version } = payload as Record<string, unknown>;
  const checked = validateMoves(moves, TIMEATTACK_BOARD);
  if (!checked.ok) return checked;
  if (!Number.isInteger(clientScore) || (clientScore as number) < 0) {
    return { ok: false, reason: 'client-score-invalid' };
  }
  if (typeof version !== 'string' || version === '')
    return { ok: false, reason: 'version-invalid' };
  return { ok: true };
}

export type SubmissionResult =
  | { ok: true; score: number; replay: ReplayResult }
  | { ok: false; reason: RejectReason; index?: number };

/**
 * 새 제출(resubmitDecision = new) 판정: 버전 → 서버 시각 → move 검사 → 리플레이 → 점수 비교.
 * seed는 클라이언트 값이 아니라 runs 기록에서 읽은 값이다 (SPEC 5.3)
 */
export function verifySubmission(
  submission: { seed: number; moves: unknown; clientScore: unknown; version: unknown },
  server: { version: string; issuedAtMs: number; submittedAtMs: number },
): SubmissionResult {
  if (submission.version !== server.version) return { ok: false, reason: 'version-mismatch' };
  const timing = checkServerTiming(server.issuedAtMs, server.submittedAtMs);
  if (!timing.ok) return timing;
  const moves = validateMoves(submission.moves, TIMEATTACK_BOARD);
  if (!moves.ok) return moves;
  const replay = replayTimeAttack(submission.seed, submission.moves as ReplayMove[]);
  if (replay.score !== submission.clientScore) return { ok: false, reason: 'score-mismatch' };
  return { ok: true, score: replay.score, replay };
}

export type Judgement =
  /** 형식이 잘못돼 해시를 만들지 않았다 (run에 아무것도 저장하지 않는다) */
  | { decision: 'invalid'; result: SubmissionResult }
  /** 같은 내용 재제출: 저장된 이전 결과를 그대로 돌려준다 */
  | { decision: 'same'; hash: string; result: SubmissionResult }
  /** 다른 내용으로 run 재사용: 거부 */
  | { decision: 'conflict'; hash: string; result: SubmissionResult }
  /** 첫 제출: 판정 결과와 hash를 run에 저장한다 */
  | { decision: 'new'; hash: string; result: SubmissionResult };

/**
 * submit-score 서버 판정 진입점 (PLAN2 5.8): 형식 검사 → 해시·재제출 판단 → 새 제출이면 verifySubmission.
 * run: runs 기록 (서버 발급 seed, 저장된 해시·결과. 처음이면 storedHash null).
 * 잘못된 형식은 해시를 만들기 전에 구조화된 거부로 돌려준다 (예외 없음)
 */
export async function judgeSubmission(
  run: { seed: number; storedHash: string | null; storedResult: SubmissionResult | null },
  payload: unknown,
  server: { version: string; issuedAtMs: number; submittedAtMs: number },
): Promise<Judgement> {
  const format = checkPayload(payload);
  if (!format.ok) return { decision: 'invalid', result: format };
  const submission = payload as SubmissionPayload;
  const hash = await submissionHash(submission);
  const decision = resubmitDecision(run.storedHash, hash);
  if (decision === 'conflict') {
    return { decision, hash, result: { ok: false, reason: 'resubmit-conflict' } };
  }
  // 해시와 결과는 함께 저장한다. 결과가 없으면(저장 도중 실패 등) 같은 내용이므로 다시 판정한다
  const result =
    decision === 'same' && run.storedResult
      ? run.storedResult
      : verifySubmission({ seed: run.seed, ...submission }, server);
  return { decision, hash, result };
}
