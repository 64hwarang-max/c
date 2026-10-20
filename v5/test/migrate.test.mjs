import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, convertDay } from '../src/migrate/v4to5.js';
import { runMigration, readV4, parseBackup, isMigrated } from '../src/migrate/run.js';
import { memoryAdapter } from '../src/core/store.js';
import { K, PILLAR_KEYS } from '../src/core/schema.js';
import { sampleV4 } from '../src/dev/sample-v4.js';

const frozen = o => JSON.stringify(o);

test('변환은 입력을 바꾸지 않는다', () => {
  const v4 = sampleV4(), before = frozen(v4);
  migrate(v4); assert.equal(frozen(v4), before);
});
test('일지: 이름 바꾸기·영성 제거·습관→완료', () => {
  const { docs, report } = migrate(sampleV4());
  const d = docs[K.day('2026-10-06')];
  assert.equal(d.v, 5); assert.equal(d.actual.length, 2); assert.equal(d.plan.length, 1);
  assert.equal('time' in d, false); assert.equal('spirit' in d.score, false); assert.equal('spirit' in d.scAuto, false);
  assert.equal(d.done['habit:h1'], true); assert.equal(d.done['habit:h2'], true); assert.equal('habit:h3' in d.done, false);
  assert.equal(report.days, 14);
  assert.ok(report.spiritScores >= 14 && report.spiritFields === 28);
  assert.equal('word' in d.rest, false); assert.equal('nurture' in d.rest, false); assert.equal('spirit' in d.rest.ar, false); assert.equal(d.rest.ar.work.b, 2);
});
test('영성 영역 블록은 영역을 비우고 표시를 남긴다', () => {
  const d = migrate(sampleV4()).docs[K.day('2026-10-06')];
  const b = d.actual.find(x => x.id === 's0'); assert.equal(b.area, ''); assert.equal(b.was, 'spirit');
  assert.equal(d.actual.find(x => x.id === 't0').area, 'work');
});
test('한 칸도 잃지 않는다: 정리하지 않은 필드는 rest에 있다', () => {
  const src = sampleV4().days[0];
  const d = convertDay(src, { spiritScores: 0, spiritFields: 0, spiritRefs: 0, habitChecks: 0 });
  assert.equal(d.rest.s10, 1); assert.deepEqual(d.rest.checks, []);
  assert.equal(d.fin[0].amt, 9000); assert.equal(d.body.sleep.hours, 7); assert.equal(d.eval.mgrat[0], '가족');
});
test('노트 → 그날의 하루 노트 블록, 영성 노트는 옮기지 않음, 날짜 없으면 작성일 기준', () => {
  const { docs, report } = migrate(sampleV4());
  const d = docs[K.day('2026-10-08')];
  const nb = d.notes.find(b => b.id === 'note-a1');
  assert.equal(nb.k, 'grow'); assert.equal(nb.c, '독서'); assert.equal(nb.s, '리더십'); assert.equal(nb.title, '리더십 메모'); assert.equal(nb.txt, '핵심은 책임이다.');
  assert.deepEqual(nb.x.tags, ['책']); assert.equal(nb.x.eb.iv.length, 3);
  assert.equal(report.notesDropped, 1);
  assert.ok(!Object.values(docs).some(v => v && v.notes && v.notes.some(b => b.id === 'note-a2')));
  assert.equal(report.notesMoved, 2);                                 // a1 + 날짜 없는 a3
  assert.equal(report.notesUndated, 0);
  const a3 = Object.values(docs).flatMap(v => (v && v.notes) || []).find(b => b.id === 'note-a3');
  assert.ok(a3 && a3.txt === '날짜 필드 없음');
});
test('기존 하루 노트 블록(dn)은 그대로 이어받는다', () => {
  const d = migrate(sampleV4()).docs[K.day('2026-10-06')];
  const b = d.notes.find(x => x.id === 'q0'); assert.equal(b.txt, '개요를 정리함'); assert.equal(b.k, 'work'); assert.equal(b.hm, '14:20');
});
test('설정: 분류·규칙·중점 기둥·남길 설정', () => {
  const { docs, report } = migrate(sampleV4());
  const tx = docs[K.taxonomy];
  assert.deepEqual(tx.pillars, PILLAR_KEYS); assert.equal(tx.pillars.includes('spirit'), false);
  assert.equal(tx.cats.find(c => c.name === '신앙').area, ''); assert.equal(tx.cats.find(c => c.name === '업무').area, 'work');
  const kinds = report.rules; assert.deepEqual(kinds, { habit: 3, routine: 1, cycle: 1, care: 1, event: 1 });
  const rules = docs[K.rules].list; assert.equal(rules.find(r => r.id === 'cycle:cy1').every.n, 3);
  const pr = docs[K.prefs];
  assert.deepEqual(pr.focus, { '2026-10-05': 'work', '2026-10-12': 'body' });   // 3개 → 1개, 영성 제외
  assert.equal(report.focusTrimmed, 1);
  ['bible', 'lvl', 'navMap', 'wt', 'stfMv', 'cats', 'habits'].forEach(k => assert.equal(k in pr, false, k));
  assert.equal(pr.theme, 'dark');
  assert.equal(docs[K.legacy].settings.bible.read[1], '2026-10-01');             // 원본은 보관
});
test('목표·할 일의 영성 표시는 비우고, 제자리는 옮기지 않는다', () => {
  const { docs, report } = migrate(sampleV4());
  assert.equal(docs[K.goals].list.find(g => g.id === 'g2').area, '');
  assert.equal(docs[K.tasks].items.find(t => t.id === 't1').dk, '');
  assert.equal(docs[K.people].list[0].name, '김아무개');
  assert.equal(Object.keys(docs).some(k => /stuff/.test(k)), false); assert.equal(report.stuffDropped, 1);
});
test('날짜가 이상한 일지는 경고만 하고 건너뛴다', () => {
  const v4 = sampleV4(); v4.days.push({ date: '2026-13-99x' });
  const { report } = migrate(v4); assert.equal(report.days, 14); assert.equal(report.warnings.length, 1);
});
test('빈 입력도 죽지 않는다', () => {
  const { docs } = migrate({ days: [], notes: [] }); assert.ok(docs[K.meta]);
  assert.doesNotThrow(() => migrate({}));
});

