// 닉네임 입력 창의 진행 상태 (순수, Phaser·DOM 없음). 입력 → 제출 중 → 결과별 다음 상태.
// 창은 이 상태를 읽어 그리기만 한다.

import { NICKNAME_TEXT, type NicknameErrorCode, type NicknamePromptText } from './nicknameText';

export type NicknameResult =
  { ok: true; nickname: string; tag: string } | { ok: false; code: NicknameErrorCode };

export type PromptOutcome = 'saved' | 'later' | 'failed';

export interface PromptTimings {
  /** 성공·already-set 안내를 보여 준 뒤 닫기까지 (ms) */
  savedMs: number;
  /** 연결 실패 안내를 보여 준 뒤 닫기까지 (ms) */
  failedMs: number;
  /** [나중에] 안내를 보여 준 뒤 닫기까지 (ms) */
  laterMs: number;
}

export const PROMPT_TIMINGS: PromptTimings = { savedMs: 1200, failedMs: 1500, laterMs: 1500 };

export interface PromptState {
  /** input: 입력 가능 / submitting: 제출 중(잠금) / closing: 안내를 보여 주는 중(잠금) */
  phase: 'input' | 'submitting' | 'closing';
  message: { kind: 'error' | 'info'; text: string } | null;
  /** closing일 때만: 닫을 때 알릴 결과와 닫기까지 기다릴 시간 */
  outcome: PromptOutcome | null;
  closeAfterMs: number;
}

export const initialPromptState = (): PromptState => ({
  phase: 'input',
  message: null,
  outcome: null,
  closeAfterMs: 0,
});

/** 입력·버튼을 막아야 하는 때 (두 번 제출 방지) */
export const isLocked = (s: PromptState): boolean => s.phase !== 'input';

/** [확인]: 입력 중일 때만 제출 중으로 넘어간다. 안내는 지운다 */
export function startSubmit(s: PromptState): PromptState {
  if (s.phase !== 'input') return s;
  return { ...s, phase: 'submitting', message: null };
}

/** [나중에]: 입력 중일 때만. 랭킹에 안 보인다는 안내를 잠깐 보여 준 뒤 닫는다 (제출 중에는 무시) */
export function chooseLater(
  s: PromptState,
  text: NicknamePromptText = NICKNAME_TEXT,
  timings: PromptTimings = PROMPT_TIMINGS,
): PromptState {
  if (s.phase !== 'input') return s;
  return {
    phase: 'closing',
    message: { kind: 'info', text: text.laterNotice },
    outcome: 'later',
    closeAfterMs: timings.laterMs,
  };
}

/** 제출 결과 반영. 제출 중이 아니면 무시한다 */
export function applyResult(
  s: PromptState,
  result: NicknameResult,
  text: NicknamePromptText = NICKNAME_TEXT,
  timings: PromptTimings = PROMPT_TIMINGS,
): PromptState {
  if (s.phase !== 'submitting') return s;
  if (result.ok) {
    return {
      phase: 'closing',
      message: { kind: 'info', text: text.success(result.nickname, result.tag) },
      outcome: 'saved',
      closeAfterMs: timings.savedMs,
    };
  }
  const message = { kind: 'error' as const, text: text.errors[result.code] };
  switch (result.code) {
    case 'too-short':
    case 'too-long':
    case 'bad-chars':
    case 'banned':
      return { phase: 'input', message, outcome: null, closeAfterMs: 0 };
    case 'already-set':
      return { phase: 'closing', message, outcome: 'saved', closeAfterMs: timings.savedMs };
    default:
      return { phase: 'closing', message, outcome: 'failed', closeAfterMs: timings.failedMs };
  }
}

/** Enter로 제출할지. 한글 조합 입력(IME) 중 Enter는 글자를 확정하는 키라 제출하지 않는다 */
export function shouldSubmitOnEnter(e: {
  key: string;
  isComposing?: boolean;
  keyCode?: number;
}): boolean {
  // 일부 브라우저는 조합 확정 keydown에서 isComposing이 false지만 keyCode가 229다
  return e.key === 'Enter' && !e.isComposing && e.keyCode !== 229;
}
