/* domain/taxonomy — 분류(대분류=기둥 또는 내 대분류 › 중분류 › 소분류)와 색. 분류 체계는 이것 하나다. */
import { PILLAR_KEYS } from '../core/schema.js';

export const PILLAR_COLORS = { rel: '#d9485f', fin: '#b7791f', body: '#2f9e5e', work: '#3949ab', grow: '#1e88e5', habit: '#7e57c2', mind: '#d6559a' };
const GRAY = '#8a919c';

/* 처음 쓰는 기기의 기본 분류(영성 분류는 뺐다). area=기둥 키 */
export const defaultTaxonomy = () => ({
  pillars: PILLAR_KEYS.slice(),
  majors: [],
  topics: [],
  cats: [
    { name: '업무', area: 'work', color: '#3949ab', subs: [] },
    { name: '자기계발', area: 'grow', color: '#1e88e5', subs: [] },
    { name: '운동', area: 'body', color: '#43a047', subs: [] },
    { name: '식사', area: 'body', color: '#f9a825', subs: [] },
    { name: '가족·관계', area: 'rel', color: '#e53935', subs: [] },
    { name: '생활', area: '', color: '#90a4ae', subs: [] },
    { name: '이동', area: '', color: '#78909c', subs: [] },
    { name: '휴식', area: 'body', color: '#00acc1', subs: [] },
    { name: '흘려보냄', area: '', color: '#bdbdbd', subs: [] },
  ],
});

export const catByName = (tx, name) => ((tx && tx.cats) || []).find(c => c.name === name) || null;
export const catNames = tx => ((tx && tx.cats) || []).map(c => c.name);

/* 분류에 기둥이 정해지지 않았을 때 이름으로 짐작하는 값 */
const area0 = n => /업무/.test(n || '') ? 'work' : /공부|자기계발|독서/.test(n || '') ? 'grow' : /운동|식사|휴식|수면/.test(n || '') ? 'body' : /가족|관계/.test(n || '') ? 'rel' : '';
export function areaOfCat(tx, name) {
  const c = catByName(tx, name);
  if (c && c.area != null) return PILLAR_KEYS.includes(c.area) ? c.area : '';
  return area0(name);
}
/* 블록 자체에 기둥이 적혀 있으면 그것이 우선 */
export const blockArea = (tx, b) => (b && PILLAR_KEYS.includes(b.area) ? b.area : areaOfCat(tx, b && b.cat));

/* 분류 색은 대분류(기둥) 단위. 직접 정한 색(prefs.dkColor) > 분류에 적힌 색 > 기둥 기본색 */
export function colorOf(tx, prefs, name) {
  const c = catByName(tx, name), a = areaOfCat(tx, name);
  const set = (prefs && prefs.dkColor) || {};
  if (a && set[a]) return set[a];
  if (c && c.color) return c.color;
  return a ? PILLAR_COLORS[a] : GRAY;
}
