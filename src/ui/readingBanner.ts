import type { Book } from '../types';
import { store } from '../store';
import { bannerKey } from '../reading';
import { afterAnim, burstFrom } from './fx';

type Exit = 'finished' | 'putback' | 'plain';
const state = new WeakMap<HTMLElement, { key: string; exit: Exit }>();

function build(root: HTMLElement, book: Book): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'rb-wrap';
  const rb = document.createElement('div');
  rb.className = 'rb';

  const thumb = document.createElement('div');
  thumb.className = 'rb-thumb';
  thumb.style.setProperty('--c', book.color);
  if (book.coverUrl) {
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => img.remove();
    img.onload = () => { if (img.naturalWidth < 8) img.remove(); };
    img.src = book.coverUrl;
    thumb.append(img);
  }
  const glyph = document.createElement('span');
  glyph.className = 'rb-glyph';
  glyph.textContent = '📖';
  thumb.prepend(glyph);

  const text = document.createElement('div');
  text.className = 'rb-text';
  const label = document.createElement('div');
  label.className = 'rb-label';
  label.textContent = 'Currently reading';
  const title = document.createElement('div');
  title.className = 'rb-title';
  title.textContent = book.title;
  text.append(label, title);

  const btns = document.createElement('div');
  btns.className = 'rb-btns';
  const fin = document.createElement('button');
  fin.type = 'button';
  fin.className = 'btn btn-hot btn-sm';
  fin.textContent = 'Finished it!';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn btn-ghost btn-sm';
  back.textContent = 'Put back';
  btns.append(fin, back);

  fin.addEventListener('click', () => {
    const s = state.get(root);
    if (s) s.exit = 'finished';
    burstFrom(fin, 'medium');
    store.setStatus(book.id, 'finished');
  });
  back.addEventListener('click', () => {
    const s = state.get(root);
    if (s) s.exit = 'putback';
    store.setStatus(book.id, 'unread');
  });

  rb.append(thumb, text, btns);
  const clip = document.createElement('div');
  clip.className = 'rb-clip';
  clip.append(rb);
  wrap.append(clip);
  return wrap;
}

function leave(wrap: HTMLElement, exit: Exit): void {
  wrap.classList.add('out', `out-${exit}`);
  wrap.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  void afterAnim(wrap, exit === 'finished' ? 700 : 450).then(() => wrap.remove());
}

/**
 * Show (or hide) the "Currently reading" banner in `root`. Safe to call on every store change:
 * it only re-renders when the shown book changes, and animates in/out.
 */
export function renderReadingBanner(root: HTMLElement, book: Book | undefined): void {
  const key = bannerKey(book);
  const prev = state.get(root);
  if (prev && prev.key === key) return;
  if (!prev && !book) return;

  const current = root.querySelector<HTMLElement>('.rb-wrap:not(.out)');
  if (current) leave(current, prev?.exit ?? 'plain');

  if (book) {
    const wrap = build(root, book);
    // A first paint with a book already reading shouldn't animate.
    if (!prev) wrap.classList.add('still');
    root.append(wrap);
  }
  state.set(root, { key, exit: 'plain' });
}
