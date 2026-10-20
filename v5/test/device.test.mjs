import test from 'node:test';
import assert from 'node:assert/strict';
import { widgetPayload, reminders, notifyId, ID_BASE, ID_SPAN } from '../src/domain/device.js';
import { plugin, isNative } from '../src/native/bridge.js';
import { pushWidget } from '../src/native/widget.js';
import { syncNotifications } from '../src/native/notify.js';

const T = '2026-10-20';
const day = { date: T, pri: [{ text: '보고서', done: true }, { text: '운동', done: false }, { text: '' }], plan: [{ id: 'a', s: '09:00', e: '10:00', act: '회의' }, { id: 'b', s: '14:00', e: '15:00', cat: '업무' }], actual: [], notes: [{}], done: { 'habit:h1': true }, eval: { step: '운동 먼저' } };
const tasks = { items: [{ id: 't1', title: '서류', due: '2026-10-18', done: false }, { id: 't2', title: '치과', due: T, time: '16:00', done: false }, { id: 't3', title: '끝', due: T, done: true }] };
const rules = [{ id: 'habit:h1', kind: 'habit' }, { id: 'habit:h2', kind: 'habit' }, { id: 'routine:r1', kind: 'routine', name: '아침 루틴', alarm: { on: true, time: '07:00', days: [2, 3] } }];

test('위젯 내용: 지금 일정·우선순위·할 일·습관', () => {
  const p = widgetPayload({ day, tasks, rules, today: T, nowHM: '09:30' });
  assert.equal(p.title, '10월 20일 (화) · 할 일 2');
  assert.ok(p.body.startsWith('▶ 지금 09:00~10:00 회의')); assert.ok(p.body.includes('✔ 보고서')); assert.ok(p.body.includes('2. 운동')); assert.ok(p.body.includes('☐ 서류 (지남)')); assert.ok(p.body.includes('☐ 16:00 치과'));
  assert.equal(p.foot, '습관 1/2 · 노트 1 · 👣 운동 먼저');
  assert.ok(widgetPayload({ day: { plan: [] }, tasks: null, rules: [], today: T, nowHM: '09:00' }).body.includes('비어 있습니다'));
});
test('알림 목록: 미래 것만, 한 계획 제외, 루틴 알람·시각 있는 할 일, 번호 범위', () => {
  const now = new Date(2026, 9, 20, 9, 0).getTime();
  const days = { [T]: { ...day, actual: [{ from: 'a' }] }, '2026-10-21': { plan: [{ id: 'z', s: '08:00', e: '09:00', act: '내일 일정' }], actual: [] } };
  const r = reminders({ getDay: d => days[d], tasks, rules, today: T, now });
  const titles = r.map(x => x.title);
  assert.ok(!titles.some(t => t.includes('회의')));            // 이미 한 계획 제외
  assert.ok(titles.includes('14:00 업무') && titles.includes('치과') && titles.includes('09:00 내일 일정'.replace('09:00', '08:00')));
  assert.ok(titles.includes('아침 루틴'));                       // 내일(수요일) 07:00
  assert.ok(r.every(x => x.at > now && x.id >= ID_BASE && x.id < ID_BASE + ID_SPAN));
  assert.deepEqual(r.map(x => x.at), r.map(x => x.at).slice().sort((a, b) => a - b));
  assert.equal(notifyId('x'), notifyId('x')); assert.notEqual(notifyId('x'), notifyId('y'));
});
test('기기 연결부: 웹에서는 조용히 건너뜀, 앱에서는 호출', async () => {
  assert.equal(isNative(), false); assert.equal(plugin('X'), null);
  assert.equal(await pushWidget({ a: 1 }), false); assert.equal((await syncNotifications([])).ok, false);
  const calls = []; globalThis.Capacitor = { isNativePlatform: () => true, Plugins: {
    WidgetBridge: { update: async a => calls.push(['w', a]) },
    LocalNotifications: { checkPermissions: async () => ({ display: 'granted' }), getPending: async () => ({ notifications: [{ id: ID_BASE + 5 }, { id: 7 }] }), cancel: async a => calls.push(['c', a]), schedule: async a => calls.push(['s', a]) } } };
  try {
    assert.equal(await pushWidget({ a: 1 }), true); assert.equal(JSON.parse(calls[0][1].data).a, 1);
    const r = await syncNotifications([{ id: ID_BASE + 9, title: 't', body: 'b', at: 1 }]); assert.equal(r.ok, true);
    assert.deepEqual(calls.find(c => c[0] === 'c')[1].notifications, [{ id: ID_BASE + 5 }]);   // 남의 알림(7)은 건드리지 않음
    assert.equal(calls.find(c => c[0] === 's')[1].notifications.length, 1);
  } finally { delete globalThis.Capacitor; }
});
