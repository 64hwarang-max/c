import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../src/core/events.js';
import { memoryAdapter, createStore } from '../src/core/store.js';
import { createTodayActions } from '../src/features/today.js';
import { defaultTaxonomy } from '../src/domain/taxonomy.js';

const D = '2026-10-20';
function setup() {
  const bus = createBus(), store = createStore(memoryAdapter(), bus), events = [];
  bus.on('change', e => events.push(e.key));
  const act = createTodayActions({ store, ctx: () => ({ tx: defaultTaxonomy(), prefs: {}, people: ['김대리'], today: D, nowHM: '15:00' }) });
  return { store, act, events };
}

test('계획 추가 → 분류 추정, 저장 알림', async () => {
  const { store, act, events } = setup();
  await act.addBlock(D, 'plan', { s: '09:00', e: '10:00', act: '보고서 작성' });
  const d = await store.loadDay(D);
  assert.equal(d.plan.length, 1); assert.equal(d.plan[0].cat, '업무');
  assert.ok(events.includes('v5/day:' + D));
});
test('실제 블록 금액은 day.fin 한 곳에만, 수정·삭제 따라감', async () => {
  const { store, act } = setup();
  await act.addBlock(D, 'actual', { s: '12:00', e: '13:00', act: '점심', amt: '9000' });
  let d = await store.loadDay(D); const id = d.actual[0].id;
  assert.equal(d.fin.length, 1); assert.equal(d.fin[0].amt, 9000); assert.equal(d.fin[0].bid, id);
  await act.editBlock(D, 'actual', id, { amt: '12000' });
  d = await store.loadDay(D); assert.equal(d.fin.length, 1); assert.equal(d.fin[0].amt, 12000);
  await act.deleteBlock(D, 'actual', id);
  d = await store.loadDay(D); assert.equal(d.fin.length, 0); assert.equal(d.actual.length, 0);
});
test('되돌리기는 저장 전 모습으로', async () => {
  const { store, act } = setup();
  await act.addBlock(D, 'plan', { s: '09:00', e: '10:00', act: 'A' });
  const r = await act.addBlock(D, 'plan', { s: '11:00', e: '12:00', act: 'B' });
  assert.equal((await store.loadDay(D)).plan.length, 2);
  await r.undo(); assert.equal((await store.loadDay(D)).plan.length, 1);
});
test('계획대로 했다: 전부/되돌리기/중복 없음', async () => {
  const { store, act } = setup();
  await act.addBlock(D, 'plan', { s: '09:00', e: '10:00', act: 'A' });
  await act.addBlock(D, 'plan', { s: '10:00', e: '11:00', act: 'B' });
  const r = await act.planDone(D); assert.equal(r.added, 2);
  assert.equal((await act.planDone(D)).added, 0);
  assert.equal((await store.loadDay(D)).actual.length, 2);
  await r.undo(); assert.equal((await store.loadDay(D)).actual.length, 0);
});
test('끌기·길이 조절은 10분 단위, 영역은 하루 안', async () => {
  const { store, act } = setup();
  await act.addBlock(D, 'plan', { s: '09:00', e: '10:00', act: 'A' });
  const id = (await store.loadDay(D)).plan[0].id;
  await act.moveBlock(D, 'plan', id, 9 * 60 + 40);
  let b = (await store.loadDay(D)).plan[0]; assert.equal(b.s, '09:40'); assert.equal(b.e, '10:40');
  await act.resizeBlock(D, 'plan', id, 12 * 60);
  b = (await store.loadDay(D)).plan[0]; assert.equal(b.e, '12:00');
});
test('빠른 입력: 일정·지출·감사·노트·할 일', async () => {
  const { store, act } = setup();
  const q = async (t, k) => act.apply(await act.preview(t, D, k), D);
  assert.ok((await q('일정: 21시 정리')).ok);
  assert.ok((await q('커피 4500원')).ok);
  assert.ok((await q('감사: 가족')).ok);
  assert.ok((await q('메모: 아이디어 하나', 'note')).ok);
  const t = await q('내일까지 서류 제출', 'task'); assert.equal(t.ok, false);
  const d = await store.loadDay(D);
  assert.equal(d.plan.length, 1); assert.equal(d.fin[0].amt, 4500); assert.equal(d.eval.mgrat[0], '가족'); assert.equal(d.notes.length, 1);
});
test('날짜 있는 일정은 그 날에 들어간다', async () => {
  const { store, act } = setup();
  const r = await act.apply(await act.preview('내일 3시 치과', D, ''), D); assert.equal(r.date, '2026-10-21');
  assert.equal((await store.loadDay('2026-10-21')).plan.length, 1); assert.equal((await store.loadDay(D)).plan.length, 0);
});
test('우선순위 저장', async () => {
  const { store, act } = setup();
  await act.setPriority(D, 2, { text: '메일' }); const d = await store.loadDay(D);
  assert.equal(d.pri[2].text, '메일'); assert.equal(d.pri.length, 3);
});
