/* core/schema — v5 문서 이름과 모양. 문서마다 주인 모듈이 하나다(주인 열 참고). */
export const SCHEMA = 5;
export const APP = 'growth-journal';   // 백업 파일 표지

/* 삶의 7기둥 (영성은 v5에서 뺐다) */
export const PILLARS = [
  ['rel', '관계', '가족·사람·섬김'],
  ['fin', '재정', '예산·절제·나눔'],
  ['body', '건강', '수면·운동·식사'],
  ['work', '업무', '임무·성과·집중'],
  ['grow', '지식', '독서·공부·배움'],
  ['habit', '습관', '오늘 지킨 습관'],
  ['mind', '마음관리', '감사·생각·감정'],
];
export const PILLAR_KEYS = PILLARS.map(p => p[0]);
export const DROPPED_PILLARS = ['spirit'];

/* v5 저장 키. v4 키(day:…, settings, goals …)는 건드리지 않는다. */
export const K = {
  day: d => `v5/day:${d}`,
  dayPrefix: 'v5/day:',
  prefs: 'v5/prefs',          // 주인: features/settings
  taxonomy: 'v5/taxonomy',    // 주인: features/taxonomy
  rules: 'v5/rules',          // 주인: features/rules (반복)
  goals: 'v5/goals',          // 주인: features/goals
  projects: 'v5/projects',
  tasks: 'v5/tasks',
  people: 'v5/people',        // 주인: features/people
  budget: 'v5/budget',        // 주인: features/finance (설정·자산만, 거래는 day.fin)
  assets: 'v5/assets',
  books: 'v5/books',
  trash: 'v5/trash',
  weeks: 'v5/weeks',          // 주인: features/planning (주 마무리 글)
  meta: 'v5/meta',            // 주인: core/migrate
  legacy: 'v5/legacy',        // v4 설정 원본 보관(읽지 않음)
};

/* 하루 한 장의 모양 */
export const blankDay = date => ({
  v: SCHEMA, date,
  plan: [],          // 계획 블록
  actual: [],        // 실제 블록 (v4 time)
  score: {},         // 최종 점수 {기둥키: 0~10}
  scUser: {},        // 직접 매긴 점수
  scAuto: {},        // 자동 초안
  eval: {},          // 평가 글(감사·아쉬움·한 걸음 …)
  body: {},          // 수면·식사·운동·몸 측정
  fin: [],           // 거래 (지출·수입은 여기에만)
  meet: [],          // 만남
  mis: [],           // 실수
  pri: [],           // 우선순위
  notes: [],         // 하루 노트 블록 (노트 화면은 이것을 모아 보여 준다)
  done: {},          // 반복 완료 { 'habit:이름': true, 'rule:id': true }
  runs: [],          // 루틴 실행 기록
  photos: [],
  rest: {},          // 아직 v5에서 정리하지 않은 v4 필드(잃지 않으려고 보관)
});

export function normDay(o) {
  const b = Object.assign(blankDay(o && o.date), o || {});
  ['plan', 'actual', 'fin', 'meet', 'mis', 'pri', 'notes', 'runs', 'photos'].forEach(k => { if (!Array.isArray(b[k])) b[k] = []; });
  ['score', 'scUser', 'scAuto', 'eval', 'body', 'done', 'rest'].forEach(k => { if (!b[k] || typeof b[k] !== 'object' || Array.isArray(b[k])) b[k] = {}; });
  b.v = SCHEMA;
  return b;
}
