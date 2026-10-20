/* dev/sample-v4 — 변환 시험용 합성 v4 데이터. 실제 사용자 데이터가 아니다. */
export function sampleV4() {
  const days = [];
  const pad = n => String(n).padStart(2, '0');
  for (let i = 0; i < 14; i++) {
    const date = `2026-10-${pad(6 + i)}`;
    days.push({
      date, s10: 1,
      plan: [{ id: 'p' + i, s: '09:00', e: '10:00', act: '보고서', cat: '업무', area: 'work' }],
      time: [
        { id: 't' + i, s: '09:00', e: '10:30', act: '보고서', cat: '업무', area: 'work', fz: 1 },
        { id: 's' + i, s: '06:00', e: '06:30', act: '아침 기도', cat: '신앙', area: 'spirit' },
      ],
      score: { spirit: 7, rel: 5 + (i % 3), work: 6, body: 4 + (i % 4), mind: 5, habit: i % 2 ? 6 : 0 },
      scAuto: { spirit: 6, work: 5 }, scUser: i === 3 ? { rel: 9 } : {},
      habits: { h1: i % 2 === 0, h2: true, h3: false },
      dn: i % 4 === 0 ? [{ id: 'q' + i, ts: 1760000000000 + i, hm: '14:20', k: 'work', c: '보고', s: '개요', txt: '개요를 정리함', ln: null }] : [],
      pri: [{ text: '보고서 제출', link: '', done: i % 2 === 0 }],
      fin: [{ id: 'f' + i, what: '점심', amt: 9000 }],
      mgrat: ['가족', '', ''], great: ['', '', ''], grat: ['', '', ''], hard: '', affirm: '', thought: '',
      word: '오늘의 말씀', nurture: { done: true, who: '', what: '' },
      sleep: { bed: '23:00', wake: '06:00', q: 3, hours: 7 }, meals: [], ex: [], meas: { w: '70' },
      routines: [], checks: [], ar: { spirit: { a: 1 }, work: { b: 2 } },
    });
  }
  const notes = [
    { kind: 'note', id: 'note-a1', date: '2026-10-08', topic: '독서', title: '리더십 메모', body: '핵심은 책임이다.', photos: [], created: 1760000100000, updated: 1760000200000, area: 'grow', sub: '리더십', tags: ['책'], eb: { s: '2026-10-08', iv: [1, 3, 7], d: {} } },
    { kind: 'note', id: 'note-a2', date: '2026-10-09', topic: '큐티', title: '큐티', body: '본문 묵상', photos: [], created: 1760000300000, area: 'spirit' },
    { kind: 'note', id: 'note-a3', topic: '아이디어', title: '날짜 없는 노트', body: '날짜 필드 없음', created: 1760100000000, area: '' },
  ];
  const settings = {
    cats: [{ name: '업무', area: 'work', subs: ['보고'] }, { name: '신앙', area: 'spirit', subs: [] }],
    topics: [{ name: '독서', area: 'grow' }], majors: [{ id: 'diary', n: '일기' }],
    habits: [{ id: 'h1', name: '운동' }, { id: 'h2', name: '독서' }, { id: 'h3', name: '일찍 자기' }],
    routines: [{ id: 'r1', name: '아침 루틴', items: [{ id: 'i1', name: '스트레칭', min: 5 }], alarm: { on: true, time: '06:30', days: [1, 2, 3, 4, 5] } }],
    cycles: [{ id: 'cy1', name: '이발', emo: '💈', every: 3, unit: 'w', last: '2026-09-20', remind: 2 }],
    pcare: [{ id: 'pc1', t: '건강검진', k: 'body', every: { unit: 'y', n: 1 } }],
    planRep: [{ id: 'pr1', name: '주간 회의' }],
    wkFocus: { '2026-10-05': ['work', 'rel', 'spirit'], '2026-10-12': ['body'] },
    bible: { read: { 1: '2026-10-01' } }, lvl: 'mid', navMap: { plan: ['vision'] }, wt: { work: 2 }, stfMv: 1, theme: 'dark',
  };
  return {
    settings, notes, days,
    goals: { list: [{ id: 'g1', lv: 'w', per: '2026-10-05', text: '보고서 완성', area: 'work' }, { id: 'g2', lv: 'y', text: '말씀 통독', area: 'spirit' }] },
    tasks: { items: [{ id: 't1', text: '전화하기', dk: 'spirit' }, { id: 't2', text: '제출', dk: 'work' }], lists: [] },
    people: { list: [{ id: 'pe1', name: '김아무개' }] },
    budget: { plans: [] }, assets: { items: [] }, books: { list: [] }, projects: { items: [] },
    stuff: { items: [{ id: 's1', name: '열쇠' }] }, trash: { items: [] },
  };
}
