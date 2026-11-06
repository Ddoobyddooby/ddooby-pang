// Edge Function이 쓸 src 코드를 rolldown으로 한 파일씩 묶어 supabase/functions/_shared/에 둔다 (PLAN2 5.8 빌드 복사).
// 타입은 tsc 선언 파일로 옆에 두고, JS 맨 위의 @ts-self-types로 Deno에 알려 준다.
//
//   npm run server:shared          다시 만들어 쓴다
//   npm run server:shared:check    다시 만든 결과가 커밋본과 다르면 exit 1 (CI)
//
// V2-W3-03의 리플레이 번들은 TARGETS에 한 줄 더하면 된다
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { build } from 'rolldown';
import ts from 'typescript';

interface Target {
  /** 저장소 루트 기준 입력 파일 */
  entry: string;
  /** 저장소 루트 기준 출력 .js. 같은 이름의 .d.ts를 옆에 만든다 */
  out: string;
}

const TARGETS: Target[] = [
  { entry: 'src/online/nicknameRules.ts', out: 'supabase/functions/_shared/nicknameRules.js' },
];

const ROOT = resolve(import.meta.dirname, '../..');

async function bundle(target: Target): Promise<Map<string, string>> {
  const header = `// 자동 생성: npm run server:shared (${target.entry}). 직접 고치지 않는다\n`;
  const result = await build({
    input: resolve(ROOT, target.entry),
    platform: 'neutral',
    write: false,
    output: { format: 'esm' },
  });
  const chunk = result.output[0];
  const dts = basename(target.out).replace(/\.js$/, '.d.ts');
  const js = `${header}// @ts-self-types="./${dts}"\n${chunk.code}`;
  return new Map([
    [target.out, js],
    [target.out.replace(/\.js$/, '.d.ts'), header + declaration(target.entry)],
  ]);
}

/** 입력 파일 하나의 선언(.d.ts). 다른 파일 타입을 내보내면 그 파일도 같이 묶어야 하므로 import가 남으면 실패 */
function declaration(entry: string): string {
  const file = resolve(ROOT, entry);
  let text: string | undefined;
  const program = ts.createProgram([file], {
    declaration: true,
    emitDeclarationOnly: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    types: [],
  });
  program.emit(program.getSourceFile(file), (name, data) => {
    if (name.endsWith('.d.ts')) text = data;
  });
  if (text === undefined) throw new Error(`${entry} 선언 파일을 만들지 못했다`);
  if (/^import |^export .* from /m.test(text))
    throw new Error(`${entry} 선언에 다른 파일 참조가 남았다`);
  return text;
}

async function main(): Promise<number> {
  const check = process.argv.includes('--check');
  const files = new Map<string, string>();
  for (const target of TARGETS)
    for (const [path, text] of await bundle(target)) files.set(path, text);

  const stale: string[] = [];
  for (const [path, text] of files) {
    const abs = resolve(ROOT, path);
    let current: string | null = null;
    try {
      current = readFileSync(abs, 'utf8');
    } catch {
      // 아직 없는 파일
    }
    if (current === text) continue;
    if (check) {
      stale.push(path);
    } else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, text);
      console.log(`썼다: ${path}`);
    }
  }
  if (stale.length > 0) {
    console.error(
      `커밋본이 src와 다르다. npm run server:shared로 다시 만들어 커밋한다:\n  ${stale.join('\n  ')}`,
    );
    return 1;
  }
  if (check) console.log(`server:shared 일치 (${files.size}개 파일)`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e);
    process.exit(2);
  },
);
