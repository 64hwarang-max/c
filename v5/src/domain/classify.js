/* domain/classify — 글에서 분류와 함께한 사람을 짐작한다(v4 guessBlock). 영성 분류는 뺐다. */
import { catByName } from './taxonomy.js';

const KW = [
  [/샤워|세면|세수|양치|머리 ?감|면도|화장|옷 ?갈아|출근 ?준비|씻기|빨래|청소|설거지|분리수거|정리정돈/, '생활'],
  [/식사|아침밥|점심|저녁|밥|회식|외식|브런치|간식|커피|카페/, '식사'],
  [/운동|헬스|달리기|조깅|러닝|수영|테니스|축구|농구|등산|걷기|산책|요가|필라테스|스트레칭|자전거|체력/, '운동'],
  [/회의|보고|결재|출근|근무|업무|훈련|당직|교육|점검|브리핑|기안|작전|검열/, '업무'],
  [/공부|독서|책|강의|논문|어학|영어|자격증|세미나|필사|학습/, '자기계발'],
  [/엄마|아빠|어머니|아버지|아내|남편|가족|아이|아들|딸|부모님|장모|장인|친구|모임|데이트|통화|전화/, '가족·관계'],
  [/이동|출근길|퇴근|운전|버스|지하철|KTX|기차|비행|귀가/, '이동'],
  [/휴식|낮잠|쉬기|TV|영화/, '휴식'],
  [/유튜브|SNS|게임|웹툰|인스타|쇼츠/, '흘려보냄'],
];
export const FAMILY = ['엄마', '아빠', '어머니', '아버지', '아내', '남편', '아들', '딸', '장모님', '장인어른', '할머니', '할아버지', '형', '누나', '동생', '언니', '오빠', '부모님'];
const rx = n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ctx: { tx(분류), learn(prefs.catLearn), people(이름 목록) } → { cat, who } */
export function guessBlock(text, ctx) {
  const t = (text || '').trim(), tx = ctx.tx, out = { cat: '', who: '' };
  const has = n => !!catByName(tx, n);
  const learned = (ctx.learn || {})[t]; if (learned && has(learned)) out.cat = learned;
  if (!out.cat) {
    let best = 0;
    ((tx && tx.cats) || []).forEach(c => String(c.kw || '').split(/[,，]/).map(x => x.trim()).filter(Boolean).forEach(w => { if (t.includes(w) && w.length > best) { out.cat = c.name; best = w.length; } }));
  }
  if (!out.cat) {
    const named = ((tx && tx.cats) || []).filter(c => c.name && t.includes(c.name)).sort((a, b) => b.name.length - a.name.length)[0];
    if (named) out.cat = named.name;
    else for (const [re, name] of KW) { if (re.test(t) && has(name)) { out.cat = name; break; } }
  }
  const ppl = (ctx.people || []).filter(n => n && n.length >= 2 && t.includes(n)).sort((a, b) => b.length - a.length)[0];
  out.who = ppl || FAMILY.find(n => new RegExp(rx(n) + '(와|과|랑|이랑|하고|님|께|에게|\\s|$)').test(t)) || '';
  return out;
}
