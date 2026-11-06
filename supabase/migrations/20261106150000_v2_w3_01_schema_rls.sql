-- V2-W3-01 경쟁 모드 주간 랭킹·플레이 로그 스키마와 권한 (SPEC v0.2 7절, PLAN2 6.2)
--
-- 권한은 두 겹으로 막는다: 테이블 GRANT(역할이 테이블에 닿는지) + RLS(어느 행인지).
-- 클라이언트 역할: anon(비로그인), authenticated(로그인. 익명 로그인 사용자도 이 역할이다).
-- 서버 쓰기는 Edge Function의 service_role 연결로만 한다 (RLS 우회, V2-W3-02·03).

-- ---------------------------------------------------------------------------
-- updated_at 자동 갱신
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 트리거 전용 함수: Data API(rpc)로 부를 일이 없다
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles: 닉네임 표시용. 쓰기는 Edge Function set-nickname만 (금칙어 검사)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text check (char_length(nickname) between 2 and 10),
  tag int check (tag between 0 and 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nickname, tag)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- runs: 서버가 발급한 경쟁 모드 한 판 (start-run 생성, submit-score 사용 처리)
-- ---------------------------------------------------------------------------

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  seed int not null,
  mode text not null check (mode in ('timeattack')),
  version text not null,
  week_key text not null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  submission_hash text,
  result jsonb
);

create index runs_user_id_idx on public.runs (user_id);

-- ---------------------------------------------------------------------------
-- weekly_scores: 사용자별 주간 최고 점수. 쓰기는 submit-score만
-- ---------------------------------------------------------------------------

create table public.weekly_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_key text not null,
  best_score int not null check (best_score >= 0),
  run_id uuid not null references public.runs (id),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_key)
);

create index weekly_scores_week_rank_idx on public.weekly_scores (week_key, best_score desc);

create trigger weekly_scores_set_updated_at
before update on public.weekly_scores
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- stage_attempts: 스토리 모드 플레이 로그 (SPEC 6.1). 클라이언트가 본인 것만 쓴다
-- ---------------------------------------------------------------------------

create table public.stage_attempts (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stage_id int not null check (stage_id between 1 and 999),
  result text not null check (result in ('clear', 'fail')),
  moves_left int not null check (moves_left >= 0),
  score int not null check (score >= 0),
  stars int not null check (stars between 0 and 3),
  attempt_no int not null check (attempt_no >= 1),
  created_at timestamptz not null default now()
);

create index stage_attempts_user_id_idx on public.stage_attempts (user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.weekly_scores enable row level security;
alter table public.stage_attempts enable row level security;

create policy "profiles: 전체 읽기"
on public.profiles for select
to anon, authenticated
using (true);

create policy "runs: 본인 읽기"
on public.runs for select
to authenticated
using (user_id = (select auth.uid()));

create policy "weekly_scores: 전체 읽기"
on public.weekly_scores for select
to anon, authenticated
using (true);

create policy "stage_attempts: 본인 쓰기"
on public.stage_attempts for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "stage_attempts: 본인 읽기"
on public.stage_attempts for select
to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 테이블 권한: 프로젝트 기본 권한(자동 노출)에 기대지 않고 모두 걷은 뒤 필요한 것만 준다
-- ---------------------------------------------------------------------------

revoke all on table public.profiles, public.runs, public.weekly_scores, public.stage_attempts
from anon, authenticated;
revoke all on sequence public.stage_attempts_id_seq from anon, authenticated;

grant select on table public.profiles to anon, authenticated;
grant select on table public.runs to authenticated;
grant select on table public.weekly_scores to anon, authenticated;
grant select on table public.stage_attempts to authenticated;
-- id·created_at은 서버 기본값만 쓰게 열 단위로 준다
grant insert (user_id, stage_id, result, moves_left, score, stars, attempt_no)
on table public.stage_attempts to authenticated;
grant usage on sequence public.stage_attempts_id_seq to authenticated;

-- Edge Function(service_role)용. 새 프로젝트는 자동 노출이 꺼져 있을 수 있어 명시한다
grant select, insert, update, delete on table
  public.profiles, public.runs, public.weekly_scores, public.stage_attempts
to service_role;
grant usage, select on sequence public.stage_attempts_id_seq to service_role;
