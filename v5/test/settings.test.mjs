import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../src/core/events.js';
import { memoryAdapter, createStore } from '../src/core/store.js';
import { createSettingsActions } from '../src/features/settings.js';
import { createTodayActions } from '../src/features/today.js';
import { defaultTaxonomy } from '../src/domain/taxonomy.js';
import { sampleV4 } from '../src/dev/sample-v4.js';
import { K } from '../src/core/schema.js';

const D = '2026-10-20';
function setup() { const store = createStore(memoryAdapter(), createBus()); return { store, s: createSettingsActions({ store }), t: createTodayActions({ store, ctx: () => ({ tx: defaultTaxonomy(), prefs: {}, people: [], today: D, nowHM: '10:00', rules: [] }) }) }; }

test('테마 저장·해제', async () => {
  const { store, s } = setup();
  await s.setTheme('dark'); assert.equal((await store.get(K.prefs)).theme, 'dark');
  await s.setTheme(''); assert.equal('theme' in (await store.get(K.prefs)), false);
});
test('분류 추가·수정·삭제, 중복 이름 막음', async () => {
  const { store, s } = setup();
  await s.saveCat('', { name: '봉사', area: 'rel', color: '#123456', subs: '청소, 배식', kw: '봉사,후원' });
  let c = (await store.get(K.taxonomy)).cats; assert.equal(c.length, 10); assert.deepEqual(c.at(-1).subs, ['청소', '배식']);
  await s.saveCat('', { name: '봉사' }); assert.equal((await store.get(K.taxonomy)).cats.length, 10);
  await s.saveCat('봉사', { name: '봉사활동', area: 'rel' }); assert.ok((await store.get(K.taxonomy)).cats.some(x => x.name === '봉사활동'));
  const r = await s.deleteCat('봉사활동'); assert.equal((await store.get(K.taxonomy)).cats.length, 9); await r.undo(); assert.equal((await store.get(K.taxonomy)).cats.length, 10);
});
test('사람 추가·중복·삭제', async () => {
  const { store, s } = setup();
  await s.addPerson(' 김대리 '); await s.addPerson('김대리'); await s.addPerson('');
  const l = (await store.get(K.people)).list; assert.equal(l.length, 1); assert.equal(l[0].name, '김대리');
  await s.deletePerson(l[0].id); assert.equal((await store.get(K.people)).list.length, 0);
});
test('백업 내보내기 → 다른 기기에 합치기/바꾸기', async () => {
  const A = setup(); await A.t.addBlock(D, 'plan', { s: '09:00', e: '10:00', act: 'A' }); await A.s.addPerson('가'); await A.t.addBlock('2026-10-19', 'plan', { s: '09:00', e: '10:00', act: 'old' });
  const text = await A.s.exportText();
  const B = setup(); await B.t.addBlock(D, 'plan', { s: '10:00', e: '11:00', act: 'B만' });
  let sunk = ''; const parsed = B.s.parse(text); assert.equal(parsed.kind, 'v5');
  const sum = await B.s.applyImport(parsed, 'merge', t => { sunk = t; });
  assert.equal(sum.daysNew, 1); assert.equal(sum.daysKept, 1); assert.ok(sunk.includes('B만'));
  assert.equal((await B.store.loadDay(D)).plan[0].act, 'B만');            // 있는 날은 그대로
  assert.equal((await B.store.loadDay('2026-10-19')).plan[0].act, 'old'); // 없던 날은 추가
  assert.equal((await B.store.get(K.people)).list.length, 1);
  await B.s.applyImport(parsed, 'replace', () => {});
  assert.equal((await B.store.loadDay(D)).plan[0].act, 'A');
});
test('가져오기: 백업을 못 내보내면 중단, 예전(v6) 백업도 읽는다, 깨진 파일은 오류', async () => {
  const { store, s } = setup();
  await assert.rejects(() => s.applyImport({ docs: {} }, 'merge', () => { throw new Error('저장 실패'); }));
  assert.throws(() => s.parse('{깨짐'), /형식/);
  const v6 = JSON.stringify({ v: 6, settings: sampleV4().settings, days: sampleV4().days, notes: [] });
  const p = s.parse(v6); assert.equal(p.kind, 'v6'); const sum = await s.applyImport(p, 'merge', null);
  assert.ok(sum.daysNew > 5); assert.ok((await store.get(K.meta)).schema >= 5);
});
