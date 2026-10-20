/* features/pillars — 기둥 방에서 하는 일: 목표(K.goals)와 반복 규칙(K.rules)의 주인, 반복 완료 체크(day.done).
   목표 문서·규칙 문서는 여기서만 쓴다. */
import { K, PILLAR_KEYS } from '../core/schema.js';
import { clone } from '../core/util.js';
import { newId } from '../domain/blocks.js';
import { perKey } from '../domain/goals.js';
import { autoScores } from '../domain/evaluate.js';

export function createPillarActions({ store, ctx }) {
  const edit = (key, fn, empty) => store.lock(async () => {
    const before = await store.get(key), after = fn(clone(before == null ? empty : before));
    await store.put(key, after);
    return { undo: () => (before == null ? store.del(key) : store.put(key, before)) };
  });
  const goals = fn => edit(K.goals, d => { d.list = Array.isArray(d.list) ? d.list : []; return fn(d) || d; }, { list: [] });
  const rules = fn => edit(K.rules, d => { d.list = Array.isArray(d.list) ? d.list : []; return fn(d) || d; }, { list: [] });

  return {
    loadGoals: async () => { const d = await store.get(K.goals); return d && Array.isArray(d.list) ? d : { list: [] }; },
    loadRules: async () => { const d = await store.get(K.rules); return d && Array.isArray(d.list) ? d : { list: [] }; },

    /* 목표: 기둥(area)과 기간 단계(lv)를 정하면 기간 키는 오늘 기준으로 붙는다 */
    async addGoal(f) {
      const T = ctx().today, g = { id: 'g' + newId(), lv: f.lv || 'm', per: '', title: String(f.title || '').trim(), parent: null, tasks: [], area: PILLAR_KEYS.includes(f.area) ? f.area : '', kind: f.kind || 'proj', done: false, created: Date.now() };
      g.per = perKey(g.lv, T);
      const r = await goals(d => { d.list.push(g); }); return { ...r, goal: g };
    },
    editGoal: (id, patch) => goals(d => { d.list = d.list.map(g => (g.id === id ? { ...g, ...patch } : g)); }),
    deleteGoal: id => goals(d => { d.list = d.list.filter(g => g.id !== id).map(g => (g.parent === id ? { ...g, parent: null } : g)); }),
    addStep: (id, title) => goals(d => { d.list = d.list.map(g => (g.id === id ? { ...g, tasks: [...(g.tasks || []), { id: 's' + newId(), title: String(title).trim(), done: false }] } : g)); }),
    toggleStep: (id, sid) => goals(d => { d.list = d.list.map(g => (g.id === id ? { ...g, tasks: (g.tasks || []).map(s => (s.id === sid ? { ...s, done: !s.done } : s)) } : g)); }),
    removeStep: (id, sid) => goals(d => { d.list = d.list.map(g => (g.id === id ? { ...g, tasks: (g.tasks || []).filter(s => s.id !== sid) } : g)); }),

    /* 반복 규칙. 습관은 kind 'habit', 소속 기둥은 pillar(없으면 습관 기둥). */
    async addRule(f) {
      const name = String(f.name || '').trim(), r0 = { id: 'habit:h' + newId(), kind: f.kind || 'habit', name, every: { unit: 'd', n: 1 }, pillar: PILLAR_KEYS.includes(f.pillar) ? f.pillar : 'habit' };
      r0.hid = r0.id.slice(6);
      const r = await rules(d => { d.list.push(r0); }); return { ...r, rule: r0 };
    },
    editRule: (id, patch) => rules(d => { d.list = d.list.map(r => (r.id === id ? { ...r, ...patch } : r)); }),
    deleteRule: id => rules(d => { d.list = d.list.filter(r => r.id !== id); }),

    /* 반복 완료는 그 날 문서의 done 한 곳에만 쓴다(점수 초안도 함께 맞춘다) */
    toggleRule: (date, id) => store.lock(async () => {
      const before = await store.loadDay(date), after = clone(before);
      after.done = { ...after.done }; if (after.done[id]) delete after.done[id]; else after.done[id] = true;
      after.scAuto = autoScores(after, ctx().tx, ctx().rules);
      await store.saveDay(after);
      return { undo: () => store.saveDay(before) };
    }),
  };
}
