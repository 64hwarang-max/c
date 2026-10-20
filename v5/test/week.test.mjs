import test from 'node:test';
import assert from 'node:assert/strict';
import { weekDates, weekBalance, weakest, daySummary } from '../src/domain/week.js';
import { addTask, toggleTask, groupTasks, normTasks, patchTask, removeTask, bucket } from '../src/domain/tasks.js';

const day = (date, sc) => ({ date, scUser: sc, plan: [], actual: [], notes: [], done: {} });
test('주는 월요일부터 7일', () => { const w = weekDates('2026-10-19'); assert.equal(w[0], '2026-10-19'); assert.equal(w[6], '2026-10-25'); });
test('균형판: 일평균(기록 없는 날 0), 지난주와 차이, 오지 않은 날 제외', () => {
  const all = new Map([['2026-10-19', day('2026-10-19', { work: 8 })], ['2026-10-20', day('2026-10-20', { work: 4 })], ['2026-10-12', day('2026-10-12', { work: 7 })]]);
  const b = weekBalance(all, '2026-10-19', '2026-10-21');   // 월·화·수 3일
  assert.equal(b.days, 3); assert.equal(b.per.work.avg, 4); assert.equal(b.per.work.prev, 1); assert.equal(b.per.work.delta, 3);
  assert.equal(weakest(b), 'rel');
});
test('날별 요약', () => {
  const d = { date: '2026-10-20', plan: [{ id: 'a', s: '09:00', e: '10:00' }, { id: 'b', s: '10:00', e: '11:00' }], actual: [{ from: 'a' }], scUser: { work: 10 } };
  const s = daySummary(d, {}); assert.equal(s.plan, 2); assert.equal(s.done, 1); assert.equal(s.xp, 10); assert.equal(s.planMin, 120);
});
test('할 일: 묶음·추가·완료·수정·삭제', () => {
  let doc = null;
  const T = '2026-10-20', ws = '2026-10-19';
  for (const f of [{ title: 'a', due: '2026-10-18' }, { title: 'b', due: T }, { title: 'c', due: '2026-10-23' }, { title: 'd', due: '2026-11-02' }, { title: 'e' }]) doc = addTask(doc, f).doc;
  const g = groupTasks(doc, T, ws);
  assert.deepEqual(['over', 'today', 'week', 'later', 'none'].map(k => g[k].length), [1, 1, 1, 1, 1]);
  const id = g.today[0].id; doc = toggleTask(doc, id, 5);
  assert.equal(groupTasks(doc, T, ws).done[0].doneAt, 5); doc = toggleTask(doc, id);
  assert.equal(groupTasks(doc, T, ws).done.length, 0);
  doc = patchTask(doc, id, { due: '2026-10-25' }); assert.equal(bucket(doc.items.find(t => t.id === id), T, ws), 'week');
  assert.equal(removeTask(doc, id).items.length, 4);
  assert.equal(normTasks({ items: [{ text: 'v4식' }] }).lists.length, 1);
});
