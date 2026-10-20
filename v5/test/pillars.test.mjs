import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../src/core/events.js';
import { memoryAdapter, createStore } from '../src/core/store.js';
import { createPillarActions } from '../src/features/pillars.js';
import { defaultTaxonomy } from '../src/domain/taxonomy.js';
import { dueRules, streakOf, lastDone } from '../src/domain/rules.js';
import { perKey, perRange, progress, isCurrent, perLabel } from '../src/domain/goals.js';
import { autoScores } from '../src/domain/evaluate.js';

const T = '2026-10-20';
let RULES = [];
function setup() { const store = createStore(memoryAdapter(), createBus()); return { store, p: createPillarActions({ store, ctx: () => ({ today: T, tx: defaultTaxonomy(), rules: RULES }) }) }; }

test('목표: 기간 키·범위·라벨', () => {
  assert.equal(perKey('m', T), '2026-10'); assert.equal(perKey('q', T), '2026-Q4'); assert.equal(perKey('h', T), '2026-H2'); assert.equal(perKey('y', T), '2026'); assert.equal(perKey('w', T), '2026-10-19');
  assert.deepEqual(perRange('q', '2026-Q4'), ['2026-10-01', '2026-12-31']); assert.deepEqual(perRange('w', '2026-10-19'), ['2026-10-19', '2026-10-25']);
  assert.equal(perLabel('q', '2026-Q4'), '2026 4분기');
  assert.equal(isCurrent({ lv: 'm', per: '2026-10' }, T), true); assert.equal(isCurrent({ lv: 'm', per: '2026-09' }, T), false);
});
test('목표 추가·단계·진행률·삭제', async () => {
  const { p } = setup();
  const { goal } = await p.addGoal({ title: '보고서 완성', area: 'work', lv: 'w' });
  assert.equal(goal.per, '2026-10-19'); assert.equal(goal.area, 'work');
  await p.addStep(goal.id, '개요'); await p.addStep(goal.id, '초안');
  let g = (await p.loadGoals()).list[0]; assert.equal(progress(g, [g], new Map(), T), 0);
  await p.toggleStep(g.id, g.tasks[0].id); g = (await p.loadGoals()).list[0]; assert.equal(progress(g, [g], new Map(), T), 0.5);
  await p.editGoal(g.id, { done: true }); g = (await p.loadGoals()).list[0]; assert.equal(progress(g, [g], new Map(), T), 1);
  const r = await p.deleteGoal(g.id); assert.equal((await p.loadGoals()).list.length, 0); await r.undo(); assert.equal((await p.loadGoals()).list.length, 1);
});
test('습관 목표 진행률: 기간 중 실천률', () => {
  const all = new Map([['2026-10-19', { done: { 'habit:h1': true } }], ['2026-10-20', { done: {} }]]);
  assert.equal(progress({ id: 'x', lv: 'w', per: '2026-10-19', kind: 'habit', hid: 'h1' }, [], all, T), 0.5);
});
test('반복 규칙: 추가, 체크는 day.done 한 곳, 점수 초안, 연속', async () => {
  const { store, p } = setup();
  const a = await p.addRule({ name: '운동', pillar: 'body' }), b = await p.addRule({ name: '독서' });
  RULES = (await p.loadRules()).list;
  assert.equal(b.rule.pillar, 'habit');
  await p.toggleRule(T, a.rule.id);
  let d = await store.loadDay(T); assert.equal(d.done[a.rule.id], true); assert.equal(d.scAuto.body, 10);
  assert.deepEqual(autoScores({ plan: [], actual: [], done: {} }, defaultTaxonomy(), RULES), {});
  await p.toggleRule(T, a.rule.id); d = await store.loadDay(T); assert.equal(a.rule.id in d.done, false);
  await p.toggleRule('2026-10-19', a.rule.id); await p.toggleRule(T, a.rule.id);
  assert.equal(streakOf(await store.allDays(), a.rule.id, T), 2); assert.equal(lastDone(await store.allDays(), a.rule.id, T), T);
  const r = await p.deleteRule(a.rule.id); assert.equal((await p.loadRules()).list.length, 1); await r.undo(); assert.equal((await p.loadRules()).list.length, 2);
  RULES = [];
});
test('오늘 할 규칙: 습관 매일·루틴 요일·주기 간격', () => {
  const rs = [{ id: 'h', kind: 'habit' }, { id: 'r', kind: 'routine', every: { days: [2] } }, { id: 'r2', kind: 'routine', every: { days: [3] } }, { id: 'c', kind: 'cycle', every: { unit: 'w', n: 2 }, last: '2026-10-05' }, { id: 'c2', kind: 'cycle', every: { unit: 'w', n: 2 }, last: '2026-10-12' }];
  assert.deepEqual(dueRules(rs, T, new Map()).map(r => r.id), ['h', 'r', 'c']);   // 10/20은 화요일
});