/* ---- 저장소를 거치는 실행 ---- */
async function v4Store() {
  const v4 = sampleV4(), init = {};
  v4.days.forEach(d => { init['day:' + d.date] = d; });
  v4.notes.forEach(n => { init[n.id] = n; });
  ['settings', 'goals', 'tasks', 'people', 'budget', 'assets', 'books', 'projects', 'stuff', 'trash'].forEach(k => { init[k] = v4[k]; });
  init['photo-abc'] = { kind: 'photo', data: 'data:image/png;base64,AAAA' };
  return memoryAdapter(init);
}
test('실행: 원본 백업 → v5 문서 쓰기 → meta 맨 마지막, v4 문서는 그대로', async () => {
  const ad = await v4Store(); const keysBefore = (await ad.keys()).filter(k => !k.startsWith('v5/')).sort();
  const order = []; let backup = '';
  const sink = async t => { backup = t; order.push('backup'); };
  const origPut = ad.put; ad.put = async (k, v) => { order.push(k); return origPut(k, v); };
  const r = await runMigration({ adapter: ad, backupSink: sink });
  assert.ok(r.report && r.report.days === 14);
  assert.equal(order[0], 'backup'); assert.equal(order[order.length - 1], K.meta);
  assert.equal((JSON.parse(backup).data.days).length, 14);                     // 원본 전체가 백업에 들어 있음
  assert.deepEqual((await ad.keys()).filter(k => !k.startsWith('v5/')).sort(), keysBefore);   // v4 문서 수 불변
  assert.deepEqual(await ad.get('day:2026-10-06'), sampleV4().days[0]);        // v4 문서 내용 불변
  assert.equal(await isMigrated(ad), true);
});
test('두 번째 실행은 아무것도 하지 않는다', async () => {
  const ad = await v4Store(); await runMigration({ adapter: ad, backupSink: async () => {} });
  let n = 0; const r = await runMigration({ adapter: ad, backupSink: async () => { n++; } });
  assert.equal(r.skipped, true); assert.equal(n, 0);
});
test('백업 저장에 실패하면 v5 문서를 쓰지 않고 중단한다', async () => {
  const ad = await v4Store();
  await assert.rejects(() => runMigration({ adapter: ad, backupSink: async () => { throw new Error('디스크 가득'); } }), /디스크/);
  assert.equal((await ad.keys()).some(k => k.startsWith('v5/')), false);
  assert.equal(await isMigrated(ad), false);
});
test('백업 장소가 없으면 중단한다', async () => {
  const ad = await v4Store();
  await assert.rejects(() => runMigration({ adapter: ad }), /백업/);
});
test('중간에 끊겨도(meta 없음) 다시 실행하면 끝까지 한다', async () => {
  const ad = await v4Store(); const op = ad.put; let n = 0;
  ad.put = async (k, v) => { if (++n === 5) throw new Error('끊김'); return op(k, v); };
  await assert.rejects(() => runMigration({ adapter: ad, backupSink: async () => {} }));
  assert.equal(await isMigrated(ad), false);
  ad.put = op; const r = await runMigration({ adapter: ad, backupSink: async () => {} });
  assert.equal(r.report.days, 14); assert.equal(await isMigrated(ad), true);
});
test('처음 쓰는 기기: 빈 meta만 만든다', async () => {
  const ad = memoryAdapter(); const r = await runMigration({ adapter: ad });
  assert.equal(r.empty, true); assert.equal(await isMigrated(ad), true); assert.deepEqual(await ad.keys(), [K.meta]);
});
test('사진 문서는 건드리지도 복사하지도 않는다', async () => {
  const ad = await v4Store(); const v4 = await readV4(ad);
  assert.equal(v4.notes.length, 3); assert.equal(v4.days.length, 14);
  await runMigration({ adapter: ad, backupSink: async () => {} });
  assert.equal((await ad.keys()).filter(k => k.includes('photo')).length, 1);
});
test('v6 백업 JSON 읽기', () => {
  const v4 = sampleV4(), txt = JSON.stringify({ app: '성장일지', v: 6, settings: v4.settings, goals: v4.goals, notes: v4.notes, days: v4.days, extra: { trash: v4.trash } });
  const p = parseBackup(txt); assert.equal(p.days.length, 14); assert.equal(migrate(p).report.days, 14);
  assert.throws(() => parseBackup('{'), /형식/); assert.throws(() => parseBackup('{"a":1}'), /days/);
  assert.throws(() => parseBackup(JSON.stringify({ v: 9, days: [] })), /새로운/);
});
