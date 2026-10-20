import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../src/core/events.js';
import { memoryAdapter, createStore } from '../src/core/store.js';
import { createTodayActions } from '../src/features/today.js';
import { createDayEndActions } from '../src/features/dayend.js';
import { defaultTaxonomy } from '../src/domain/taxonomy.js';
import { basis, autoScores } from '../src/domain/evaluate.js';
import { dayScores, dayXp, summarize, levelUps } from '../src/domain/score.js';

const D = '2026-10-20', tx = defaultTaxonomy();
const ctx = () => ({ tx, prefs: {}, people: [], today: D, nowHM: '15:00' });
function setup() { const store = createStore(memoryAdapter(), createBus()); return { store, t: createTodayActions({ store, ctx }), e: createDayEndActions({ store, ctx }) }; }

test('자동 초안: 계획 대비 실제, 계획 없는 30분 이상은 5점', () => {
  const day = { plan: [{ s: '09:00', e: '11:00', cat: '업무' }, { s: '19:00', e: '20:00', cat: '운동' }], actual: [{ s: '09:00', e: '10:00', cat: '업무' }, { s: '20:00', e: '20:40', cat: '자기계발' }] };
  const b = basis(day, tx);
  assert.equal(b.work.score, 5); assert.equal(b.body.score, 0); assert.equal(b.grow.score, 5);
  assert.deepEqual(autoScores(day, tx), { work: 5, grow: 5 });
  assert.deepEqual(autoScores({ plan: [{ s: '09:00', e: '10:00', cat: '업무' }], actual: [{ s: '09:00', e: '10:30', cat: '업무' }] }, tx), { work: 10 });
});
test('블록을 바꾸면 scAuto가 따라가고, 직접 매긴 값이 우선', async () => {
  const { store, t, e } = setup();
  await t.addBlock(D, 'plan', { s: '09:00', e: '10:00', act: '보고서 작성' });
  await t.planDone(D);
  let d = await store.loadDay(D); assert.equal(d.scAuto.work, 10); assert.equal(dayScores(d).work, 10);
  await e.setScore(D, 'work', 7);
  d = await store.loadDay(D); assert.equal(d.scUser.work, 7); assert.equal(dayScores(d).work, 7);
  await t.addBlock(D, 'plan', { s: '11:00', e: '12:00', act: '회의' });
  d = await store.loadDay(D); assert.equal(d.scAuto.work, 5); assert.equal(dayScores(d).work, 7);
  await e.setScore(D, 'work', null);
  d = await store.loadDay(D); assert.equal(dayScores(d).work, 5);
});
test('점수는 0~10으로 제한, 모르는 기둥은 무시', async () => {
  const { store, e } = setup();
  await e.setScore(D, 'body', 99); await e.setScore(D, 'spirit', 5); await e.setScore(D, 'mind', -3);
  const d = await store.loadDay(D); assert.equal(d.scUser.body, 10); assert.equal(d.scUser.mind, 0); assert.equal('spirit' in d.scUser, false);
});
test('돌아봄 저장: 3칸·한 줄', async () => {
  const { store, e } = setup();
  await e.setEval(D, 'mgrat', ' 가족 ', 1); await e.setEval(D, 'step', '운동 먼저', 0);
  const d = await store.loadDay(D); assert.deepEqual(d.eval.mgrat, ['', '가족', '']); assert.equal(d.eval.step, '운동 먼저');
});
test('하루 노트 블록 추가·수정·삭제·되돌리기', async () => {
  const { store, e } = setup();
  const r = await e.addNote(D, { k: 'work', c: ' 보고 ', title: '개요', txt: '본문', ln: 'abc' });
  let d = await store.loadDay(D); const n = d.notes[0];
  assert.equal(n.hm, '15:00'); assert.equal(n.c, '보고'); assert.equal(n.ln, 'abc');
  await e.editNote(D, n.id, { title: '개요 수정', c: '' });
  d = await store.loadDay(D); assert.equal(d.notes[0].title, '개요 수정'); assert.equal(d.notes[0].c, '');
  await e.deleteNote(D, n.id); assert.equal((await store.loadDay(D)).notes.length, 0);
  await r.undo(); assert.equal((await store.loadDay(D)).notes.length, 0);
});
test('점수 → XP·레벨업 비교', async () => {
  const { store, e } = setup();
  const sum = async () => summarize(await store.allDays(), {}, D);
  const p = await sum();
  await e.setScore(D, 'work', 10); await e.setScore(D, 'body', 10); await e.setScore(D, 'grow', 10);
  const n = await sum();
  assert.equal(dayXp(await store.loadDay(D), {}).xp, 30);
  assert.ok(levelUps(p, n).length >= 0);
  const big = { ...n, level: { level: 9 }, pillars: n.pillars }; assert.equal(levelUps(p, big)[0].kind, 'total');
});
test('점수 올리기를 연달아 눌러도 빠짐없이 쌓인다', async () => {
  const { store, e } = setup();
  await Promise.all([e.bumpScore(D, 'mind', 1), e.bumpScore(D, 'mind', 1), e.bumpScore(D, 'mind', 1)]);
  assert.equal((await store.loadDay(D)).scUser.mind, 3);
  await e.bumpScore(D, 'mind', -9); assert.equal((await store.loadDay(D)).scUser.mind, 0);
});
test('syncAuto: 어긋났을 때만 쓴다', async () => {
  const { store, t, e } = setup();
  await store.saveDay({ date: D, plan: [{ id: 'a', s: '09:00', e: '10:00', cat: '업무' }], actual: [{ id: 'b', s: '09:00', e: '10:00', cat: '업무', from: 'a' }] });
  assert.equal(await e.syncAuto(D), true); assert.equal((await store.loadDay(D)).scAuto.work, 10);
  assert.equal(await e.syncAuto(D), false);
});
