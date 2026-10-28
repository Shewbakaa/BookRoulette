import type { Book } from '../types';
import { store } from '../store';
import { groupUnread } from '../listLogic';
import { miniCover } from './bookCard';
import { bookForm } from './bookForm';
import { openSheet } from './drawer';
import { revealList } from './fx';
import { askConfirm } from './prompt';
import { toast } from './toast';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/** A brass text action (row-level: Edit, Finished, Delete). */
const btn = (cls: string, text: string, onClick: () => void): HTMLButtonElement => {
  const b = el('button', `text-act${cls ? ` ${cls}` : ''}`, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
};

export function openEdit(book: Book): void {
  const sheet = openSheet({ title: 'Edit book', className: 'sheet-add' });
  const form = bookForm(
    { title: book.title, author: book.author, genre: book.genre, isbn: book.isbn, coverUrl: book.coverUrl },
    (input) => {
      store.update(book.id, { title: input.title, author: input.author, genre: input.genre, isbn: input.isbn ?? '' });
      toast('Saved', 'ok');
      void sheet.close();
    },
  );
  const save = form.querySelector('.bf-save');
  if (save) save.textContent = 'Save changes';
  sheet.body.append(form);
}

function row(book: Book): HTMLElement {
  const r = el('div', 'lib-row');
  const info = el('div', 'lib-info');
  info.append(el('span', 'lib-title', book.title), el('span', 'lib-author', book.author));
  const acts = el('div', 'lib-acts');
  acts.append(
    btn('', 'Edit', () => openEdit(book)),
    btn('', 'Finished', () => {
      store.setStatus(book.id, 'finished');
      toast('Marked finished', 'ok');
    }),
    btn('lib-del', 'Delete', () => {
      void askConfirm({ message: ['Delete ', { em: book.title }, '?'], ok: 'Delete', cancel: 'Keep' }).then((ok) => {
        if (ok) store.remove(book.id);
      });
    }),
  );
  info.append(acts);
  r.append(miniCover(book), info);
  return r;
}

export function openLibrary(): void {
  let query = '';
  const sheet = openSheet({ title: 'Library', className: 'sheet-list', onClose: () => unsub() });
  const search = el('input', 'bf-input lib-search');
  search.type = 'search';
  search.placeholder = 'Search title or author';
  search.autocomplete = 'off';
  search.setAttribute('aria-label', 'Search books');
  const list = el('div', 'lib-list');
  sheet.body.append(search, list);

  let first = true; // stagger the rows in once; later renders (typing, edits) just swap
  const render = (): void => {
    list.replaceChildren();
    const groups = groupUnread(store.books(), query);
    if (!groups.length) {
      list.append(el('p', 'list-empty', query.trim() ? 'No matches' : 'No unread books. Add some!'));
      return;
    }
    for (const g of groups) {
      const sec = el('section', 'lib-sec');
      sec.append(el('h3', 'lib-genre', g.genre));
      for (const b of g.books) sec.append(row(b));
      list.append(sec);
    }
    if (first) revealList([...list.querySelectorAll('.lib-genre, .lib-row')]);
    first = false;
  };
  search.addEventListener('input', () => { query = search.value; render(); });
  const unsub = store.subscribe(render);
  render();
}
