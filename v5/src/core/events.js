/* core/events — 데이터가 바뀌면 알리는 통로. 화면은 여기서 'change'를 받아 자기 부분만 다시 그린다. */
export function createBus() {
  const map = new Map();
  return {
    on(type, fn) { if (!map.has(type)) map.set(type, new Set()); map.get(type).add(fn); return () => map.get(type).delete(fn); },
    emit(type, detail) { (map.get(type) || []).forEach(fn => { try { fn(detail); } catch (e) { console.error('[events]', type, e); } }); },
  };
}
