# 개발 가이드

> VSCode에서 프로젝트를 열고, 서버를 띄우고, 작업 결과를 확인하는 방법.
> 태스크가 끝날 때마다 아래 **작업별 확인 방법**에 항목을 추가한다.

---

## 1. 처음 한 번

1. Node.js 20.19 이상 설치 (`node -v`로 확인)
2. repo 받기
   ```bash
   gh repo clone Ddoobyddooby/ddooby-pang
   cd ddooby-pang
   ```
3. VSCode로 열기: `code .`
   - `code` 명령이 없으면 VSCode에서 `Cmd+Shift+P` → "Shell Command: Install 'code' command in PATH"
4. 의존성 설치: VSCode 터미널(`` Ctrl+` ``)에서 `npm install`

## 2. 매일 쓰는 명령

VSCode 터미널에서 실행한다. 터미널은 `+` 버튼으로 여러 개 열 수 있다 (서버용 1개, 테스트용 1개 권장).

| 명령 | 용도 |
|---|---|
| `npm run dev` | 개발 서버. 코드를 저장하면 브라우저가 자동 갱신된다. 끄려면 `Ctrl+C` |
| `npm test` | 테스트 한 번 실행 |
| `npm run test:watch` | 파일을 저장할 때마다 테스트 자동 재실행. 끄려면 `q` |
| `npm run typecheck` | 타입 에러만 확인 |
| `npm run build` | 타입체크 + 배포용 빌드 (`dist/`) |

## 3. 게임 화면 확인하기

1. `npm run dev` 실행 → 터미널에 주소가 뜬다
   ```
   ➜  Local:   http://localhost:5173/
   ➜  Network: http://192.168.x.x:5173/
   ```
2. **PC 브라우저**: `Local` 주소를 연다 (`Cmd` + 클릭)
3. **휴대폰 크기로 보기**: Chrome 개발자도구(`Cmd+Option+I`) → 기기 툴바(`Cmd+Shift+M`) → iPhone 등 선택
4. **실제 휴대폰으로 보기**: PC와 같은 Wi-Fi에 연결한 뒤 휴대폰 브라우저로 `Network` 주소를 연다
5. 에러가 나면 개발자도구의 **Console** 탭을 확인한다

## 4. 작업별 확인 방법

### W1-01 프로젝트 세팅
- `npm run dev` → 브라우저에 어두운 배경과 가운데 "ddooby-pang" 글자가 보이면 정상
- 창 크기를 바꿔도 세로 화면 비율(720x1280)을 유지하며 가운데 정렬된다

### W1-02 Vitest
- `npm test` → 아래처럼 나오면 정상
  ```
  Test Files  1 passed (1)
       Tests  1 passed (1)
  ```
- 테스트 파일 위치: `tests/**/*.test.ts`
- 테스트가 실패하는 걸 직접 보고 싶으면 `tests/sample.test.ts`의 `toBe(63)`을 `toBe(64)`로 바꿔 저장해본다 (확인 후 되돌리기)

## 5. 문제 해결

| 증상 | 해결 |
|---|---|
| `Port 5173 is in use` | 다른 터미널에서 서버가 이미 떠 있다. 그 터미널에서 `Ctrl+C`, 또는 Vite가 제안하는 다른 포트를 쓴다 |
| `vite: command not found` 등 | `npm install`을 안 했거나 실패했다. 다시 실행 |
| 휴대폰에서 `Network` 주소가 안 열림 | 같은 Wi-Fi인지 확인. macOS 방화벽이 Node 연결을 막고 있는지 확인 |
| 화면이 갱신 안 됨 | 브라우저 강력 새로고침 `Cmd+Shift+R` |
