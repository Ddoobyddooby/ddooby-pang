// DEV 전용 ?nickname=<값>: 가짜 submit으로 닉네임 입력 창을 띄워 모든 결과를 본다 (V2-W3-02).
// 값: ok(성공, 입력한 이름 + #0427) 또는 NicknameErrorCode 하나(그 오류를 돌려줌). 모르는 값이면 ok.
// 닫힐 때 결과를 콘솔에 남긴다. 서버·저장과 무관하다.

import { NicknamePrompt } from '../view/NicknamePrompt';
import type { NicknameResult } from '../view/nicknamePromptState';
import type { NicknameErrorCode } from '../view/nicknameText';

const CODES: readonly NicknameErrorCode[] = [
  'too-short',
  'too-long',
  'bad-chars',
  'banned',
  'already-set',
  'network',
  'server',
  'unauthorized',
];

export function parsePreviewResult(value: string | null): NicknameErrorCode | 'ok' {
  return CODES.find((c) => c === value) ?? 'ok';
}

export function openNicknamePreview(canvas: HTMLElement, value: string | null): NicknamePrompt {
  const want = parsePreviewResult(value);
  const submit = (name: string): Promise<NicknameResult> =>
    new Promise((resolve) =>
      window.setTimeout(
        () =>
          resolve(
            want === 'ok'
              ? { ok: true, nickname: name.trim() || '이안', tag: '0427' }
              : { ok: false, code: want },
          ),
        500,
      ),
    );
  return new NicknamePrompt({
    canvas,
    submit,
    onClose: (result) => console.info(`[nickname-preview] closed: ${result}`),
  });
}
