/* features/dayend — 마감(평가)과 하루 노트. 점수·돌아봄·노트 블록을 하루 문서에 쓴다.
   점수는 day.scUser(직접 매김) 한 곳에만 쓰고, 자동 초안(scAuto)은 features/today가 맞춘다. */
import { newId } from '../domain/blocks.js';
import { clone } from '../core/util.js';
import { PILLAR_KEYS } from '../core/schema.js';
import { dayScores } from '../domain/score.js';
import { autoScores } from '../domain/evaluate.js';

export const EVAL_LISTS = { mgrat: '감사', great: '잘한 일' };     // 3칸짜리
export const EVAL_LINES = { better: '아쉬운 점', step: '내일 한 걸음' };  // 한 줄짜리

export function createDayEndActions({ store, ctx }) {
  const mutate = (date, fn) => store.lock(async () => {
    const before = await store.loadDay(date), after = fn(clone(before)) || before;
    await store.saveDay(after);
    return { undo: () => store.saveDay(before) };
  });
  const tr = (v, o) => String(v ?? o ?? '').trim();
  const clamp = v => Math.max(0, Math.min(10, Math.round(+v)));

  return {
    /* 자동 초안이 시간표와 어긋나 있으면(예전 문서 등) 맞춰 저장한다. 바뀐 게 없으면 쓰지 않는다. */
    async syncAuto(date) {
      return store.lock(async () => {
        const d = await store.loadDay(date), a = autoScores(d, ctx().tx, ctx().rules);
        if (JSON.stringify(a) === JSON.stringify(d.scAuto)) return false;
        d.scAuto = a; await store.saveDay(d); return true;
      });
    },
    /* 점수를 한 칸 올리거나 내린다(지금 보이는 값 기준) */
    bumpScore: (date, key, delta) => mutate(date, d => {
      if (!PILLAR_KEYS.includes(key)) return d;
      const cur = dayScores(d)[key] || 0; d.scUser = { ...d.scUser, [key]: clamp(cur + delta) }; return d;
    }),
    /* 점수를 직접 매긴다. null이면 직접 매긴 값을 지우고 자동 초안으로 돌아간다. */
    setScore: (date, key, val) => mutate(date, d => {
      if (!PILLAR_KEYS.includes(key)) return d;
      d.scUser = { ...d.scUser };
      if (val == null) delete d.scUser[key]; else d.scUser[key] = clamp(val);
      return d;
    }),
    /* 돌아봄: 3칸(i 필요) 또는 한 줄 */
    setEval: (date, field, val, i) => mutate(date, d => {
      d.eval = { ...d.eval };
      if (field in EVAL_LISTS) { const L = Array.isArray(d.eval[field]) ? d.eval[field].slice() : ['', '', '']; while (L.length < 3) L.push(''); L[i || 0] = String(val || '').trim(); d.eval[field] = L; }
      else if (field in EVAL_LINES) d.eval[field] = String(val || '').trim();
      return d;
    }),

    /* 하루 노트 블록. k=대분류(기둥 키), c=중분류, s=소분류, ln=연결한 시간 블록 id */
    addNote: (date, f) => mutate(date, d => {
      const c = ctx(), t = Date.now();
      d.notes = [...d.notes, { id: 'n' + newId(), ts: t, hm: f.hm || c.nowHM, k: f.k || '', c: (f.c || '').trim(), s: (f.s || '').trim(), title: (f.title || '').trim(), txt: f.txt || '', ln: f.ln || null }];
      return d;
    }),
    editNote: (date, id, f) => mutate(date, d => {
      d.notes = d.notes.map(n => (n.id === id ? { ...n, ...f, c: tr(f.c, n.c), s: tr(f.s, n.s), title: tr(f.title, n.title), upd: Date.now() } : n));
      return d;
    }),
    deleteNote: (date, id) => mutate(date, d => { d.notes = d.notes.filter(n => n.id !== id); return d; }),
  };
}
