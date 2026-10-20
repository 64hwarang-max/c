/* core/util — 여러 모듈이 같이 쓰는 작은 함수 */
export const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
export const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
export const arr = v => (Array.isArray(v) ? v : []);
