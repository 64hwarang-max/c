import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuick, withKind, qTime, qDur, parseAmt } from '../src/domain/quick.js';
import { parseWhen } from '../src/domain/when.js';
import { guessBlock } from '../src/domain/classify.js';
import { defaultTaxonomy } from '../src/domain/taxonomy.js';

const T = '2026-10-20';   // 화요일
const ctx = (o = {}) => ({ today: T, cur: T, nowHM: '10:00', lastPlanEnd: '', ...o });

test('시간 읽기', () => {
  assert.equal(qTime('2시 회의').s, '14:00'); assert.equal(qTime('2시 회의').e, '15:00');
  assert.equal(qTime('오전 9시 30분 보고').s, '09:30'); assert.equal(qTime('오후 3시 반 상담').s, '15:30');
  const r = qTime('9~11시 보고서'); assert.equal(r.s, '09:00'); assert.equal(r.e, '11:00');
  assert.equal(qTime('1~3시 회의').s, '13:00'); assert.equal(qTime('1~3시 회의').e, '15:00'); assert.equal(qTime('오전 10~12시').e, '12:00');
  assert.equal(qTime('7시 30분~8시 반').e, '08:30'); assert.equal(qTime('회의 없음'), null);
  assert.equal(qTime('2시 회의 90분').e, '15:30');
});
test('시간·금액 읽기', () => {
  assert.equal(qDur('1시간 30분 운동').min, 90); assert.equal(qDur('45분 걷기').min, 45);
  assert.equal(parseAmt('9,000원'), 9000); assert.equal(parseAmt('1만 5천원'), 15000); assert.equal(parseAmt('3천'), 3000);
});
test('2시 회의 → 일정(앞으로), 오전 9시 보고 → 한 일(이미 지남)', () => {
  assert.equal(parseQuick('2시 회의', ctx()).kind, 'plan'); assert.equal(parseQuick('2시 회의', ctx()).t, '회의');
  const r = parseQuick('오전 9시 보고서 작성', ctx()); assert.equal(r.kind, 'done'); assert.equal(r.s, '09:00');
});
test('지출·수입·감사·만남·노트', () => {
  const f = parseQuick('점심 9000원', ctx()); assert.equal(f.kind, 'fin'); assert.equal(f.amtN, 9000); assert.equal(f.t, '점심');
  assert.equal(parseQuick('월급 300만원', ctx()).income, 1);
  assert.equal(parseQuick('감사: 가족이 건강함', ctx()).kind, 'grat');
  assert.equal(parseQuick('김 중령 만났다', ctx()).kind, 'meet');
  assert.equal(parseQuick('노트: 오늘 배운 것', ctx()).kind, 'note');
  assert.equal(parseQuick('메모: 짧은 글', ctx()).kind, 'note');
  assert.equal(parseQuick('가'.repeat(45), ctx()).kind, 'note');
});
test('접두어로 종류를 정한다', () => {
  assert.equal(parseQuick('일정: 회의', ctx()).kind, 'plan'); assert.equal(parseQuick('지출: 커피 4500원', ctx()).kind, 'fin');
  assert.equal(parseQuick('한 일: 운동 30분', ctx()).kind, 'done'); assert.equal(parseQuick('할 일: 보고', ctx()).kind, 'task');
});
test('날짜가 들어 있으면 그날의 일정으로', () => {
  const r = parseQuick('내일 3시 면담', ctx()); assert.equal(r.kind, 'plan'); assert.equal(r.date, '2026-10-21'); assert.equal(r.s, '15:00'); assert.equal(r.t, '면담');
  const r2 = parseQuick('금요일 회의', ctx()); assert.equal(r2.date, '2026-10-23'); assert.equal(r2.notime, 1); assert.equal(r2.s, '09:00');
  assert.equal(parseQuick('오늘 3시 면담', ctx()).date, undefined);          // 보고 있는 날이면 date 없음
  assert.equal(parseQuick('내일까지 보고서 제출', ctx()).kind, 'task');        // “까지”는 할 일
});
test('할 일 말투는 task', () => { assert.equal(parseQuick('보고서 제출', ctx()).kind, 'task'); });
test('시간이 없는 일정은 직전 계획 끝에 붙인다', () => {
  const r = parseQuick('일정: 정리', ctx({ lastPlanEnd: '11:30' })); assert.equal(r.s, '11:30'); assert.equal(r.e, '12:30');
  assert.equal(parseQuick('일정: 정리', ctx({ nowHM: '10:20' })).s, '11:00');
});
test('한 일은 지금까지의 시간으로', () => {
  const r = parseQuick('운동 30분 했다', ctx({ nowHM: '07:40' })); assert.equal(r.kind, 'done'); assert.equal(r.e, '07:40'); assert.equal(r.s, '07:10');
  const past = parseQuick('독서 1시간', ctx({ cur: '2026-10-18' })); assert.equal(past.kind, 'done'); assert.equal(past.e, '12:30');
});
test('칩으로 종류를 바꾸면 시간을 채운다', () => {
  const r = parseQuick('정리', ctx()); const x = withKind(r, 'plan', ctx({ nowHM: '10:20' })); assert.equal(x.kind, 'plan'); assert.equal(x.s, '11:00'); assert.equal(x.user, 1);
  assert.equal(withKind(r, 'done', ctx({ nowHM: '10:20' })).e, '10:20');
});
test('날짜 표현', () => {
  assert.equal(parseWhen('내일 보고', T).date, '2026-10-21'); assert.equal(parseWhen('모레', T).date, '2026-10-22');
  assert.equal(parseWhen('다음 주 화요일 회의', T).date, '2026-10-27'); assert.equal(parseWhen('다음 주 회의', T).date, '2026-10-26');
  assert.equal(parseWhen('이번 주 금요일', T).date, '2026-10-23'); assert.equal(parseWhen('10월 3일 행사', T).date, '2027-10-03');
  assert.equal(parseWhen('25일 정산', T).date, '2026-10-25'); assert.equal(parseWhen('3일 뒤 점검', T).date, '2026-10-23');
  assert.equal(parseWhen('그냥 글', T).date, ''); assert.equal(parseWhen('내일 보고', T).rest, '보고');
});
test('분류·사람 짐작', () => {
  const c = { tx: defaultTaxonomy(), learn: {}, people: ['김철수', '박'] };
  assert.equal(guessBlock('아침 운동', c).cat, '운동'); assert.equal(guessBlock('점심 회식', c).cat, '식사'); assert.equal(guessBlock('주간 회의', c).cat, '업무');
  assert.equal(guessBlock('김철수와 점심', c).who, '김철수'); assert.equal(guessBlock('엄마와 통화', c).who, '엄마');
  assert.equal(guessBlock('박 만남', c).who, '');                                    // 한 글자 이름은 무시
  assert.equal(guessBlock('예배 참석', c).cat, '');                                  // 영성 분류는 없다
  assert.equal(guessBlock('독서', { ...c, learn: { 독서: '휴식' } }).cat, '휴식');     // 배운 분류가 우선
  assert.equal(guessBlock('독서', { ...c, learn: { 독서: '없는분류' } }).cat, '자기계발');
});
