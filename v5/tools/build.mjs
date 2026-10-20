/* 빌드: src/ → dist/index.html 한 파일.  사용법: node tools/build.mjs [--dev]
   build-apk.yml 은 index.html 안의 __BUILD__ 를 sed 로 바꾸므로, 운영 빌드는 그 글자를 그대로 둔다. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundle.mjs';
import { lint } from './lint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src'), dev = process.argv.includes('--dev');

const errs = lint(src);
const b = bundle(path.join(src, 'main.js'));
errs.push(...b.problems);
if (errs.length) { console.error('빌드 실패 — 구조 검사에 걸렸습니다:\n' + errs.map(e => ' · ' + e).join('\n')); process.exit(1); }

const tpl = fs.readFileSync(path.join(src, 'index.template.html'), 'utf8');
let code = b.code.replace(/<\/script/gi, '<\\/script');
if (dev) code = code.replace(/__BUILD__/g, 'dev');
const out = tpl.replace('/*APP*/', () => code);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), out);
/* 아티팩트용(화면 확인): 게시 도구가 문서 뼈대를 씌우므로 title·style·본문만 낸다 */
const title = tpl.match(/<title>[\s\S]*?<\/title>/)[0], style = tpl.match(/<style>[\s\S]*?<\/style>/)[0];
const art = `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n${style}\n<div id="app" aria-live="polite"></div>\n<script>\n${code}\n</script>\n`;
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), art);
console.log(`빌드 완료: dist/index.html ${(out.length / 1024).toFixed(1)}KB · 모듈 ${b.files.length}개`);
