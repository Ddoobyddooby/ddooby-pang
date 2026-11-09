// Supabase 연결 (PLAN2 6.1·6.3). publishable key만 쓴다. 키가 없으면(로컬 빌드·포크) null → 온라인 기능 꺼짐.
// account·profile은 아래 OnlineBackend만 알고 supabase-js를 직접 모른다 (가짜 백엔드로 시험하기 위해)
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProfileRow {
  nickname: string | null;
  tag: number | null;
}

/** Edge Function 응답. 연결 자체가 안 되면(오프라인·CORS 차단) 'network' */
export type FunctionResult = { status: number; body: unknown } | 'network';

/** DB 함수(rpc) 응답. 권한·4xx·5xx·연결 실패는 구분하지 않고 'error' (throw하지 않는다) */
export type RpcResult = { data: unknown } | 'error';

export interface OnlineBackend {
  /** 저장된 세션의 사용자 ID. 세션이 없으면 null. 실패는 throw */
  getSessionUserId(): Promise<string | null>;
  /** 익명 로그인 → 사용자 ID. 실패는 throw */
  signInAnonymously(): Promise<string>;
  /** 세션이 사라졌을 때(갱신 실패·로그아웃) 부른다 */
  onSignedOut(listener: () => void): void;
  /** 본인 profiles 행. 행이 없으면 null. 실패는 throw */
  fetchProfile(userId: string): Promise<ProfileRow | null>;
  /** Edge Function 호출 (세션 토큰은 클라이언트가 붙인다) */
  callFunction(name: string, body: Record<string, unknown>): Promise<FunctionResult>;
  /** DB 함수 호출 (PostgREST rpc) */
  callRpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
  /** 테이블에 행 하나 INSERT (응답 행은 받지 않는다). 권한·4xx·5xx·연결 실패는 'error' (throw하지 않는다) */
  insertRow(table: string, row: Record<string, unknown>): Promise<'ok' | 'error'>;
}

export function backendFromClient(
  client: SupabaseClient,
  errors: FunctionErrorClasses,
): OnlineBackend {
  return {
    async getSessionUserId() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session?.user.id ?? null;
    },
    async signInAnonymously() {
      const { data, error } = await client.auth.signInAnonymously();
      if (error) throw error;
      if (!data.user) throw new Error('익명 로그인 응답에 user가 없다');
      return data.user.id;
    },
    onSignedOut(listener) {
      client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') listener();
      });
    },
    async fetchProfile(userId) {
      const { data, error } = await client
        .from('profiles')
        .select('nickname, tag')
        .eq('id', userId)
        .maybeSingle<ProfileRow>();
      if (error) throw error;
      return data;
    },
    async callFunction(name, body) {
      const { data, error } = await client.functions.invoke(name, { body });
      if (!error) return { status: 200, body: data };
      if (error instanceof errors.FunctionsHttpError) {
        const res = error.context as Response;
        let resBody: unknown = null;
        try {
          resBody = await res.json();
        } catch {
          // 본문이 JSON이 아니면 상태 코드만 쓴다
        }
        return { status: res.status, body: resBody };
      }
      if (error instanceof errors.FunctionsFetchError) return 'network';
      // FunctionsRelayError 등: 함수까지 못 간 서버 쪽 오류
      return { status: 502, body: null };
    },
    async callRpc(name, args) {
      try {
        const { data, error } = await client.rpc(name, args);
        return error ? 'error' : { data };
      } catch {
        return 'error';
      }
    },
    async insertRow(table, row) {
      try {
        const { error } = await client.from(table).insert(row);
        return error ? 'error' : 'ok';
      } catch {
        return 'error';
      }
    },
  };
}

/** supabase-js의 오류 클래스 (instanceof 판정용. 동적 import한 모듈에서 넘겨받는다) */
export interface FunctionErrorClasses {
  FunctionsHttpError: abstract new (...args: never[]) => { context: unknown };
  FunctionsFetchError: abstract new (...args: never[]) => object;
}

/**
 * `.env.local`·저장소 Variables의 URL·publishable key로 백엔드를 만든다. 키가 없으면 null.
 * supabase-js는 처음 쓸 때 동적 import해 게임 첫 로딩 번들에 넣지 않는다
 */
export async function createDefaultBackend(): Promise<OnlineBackend | null> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) return null;
  const supabase = await import('@supabase/supabase-js');
  const client = supabase.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return backendFromClient(client, supabase);
}

/** 키가 들어 있는 빌드인지 (supabase-js를 불러오지 않고 판단) */
export function hasOnlineKeys(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
}
