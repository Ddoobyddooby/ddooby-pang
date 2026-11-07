// Edge Function submit-score (PLAN2 6.4): 서버 리플레이로 점수를 검증해 주간 최고 점수에 반영한다 (SPEC 5.3)
import { corsHeaders } from '@supabase/supabase-js/cors';
import { CORE_VERSION } from '../_shared/replay.js';
import { createAdmin, userIdFromToken } from '../_lib/admin.ts';
import { handleSubmitScore, type StoredResult, type SubmitScoreDeps } from './handler.ts';

interface RunRecord {
  id: string;
  seed: number;
  version: string;
  week_key: string;
  created_at: string;
  submission_hash: string | null;
  result: StoredResult | null;
}

const admin = createAdmin();

const deps: SubmitScoreDeps = {
  allowHeaders: corsHeaders['Access-Control-Allow-Headers'],
  version: CORE_VERSION,
  now: () => Date.now(),
  getUserId: (token) => userIdFromToken(admin, token),

  async getRun(runId, userId) {
    const { data, error } = await admin
      .from('runs')
      .select('id, seed, version, week_key, created_at, submission_hash, result')
      .eq('id', runId)
      .eq('user_id', userId)
      .maybeSingle<RunRecord>();
    if (error) throw error;
    if (!data) return null;
    const createdAtMs = Date.parse(data.created_at);
    if (!Number.isFinite(createdAtMs))
      throw new Error(`created_at을 읽을 수 없다: ${data.created_at}`);
    return {
      id: data.id,
      seed: data.seed,
      version: data.version,
      weekKey: data.week_key,
      createdAtMs,
      submissionHash: data.submission_hash,
      result: data.result,
    };
  },

  async claimRun(runId, hash, result, submittedAtMs) {
    const { data, error } = await admin
      .from('runs')
      .update({
        submission_hash: hash,
        result,
        submitted_at: new Date(submittedAtMs).toISOString(),
      })
      .eq('id', runId)
      .is('submission_hash', null)
      .select('id');
    if (error) throw error;
    return data.length > 0;
  },

  async saveResult(runId, result) {
    const { error } = await admin.from('runs').update({ result }).eq('id', runId);
    if (error) throw error;
  },

  async recordWeeklyBest(userId, weekKey, score, runId) {
    const { data, error } = await admin
      .rpc('record_weekly_best', { p_user: userId, p_week: weekKey, p_score: score, p_run: runId })
      .single<{ best: number; is_new_best: boolean }>();
    if (error) throw error;
    return { best: data.best, isNewBest: data.is_new_best };
  },
};

Deno.serve((req) => handleSubmitScore(deps, req));
