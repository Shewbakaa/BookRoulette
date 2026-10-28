import { store } from '../store';
import { finishedNewestFirst, formatDate } from '../listLogic';
import { openSheet } from './drawer';
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
  const render = (): void => {
    list.replaceChildren();
    const books = finishedNewestFirst(store.books());
    if (!books.length) {
      list.append(el('p', 'list-empty', 'Nothing finished yet — go read something!'));
      return;
    }
    books.forEach((book, i) => {
      const r = el('div', 'lib-row');
      r.style.setProperty('--i', String(Math.min(i, 12)));
      const dot = el('span', 'lib-dot');
      dot.style.background = book.color;
      const info = el('div', 'lib-info');
      info.append(el('span', 'lib-title', book.title), el('span', 'lib-author', book.author));
      if (book.finishedAt) info.append(el('span', 'lib-date', `finished ${formatDate(book.finishedAt)}`));
      const acts = el('div', 'lib-acts');
      const b = el('button', 'btn btn-sm btn-soft', 'Move back to roulette');
      b.type = 'button';
      b.addEventListener('click', () => {
        store.setStatus(book.id, 'unread');
        toast('Back in the roulette', 'ok');
      });
      acts.append(b);
      r.append(dot, info, acts);
      list.append(r);
    });
  };
  const unsub = store.subscribe(render);
  render();
}
