import test from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../src/domain/blocks.js';
import { defaultTaxonomy, areaOfCat, blockArea, colorOf, PILLAR_COLORS } from '../src/domain/taxonomy.js';

const b = (id, s, e, extra = {}) => ({ id, s, e, act: id, cat: '업무', ...extra });

test('시각 변환과 길이(자정을 넘는 블록 포함)', () => {
  assert.equal(B.toMin('09:30'), 570); assert.equal(B.fromMin(570), '09:30'); assert.equal(B.fromMin(1500), '01:00'); assert.equal(B.fromMin(-30), '23:30');
  assert.equal(B.durMin(b('a', '09:00', '10:30')), 90); assert.equal(B.durMin(b('a', '23:00', '01:00')), 120);
  assert.equal(B.addMin('23:30', 60), '00:30'); assert.equal(B.snap(14), 10); assert.equal(B.snap(16), 20);
});
test('추가는 시작 시각순으로 정렬하고 입력을 바꾸지 않는다', () => {
  const a = [b('x', '10:00', '11:00')]; const r = B.addBlock(a, b('y', '08:00', '09:00'));
  assert.deepEqual(r.map(x => x.id), ['y', 'x']); assert.equal(a.length, 1);
});
test('끝 시각을 바꾸면 바로 이어 붙은 블록만 같이 밀린다', () => {
  const a = [b('a', '09:00', '10:00'), b('b', '10:00', '11:00'), b('c', '11:00', '12:00'), b('d', '13:00', '14:00')];
  const r = B.updateBlock(a, 'a', { e: '10:30' });
  const g = id => r.find(x => x.id === id);
  assert.deepEqual([g('b').s, g('b').e, g('c').s, g('c').e], ['10:30', '11:30', '11:30', '12:30']);
  assert.deepEqual([g('d').s, g('d').e], ['13:00', '14:00']);          // 떨어진 블록은 그대로
  assert.equal(a[1].s, '10:00');                                        // 원본 불변
});
test('끌기·길이 조절은 10분 단위, 하루를 벗어나지 않는다', () => {
  const a = [b('a', '09:00', '10:00')];
  assert.equal(B.moveBlock(a, 'a', 13 * 60 + 14)[0].s, '13:10');
  assert.equal(B.moveBlock(a, 'a', 13 * 60 + 14)[0].e, '14:10');
  assert.equal(B.moveBlock(a, 'a', 23 * 60 + 50)[0].e, '24:00'.replace('24:00', '00:00'));  // 끝이 자정이면 00:00
  assert.equal(B.moveBlock(a, 'a', -50)[0].s, '00:00');
  assert.equal(B.resizeBlock(a, 'a', 9 * 60 + 2)[0].e, '09:10');       // 최소 10분
  assert.equal(B.resizeBlock(a, 'a', 11 * 60 + 40)[0].e, '11:40');
});
test('겹치는 블록은 나란히 줄을 배정한다', () => {
  const L = B.layoutLanes([b('a', '09:00', '11:00'), b('b', '10:00', '12:00'), b('c', '12:00', '13:00'), b('d', '09:30', '10:30')]);
  assert.equal(L.get('a').lanes, 3); assert.notEqual(L.get('a').lane, L.get('b').lane); assert.notEqual(L.get('b').lane, L.get('d').lane);
  assert.deepEqual(L.get('c'), { lane: 0, lanes: 1 });
});
test('다음 빈 시간', () => {
  assert.deepEqual(B.nextSlot([b('a', '09:00', '10:30')], '08:10'), { s: '10:30', e: '11:30' });
  assert.deepEqual(B.nextSlot([], '14:20'), { s: '15:00', e: '16:00' });
  assert.equal(B.nextSlot([b('a', '21:30', '23:30')], '08:00').s, '22:00');
});
test('계획 → 실제: 전체·선택, 이미 한 것은 건너뜀, 취소', () => {
  const day = { plan: [b('p1', '09:00', '10:00', { rid: 'r1' }), b('p2', '10:00', '11:00'), { id: 'p3', act: '시간없음' }], actual: [] };
  const r1 = B.planToActual(day, ['p1']);
  assert.equal(r1.added, 1); assert.equal(r1.day.actual[0].from, 'p1'); assert.equal('rid' in r1.day.actual[0], false); assert.notEqual(r1.day.actual[0].id, 'p1');
  const r2 = B.planToActual(r1.day);
  assert.equal(r2.added, 1); assert.equal(r2.day.actual.length, 2);      // p1 중복 없음, 시간 없는 p3 제외
  assert.equal(B.planToActual(r2.day).added, 0);
  assert.equal(B.undoPlanDone(r2.day, 'p1').actual.length, 1);
  assert.equal(day.actual.length, 0);
});
test('지금과 다음', () => {
  const plan = [b('a', '09:00', '10:00'), b('b', '12:00', '13:00')];
  assert.equal(B.nowNext(plan, '09:30').cur.id, 'a'); assert.equal(B.nowNext(plan, '09:30').next.id, 'b');
  assert.equal(B.nowNext(plan, '11:00').cur, null); assert.equal(B.nowNext(plan, '13:00').next, null);
});
test('집계: 기둥별·분류별·기둥 없는 시간', () => {
  const tx = defaultTaxonomy();
  const blocks = [b('a', '09:00', '11:00'), b('b', '12:00', '13:00', { cat: '식사' }), b('c', '14:00', '14:30', { cat: '이동' }), b('d', '15:00', '16:00', { cat: '이동', area: 'rel' })];
  const m = B.minutesBy(blocks, tx);
  assert.equal(m.pil.work, 120); assert.equal(m.pil.body, 60); assert.equal(m.pil.rel, 60); assert.equal(m.other, 30); assert.equal(m.total, 270); assert.equal(m.cat['이동'], 90);
  assert.equal(B.hm(90), '1시간 30분'); assert.equal(B.hm(45), '45분'); assert.equal(B.hm(120), '2시간');
});
test('분류: 기둥·색', () => {
  const tx = defaultTaxonomy();
  assert.equal(areaOfCat(tx, '업무'), 'work'); assert.equal(areaOfCat(tx, '이동'), ''); assert.equal(areaOfCat(tx, '없는분류'), '');
  assert.equal(areaOfCat({ cats: [{ name: '신앙', area: 'spirit' }] }, '신앙'), '');   // 영성 기둥은 없다
  assert.equal(blockArea(tx, { cat: '이동', area: 'rel' }), 'rel'); assert.equal(blockArea(tx, { cat: '이동', area: 'spirit' }), '');
  assert.equal(colorOf(tx, {}, '업무'), '#3949ab'); assert.equal(colorOf(tx, { dkColor: { work: '#000000' } }, '업무'), '#000000');
  assert.equal(colorOf({ cats: [{ name: 'x', area: 'rel' }] }, {}, 'x'), PILLAR_COLORS.rel);
  assert.equal(colorOf(tx, {}, '이동'), '#78909c');
});
