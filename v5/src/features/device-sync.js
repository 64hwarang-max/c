/* features/device-sync — 기록이 바뀌면 위젯과 알림을 지금 상태로 맞춘다. 읽기만 하고 기록 문서는 쓰지 않는다.
   켜고 끄는 값은 prefs.devices { widget, remind }(기본 켬). 앱이 아니면 아무것도 하지 않는다. */
import { K } from '../core/schema.js';
import { addD } from '../core/date.js';
import { arr } from '../core/util.js';
import { widgetPayload, reminders } from '../domain/device.js';
import { normTasks } from '../domain/tasks.js';
import { pushWidget } from '../native/widget.js';
import { syncNotifications } from '../native/notify.js';
import { isNative } from '../native/bridge.js';

export const deviceOn = (prefs, key) => !(prefs && prefs.devices && prefs.devices[key] === false);

export function createDeviceSync({ store, ctx }) {
  return {
    available: () => isNative(),
    async run() {
      if (!isNative()) return { skipped: true };
      const c = ctx(), prefs = (await store.get(K.prefs)) || {}, tasks = normTasks(await store.get(K.tasks));
      const rd = await store.get(K.rules), rules = arr(rd && rd.list), out = {};
      if (deviceOn(prefs, 'widget')) out.widget = await pushWidget(widgetPayload({ day: await store.loadDay(c.today), tasks, rules, today: c.today, nowHM: c.nowHM }));
      if (deviceOn(prefs, 'remind')) {
        const cache = {}; for (let i = 0; i < 2; i++) { const d = addD(c.today, i); cache[d] = await store.loadDay(d); }
        out.remind = await syncNotifications(reminders({ getDay: d => cache[d], tasks, rules, today: c.today, now: Date.now() }));
      }
      return out;
    },
  };
}
