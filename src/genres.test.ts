import { describe, it, expect } from 'vitest';
import { GENRES, normalizeGenre, allGenres } from './genres';
import type { Book } from './types';

const mk = (genre: string, status: Book['status'] = 'unread'): Book => ({
  id: genre + status + Math.random(), title: 't', author: 'a', genre, color: '#000', status, addedAt: 0,
});

describe('normalizeGenre', () => {
  it('maps common categories', () => {
    expect(normalizeGenre(['Fiction / Science Fiction / Space Opera'])).toBe('Sci-Fi');
    expect(normalizeGenre(['Juvenile Fiction / Fantasy & Magic'])).toBe('Fantasy');
    expect(normalizeGenre(['Biography & Autobiography'])).toBe('Memoir/Biography');
    expect(normalizeGenre(['Detective and mystery stories'])).toBe('Mystery/Thriller');
    expect(normalizeGenre(['Self-Help'])).toBe('Self-help');
    expect(normalizeGenre(['Fiction / General'])).toBe('Fiction');
    expect(normalizeGenre(['Business & Economics'])).toBe('Non-fiction');
  });
  it('Other for no match or empty', () => {
    expect(normalizeGenre(['Cooking'])).toBe('Other');
    expect(normalizeGenre([])).toBe('Other');
  });
});

describe('allGenres', () => {
  it('rule: genres with >=1 unread first (GENRES order, then custom in first-seen order), then the rest (GENRES order, then custom)', () => {
    const books = [
      mk('Romance'), mk('Fantasy', 'finished'), mk('Zine'), mk('Poetry', 'finished'), mk('Fiction', 'reading'),
    ];
    const r = allGenres(books);
    expect(r.slice(0, 2)).toEqual(['Romance', 'Zine']);
    expect(r.slice(2)).toEqual(GENRES.filter((g) => g !== 'Romance').concat(['Poetry']));
    expect(new Set(r).size).toBe(r.length);
  });
  it('returns GENRES for empty library', () => {
    expect(allGenres([])).toEqual([...GENRES]);
  });
});
