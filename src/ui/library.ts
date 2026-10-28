import type { Book } from '../types';
import { store } from '../store';
import { groupUnread } from '../listLogic';
import { bookForm } from './bookForm';
import { openSheet } from './drawer';
import { askConfirm } from './prompt';
import { toast } from './toast';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const btn = (cls: string, text: string, onClick: () => void): HTMLButtonElement => {
  const b = el('button', `btn btn-sm ${cls}`, text);
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

function row(book: Book, i: number): HTMLElement {
  const r = el('div', 'lib-row');
  r.style.setProperty('--i', String(Math.min(i, 12)));
  const dot = el('span', 'lib-dot');
  dot.style.background = book.color;
  const info = el('div', 'lib-info');
  info.append(el('span', 'lib-title', book.title), el('span', 'lib-author', book.author));
  const acts = el('div', 'lib-acts');
  acts.append(
    btn('btn-soft', 'Edit', () => openEdit(book)),
    btn('btn-soft', 'Finished', () => {
      store.setStatus(book.id, 'finished');
      toast('Marked finished', 'ok');
    }),
    btn('btn-ghost lib-del', 'Delete', () => {
      void askConfirm({ message: ['Delete ', { em: book.title }, '?'], ok: 'Delete', cancel: 'Keep' }).then((ok) => {
        if (ok) store.remove(book.id);
      });
    }),
  );
  r.append(dot, info, acts);
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

  const render = (): void => {
    list.replaceChildren();
    const groups = groupUnread(store.books(), query);
    if (!groups.length) {
      list.append(el('p', 'list-empty', query.trim() ? 'No matches' : 'No unread books — add some!'));
      return;
    }
    let i = 0;
    for (const g of groups) {
      list.append(el('h3', 'lib-genre', g.genre));
      for (const b of g.books) list.append(row(b, i++));
    }
  };
  search.addEventListener('input', () => { query = search.value; render(); });
  const unsub = store.subscribe(render);
  render();
}
