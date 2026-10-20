/* features/planning — 계획 탭의 일: 할 일(K.tasks), 주 마무리 글(K.weeks), 주의 중점 기둥(prefs.focus).
   할 일 문서의 주인은 이 파일이다. 다른 곳은 domain/tasks의 선택 함수로 읽기만 한다. */
import { K, PILLAR_KEYS } from '../core/schema.js';
import { clone } from '../core/util.js';
import { addTask, patchTask, removeTask, toggleTask, normTasks } from '../domain/tasks.js';
import { parseWhen } from '../domain/when.js';
import { weekStart } from '../core/date.js';

export function createPlanningActions({ store, ctx }) {
  /* 문서 하나를 읽고-바꾸고-쓴다. 되돌리기는 바꾸기 전 문서로 돌아간다. */
  const edit = (key, fn, empty) => store.lock(async () => {
    const before = await store.get(key), after = fn(clone(before == null ? empty : before));
    await store.put(key, after);
    return { undo: () => (before == null ? store.del(key) : store.put(key, before)) };
  });

  return {
    loadTasks: async () => normTasks(await store.get(K.tasks)),
    loadWeeks: async () => (await store.get(K.weeks)) || {},

    async addTask(f) { let task; const r = await edit(K.tasks, d => { const x = addTask(d, f); task = x.task; return x.doc; }, {}); return { ...r, task }; },
    /* 빠른 입력 한 줄에서: 날짜 말("내일까지", "금요일")을 마감일로 읽는다 */
    addFromQuick(r) {
      const T = ctx().today, w = parseWhen(r.t || r.raw, T);
      return this.addTask({ title: (w.rest || r.t || r.raw).replace(/까지$/, '').trim(), due: w.date || '' });
    },
    editTask: (id, patch) => edit(K.tasks, d => patchTask(d, id, patch), {}),
    toggleTask: id => edit(K.tasks, d => toggleTask(d, id), {}),
    deleteTask: id => edit(K.tasks, d => removeTask(d, id), {}),

    /* 그 주의 중점 기둥 하나(없으면 ''). 키는 월요일 날짜. */
    setFocus: (anyDate, key) => edit(K.prefs, p => {
      const ws = weekStart(anyDate); p.focus = { ...(p.focus || {}) };
      if (PILLAR_KEYS.includes(key)) p.focus[ws] = key; else delete p.focus[ws];
      return p;
    }, {}),

    /* 주 마무리 글: good(잘한 것) bad(아쉬운 것) next(다음 주 첫 계획) */
    setWrap: (anyDate, field, val) => edit(K.weeks, w => {
      const ws = weekStart(anyDate); w[ws] = { ...(w[ws] || {}), [field]: String(val || '').trim() }; return w;
    }, {}),
  };
}
