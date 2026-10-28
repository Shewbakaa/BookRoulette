import { describe, it, expect } from 'vitest';
import { poolFor, pickWinner, ringFor, spinTargetAngle, RING_MAX } from './pick';
import type { Book } from './types';

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mk = (i: number, over: Partial<Book> = {}): Book => ({
  id: `b${i}`, title: `T${i}`, author: 'A', genre: 'Fiction', color: '#fff',
  status: 'unread', addedAt: 1000 - i, ...over,
});
const mod = (x: number) => ((x % 360) + 360) % 360;

describe('poolFor', () => {
  const books = [
    mk(1), mk(2, { status: 'reading' }), mk(3, { status: 'finished' }),
    mk(4, { genre: 'Fantasy' }),
  ];
  it('excludes reading/finished; empty set = all genres', () => {
    expect(poolFor(books, new Set()).map((b) => b.id)).toEqual(['b1', 'b4']);
  });
  it('filters by genre', () => {
    expect(poolFor(books, new Set(['Fantasy'])).map((b) => b.id)).toEqual(['b4']);
  });
});

describe('pickWinner', () => {
  it('null for empty, the book for single', () => {
    expect(pickWinner([])).toBeNull();
    const b = mk(1);
    expect(pickWinner([b])).toBe(b);
  });
});

describe('ringFor', () => {
  it('30 books -> 12 incl. winner over 50 seeded runs', () => {
    const pool = Array.from({ length: 30 }, (_, i) => mk(i));
    for (let s = 0; s < 50; s++) {
      const rng = mulberry32(s);
      const w = pickWinner(pool, rng)!;
      const ring = ringFor(pool, w, rng);
      expect(ring).toHaveLength(RING_MAX);
      expect(ring).toContain(w);
      expect(new Set(ring.map((b) => b.id)).size).toBe(RING_MAX);
    }
  });
  it('3 books -> 3', () => {
    const pool = [mk(1), mk(2), mk(3)];
    expect(ringFor(pool, pool[1], mulberry32(1))).toHaveLength(3);
  });
  it('no winner: stable, 12 newest by addedAt desc', () => {
    const pool = Array.from({ length: 30 }, (_, i) => mk(i));
    const a = ringFor(pool, null);
    expect(a).toHaveLength(12);
    expect(a.map((b) => b.id)).toEqual(ringFor([...pool].reverse(), null).map((b) => b.id));
    expect(a[0].addedAt).toBeGreaterThanOrEqual(a[1].addedAt);
    const newest = mk(99, { addedAt: 5000 });
    expect(ringFor([...pool, newest], null)[0].id).toBe('b99');
  });
});

describe('spinTargetAngle', () => {
  it('lands winner at front, rotating negatively', () => {
    const x = spinTargetAngle(0, 8, 3, 4);
    expect(mod(x)).toBe(225);
    expect(x).toBeLessThanOrEqual(-1440);
    const y = spinTargetAngle(x, 8, 3, 4);
    expect(y).toBeLessThan(x);
    expect(mod(y)).toBe(225);
    expect(y).toBeLessThanOrEqual(x - 1440);
  });
  it('winner index 0 from 0', () => {
    const x = spinTargetAngle(0, 5, 0, 2);
    expect(mod(x)).toBe(0);
    expect(x).toBeLessThanOrEqual(-720);
  });
});
