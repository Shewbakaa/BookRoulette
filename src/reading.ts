import type { Book } from './types';

/** True when starting `pick` would bump a different book that is already being read. */
export function needsSwap(current: Book | undefined, pick: Book): current is Book {
  return !!current && current.id !== pick.id;
}

/** Message parts for the swap prompt: "Swap with *{title}*? It goes back in the roulette." */
export function swapMessage(currentTitle: string): (string | { em: string })[] {
  return ['Swap with ', { em: currentTitle }, '? It goes back in the roulette.'];
}

/** Identity of what the reading banner shows; re-render only when this changes. */
export function bannerKey(book: Book | undefined): string {
  return book ? `${book.id}|${book.title}|${book.author}|${book.coverUrl ?? ''}|${book.color}` : '';
}
