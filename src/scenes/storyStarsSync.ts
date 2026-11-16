// 스토리 별 동기화 (V2-W5-02, PLAN2 6.9.1): 기기의 최고 별 전체를 내 계정에 올린다. Phaser 없음, 테스트용으로 분리.
// 실제 구현(src/online의 syncStoryStars)은 main.ts가 setStoryStarsClient로 꽂는다 (rankingClient.ts와 같은 방식).
// 캐시·직렬화·계정 처리는 online이 하고, 여기는 "보낼지 말지"와 "실패해도 게임을 막지 않기"만 맡는다.

export type StarsSyncResult =
  { kind: 'ok'; total: number } | { kind: 'offline' } | { kind: 'error' };

/** 이번에는 보내지 않았다 (데모·시험 스테이지·DEV) */
export type StarsSyncOutcome = StarsSyncResult | { kind: 'skipped' };

export interface StoryStarsClient {
  /** 절대 throw하지 않는다. 서버가 최고값만 남기므로 매번 전체를 보내도 된다 */
  syncStoryStars(bestStars: Record<number, number>): Promise<StarsSyncResult>;
}

const NO_CLIENT: StoryStarsClient = {
  syncStoryStars: () => Promise.resolve({ kind: 'offline' }),
};

let client: StoryStarsClient = NO_CLIENT;

export function setStoryStarsClient(next: StoryStarsClient): void {
  client = next;
}

export function getStoryStarsClient(): StoryStarsClient {
  return client;
}

/**
 * 보내지 않는 경우: DEV 시험 스테이지(devStage), ?demo 자동 플레이 (DEV·?starsync와 무관하게 항상),
 * DEV 빌드 (개발 중 ?unlock 등이 실제 랭킹을 흐리지 않게). DEV에서는 ?starsync가 있을 때만 보낸다
 */
export function shouldSyncStars(options: {
  devStage: boolean;
  demo: boolean;
  dev: boolean;
  search: string;
}): boolean {
  if (options.devStage || options.demo) return false;
  return !options.dev || new URLSearchParams(options.search).has('starsync');
}

/** 지금 주소·빌드 기준으로 보낼 판인지 (부팅·랭킹 화면용: 시험 스테이지가 아닌 일반 상태) */
export function syncContextNow(devStage = false): {
  devStage: boolean;
  demo: boolean;
  dev: boolean;
  search: string;
} {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  return {
    devStage,
    demo: new URLSearchParams(search).has('demo'),
    dev: import.meta.env.DEV,
    search,
  };
}

/**
 * 별을 올린다. 보내지 않는 경우는 요청 없이 skipped. 절대 throw하지 않고, 호출한 쪽이 기다리지 않아도 된다
 * (`void syncStars(...)`). 실패는 다음 부팅·클리어·랭킹 탭에서 전체를 다시 보내 메운다
 */
export async function syncStars(
  bestStars: Record<number, number>,
  context: { devStage: boolean; demo: boolean; dev: boolean; search: string },
  starsClient: StoryStarsClient = client,
): Promise<StarsSyncOutcome> {
  if (!shouldSyncStars(context)) return { kind: 'skipped' };
  try {
    // 호출 시점의 값을 복사해 넘긴다 (보내는 동안 저장이 바뀌어도 이 호출의 내용은 그대로)
    return await starsClient.syncStoryStars({ ...bestStars });
  } catch {
    return { kind: 'error' };
  }
}
