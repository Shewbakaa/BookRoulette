import type { BookInput } from './types';
import { normalizeGenre } from './genres';

const https = (u?: string): string | undefined => (u ? u.replace(/^http:\/\//i, 'https://') : undefined);

async function getJson(url: string, f: typeof fetch): Promise<any | null> {
  try {
    const res = await f(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fromGoogle(isbn: string, f: typeof fetch): Promise<BookInput | null> {
  const data = await getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`, f);
  const v = data?.items?.[0]?.volumeInfo;
  if (!v?.title) return null;
  const thumb = https(v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail)?.replace('zoom=1', 'zoom=2');
  return {
    isbn,
    title: String(v.title),
    author: Array.isArray(v.authors) ? v.authors.join(', ') : '',
    genre: normalizeGenre(Array.isArray(v.categories) ? v.categories : []),
    coverUrl: thumb ?? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
  };
}

async function fromOpenLibrary(isbn: string, f: typeof fetch): Promise<BookInput | null> {
  const data = await getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, f);
  const d = data?.[`ISBN:${isbn}`];
  if (!d?.title) return null;
  const subjects: string[] = (d.subjects ?? []).map((s: { name?: string }) => s?.name ?? '').filter(Boolean);
  const authors: string[] = (d.authors ?? []).map((a: { name?: string }) => a?.name ?? '').filter(Boolean);
  return {
    isbn,
    title: String(d.title),
    author: authors.join(', '),
    genre: normalizeGenre(subjects),
    coverUrl: https(d.cover?.large ?? d.cover?.medium) ?? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
  };
}

/** Looks up a normalized ISBN-13. Never throws; returns null when nothing is found. */
export async function lookupIsbn(isbn: string, fetchFn: typeof fetch = fetch): Promise<BookInput | null> {
  try {
    return (await fromGoogle(isbn, fetchFn)) ?? (await fromOpenLibrary(isbn, fetchFn));
  } catch {
    return null;
  }
}
