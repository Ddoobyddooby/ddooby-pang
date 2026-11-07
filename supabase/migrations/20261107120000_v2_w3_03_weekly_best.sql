-- V2-W3-03 주간 최고 점수 기록 (SPEC v0.2 5.2·5.3, PLAN2 6.4)
--
-- submit-score가 판정을 통과한 점수를 넣는다. 1인 1주 1행이고 더 높은 점수일 때만 바꾸므로
-- 같은 사용자의 제출이 동시에 와도 최고 점수만 남는다 (insert … on conflict는 행 잠금 뒤 비교한다).
-- is_new_best는 "이번 호출이 행을 바꿨는지"가 아니라 "기록 뒤 그 주 최고 점수가 이 run의 것인지"로 정한다.
-- 그래서 같은 run으로 몇 번 불러도(동시 재제출, 결과 저장 실패 뒤 재시도) 같은 답이 나온다 (멱등).
-- 같은 점수의 다른 run은 run_id를 바꾸지 않으므로 false다.
-- 클라이언트는 부를 수 없다: execute는 service_role(Edge Function)에만 준다.

create function public.record_weekly_best(p_user uuid, p_week text, p_score int, p_run uuid)
returns table (best int, is_new_best boolean)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.weekly_scores as w (user_id, week_key, best_score, run_id)
  values (p_user, p_week, p_score, p_run)
  on conflict (user_id, week_key) do update
    set best_score = excluded.best_score, run_id = excluded.run_id
    where excluded.best_score > w.best_score;

  -- row_count(이번 호출이 바꿨는지)를 쓰면 같은 run의 두 번째 호출이 false가 된다. run_id로 본다
  return query
  select w.best_score, w.run_id = p_run
  from public.weekly_scores as w
  where w.user_id = p_user and w.week_key = p_week;
end;
$$;

revoke all on function public.record_weekly_best(uuid, text, int, uuid) from public, anon, authenticated;
grant execute on function public.record_weekly_best(uuid, text, int, uuid) to service_role;
