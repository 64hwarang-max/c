/* native/app — 앱 수명(App): 다시 앞으로 왔을 때, 뒤로가기 단추. 앱이 아니면 브라우저 이벤트로 대신한다. */
import { plugin } from './bridge.js';

export function onResume(cb) {
  const A = plugin('App');
  if (A) { A.addListener('resume', cb); return; }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cb(); });
}
/* cb()가 true를 돌려주면 처리한 것이고, 아니면 앱을 닫는다 */
export function onBack(cb) {
  const A = plugin('App'); if (!A) return;
  A.addListener('backButton', () => { if (!cb() && A.exitApp) A.exitApp(); });
}
