# supabase/

ddooby-pang 전용 Supabase 프로젝트의 설정과 DB 마이그레이션 (SPEC v0.2 7절, PLAN2 6.1·6.2).

- `config.toml`: `supabase init`으로 만든 CLI 설정. 로컬 Docker 스택은 쓰지 않으므로 원격 적용에는 영향이 없다 (`enable_anonymous_sign_ins = true`는 의도 기록용)
- `migrations/`: 스키마·RLS·GRANT. 파일명 타임스탬프 순서로 적용된다
- `functions/<이름>/`: Edge Function. `index.ts`(Deno 진입점, 환경 변수·DB 연결) + 순수 처리 로직(`handler.ts`, Vitest 대상) + 함수별 `deno.json`
- `functions/_shared/`: `npm run server:shared`가 src에서 묶어 만드는 파일 (직접 고치지 않는다). CI가 `npm run server:shared:check`로 커밋본과 대조한다
- `.temp/`·`.branches/`: CLI가 만드는 링크 정보. 커밋하지 않는다 (`supabase/.gitignore`)

## 원격 적용 (PL이 사용자 확인을 받은 뒤에만)

키·비밀번호는 파일이나 채팅에 남기지 않고 사용자가 터미널에 직접 입력한다.

```sh
supabase login                                   # 브라우저 인증
supabase link --project-ref <ref>                # DB 비밀번호 입력
supabase db push --dry-run                       # 올라갈 마이그레이션 확인
supabase db push
```

worktree에서 실행할 때는 `--workdir <worktree 경로>`를 붙인다 (그 아래 `supabase/`를 쓴다). `link`도 같은 `--workdir`로 해야 `.temp/`에 링크가 남는다.

## Edge Function 배포 (PL이 한다)

```sh
npm run server:shared:check                      # _shared 묶음이 src와 같은지
npm run functions:check                          # deno check
supabase functions deploy set-nickname --use-api --workdir <worktree 경로>
```

- `--use-api`: Docker 없이 서버에서 묶는다. 빼면 로컬 Docker로 묶는다
- JWT 확인: `config.toml`의 `[functions.set-nickname] verify_jwt = true`(기본값). 게이트웨이가 먼저 사용자 JWT를 보고, 함수 안에서 `auth.getUser(token)`으로 한 번 더 본다. `--no-verify-jwt`는 쓰지 않는다
- 키: 함수는 Supabase가 주입하는 `SUPABASE_URL`, `SUPABASE_SECRET_KEYS`(없으면 구형 `SUPABASE_SERVICE_ROLE_KEY`)만 읽는다. `supabase secrets set`은 필요 없다

## 권한 시험

```sh
npm run supabase:check                           # 기본 .env.local
npm run supabase:check -- <env 파일 경로>         # 예: 메인 저장소의 .env.local
npm run supabase:check -- <env 파일 경로> --nickname   # set-nickname 배포 뒤: 닉네임 항목 추가
```

익명 사용자 A·B와 비로그인 anon으로 PLAN2 6.2 시험 ①~④와 anon 쓰기 차단을 표로 출력한다. 모두 PASS면 exit 0, FAIL이 있으면 1, 설정·로그인 오류는 2. 대시보드에서 Anonymous Sign-ins가 켜져 있어야 한다. 시험이 만든 익명 계정, `stage_attempts` 행(`stage_id = 999`), `시험` 접두어 닉네임은 남는다.

`--nickname` 항목 (익명 사용자 C를 하나 더 만든다): A 정상 설정(응답·profiles 일치), B 금칙어(사칭 접두·욕설 접미 변형)·짧음 400(시험 이름이 현재 규칙에서 그 코드로 거부되는지 먼저 로컬 확인), 닉네임 없는 C가 A와 같은 이름 → 다른 태그, A 두 번째 설정 409, 토큰 없음·무효 401, 허용 출처 preflight에 Allow-Origin 있음, 허용 안 된 출처 preflight에 없음, profiles 직접 UPDATE 여전히 실패.

