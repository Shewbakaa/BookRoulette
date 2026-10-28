import type { Book } from '../types';
import { readableText, clothColor } from './ringMath';

/**
 * A book "cover": the real cover image when it loads, otherwise a coloured card
 * with title + author (the fallback is always underneath, so a 404 just reveals it).
 */
export function bookCard(book: Book): HTMLElement {
  const el = document.createElement('div');
  el.className = 'book-card';
  const cloth = clothColor(book.color);
  el.style.setProperty('--c', cloth);
  el.style.setProperty('--ink', readableText(cloth));

  const fb = document.createElement('div');
  fb.className = 'bc-fallback';
  const t = document.createElement('span');
  t.className = 'bc-title';
  t.textContent = book.title;
  const a = document.createElement('span');
  a.className = 'bc-author';
  a.textContent = book.author;
  fb.append(t, a);
  el.append(fb);

  if (book.coverUrl) {
    const img = document.createElement('img');
    img.className = 'bc-img';
    img.alt = `${book.title} cover`;
    img.decoding = 'async';
    img.draggable = false;
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => img.remove();
    img.onload = () => {
      if (img.naturalWidth < 8) img.remove(); // placeholder pixels
      else el.classList.add('has-img');
    };
    img.src = book.coverUrl;
    el.append(img);
  }

  return el;
}

/** A small cover thumbnail for list rows: the cover image over the book's cloth colour. */
export function miniCover(book: Book): HTMLElement {
  const el = document.createElement('div');
  el.className = 'mini-cover';
  el.style.setProperty('--c', clothColor(book.color));
  el.setAttribute('aria-hidden', 'true');
  if (book.coverUrl) {
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.draggable = false;
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => img.remove();
    img.onload = () => { if (img.naturalWidth < 8) img.remove(); };
    img.src = book.coverUrl;
    el.append(img);
  }
  return el;
}
