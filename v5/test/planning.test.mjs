import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../src/core/events.js';
import { memoryAdapter, createStore } from '../src/core/store.js';
import { createPlanningActions } from '../src/features/planning.js';
import { K } from '../src/core/schema.js';

const T = '2026-10-20';
function setup() { const store = createStore(memoryAdapter(), createBus()); return { store, p: createPlanningActions({ store, ctx: () => ({ today: T }) }) }; }

test('빠른 입력 할 일: 날짜 말을 마감일로', async () => {
  const { p } = setup();
  const a = await p.addFromQuick({ t: '내일까지 서류 제출', raw: '내일까지 서류 제출' });
  assert.equal(a.task.title, '서류 제출'); assert.equal(a.task.due, '2026-10-21');
  const b = await p.addFromQuick({ t: '치과 예약', raw: '치과 예약' }); assert.equal(b.task.due, '');
  assert.equal((await p.loadTasks()).items.length, 2);
});
test('할 일 수정·완료·삭제·되돌리기', async () => {
  const { p } = setup();
  const { task } = await p.addTask({ title: 'A', due: T });
  await p.toggleTask(task.id); assert.equal((await p.loadTasks()).items[0].done, true);
  const r = await p.deleteTask(task.id); assert.equal((await p.loadTasks()).items.length, 0);
  await r.undo(); assert.equal((await p.loadTasks()).items.length, 1);
});
test('연달아 넣어도 빠짐없이', async () => {
  const { p } = setup();
  await Promise.all([p.addTask({ title: 'a' }), p.addTask({ title: 'b' }), p.addTask({ title: 'c' })]);
  assert.equal((await p.loadTasks()).items.length, 3);
});
test('중점 기둥: 한 주에 하나, 월요일 키, 지우기, 모르는 키 무시', async () => {
  const { store, p } = setup();
  await p.setFocus('2026-10-22', 'body'); assert.equal((await store.get(K.prefs)).focus['2026-10-19'], 'body');
  await p.setFocus('2026-10-20', 'work'); assert.equal((await store.get(K.prefs)).focus['2026-10-19'], 'work');
  await p.setFocus('2026-10-20', 'spirit'); assert.equal('2026-10-19' in (await store.get(K.prefs)).focus, false);
});
test('주 마무리 글 저장', async () => {
  const { p } = setup();
  await p.setWrap('2026-10-23', 'good', ' 운동 '); await p.setWrap('2026-10-21', 'bad', '늦잠');
  const w = (await p.loadWeeks())['2026-10-19']; assert.equal(w.good, '운동'); assert.equal(w.bad, '늦잠');
});
