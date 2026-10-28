import { describe, expect, it } from 'vitest';
import type { Book } from './types';
import { backupFilename, finishedNewestFirst, groupUnread } from './listLogic';

const mk = (o: Partial<Book> & { id: string }): Book => ({
  title: 'T', author: 'A', genre: 'Fiction', color: '#fff', status: 'unread', addedAt: 0, ...o,
});

describe('groupUnread', () => {
  const books = [
    mk({ id: '1', title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi' }),
    mk({ id: '2', title: 'Emma', author: 'Jane Austen', genre: 'Romance' }),
    mk({ id: '3', title: 'Hobbit', author: 'Tolkien', genre: 'Fantasy' }),
    mk({ id: '4', title: 'Reading', genre: 'Fantasy', status: 'reading' }),
    mk({ id: '5', title: 'Done', genre: 'Fantasy', status: 'finished' }),
    mk({ id: '6', title: 'Zed', genre: 'Zine' }),
  ];
  it('groups unread only in genre order', () => {
    expect(groupUnread(books, '').map((g) => g.genre)).toEqual(['Fantasy', 'Sci-Fi', 'Romance', 'Zine']);
    expect(groupUnread(books, '').flatMap((g) => g.books.map((b) => b.id))).not.toContain('4');
  });
  it('searches title and author case-insensitively', () => {
    expect(groupUnread(books, 'DUNE')[0].books[0].id).toBe('1');
    expect(groupUnread(books, ' austen ')[0].books[0].id).toBe('2');
    expect(groupUnread(books, 'nope')).toEqual([]);
  });
});

describe('finishedNewestFirst', () => {
  it('sorts by finishedAt desc', () => {
    const l = finishedNewestFirst([
      mk({ id: 'a', status: 'finished', finishedAt: 1 }),
      mk({ id: 'b', status: 'finished', finishedAt: 5 }),
      mk({ id: 'c' }),
    ]);
    expect(l.map((b) => b.id)).toEqual(['b', 'a']);
  });
});

describe('backupFilename', () => {
  it('uses local date, zero padded', () => {
    expect(backupFilename(new Date(2026, 0, 5, 23, 59))).toBe('bookroulette-backup-2026-01-05.json');
  });
});
