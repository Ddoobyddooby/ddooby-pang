// start-run·submit-score의 Supabase 연결 (Deno 전용, index.ts만 import한다).
// 키는 Supabase가 주입하는 환경 변수만 읽는다 (SUPABASE_URL, SUPABASE_SECRET_KEYS 또는 구형 SUPABASE_SERVICE_ROLE_KEY)
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

/** service role 연결 (RLS 우회). 쓰기는 이 연결로만 한다 */
export function createAdmin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', serverKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** 토큰이 유효하면 사용자 ID, 무효(4xx)면 null. 그 밖의 오류는 throw (→ 500) */
export async function userIdFromToken(
  admin: SupabaseClient,
  token: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.getUser(token);
  if (error) {
    if (error.status !== undefined && error.status >= 400 && error.status < 500) return null;
    throw error;
  }
  return data.user?.id ?? null;
}
