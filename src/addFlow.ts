import type { Book, BookInput } from './types';
import { normalizeIsbn } from './isbn';

/** User-facing copy for the add flow (kept here so tests and UI agree). */
export const MSG = {
  lookingUp: 'Looking up…',
  found: 'Found it!',
  notFound: 'Couldn’t find it — add it manually',
  duplicate: 'Already in your library',
  manual: 'Add a book',
} as const;

export type ScanOutcome =
  | { kind: 'invalid' }
  | { kind: 'duplicate'; isbn: string; existing: Book }
  | { kind: 'found'; isbn: string; input: BookInput }
  | { kind: 'notFound'; isbn: string };

export interface ScanDeps {
  books(): Book[];
  lookup(isbn: string): Promise<BookInput | null>;
}

/**
 * Decides what a scanned code means. Non-ISBNs are 'invalid' (no lookup); a book already in
 * the library (any status) is a 'duplicate' (no lookup); otherwise the lookup decides.
 * Never throws: a failing lookup counts as 'notFound'.
 */
export async function resolveScan(raw: string, deps: ScanDeps): Promise<ScanOutcome> {
  const isbn = normalizeIsbn(raw);
  if (!isbn) return { kind: 'invalid' };
  const existing = deps.books().find((b) => b.isbn === isbn);
  if (existing) return { kind: 'duplicate', isbn, existing };
  let input: BookInput | null = null;
  try { input = await deps.lookup(isbn); } catch { input = null; }
  if (!input) return { kind: 'notFound', isbn };
  return { kind: 'found', isbn, input: { ...input, isbn } };
}

/** Cleans form values into a BookInput, or returns the list of missing required fields. */
export function cleanInput(v: { title: string; author: string; genre: string; isbn?: string; coverUrl?: string }):
  { ok: true; input: BookInput } | { ok: false; missing: ('title' | 'author')[] } {
  const title = v.title.trim().replace(/\s+/g, ' ');
  const author = v.author.trim().replace(/\s+/g, ' ');
  const missing: ('title' | 'author')[] = [];
  if (!title) missing.push('title');
  if (!author) missing.push('author');
  if (missing.length) return { ok: false, missing };
  const genre = v.genre.trim().replace(/\s+/g, ' ') || 'Other';
  const input: BookInput = { title, author, genre };
  const isbn = v.isbn?.trim();
  if (isbn) input.isbn = isbn;
  if (v.coverUrl) input.coverUrl = v.coverUrl;
  return { ok: true, input };
}
