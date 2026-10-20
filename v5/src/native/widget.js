/* native/widget — 오늘 위젯 갱신(WidgetBridge). 앱이 아니면 아무 일도 하지 않는다. */
import { plugin } from './bridge.js';
export async function pushWidget(payload) {
  const W = plugin('WidgetBridge'); if (!W) return false;
  try { await W.update({ data: JSON.stringify(payload) }); return true; } catch (e) { return false; }
}
