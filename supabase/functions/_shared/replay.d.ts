// 자동 생성: npm run server:shared (src/replay/index.ts). 직접 고치지 않는다
/** 경쟁 모드 보드. 화면이 읽는 public/stages/timeattack.json을 그대로 번들에 넣는다 (값을 따로 두지 않는다) */
export declare const TIMEATTACK_BOARD: {
    readonly rows: number;
    readonly cols: number;
    readonly colors: number;
    readonly timeLimitMs: number;
};
/** 보드 칸 (core Pos와 같은 모양. 서버 선언 파일이 core 타입에 기대지 않게 따로 둔다) */
export interface Cell {
    r: number;
    c: number;
}
/** t: 게임 시작부터 그 스왑을 입력한 순간까지의 게임 시간(ms 정수, 일시정지 제외). 오름차순 */
export interface ReplayMove {
    from: Cell;
    to: Cell;
    t: number;
}
export interface ReplayResult {
    /** 최종 점수 (스왑 점수 + 마지막 팡) */
    score: number;
    validMoves: number;
    invalidMoves: number;
    /** 마지막 팡 점수 (score에 이미 들어 있다) */
    finaleScore: number;
}
/** moves는 validateMoves를 통과했다고 본다 (모두 제한 시간 안이라 게임이 받은 스왑이다) */
export declare function replayTimeAttack(seed: number, moves: readonly ReplayMove[]): ReplayResult;

/** PLAN2 5.8 판정 기준 (한곳에 모은다) */
export declare const JUDGE: {
    /** move 시각: 0 ≤ t < limitMs, 정수 ms */
    readonly limitMs: number;
    /** 연속 두 move의 t 차이 하한 (유효·무효 구분 없이). 그래서 move 수는 최대 limitMs / minGapMs = 300개 */
    readonly minGapMs: 200;
    /** 서버 시각 start-run 발급 → submit 도착 하한 (60초 − 오차 2초) */
    readonly minServerElapsedMs: 58000;
    /** run 유효기간. 발급 후 이 시간 이상이면 만료 */
    readonly runTtlMs: number;
};
export type RejectReason = 'version-mismatch' | 'too-fast' | 'expired' | 'moves-not-array' | 't-not-integer' | 't-out-of-range' | 'gap-too-short' | 'pos-invalid' | 'not-adjacent' | 'score-mismatch' | 'payload-invalid' | 'client-score-invalid' | 'version-invalid' | 'resubmit-conflict';
export type Verdict = {
    ok: true;
} | {
    ok: false;
    reason: RejectReason;
    index?: number;
};
/** move 시각·간격·좌표 (JSON에서 온 값이라 타입을 믿지 않고 하나씩 본다) */
export declare function validateMoves(moves: unknown, board: {
    rows: number;
    cols: number;
}): Verdict;
/** 서버 시각 (ms). 발급 → 도착이 58초 미만이면 거부, 30분 이상이면 만료 */
export declare function checkServerTiming(issuedAtMs: number, submittedAtMs: number): Verdict;
export interface SubmissionPayload {
    moves: readonly ReplayMove[];
    clientScore: number;
    version: string;
}
/**
 * moves·clientScore·version을 키 순서를 고정한 JSON으로 만든 sha256 (hex). 다른 필드는 무시한다.
 * 형식 검사(checkPayload)를 통과한 payload만 넣는다 (잘못된 moves면 예외가 난다)
 */
export declare function submissionHash(payload: SubmissionPayload): Promise<string>;
/** run에 저장된 해시와 비교: 처음이면 new, 같은 내용이면 same(이전 결과 반환), 다른 내용이면 conflict(거부) */
export declare function resubmitDecision(storedHash: string | null, newHash: string): 'new' | 'same' | 'conflict';
/**
 * 제출 형식: 객체, moves는 validateMoves 통과, clientScore는 0 이상 정수, version은 빈 문자열이 아닌 문자열.
 * 통과하면 submissionHash에 넣어도 안전하다
 */
export declare function checkPayload(payload: unknown): Verdict;
export type SubmissionResult = {
    ok: true;
    score: number;
    replay: ReplayResult;
} | {
    ok: false;
    reason: RejectReason;
    index?: number;
};
/**
 * 새 제출(resubmitDecision = new) 판정: 버전 → 서버 시각 → move 검사 → 리플레이 → 점수 비교.
 * seed는 클라이언트 값이 아니라 runs 기록에서 읽은 값이다 (SPEC 5.3)
 */
export declare function verifySubmission(submission: {
    seed: number;
    moves: unknown;
    clientScore: unknown;
    version: unknown;
}, server: {
    version: string;
    issuedAtMs: number;
    submittedAtMs: number;
}): SubmissionResult;
/**
 * 새 제출(decision = new)의 해시·결과를 run에 저장할지 (PLAN2 6.4 "판정 저장").
 * too-fast는 내용이 아니라 도착 시각 때문의 거부라 저장하지 않는다: 저장하면 같은 내용의 정상 재시도까지 영구히 막힌다.
 * 통과·expired·내용 거부(점수 불일치 등)는 저장해 같은 내용이면 같은 결과를 돌려준다
 */
export declare function shouldStore(result: SubmissionResult): boolean;
export type Judgement = 
/** 형식이 잘못돼 해시를 만들지 않았다 (run에 아무것도 저장하지 않는다) */
{
    decision: 'invalid';
    result: SubmissionResult;
}
/** 같은 내용 재제출: 저장된 이전 결과를 그대로 돌려준다 */
 | {
    decision: 'same';
    hash: string;
    result: SubmissionResult;
}
/** 다른 내용으로 run 재사용: 거부 */
 | {
    decision: 'conflict';
    hash: string;
    result: SubmissionResult;
}
/** 첫 제출: 판정 결과와 hash를 run에 저장한다 (shouldStore가 false면 저장하지 않는다) */
 | {
    decision: 'new';
    hash: string;
    result: SubmissionResult;
};
/**
 * submit-score 서버 판정 진입점 (PLAN2 5.8): 형식 검사 → 해시·재제출 판단 → 새 제출이면 verifySubmission.
 * run: runs 기록 (서버 발급 seed, 저장된 해시·결과. 처음이면 storedHash null).
 * 잘못된 형식은 해시를 만들기 전에 구조화된 거부로 돌려준다 (예외 없음)
 */
export declare function judgeSubmission(run: {
    seed: number;
    storedHash: string | null;
    storedResult: SubmissionResult | null;
}, payload: unknown, server: {
    version: string;
    issuedAtMs: number;
    submittedAtMs: number;
}): Promise<Judgement>;

/** ms(Unix 시각) → '2026-W45'. ISO 주차는 그 주 목요일이 속한 해를 쓴다 (연말·연초에 해가 바뀔 수 있다) */
export declare function weekKey(ms: number): string;

/** 코어 version: 이 번들 코드의 sha256 앞 12자 */
export declare const CORE_VERSION: string;
