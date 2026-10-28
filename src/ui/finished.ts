import { store } from '../store';
import { finishedNewestFirst, formatDate } from '../listLogic';
import { miniCover } from './bookCard';
import { openSheet } from './drawer';
import { revealList } from './fx';
import { toast } from './toast';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

export function openFinished(): void {
  const sheet = openSheet({ title: 'Finished', className: 'sheet-list', onClose: () => unsub() });
  const list = el('div', 'lib-list');
  sheet.body.append(list);
  let first = true;
  const render = (): void => {
    list.replaceChildren();
    const books = finishedNewestFirst(store.books());
    if (!books.length) {
      list.append(el('p', 'list-empty', 'Nothing finished yet. Go read something!'));
      return;
    }
    for (const book of books) {
      const r = el('div', 'lib-row');
      const info = el('div', 'lib-info');
      info.append(el('span', 'lib-title', book.title), el('span', 'lib-author', book.author));
      if (book.finishedAt) info.append(el('span', 'lib-date', `finished ${formatDate(book.finishedAt)}`));
      const acts = el('div', 'lib-acts');
      const b = el('button', 'text-act', 'Move back to roulette');
      b.type = 'button';
      b.addEventListener('click', () => {
        store.setStatus(book.id, 'unread');
        toast('Back in the roulette', 'ok');
      });
      acts.append(b);
      info.append(acts);
      r.append(miniCover(book), info);
      list.append(r);
    }
    if (first) revealList([...list.children]);
    first = false;
  };
  const unsub = store.subscribe(render);
  render();
}
