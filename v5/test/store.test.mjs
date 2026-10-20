import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../src/core/events.js';
import { createStore, memoryAdapter, localAdapter } from '../src/core/store.js';
import { K } from '../src/core/schema.js';

test('일 문서 저장·불러오기·변경 알림', async () => {
  const bus = createBus(), seen = [];
  bus.on('change', e => seen.push(e.key));
  const st = createStore(memoryAdapter(), bus);
  const d = await st.loadDay('2026-10-20');
  assert.equal(d.v, 5); assert.deepEqual(d.plan, []);
  d.score = { rel: 7 }; await st.saveDay(d);
  assert.equal((await st.loadDay('2026-10-20')).score.rel, 7);
  assert.deepEqual(seen, [K.day('2026-10-20')]);
  assert.deepEqual(await st.dayKeys(), ['2026-10-20']);
});
test('잘못된 날짜는 저장하지 않는다', async () => {
  const st = createStore(memoryAdapter(), createBus());
  await assert.rejects(() => st.saveDay({ date: '2026-1-2' }));
});
test('v4 키와 섞이지 않는다', async () => {
  const ad = memoryAdapter({ 'day:2026-10-01': { date: '2026-10-01' }, settings: { a: 1 } });
  const st = createStore(ad, createBus());
  assert.deepEqual(await st.dayKeys(), []);
});
test('저장소는 값을 복사해 둔다(밖에서 고쳐도 안 바뀜)', async () => {
  const st = createStore(memoryAdapter(), createBus());
  const o = { a: { b: 1 } }; await st.put('x', o); o.a.b = 2;
  assert.equal((await st.get('x')).a.b, 1);
});
test('localStorage 어댑터', async () => {
  const mem = new Map(); const ls = { setItem: (k, v) => mem.set(k, v), getItem: k => mem.get(k) ?? null, removeItem: k => mem.delete(k), key: i => [...mem.keys()][i], get length() { return mem.size; } };
  const ad = localAdapter(ls); assert.equal(ad.mode, 'local');
  await ad.put('v5/prefs', { a: 1 }); assert.deepEqual(await ad.get('v5/prefs'), { a: 1 });
  assert.deepEqual(await ad.keys(), ['v5/prefs']); await ad.del('v5/prefs'); assert.equal(await ad.get('v5/prefs'), null);
});
test('localStorage가 막히면 메모리로 내려간다', () => {
  const ls = { setItem() { throw new Error('blocked'); }, removeItem() {} };
  assert.equal(localAdapter(ls).mode, 'memory');
});
