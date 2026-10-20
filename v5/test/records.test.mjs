import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../src/core/events.js';
import { memoryAdapter, createStore } from '../src/core/store.js';
import { createRecordActions } from '../src/features/records.js';
import { collectNotes, filterNotes, groupNotes, groupNotesByDate, monthFin, addMonth, meetStats, bookGroups, amtOf } from '../src/domain/records.js';

const days = new Map([
  ['2026-10-19', { notes: [{ id: 'a', k: 'work', c: '보고', s: '개요', title: '개요', txt: '첫 문단', hm: '09:00', ts: 1 }, { id: 'b', k: '', c: '', s: '', txt: '아이디어 하나\n둘째 줄', hm: '10:00', ts: 2 }], fin: [{ type: '지출', item: '점심', amt: '9,000', cat: '식비' }, { type: '수입', item: '용돈', amt: 50000 }], meet: [{ who: '김대리', what: '식사', follow: true }] }],
  ['2026-10-20', { notes: [{ id: 'c', k: 'work', c: '보고', s: '초안', title: '초안', txt: '', hm: '11:00', ts: 3 }], fin: [{ type: '지출', item: '커피', amt: 4500, cat: '식비' }, { type: '나눔', item: '기부', amt: 10000 }], meet: [{ who: '김대리', what: '회의' }, { who: '박과장' }] }],
  ['2026-09-30', { fin: [{ type: '지출', item: '교통', amt: 1000 }] }],
]);

test('노트 모음: 최신순, 검색, 분류 필터, 나무', () => {
  const l = collectNotes(days); assert.deepEqual(l.map(n => n.id), ['c', 'b', 'a']);
  assert.equal(l[1].title, '아이디어 하나');
  assert.deepEqual(filterNotes(l, { q: '문단' }).map(n => n.id), ['a']);
  assert.deepEqual(filterNotes(l, { k: 'work' }).map(n => n.id), ['c', 'a']); assert.deepEqual(filterNotes(l, { k: '-' }).map(n => n.id), ['b']);
  const t = groupNotes(l); const w = t.find(x => x.name === '업무'); assert.equal(w.count, 2); assert.equal(w.kids[0].name, '보고'); assert.equal(w.kids[0].kids.length, 2);
  assert.equal(groupNotesByDate(l)[0].date, '2026-10-20');
});
test('재정: 월 합계·분류·금액 읽기', () => {
  assert.equal(amtOf({ amt: '9,000원' }), 9000); assert.equal(amtOf({ amt: '' }), 0);
  const m = monthFin(days, '2026-10'); assert.deepEqual(m.sum, { in: 50000, out: 13500, give: 10000 }); assert.equal(m.net, 26500);
  assert.equal(m.cats[0].name, '식비'); assert.equal(m.cats[0].n, 13500); assert.equal(m.rows[0].date, '2026-10-20');
  assert.equal(addMonth('2026-12', 1), '2027-01'); assert.equal(addMonth('2026-01', -1), '2025-12');
});
test('만남: 사람별 횟수·마지막', () => {
  const s = meetStats(days); const k = s.find(x => x.who === '김대리'); assert.equal(k.count, 2); assert.equal(k.last, '2026-10-20'); assert.equal(k.follow, 1);
  assert.ok(s.some(x => x.who === '박과장'));
});
test('책: 추가·상태 이동·삭제·되돌리기, v4 items/list 모두', async () => {
  const store = createStore(memoryAdapter(), createBus()), r = createRecordActions({ store });
  const { book } = await r.addBook({ title: '내적 지휘', author: '저자' });
  assert.equal(bookGroups(await r.loadBooks()).find(g => g.k === 'want').items.length, 1);
  await r.editBook(book.id, { st: 'read' }); assert.equal(bookGroups(await r.loadBooks()).find(g => g.k === 'read').items.length, 1);
  const u = await r.deleteBook(book.id); assert.equal(r.count(await r.loadBooks()), 0); await u.undo(); assert.equal(r.count(await r.loadBooks()), 1);
  assert.equal(bookGroups({ list: [{ id: 'x', title: 'a', st: 'done' }] }).find(g => g.k === 'done').items.length, 1);
});
