import type { Book } from './types';

export const GENRES: readonly string[] = [
  'Fiction', 'Fantasy', 'Sci-Fi', 'Mystery/Thriller', 'Romance',
  'Non-fiction', 'History', 'Memoir/Biography', 'Self-help', 'Other',
];

// Order matters: specific genres first, generic Fiction / Non-fiction last.
const RULES: [string, RegExp][] = [
  ['Sci-Fi', /science fiction|sci-?fi|dystopi|space opera|cyberpunk/],
  ['Fantasy', /fantasy|magic|dragons|wizard/],
  ['Mystery/Thriller', /mystery|thriller|detective|crime|suspense|noir/],
  ['Romance', /romance|love stor/],
  ['Memoir/Biography', /biograph|memoir|autobiograph/],
  ['Self-help', /self-help|self help|personal development|self-improvement|self improvement/],
  ['History', /history|historical|war\b/],
  ['Fiction', /fiction|novel|stories|literature/],
  ['Non-fiction', /non-?fiction|business|economics|science|psychology|philosophy|politic|religion|social science|technology|essays/],
];

/** Maps raw category/subject strings to one app genre; first matching rule wins. */
export function normalizeGenre(raw: string[]): string {
  const text = raw.join(' | ').toLowerCase();
  for (const [genre, re] of RULES) if (re.test(text)) return genre;
  return 'Other';
}

/**
 * Rule: genres with at least one unread book come first (GENRES order, then custom
 * genres in first-seen order); all remaining genres follow in the same order.
 */
export function allGenres(books: Book[]): string[] {
  const all = [...GENRES];
  for (const b of books) if (b.genre && !all.includes(b.genre)) all.push(b.genre);
  const unread = new Set(books.filter((b) => b.status === 'unread').map((b) => b.genre));
  return [...all.filter((g) => unread.has(g)), ...all.filter((g) => !unread.has(g))];
}
