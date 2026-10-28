import { describe, it, expect, vi } from 'vitest';
import { lookupIsbn } from './lookup';

const ISBN = '9780140328721';
const json = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

const google = {
  totalItems: 1,
  items: [{ volumeInfo: {
    title: 'Fantastic Mr Fox', authors: ['Roald Dahl', 'Quentin Blake'],
    categories: ['Juvenile Fiction / Fantasy & Magic'],
    imageLinks: { thumbnail: 'http://books.google.com/x?id=1&zoom=1&edge=curl' },
  } }],
};
const ol = {
  [`ISBN:${ISBN}`]: {
    title: 'OL Title', authors: [{ name: 'A One' }, { name: 'B Two' }],
    subjects: [{ name: 'Mystery' }], cover: { large: 'http://covers.openlibrary.org/b/id/1-L.jpg' },
  },
};

describe('lookupIsbn', () => {
  it('uses Google Books', async () => {
    const f = (async () => json(google)) as unknown as typeof fetch;
    const r = await lookupIsbn(ISBN, f);
    expect(r).toMatchObject({ isbn: ISBN, title: 'Fantastic Mr Fox', author: 'Roald Dahl, Quentin Blake', genre: 'Fantasy' });
    expect(r!.coverUrl!.startsWith('https://')).toBe(true);
    expect(r!.coverUrl).toContain('zoom=2');
  });
  it('falls back to Open Library when Google has no items', async () => {
    const f = (async (u: string) => u.includes('googleapis') ? json({ totalItems: 0 }) : json(ol)) as unknown as typeof fetch;
    const r = await lookupIsbn(ISBN, f);
    expect(r).toMatchObject({ isbn: ISBN, title: 'OL Title', author: 'A One, B Two', genre: 'Mystery/Thriller' });
    expect(r!.coverUrl).toBe('https://covers.openlibrary.org/b/id/1-L.jpg');
  });
  it('uses Open Library cover when Google has none', async () => {
    const g = { totalItems: 1, items: [{ volumeInfo: { title: 'T', authors: ['X'] } }] };
    const f = (async () => json(g)) as unknown as typeof fetch;
    const r = await lookupIsbn(ISBN, f);
    expect(r!.coverUrl).toBe(`https://covers.openlibrary.org/b/isbn/${ISBN}-L.jpg?default=false`);
  });
  it('null when both have nothing', async () => {
    const f = (async (u: string) => u.includes('googleapis') ? json({ totalItems: 0 }) : json({})) as unknown as typeof fetch;
    expect(await lookupIsbn(ISBN, f)).toBeNull();
  });
  it('falls through to Open Library when Google JSON is malformed', async () => {
    const f = ((u: string) => u.includes('googleapis')
      ? Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('bad')) } as Response)
      : json(ol)) as unknown as typeof fetch;
    const r = await lookupIsbn(ISBN, f);
    expect(r).toMatchObject({ title: 'OL Title', author: 'A One, B Two' });
  });
  it('null when all JSON is malformed', async () => {
    const bad = (() => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('bad')) } as Response)) as unknown as typeof fetch;
    expect(await lookupIsbn(ISBN, bad)).toBeNull();
  });
  it('null when fetch rejects or is not ok', async () => {
    expect(await lookupIsbn(ISBN, (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch)).toBeNull();
    expect(await lookupIsbn(ISBN, (() => Promise.resolve({ ok: false } as Response)) as unknown as typeof fetch)).toBeNull();
  });
});

describe('lookupIsbn timeout', () => {
  it('returns null when every fetch hangs', async () => {
    vi.useFakeTimers();
    try {
      let signals = 0;
      const hang = ((_u: string, init?: RequestInit) => { if (init?.signal) signals++; return new Promise(() => {}); }) as unknown as typeof fetch;
      const p = lookupIsbn(ISBN, hang);
      await vi.advanceTimersByTimeAsync(6000);
      await vi.advanceTimersByTimeAsync(6000);
      expect(await p).toBeNull();
      expect(signals).toBe(2);
    } finally { vi.useRealTimers(); }
  });
});
