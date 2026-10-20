/* 배포용 빌드. 사용법: node tools/release.mjs <내보낼 경로>   예) node tools/release.mjs ../index.html
   경로를 주지 않으면 아무것도 덮어쓰지 않는다. 기존 워크플로(build-apk.yml)가 읽는 단일 index.html을 만든다. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const out = process.argv[2];
if (!out) { console.error('내보낼 경로를 주십시오. 예: node tools/release.mjs ../index.html'); process.exit(1); }
const r = spawnSync(process.execPath, [path.join(import.meta.dirname, 'build.mjs')], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);
const html = fs.readFileSync(path.join(import.meta.dirname, '..', 'dist', 'index.html'), 'utf8');
if (!html.includes('__BUILD__')) { console.error('빌드 자리표시(__BUILD__)가 없습니다. 워크플로가 번호를 넣지 못합니다.'); process.exit(1); }
if (/BUILD\s*=\s*'dev'/.test(html)) { console.error('시험판(--dev) 표시가 들어 있습니다.'); process.exit(1); }
fs.writeFileSync(out, html);
console.log(`쓴 파일: ${path.resolve(out)} (${(html.length / 1024).toFixed(0)}KB)`);
