-- V2-W3-04 주간 랭킹 조회 (SPEC v0.2 5.2, PLAN2 6.5)
--
-- 랭킹 화면이 한 번 부르면 TOP 50·내 위아래 5명·내 상태를 한꺼번에 받는다.
-- - 주: p_week가 null이면 서버 시각(KST)의 ISO 주. src/replay/weekKey.ts와 같은 규칙·형식('2026-W45')이라
--   기기 시계와 무관하게 월요일 00:00 KST에 바뀐다. 명시 week는 시험용
-- - 대상: 그 주 기록 중 닉네임이 있는 사람만 (PLAN2 6.1). 닉네임 없는 점수는 목록·순위 계산에서 빠진다
-- - 나열: best_score desc, updated_at asc(먼저 최고 점수에 도달한 사람이 위), user_id. 표시 순위는 rank() 공동 순위
-- - section: 'top' 나열 1~50번째 / 'around' 내 나열 순번 ±5 (나 포함, top과 겹쳐도 준다) /
--   'me' 내 상태 1행 (닉네임·기록 있음 → rank, 기록 있으나 닉네임 없음 → rank·seq null + 점수, 기록 없음 → 행 없음)
-- - seq: 나열 순번(1부터). 클라이언트가 top·around를 합칠 때 중복 제거·⋯ 위치 판단에 쓴다
-- - user_id는 돌려주지 않는다 (is_me로만 구분). 비로그인(anon)은 auth.uid()가 null이라 around·me가 없다
-- 표 권한·RLS는 그대로다: security invoker라 호출자 권한으로 읽고, 두 표 모두 이미 전체 SELECT다.

create function public.weekly_ranking(p_week text default null)
returns table (
  week_key text,
  section text,
  seq int,
  rank int,
  nickname text,
  tag int,
  best_score int,
  is_me boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      coalesce(p_week, to_char(now() at time zone 'Asia/Seoul', 'IYYY-"W"IW')) as wk,
      auth.uid() as me
  ),
  ranked as (
    select
      w.user_id,
      p.nickname,
      p.tag,
      w.best_score,
      (row_number() over (order by w.best_score desc, w.updated_at asc, w.user_id))::int as seq,
      (rank() over (order by w.best_score desc))::int as rnk
    from public.weekly_scores as w
    join public.profiles as p on p.id = w.user_id
    cross join params
    where w.week_key = params.wk and p.nickname is not null
  ),
  my_seq as (
    select r.seq from ranked as r cross join params where r.user_id = params.me
  ),
  sections as (
    select 'top' as section, 1 as ord, r.* from ranked as r where r.seq <= 50
    union all
    select 'around', 2, r.*
    from ranked as r cross join my_seq as m
    where r.seq between m.seq - 5 and m.seq + 5
    union all
    select 'me', 3, r.*
    from ranked as r cross join params
    where r.user_id = params.me
    union all
    -- 기록은 있으나 닉네임이 없다: 순위 없이 점수만
    select 'me', 3, w.user_id, null, null, w.best_score, null, null
    from public.weekly_scores as w cross join params
    where w.week_key = params.wk
      and w.user_id = params.me
      and not exists (select 1 from ranked as r where r.user_id = params.me)
  )
  select
    params.wk,
    s.section,
    s.seq,
    s.rnk,
    s.nickname,
    s.tag,
    s.best_score,
    s.user_id is not distinct from params.me
  from sections as s cross join params
  order by s.ord, s.seq;
$$;

revoke all on function public.weekly_ranking(text) from public;
grant execute on function public.weekly_ranking(text) to anon, authenticated;
