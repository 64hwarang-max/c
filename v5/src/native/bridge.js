/* native/bridge — Capacitor 연결부를 꺼내는 유일한 문. 웹에서는 모두 null이라 호출 쪽이 조용히 건너뛴다. */
export const isNative = () => { try { return !!(globalThis.Capacitor && (globalThis.Capacitor.isNativePlatform ? globalThis.Capacitor.isNativePlatform() : true)); } catch (e) { return false; } };
export function plugin(name) {
  if (!isNative()) return null;
  const C = globalThis.Capacitor;
  return (C.Plugins && C.Plugins[name]) || (C.registerPlugin && C.registerPlugin(name)) || null;
}
