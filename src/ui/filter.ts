import type { Book } from '../types';
import { allGenres } from '../genres';

export interface Filter {
  /** Rebuild chips from the library (keeps the selection where still valid). */
  update(books: Book[]): void;
  selected(): Set<string>;
}

/** Horizontally scrollable, multi-select genre chips. "All" clears the selection. */
export function createFilter(root: HTMLElement, onChange: (genres: Set<string>) => void): Filter {
  const sel = new Set<string>();
  root.classList.add('filter');
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Filter by genre');

  const chip = (label: string, value: string, count: number | null, on: boolean): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (on ? ' on' : '') + (count === 0 ? ' zero' : '');
    b.dataset.genre = value;
    b.setAttribute('aria-pressed', String(on));
    b.textContent = label;
    if (count !== null) {
      const c = document.createElement('span');
      c.className = 'count';
      c.textContent = String(count);
      b.append(c);
    }
    return b;
  };

  let books: Book[] = [];
  const draw = (): void => {
    const counts = new Map<string, number>();
    for (const b of books) if (b.status === 'unread') counts.set(b.genre, (counts.get(b.genre) ?? 0) + 1);
    const genres = allGenres(books);
    for (const g of [...sel]) if (!genres.includes(g)) sel.delete(g);
    const scroll = root.scrollLeft;
    root.replaceChildren(
      chip('All', '', null, sel.size === 0),
      ...genres.map((g) => chip(g, g, counts.get(g) ?? 0, sel.has(g))),
    );
    root.scrollLeft = scroll;
  };

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button.chip');
    if (!b || !root.contains(b)) return;
    const g = b.dataset.genre ?? '';
    if (g === '') {
      if (sel.size === 0) return;
      sel.clear();
    } else if (sel.has(g)) sel.delete(g);
    else sel.add(g);
    draw();
    onChange(new Set(sel));
  });

  return {
    update(next) { books = next; draw(); },
    selected: () => new Set(sel),
  };
}
