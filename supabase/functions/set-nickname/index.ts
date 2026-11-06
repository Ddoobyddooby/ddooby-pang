// Edge Function set-nickname (PLAN2 6.3): 사용자 토큰 확인 → checkNickname → 태그 발급 → profiles 저장.
// 키는 Supabase가 주입하는 환경 변수만 읽는다 (SUPABASE_URL, SUPABASE_SECRET_KEYS 또는 구형 SUPABASE_SERVICE_ROLE_KEY)
import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '@supabase/supabase-js/cors';
import { TAG_MAX } from '../_shared/nicknameRules.js';
import { handleSetNickname, type SetNicknameDeps } from './handler.ts';

/** 새 secret key(JSON 사전의 default)를 먼저 쓰고, 없으면 구형 service_role key */
function serverKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const key = (JSON.parse(keys) as Record<string, unknown>).default;
      if (typeof key === 'string' && key) return key;
    } catch {
      // 형식이 다르면 구형 키로 넘어간다
    }
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  throw new Error('서버 키 환경 변수가 없다');
}

const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serverKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const deps: SetNicknameDeps = {
  allowHeaders: corsHeaders['Access-Control-Allow-Headers'],

  async getUserId(token) {
    const { data, error } = await admin.auth.getUser(token);
    if (error) {
      // 4xx는 토큰 무효(→ 401). 그 밖은 서버 오류(→ 500)
      if (error.status !== undefined && error.status >= 400 && error.status < 500) return null;
      throw error;
    }
    return data.user?.id ?? null;
  },

  async getNickname(userId) {
    const { data, error } = await admin
      .from('profiles')
      .select('nickname')
      .eq('id', userId)
      .maybeSingle<{ nickname: string | null }>();
    if (error) throw error;
    return data?.nickname ?? null;
  },

  async saveNickname(userId, nickname, tag) {
    // 행이 없으면 빈 행을 만들고, 닉네임이 아직 없을 때만 채운다 (동시 요청에도 한 번만 정해진다)
    const created = await admin
      .from('profiles')
      .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
    if (created.error) throw created.error;
    const { data, error } = await admin
      .from('profiles')
      .update({ nickname, tag })
      .eq('id', userId)
      .is('nickname', null)
      .select('id');
    if (error) {
      if (error.code === '23505') return 'tag-taken'; // unique (nickname, tag)
      throw error;
    }
    return data.length === 0 ? 'already-set' : 'ok';
  },

  randomTag() {
    const [n = 0] = crypto.getRandomValues(new Uint32Array(1));
    return n % (TAG_MAX + 1);
  },
};

Deno.serve((req) => handleSetNickname(deps, req));
