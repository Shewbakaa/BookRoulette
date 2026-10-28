import type { Book } from '../types';
import { store } from '../store';
import { bannerKey } from '../reading';
import { play, reducedMotion, sparks } from './fx';

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
  thumb.setAttribute('aria-hidden', 'true');
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

  const text = document.createElement('div');
  text.className = 'rb-text';
  const label = document.createElement('div');
  label.className = 'rb-label';
  label.textContent = 'Now reading';
  const title = document.createElement('div');
  title.className = 'rb-title';
  title.textContent = book.title;
  text.append(label, title);

  const btns = document.createElement('div');
  btns.className = 'rb-btns';
  const fin = document.createElement('button');
  fin.type = 'button';
  fin.className = 'rb-act';
  fin.textContent = 'Finished it';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'rb-act';
  back.textContent = 'Put back';
  btns.append(fin, back);

  fin.addEventListener('click', () => {
    const s = state.get(root);
    if (s) s.exit = 'finished';
    void sparks(rb, { burst: true });
    store.setStatus(book.id, 'finished');
  });
  back.addEventListener('click', () => {
    const s = state.get(root);
    if (s) s.exit = 'putback';
    store.setStatus(book.id, 'unread');
  });

  rb.append(thumb, text, btns);
  wrap.append(rb);
  return wrap;
}

function leave(wrap: HTMLElement, exit: Exit): void {
  wrap.classList.add('out');
  wrap.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  if (reducedMotion()) {
    wrap.remove();
    return;
  }
  // "Finished it" lingers a beat so the spark burst can play before the line lifts away.
  const kf = exit === 'putback' ? { opacity: 0, y: 10 } : { opacity: 0, y: -10 };
  void play(wrap, kf, { duration: 0.3, delay: exit === 'finished' ? 0.45 : 0, ease: 'easeIn' }).then(() => wrap.remove());
}

/**
 * Show (or hide) the "Now reading" line in `root`. Safe to call on every store change:
 * it only re-renders when the shown book changes, and animates in/out.
 */
export function renderReadingBanner(root: HTMLElement, book: Book | undefined): void {
  const key = bannerKey(book);
  const prev = state.get(root);
  if (prev && prev.key === key) return;
  if (!prev && !book) return;

  const current = root.querySelector<HTMLElement>('.rb-wrap:not(.out)');
  if (current) {
    // Swapping books: the old line leaves on top of the new one instead of stacking above it.
    if (book) current.classList.add('swapped');
    leave(current, prev?.exit ?? 'plain');
  }

  if (book) {
    const wrap = build(root, book);
    root.append(wrap);
    // A first paint with a book already reading shouldn't animate.
    if (prev && !reducedMotion()) {
      wrap.style.opacity = '0';
      void play(wrap, { opacity: [0, 1], y: [-8, 0] }, { duration: 0.4, delay: current ? 0.25 : 0, ease: 'easeOut' })
        .then(() => { wrap.style.opacity = '1'; });
    }
  }
  state.set(root, { key, exit: 'plain' });
}
