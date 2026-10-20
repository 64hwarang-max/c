/* 구조 검사. 어기면 빌드가 실패한다.
   1) 덧대기 패치 금지: MutationObserver, 함수 덮어쓰기(window.x = / globalThis.x = )
   2) 계층 위반 금지: core·domain·migrate 는 DOM(document/window)을 쓰지 않는다. domain 은 저장소·화면을 부르지 않는다.
   3) screens/ 는 store 어댑터를 직접 만지지 않는다.                                                          */
import fs from 'node:fs';
import path from 'node:path';

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

export function lint(srcDir) {
  const errs = [];
  for (const f of walk(srcDir).filter(f => f.endsWith('.js'))) {
    const rel = path.relative(srcDir, f), layer = rel.split(path.sep)[0], code = strip(fs.readFileSync(f, 'utf8'));
    const bad = (re, msg) => { if (re.test(code)) errs.push(`${rel}: ${msg}`); };
    bad(/\bMutationObserver\b/, '덧대기 패치 금지: MutationObserver');
    bad(/\b(?:window|globalThis)\.[A-Za-z_$][\w$]*\s*=[^=]/, '전역 덮어쓰기 금지: window.x = / globalThis.x =');
    bad(/\bsetInterval\s*\(/, '보정용 setInterval 금지');
    if (['core', 'domain', 'migrate'].includes(layer)) bad(/\b(?:document|window|navigator|alert|confirm)\b/, `${layer} 는 화면 객체를 쓰지 않습니다`);
    if (layer === 'domain') {
      bad(/from\s+['"]\.\.\/(?:screens|features|ui|native|migrate)\//, 'domain 은 위 계층을 부를 수 없습니다');
      bad(/\bstore\b|\badapter\b|indexedDB|localStorage/, 'domain 은 저장소를 만지지 않습니다');
    }
    if (layer === 'screens') { bad(/\badapter\b|indexedDB|localStorage/, 'screens 는 저장소를 직접 만지지 않습니다'); bad(/from\s+['"]\.\/(?!.*shared)/, 'screens 끼리 직접 부르지 않습니다(router 사용)'); }
  }
  return errs;
}
