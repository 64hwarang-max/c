import test from 'node:test';
import assert from 'node:assert/strict';
import { dayScores, dayXp, levelInfo, needTotal, needPillar, summarize, levelUps, weightOf, focusOf } from '../src/domain/score.js';
import { weekStart, addD } from '../src/core/date.js';

const mk = (date, score, extra = {}) => ({ date, score, scUser: {}, scAuto: {}, actual: [], notes: [], done: {}, ...extra });

test('점수 우선순위: 직접 > 저장 > 자동, 영성은 무시', () => {
  const s = dayScores({ scUser: { rel: 9 }, score: { rel: 5, work: 6, spirit: 10 }, scAuto: { work: 2, body: 4 } });
  assert.deepEqual(s, { rel: 9, work: 6, body: 4 });
});
test('점수는 0~10으로 자른다', () => {
  assert.equal(dayScores({ score: { rel: 15, work: -3 } }).rel, 10);
  assert.equal('work' in dayScores({ score: { work: -3 } }), false);
});
test('중점 기둥만 ×1.5', () => {
  const d = '2026-10-21', wk = weekStart(d), focus = { [wk]: 'work' };
  assert.equal(weekStart('2026-10-18'), '2026-10-12');  // 일요일은 그 주의 끝
  assert.equal(weekStart('2026-10-19'), '2026-10-19');  // 월요일 시작
  assert.equal(focusOf(focus, d), 'work');
  const r = dayXp(mk(d, { work: 6, rel: 4 }), focus);
  assert.equal(r.per.work, 9); assert.equal(r.per.rel, 4); assert.equal(r.xp, 13);
  assert.equal(weightOf(focus, d, 'rel'), 1);
});
test('레벨 곡선은 단조 증가하고 경계에서 올라간다', () => {
  for (let L = 1; L < 40; L++) { assert.ok(needTotal(L + 1) > needTotal(L)); assert.ok(needPillar(L + 1) > needPillar(L)); }
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(needTotal(2) - 0.1).level, 1);
  assert.equal(levelInfo(needTotal(2)).level, 2);
  assert.equal(levelInfo(needTotal(5), needTotal).pct, 0);
  assert.equal(levelInfo(needPillar(3), needPillar).level, 3);
});
test('요약: 합계·기둥 레벨·연속 기록·미래 날짜 제외', () => {
  const T = '2026-10-20', days = new Map();
  for (let i = 0; i < 5; i++) { const d = addD(T, -i); days.set(d, mk(d, { rel: 5, work: 5 })); }
  days.set(addD(T, -7), mk(addD(T, -7), { rel: 5 }));          // 끊긴 날 뒤의 옛 기록
  days.set(addD(T, 3), mk(addD(T, 3), { rel: 10 }));            // 미래: 센다면 틀림
  const s = summarize(days, {}, T);
  assert.equal(s.total, 55);             // 5일 × 10 + 5
  assert.equal(s.streak, 5); assert.equal(s.best, 5);
  assert.equal(s.pillars.rel.xp, 30); assert.equal(s.pillars.work.xp, 25);
  assert.equal(s.today.xp, 10);
});
test('오늘 아직 기록이 없으면 어제까지의 연속을 유지한다', () => {
  const T = '2026-10-20', days = new Map();
  [1, 2, 3].forEach(i => { const d = addD(T, -i); days.set(d, mk(d, { rel: 5 })); });
  assert.equal(summarize(days, {}, T).streak, 3);
});
test('실행 기록·노트만 있어도 연속 기록에 든다', () => {
  const T = '2026-10-20', days = new Map();
  days.set(T, mk(T, {}, { actual: [{ s: '09:00', e: '10:00' }] }));
  days.set(addD(T, -1), mk(addD(T, -1), {}, { notes: [{ id: 'x' }] }));
  assert.equal(summarize(days, {}, T).streak, 2);
});
test('레벨업 감지', () => {
  const T = '2026-10-20', a = new Map(), b = new Map();
  a.set(T, mk(T, { rel: 8, work: 8 }));
  for (let i = 0; i < 12; i++) b.set(addD(T, -i), mk(addD(T, -i), { rel: 8, work: 8, body: 8 }));
  const ups = levelUps(summarize(a, {}, T), summarize(b, {}, T));
  assert.ok(ups.some(u => u.kind === 'total')); assert.ok(ups.some(u => u.kind === 'pillar' && u.key === 'rel'));
  assert.deepEqual(levelUps(null, summarize(b, {}, T)), []);
});
