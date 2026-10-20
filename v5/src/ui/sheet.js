/* ui/sheet — 아래에서 올라오는 시트와 토스트. 한 번에 시트 하나만 연다. */
import { esc } from './html.js';

let cur = null;
export function openSheet({ title, html, onMount, onClose }) {
  closeSheet();
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><b>${esc(title)}</b><button type="button" class="ico" data-sheet-x aria-label="닫기">✕</button></div><div class="sheet-body">${html}</div></div>`;
  const opener = document.activeElement;
  const close = () => { if (cur !== back) return; cur = null; back.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); if (opener && opener.focus) { try { opener.focus(); } catch (e) { /* 무시 */ } } };
  const onKey = e => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-sheet-x]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back); cur = back;
  const first = back.querySelector('input:not([type=hidden]),select,textarea,button'); if (first && !first.matches('[data-sheet-x]')) first.focus();
  if (onMount) onMount(back.querySelector('.sheet-body'), close);
  return { el: back, close };
}
export function closeSheet() { if (cur) { const b = cur; b.querySelector('[data-sheet-x]').click(); if (cur === b) { cur = null; b.remove(); } } }

let tt = 0;
export function toast(msg, action) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" class="tbtn">${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  if (action) el.querySelector('.tbtn').onclick = () => { el.hidden = true; action.fn(); };
  clearTimeout(tt); tt = setTimeout(() => { el.hidden = true; }, action ? 8000 : 3500);
}
