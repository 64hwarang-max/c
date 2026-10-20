/* native/notify — 로컬 알림(LocalNotifications). 우리가 만든 번호 범위(1억~2억)만 지우고 다시 맞춘다. */
import { plugin } from './bridge.js';
import { ID_BASE, ID_SPAN } from '../domain/device.js';

export async function syncNotifications(list) {
  const N = plugin('LocalNotifications'); if (!N) return { ok: false, reason: 'web' };
  try {
    const perm = await N.checkPermissions(); let st = perm && perm.display;
    if (st !== 'granted') { const r = await N.requestPermissions(); st = r && r.display; }
    if (st !== 'granted') return { ok: false, reason: 'denied' };
    const pend = await N.getPending(), mine = ((pend && pend.notifications) || []).filter(n => n.id >= ID_BASE && n.id < ID_BASE + ID_SPAN);
    if (mine.length) await N.cancel({ notifications: mine.map(n => ({ id: n.id })) });
    if (list.length) await N.schedule({ notifications: list.map(x => ({ id: x.id, title: x.title, body: x.body, schedule: { at: new Date(x.at), allowWhileIdle: true } })) });
    return { ok: true, count: list.length };
  } catch (e) { return { ok: false, reason: e.message }; }
}
