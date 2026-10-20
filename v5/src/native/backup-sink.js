/* native/backup-sink — 변환 전 v4 원본을 파일로 내보낸다. 앱이면 문서 폴더에, 웹이면 내려받기로. */
export function makeBackupSink() {
  return async text => {
    const name = `성장일지-v4원본-${new Date().toISOString().slice(0, 10)}.json`;
    const FS = globalThis.Capacitor && globalThis.Capacitor.Plugins && globalThis.Capacitor.Plugins.Filesystem;
    if (FS) {
      /* 문서 폴더에 먼저 쓰고, 안 되면 앱 전용 폴더로 물러선다. 둘 다 안 되면 오류(변환 중단). */
      try { await FS.mkdir({ path: '성장일지', directory: 'DOCUMENTS', recursive: true }); } catch (e) { /* 이미 있음 */ }
      try { await FS.writeFile({ path: `성장일지/${name}`, data: text, directory: 'DOCUMENTS', encoding: 'utf8' }); return `Documents/성장일지/${name}`; } catch (e) { /* 아래로 */ }
      await FS.writeFile({ path: `백업/${name}`, data: text, directory: 'DATA', encoding: 'utf8', recursive: true });
      return `앱 전용 폴더/백업/${name}`;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    return name;
  };
}
