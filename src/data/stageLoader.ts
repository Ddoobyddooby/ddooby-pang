// 스테이지 JSON을 받아 검증한다 (PLAN 7.1). fetch를 쓰는 건 이 파일뿐이다.
// 실패(네트워크, HTTP 오류, 깨진 JSON, 스키마 위반)는 파일 이름이 들어간 에러로 던진다. 조용히 넘어가지 않는다.

import {
  StageError,
  parseStory,
  parseTimeAttack,
  type StageDef,
  type TimeAttackDef,
} from './stageSchema';

export interface StageData {
  story: StageDef[];
  timeattack: TimeAttackDef;
}

/** fetch의 최소 모양 (테스트에서 가짜를 넣는다) */
export type FetchFn = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

const STORY_FILE = 'stages/story.json';
const TIMEATTACK_FILE = 'stages/timeattack.json';

/** 파일 하나를 받아 parse까지 한다. 어떤 실패든 `파일 이름: 이유` 메시지로 바꿔 던진다 */
async function loadFile<T>(
  fetchFn: FetchFn,
  base: string,
  file: string,
  parse: (raw: unknown) => T,
): Promise<T> {
  let raw: unknown;
  try {
    const res = await fetchFn(`${base}${file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (error) {
    const reason = error instanceof SyntaxError ? 'JSON 형식이 잘못됐다' : '파일을 받지 못했다';
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${file}: ${reason} (${detail})`, { cause: error });
  }
  try {
    return parse(raw);
  } catch (error) {
    if (error instanceof StageError) throw new Error(`${file}: ${error.message}`, { cause: error });
    throw error;
  }
}

/** base는 vite의 base('./')라서 상대 경로로 받는다 (Capacitor WebView 대비) */
export async function loadStages(
  fetchFn: FetchFn = fetch,
  base: string = import.meta.env.BASE_URL,
): Promise<StageData> {
  const [story, timeattack] = await Promise.all([
    loadFile(fetchFn, base, STORY_FILE, parseStory),
    loadFile(fetchFn, base, TIMEATTACK_FILE, parseTimeAttack),
  ]);
  return { story, timeattack };
}
