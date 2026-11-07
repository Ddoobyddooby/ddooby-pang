// Edge Function start-run (PLAN2 6.4): 경쟁 모드 한 판을 서버가 발급한다 (seed는 서버가 정한다. SPEC 5.3)
import { corsHeaders } from '@supabase/supabase-js/cors';
import { CORE_VERSION } from '../_shared/replay.js';
import { createAdmin, userIdFromToken } from '../_lib/admin.ts';
import { handleStartRun, SEED_LIMIT, type StartRunDeps } from './handler.ts';

const admin = createAdmin();

const deps: StartRunDeps = {
  allowHeaders: corsHeaders['Access-Control-Allow-Headers'],
  version: CORE_VERSION,
  now: () => Date.now(),
  getUserId: (token) => userIdFromToken(admin, token),

  randomSeed() {
    // 2^32는 SEED_LIMIT로 나누어떨어지지 않아 아주 작은 치우침이 있지만 판 seed로는 문제없다
    const [n = 0] = crypto.getRandomValues(new Uint32Array(1));
    return n % SEED_LIMIT;
  },

  async insertRun(run) {
    const { data, error } = await admin
      .from('runs')
      .insert({
        user_id: run.userId,
        seed: run.seed,
        mode: 'timeattack',
        version: run.version,
        week_key: run.weekKey,
        created_at: new Date(run.createdAtMs).toISOString(),
      })
      .select('id')
      .single<{ id: string }>();
    if (error) throw error;
    return data.id;
  },
};

Deno.serve((req) => handleStartRun(deps, req));
