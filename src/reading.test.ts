import { describe, it, expect } from 'vitest';
import { bannerKey, needsSwap, swapMessage } from './reading';
import type { Book } from './types';

const mk = (id: string, over: Partial<Book> = {}): Book => ({
  id, title: `T-${id}`, author: 'A', genre: 'Fiction', color: '#123456', status: 'unread', addedAt: 1, ...over,
});

describe('needsSwap', () => {
  it('is false when nothing is being read', () => {
    expect(needsSwap(undefined, mk('a'))).toBe(false);
  });
  it('is false when the pick is already the reading book', () => {
    expect(needsSwap(mk('a', { status: 'reading' }), mk('a'))).toBe(false);
  });
  it('is true when a different book is being read', () => {
    expect(needsSwap(mk('b', { status: 'reading' }), mk('a'))).toBe(true);
  });
});

describe('swapMessage', () => {
  it('emphasises the current title and keeps the exact copy', () => {
    const parts = swapMessage('Dune');
    expect(parts).toEqual(['Swap with ', { em: 'Dune' }, '? It goes back in the roulette.']);
  });
  it('keeps markup-looking titles as plain data', () => {
    expect(swapMessage('<b>x</b>')[1]).toEqual({ em: '<b>x</b>' });
  });
});

describe('bannerKey', () => {
  it('is empty with no book and changes when shown fields change', () => {
    expect(bannerKey(undefined)).toBe('');
    const a = mk('a');
    expect(bannerKey(a)).toBe(bannerKey({ ...a, status: 'reading' }));
    expect(bannerKey(a)).not.toBe(bannerKey({ ...a, title: 'New' }));
    expect(bannerKey(a)).not.toBe(bannerKey(mk('b')));
  });
});
