import { describe, it, expect, vi } from 'vitest';
import { resolveScan, cleanInput } from './addFlow';
import type { Book, BookInput } from './types';

const book = (over: Partial<Book> = {}): Book => ({
  id: '1', title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi', color: '#fff',
  status: 'unread', addedAt: 1, isbn: '9780441172719', ...over,
});
const dune: BookInput = { title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi', coverUrl: 'https://x/c.jpg' };

describe('resolveScan', () => {
  it('ignores non-ISBN codes without a lookup', async () => {
    const lookup = vi.fn();
    expect(await resolveScan('036000291452', { books: () => [], lookup })).toEqual({ kind: 'invalid' });
    expect(await resolveScan('hello', { books: () => [], lookup })).toEqual({ kind: 'invalid' });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('returns found with the normalized ISBN', async () => {
    const lookup = vi.fn().mockResolvedValue(dune);
    const r = await resolveScan('0-441-17271-7', { books: () => [], lookup });
    expect(lookup).toHaveBeenCalledWith('9780441172719');
    expect(r).toEqual({ kind: 'found', isbn: '9780441172719', input: { ...dune, isbn: '9780441172719' } });
  });

  it('returns notFound (ISBN kept) when lookup is null or throws', async () => {
    expect(await resolveScan('9780441172719', { books: () => [], lookup: async () => null }))
      .toEqual({ kind: 'notFound', isbn: '9780441172719' });
    expect(await resolveScan('9780441172719', { books: () => [], lookup: async () => { throw new Error('offline'); } }))
      .toEqual({ kind: 'notFound', isbn: '9780441172719' });
  });

  it.each(['unread', 'reading', 'finished'] as const)('flags a %s book as duplicate without a lookup', async (status) => {
    const lookup = vi.fn();
    const existing = book({ status });
    const r = await resolveScan('0441172717', { books: () => [existing], lookup });
    expect(r).toEqual({ kind: 'duplicate', isbn: '9780441172719', existing });
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe('cleanInput', () => {
  it('requires title and author', () => {
    expect(cleanInput({ title: ' ', author: '', genre: 'Fiction' })).toEqual({ ok: false, missing: ['title', 'author'] });
    expect(cleanInput({ title: 'X', author: '  ', genre: 'Fiction' })).toEqual({ ok: false, missing: ['author'] });
  });

  it('trims, collapses spaces, defaults blank genre to Other, drops blank ISBN', () => {
    expect(cleanInput({ title: '  The   Hobbit ', author: ' Tolkien ', genre: '  ', isbn: ' ' }))
      .toEqual({ ok: true, input: { title: 'The Hobbit', author: 'Tolkien', genre: 'Other' } });
  });

  it('keeps ISBN, custom genre and cover', () => {
    expect(cleanInput({ title: 'A', author: 'B', genre: 'Cozy  Fantasy', isbn: '978-0441172719', coverUrl: 'u' }))
      .toEqual({ ok: true, input: { title: 'A', author: 'B', genre: 'Cozy Fantasy', isbn: '978-0441172719', coverUrl: 'u' } });
  });
});
