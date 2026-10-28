import type { Book } from './types';
import { allGenres } from './genres';

export interface GenreGroup { genre: string; books: Book[] }

/** Unread books matching the query (title/author, case-insensitive), grouped by genre in allGenres order. */
export function groupUnread(books: Book[], query: string): GenreGroup[] {
  const q = query.trim().toLowerCase();
  const unread = books.filter(
    (b) => b.status === 'unread' && (!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)),
  );
  const out: GenreGroup[] = [];
  for (const genre of allGenres(books)) {
    const list = unread.filter((b) => b.genre === genre);
    if (list.length) out.push({ genre, books: list });
  }
  return out;
}

/** Finished books, most recently finished first. */
export function finishedNewestFirst(books: Book[]): Book[] {
  return books.filter((b) => b.status === 'finished').sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** bookroulette-backup-YYYY-MM-DD.json using the local date. */
export function backupFilename(d: Date): string {
  return `bookroulette-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** Short local date such as "Oct 27, 2026". */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