`runs`는 클라이언트가 만들 수 없어 지금은 "오류 없이 0행"만 본다. 실제 교차 시험(B가 A의 run을 못 읽음)은 `start-run`이 생기는 V2-W3-03에서 추가한다.

## PLAN2 6.2 대조 (`20261106150000_v2_w3_01_schema_rls.sql`)

| PLAN2 6.2 | 마이그레이션 |
|---|---|
| `profiles.id` uuid PK → auth.users on delete cascade | `id uuid primary key references auth.users (id) on delete cascade` |
| `nickname` text null 2~10자 / `tag` int null 0~9999 | `check (char_length(nickname) between 2 and 10)` / `check (tag between 0 and 9999)` |
| `created_at`, `updated_at`, `unique (nickname, tag)` | `not null default now()` 두 열 + `updated_at` 트리거, `unique (nickname, tag)` |
| profiles: SELECT 전체, 쓰기 없음 | `grant select to anon, authenticated` + 정책 `using (true)` |
| `runs.id` uuid PK default gen_random_uuid() | 그대로 |
| `user_id → auth.users`, `seed int`, `mode check ('timeattack')`, `version`, `week_key` | `not null`, user_id는 on delete cascade, `check (mode in ('timeattack'))` |
| `created_at default now()`, `submitted_at`, `submission_hash`, `result jsonb` | 그대로 (뒤 셋은 null 허용) |
| runs: SELECT 본인만, 쓰기 없음 | `grant select to authenticated` + 정책 `user_id = (select auth.uid())` |
| `weekly_scores`: `user_id`, `week_key`, `best_score ≥ 0`, `run_id → runs`, `updated_at`, PK `(user_id, week_key)` | 그대로 (user_id on delete cascade, `updated_at` 트리거) |
| 인덱스 `(week_key, best_score desc)` | `weekly_scores_week_rank_idx` |
| weekly_scores: SELECT 전체, INSERT·UPDATE·DELETE 불가 | `grant select to anon, authenticated` + 정책 `using (true)`. 쓰기 grant 없음 |
| `stage_attempts.id bigserial`, `user_id default auth.uid()` | 그대로 (+ on delete cascade) |
| `stage_id 1~999`, `result ('clear','fail')`, `moves_left ≥ 0`, `score ≥ 0`, `stars 0~3`, `attempt_no ≥ 1`, `created_at` | 각 `check`, `created_at default now()` |
| stage_attempts: INSERT 본인만, SELECT 본인만 | `grant select, insert(열 7개) to authenticated` + 시퀀스 usage, 정책 insert `with check`·select `using` 모두 `user_id = (select auth.uid())` |
| 모든 public 테이블 RLS, `revoke all` 뒤 표만 grant | 4개 테이블 `enable row level security`, anon·authenticated `revoke all` (테이블·시퀀스) |

표에 없이 더한 것:

- `stage_attempts` INSERT는 열 단위 grant라 `id`·`created_at`은 클라이언트가 정하지 못한다
- `service_role`에 4개 테이블 select·insert·update·delete와 시퀀스 usage·select를 명시한다 (새 프로젝트는 자동 노출이 꺼져 있을 수 있어서. Edge Function용)
- `runs (user_id)`·`stage_attempts (user_id)` 인덱스 (본인 조회·RLS 조건)
- 트리거 함수 `set_updated_at()`은 `set search_path = ''`, anon·authenticated·PUBLIC의 execute를 걷었다

정적 확인: `supabase db lint`는 로컬 DB(Docker)나 링크된 원격이 있어야 해서 이번 단계에선 생략했다. 대신 PGlite(WASM Postgres)에 auth 스텁(`auth.users`, `auth.uid()`, anon·authenticated·service_role 역할, 예전 기본 권한 "자동 노출")을 만들고 마이그레이션을 적용해 역할별 권한 33항목을 확인했다 (모두 PASS, 커밋하지 않은 일회성 확인).
