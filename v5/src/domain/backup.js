/* domain/backup — 백업 파일의 모양과 가져오기 계획. 파일 읽기·쓰기는 하지 않고 계산만 한다. */
import { K, APP } from '../core/schema.js';
import { arr, isObj } from '../core/util.js';

/* v5 문서 전부를 한 파일로: { app, kind:'v5', v:5, exported, docs:{ 키: 문서 } } */
export function makeBackup(docs, now = new Date()) {
  return { app: APP, kind: 'v5', v: 5, exported: now.toISOString(), docs };
}

const LIST_KEY = { [K.tasks]: 'items', [K.goals]: 'list', [K.rules]: 'list', [K.people]: 'list', [K.books]: 'items' };
/* 합치기: 있는 것은 그대로 두고 없는 것만 더한다 */
export function mergeDoc(key, cur, inc) {
  if (cur == null) return inc;
  const lk = LIST_KEY[key];
  if (lk && isObj(cur) && isObj(inc)) {
    const alt = lk === 'items' ? 'list' : 'items', ck = Array.isArray(cur[lk]) ? lk : Array.isArray(cur[alt]) ? alt : lk, ik = Array.isArray(inc[lk]) ? lk : alt;
    const have = new Set(arr(cur[ck]).map(x => x && x.id)), add = arr(inc[ik]).filter(x => x && !have.has(x.id));
    return add.length ? { ...cur, [ck]: [...arr(cur[ck]), ...add] } : cur;
  }
  return cur;   // 설정·분류·메타 등은 기존 것을 지키고, 날짜는 아래에서 따로 다룬다
}

/* 가져오기 계획: 무엇을 쓰고(writes) 무엇을 지울지(deletes)와 숫자 요약.
   mode 'merge' = 합치기, 'replace' = 바꾸기(기존 v5 문서를 모두 지우고 들어오는 것으로) */
export function planImport(existing, incoming, mode) {
  const writes = {}, sum = { daysNew: 0, daysKept: 0, daysReplaced: 0, docs: 0 };
  const isDay = k => k.startsWith(K.dayPrefix);
  Object.keys(incoming).forEach(k => {
    if (k === K.meta) return;
    if (mode === 'replace') { writes[k] = incoming[k]; if (isDay(k)) sum.daysReplaced++; else sum.docs++; return; }
    if (isDay(k)) { if (existing[k] == null) { writes[k] = incoming[k]; sum.daysNew++; } else sum.daysKept++; return; }
    const m = mergeDoc(k, existing[k], incoming[k]);
    if (JSON.stringify(m) !== JSON.stringify(existing[k])) { writes[k] = m; sum.docs++; }
  });
  const deletes = mode === 'replace' ? Object.keys(existing).filter(k => k.startsWith('v5/') && k !== K.meta && !(k in incoming)) : [];
  return { writes, deletes, sum };
}
