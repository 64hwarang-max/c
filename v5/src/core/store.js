/* core/store — 저장 계층. 화면과 기능은 adapter를 직접 만지지 않고 store만 쓴다.
   adapter 규칙: get(key) / put(key, value) / del(key) / keys() — 모두 Promise. */
import { K, normDay } from './schema.js';
import { isDate } from './date.js';
import { clone } from './util.js';

export function memoryAdapter(init) {
  const m = new Map(Object.entries(init || {}).map(([k, v]) => [k, clone(v)]));
  return {
    mode: 'memory',
    async get(k) { return m.has(k) ? clone(m.get(k)) : null; },
    async put(k, v) { m.set(k, clone(v)); },
    async del(k) { m.delete(k); },
    async keys() { return [...m.keys()]; },
  };
}

/* v4와 같은 DB('growth-journal') · 같은 저장소('docs')를 쓴다. 키만 다르다. */
export function idbAdapter(idb = globalThis.indexedDB) {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = idb.open('growth-journal', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('docs');
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); dbp = null; }; res(db); };   // 다른 창이 지우거나 올리려 하면 길을 비켜 준다
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('docs', mode); const st = t.objectStore('docs');
      const req = fn(st);
      t.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
      t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  };
  return {
    mode: 'idb',
    async get(k) { const v = await run('readonly', st => st.get(k)); return v === undefined ? null : v; },
    async put(k, v) { await run('readwrite', st => st.put(clone(v), k)); },
    async del(k) { await run('readwrite', st => st.delete(k)); },
    async keys() { return run('readonly', st => st.getAllKeys()); },
  };
}

/* 아티팩트 확인판 등 IndexedDB가 없을 때. localStorage도 막히면 메모리로 내려간다. */
export function localAdapter(ls) {
  try { ls = ls || globalThis.localStorage; ls.setItem('gj5-probe', '1'); ls.removeItem('gj5-probe'); } catch (e) { return memoryAdapter(); }
  const P = 'gj5:';
  return {
    mode: 'local',
    async get(k) { try { const r = ls.getItem(P + k); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
    async put(k, v) { ls.setItem(P + k, JSON.stringify(v)); },
    async del(k) { ls.removeItem(P + k); },
    async keys() { const a = []; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k.startsWith(P)) a.push(k.slice(P.length)); } return a; },
  };
}

export function pickAdapter() {
  try { if (globalThis.indexedDB) return idbAdapter(); } catch (e) { /* 아래로 */ }
  return localAdapter();
}

/* 저장 인터페이스. 쓰기는 모두 여기를 지나고, 끝나면 'change'가 나간다. */
export function createStore(adapter, bus) {
  const emit = key => bus && bus.emit('change', { key });
  let q = Promise.resolve();
  const api = {
    adapter,
    /* 읽고-바꾸고-쓰는 일을 한 줄로 세운다(연달아 눌러도 서로 덮어쓰지 않게) */
    lock(fn) { const r = q.then(fn); q = r.then(() => {}, () => {}); return r; },
    get: k => adapter.get(k),
    async put(k, v) { await adapter.put(k, v); emit(k); },
    async del(k) { await adapter.del(k); emit(k); },
    keys: () => adapter.keys(),
    async loadDay(d) { const o = await adapter.get(K.day(d)); return o ? normDay(o) : normDay({ date: d }); },
    async saveDay(o) { if (!isDate(o.date)) throw new Error('날짜가 올바르지 않습니다: ' + o.date); await adapter.put(K.day(o.date), normDay(o)); emit(K.day(o.date)); },
    async dayKeys() { return (await adapter.keys()).filter(k => k.startsWith(K.dayPrefix)).map(k => k.slice(K.dayPrefix.length)).filter(isDate).sort(); },
    async allDays() { const ks = await api.dayKeys(); return new Map(await Promise.all(ks.map(async d => [d, await api.loadDay(d)]))); },
  };
  return api;
}
