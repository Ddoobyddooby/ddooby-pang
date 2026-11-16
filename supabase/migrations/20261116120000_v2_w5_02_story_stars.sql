-- V2-W5-02 스토리 별 랭킹 (SPEC v0.2 5.4, PLAN2 6.9·6.9.1)
--
-- 사용자·스테이지(1~30)별 최고 별(1~3) 한 행. 합계 0~90을 주간 초기화 없이 상시 순위로 매긴다.
-- 클라이언트가 보낸 별을 믿는 친목용 순위다: 서버는 인증·소유권·스테이지 범위·별 범위·개수만 검사하고
-- 실제 플레이 여부는 증명하지 못한다 (경쟁 모드의 리플레이 검증과 별개).
--
-- - 표 story_stars: anon·authenticated는 SELECT만. 쓰기는 sync_story_stars(security definer)로만 한다
-- - sync_story_stars(p_stars jsonb): 호출자(auth.uid()) 본인 행만, 낮거나 같은 별로 덮어쓰지 않는다. 반환은 서버 합계
-- - story_ranking(): weekly_ranking과 같은 틀(top·around·me). week 메타 행은 없다

-- ---------------------------------------------------------------------------
-- story_stars
-- ---------------------------------------------------------------------------

create table public.story_stars (
  user_id uuid not null references auth.users (id) on delete cascade,
  stage_id int not null check (stage_id between 1 and 30),
  stars int not null check (stars between 1 and 3),
  updated_at timestamptz not null default now(),
  primary key (user_id, stage_id)
);

alter table public.story_stars enable row level security;

create policy "story_stars: 전체 읽기"
on public.story_stars
for select
to anon, authenticated
using (true);

-- 프로젝트 기본 권한(자동 노출)에 기대지 않고 모두 걷은 뒤 SELECT만 준다. INSERT·UPDATE·DELETE 정책도 없다
revoke all on table public.story_stars from anon, authenticated;
grant select on table public.story_stars to anon, authenticated;
grant select, insert, update, delete on table public.story_stars to service_role;

-- ---------------------------------------------------------------------------
-- sync_story_stars: 기기의 최고 별 전체를 보내면 스테이지마다 더 높은 값만 남긴다
-- ---------------------------------------------------------------------------
-- 입력 {"1":3,"2":1,...}. 하나라도 어긋나면 예외로 전체 거부한다(아무 행도 바뀌지 않는다).
-- - object가 아님(SQL NULL·JSON null·배열·문자열·숫자·불리언) / 키 31개 이상
-- - 키가 "1"~"30"의 정규 표기가 아님 ("01"·"1.0"·" 1"·"" 거부)
-- - 값이 JSON number 1·2·3이 아님 (문자열 "3"·불리언·null·0·4·1.5 거부. 1.0은 수학적으로 1이라 허용)
-- 빈 object는 허용: 쓰기 없이 현재 합계만 돌려준다.
-- user_id는 인자로 받지 않고 auth.uid()만 쓴다 → 다른 사용자의 행은 쓸 수 없다.

