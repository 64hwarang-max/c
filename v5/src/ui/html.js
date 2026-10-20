/* ui/html — 공통 부품: 문자열 이스케이프와 작은 DOM 도구 */
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root) => (root || document).querySelector(sel);
export const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
export const num = n => (Math.round(n * 10) / 10).toLocaleString('ko-KR');