create function public.sync_story_stars(p_stars jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_val jsonb;
  v_total int;
begin
  if v_uid is null then
    raise exception 'sync_story_stars: not authenticated' using errcode = '42501';
  end if;

  if p_stars is null or jsonb_typeof(p_stars) <> 'object' then
    raise exception 'sync_story_stars: p_stars must be an object' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_object_keys(p_stars)) > 30 then
    raise exception 'sync_story_stars: too many stages' using errcode = '22023';
  end if;

  -- 먼저 전부 검사한다. 쓰기는 모두 통과한 뒤에만 (예외가 나면 이 호출 전체가 되돌려진다)
  for v_key, v_val in select e.key, e.value from jsonb_each(p_stars) as e loop
    if v_key !~ '^([1-9]|[12][0-9]|30)$' then
      raise exception 'sync_story_stars: invalid stage key' using errcode = '22023';
    end if;
    if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}')::numeric not in (1, 2, 3) then
      raise exception 'sync_story_stars: invalid stars' using errcode = '22023';
    end if;
  end loop;

  -- 스테이지 번호순으로 써서 같은 사용자의 동시 호출끼리 잠금 순서를 맞춘다.
  -- 낮거나 같은 별은 where에서 걸러져 행(updated_at 포함)을 바꾸지 않는다 → 같은 요청을 반복해도 결과가 같다
  insert into public.story_stars as s (user_id, stage_id, stars)
  select v_uid, e.key::int, (e.value #>> '{}')::numeric::int
  from jsonb_each(p_stars) as e
  order by e.key::int
  on conflict (user_id, stage_id) do update
    set stars = excluded.stars, updated_at = now()
    where s.stars < excluded.stars;

  select coalesce(sum(s.stars), 0)::int into v_total
  from public.story_stars as s
  where s.user_id = v_uid;

  return v_total;
end;
$$;

-- 함수 기본 PUBLIC 실행 권한과 Supabase 기본 권한(anon 자동 노출)을 모두 걷고 로그인 사용자에게만 준다.
-- 익명 로그인 사용자도 authenticated 역할이다
revoke all on function public.sync_story_stars(jsonb) from public, anon, authenticated;
grant execute on function public.sync_story_stars(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- story_ranking: 별 합계 랭킹 (weekly_ranking과 같은 틀)
-- ---------------------------------------------------------------------------
-- - 대상: 별을 1개 이상 등록하고 닉네임이 있는 사용자. 닉네임 없는 기록은 목록·순위 계산에서 빠진다
-- - 합계 total_stars = sum(stars), 도달 시각 reached_at = max(updated_at)
-- - 나열(seq): total_stars desc, reached_at asc(먼저 그 합계에 도달한 사람이 위), user_id.
--   표시 순위는 rank() over (total_stars desc) → 공동 순위 (시간은 순위를 가르지 않는다)
-- - section: 'top' 나열 1~50번째 / 'around' 내 나열 순번 ±5 (나 포함, top과 겹쳐도 준다) /
--   'me' 내 상태 1행 (닉네임·기록 있음 → rank, 기록은 있으나 닉네임 없음 → rank·seq null + 합계, 기록 없음 → 행 없음)
-- - week 메타 행은 없다. user_id는 돌려주지 않는다 (is_me로만 구분). 비로그인(anon)은 around·me가 없다
-- security invoker라 호출자 권한으로 읽는다 (story_stars·profiles 모두 전체 SELECT).

create function public.story_ranking()
returns table (
  section text,
  seq int,
  rank int,
  nickname text,
  tag int,
  total_stars int,
  is_me boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select auth.uid() as me
  ),
  totals as (
    select s.user_id, sum(s.stars)::int as total_stars, max(s.updated_at) as reached_at
    from public.story_stars as s
    group by s.user_id
  ),
  ranked as (
    select
      t.user_id,
      p.nickname,
      p.tag,
      t.total_stars,
      (row_number() over (order by t.total_stars desc, t.reached_at asc, t.user_id))::int as seq,
      (rank() over (order by t.total_stars desc))::int as rnk
    from totals as t
    join public.profiles as p on p.id = t.user_id
    where p.nickname is not null
  ),
  my_seq as (
    select r.seq from ranked as r cross join params where r.user_id = params.me
  ),
  sections as (
    select 'top' as section, 1 as ord, r.user_id, r.nickname, r.tag, r.total_stars, r.seq, r.rnk
    from ranked as r
    where r.seq <= 50
    union all
    select 'around', 2, r.user_id, r.nickname, r.tag, r.total_stars, r.seq, r.rnk
    from ranked as r cross join my_seq as m
    where r.seq between m.seq - 5 and m.seq + 5
    union all
    select 'me', 3, r.user_id, r.nickname, r.tag, r.total_stars, r.seq, r.rnk
    from ranked as r cross join params
    where r.user_id = params.me
    union all
    -- 기록은 있으나 닉네임이 없다: 순위 없이 합계만
    select 'me', 3, t.user_id, null, null, t.total_stars, null, null
    from totals as t cross join params
    where t.user_id = params.me
      and not exists (select 1 from ranked as r where r.user_id = params.me)
  )
  select
    s.section,
    s.seq,
    s.rnk,
    s.nickname,
    s.tag,
    s.total_stars,
    -- anon(me null)은 false
    coalesce(s.user_id = params.me, false)
  from sections as s cross join params
  order by s.ord, s.seq;
$$;

revoke all on function public.story_ranking() from public;
grant execute on function public.story_ranking() to anon, authenticated;
