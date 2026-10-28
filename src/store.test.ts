import { describe, it, expect } from 'vitest';
import { Store } from './store';
import type { BookInput } from './types';

class FakeStorage implements Storage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
}

const inp = (title: string, isbn?: string): BookInput => ({ title, author: 'A', genre: 'Fiction', isbn });
const mk = () => { const s = new FakeStorage(); return { s, store: new Store(s) }; };
const added = (store: Store, i: BookInput) => {
  const r = store.add(i);
  if (!r.ok) throw new Error('dup');
  return r.book;
};

describe('Store', () => {
  it('persists and reloads', () => {
    const { s, store } = mk();
    added(store, inp('Dune', '9780441172719'));
    expect(new Store(s).books().map(b => b.title)).toEqual(['Dune']);
  });
  it('assigns defaults and palette color', () => {
    const { store } = mk();
    const b = added(store, inp('Dune'));
    expect(b.status).toBe('unread');
    expect(b.id).toBeTruthy();
    expect(b.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(added(store, inp('Dune')).color).toBe(b.color);
  });
  it('rejects duplicate ISBN of finished book', () => {
    const { store } = mk();
    const a = added(store, inp('Dune', '9780441172719'));
    store.setStatus(a.id, 'finished');
    const r = store.add(inp('Dune again', '9780441172719'));
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('duplicate'); expect(r.existing.id).toBe(a.id); }
    expect(store.books().length).toBe(1);
  });
  it('books without ISBN never collide', () => {
    const { store } = mk();
    added(store, inp('X'));
    expect(store.add(inp('X')).ok).toBe(true);
  });
  it('startReading swaps current', () => {
    const { store } = mk();
    const a = added(store, inp('A'));
    const b = added(store, inp('B'));
    expect(store.startReading(a.id)).toBeNull();
    const prev = store.startReading(b.id);
    expect(prev?.id).toBe(a.id);
    expect(store.books().find(x => x.id === a.id)!.status).toBe('unread');
    expect(store.current()?.id).toBe(b.id);
  });
  it('setStatus sets and clears finishedAt', () => {
    const { store } = mk();
    const a = added(store, inp('A'));
    store.setStatus(a.id, 'finished');
    expect(store.books()[0].finishedAt).toBeTypeOf('number');
    store.setStatus(a.id, 'unread');
    expect(store.books()[0].finishedAt).toBeUndefined();
  });
  it('update and remove', () => {
    const { store } = mk();
    const a = added(store, inp('A'));
    store.update(a.id, { title: 'B' });
    expect(store.books()[0].title).toBe('B');
    store.remove(a.id);
    expect(store.books().length).toBe(0);
  });
  it('notifies subscribers and unsubscribes', () => {
    const { store } = mk();
    let n = 0;
    const off = store.subscribe(() => n++);
    added(store, inp('A'));
    expect(n).toBe(1);
    off();
    added(store, inp('B'));
    expect(n).toBe(1);
  });
  it('rejects bad import and leaves books', () => {
    const { store } = mk();
    added(store, inp('A'));
    expect(store.importJson('{nope').ok).toBe(false);
    expect(store.importJson('{"foo":1}').ok).toBe(false);
    expect(store.importJson('{"app":"bookroulette","version":1,"books":5}').ok).toBe(false);
    expect(store.books().length).toBe(1);
  });
  it('import merges and re-import adds 0', () => {
    const a = mk(); const b = mk();
    added(a.store, inp('A', '9780441172719'));
    added(a.store, inp('B'));
    const json = a.store.exportJson();
    expect(JSON.parse(json).app).toBe('bookroulette');
    expect(b.store.importJson(json)).toEqual({ ok: true, added: 2 });
    expect(b.store.importJson(json)).toEqual({ ok: true, added: 0 });
    // same ISBN, different id
    const c = mk();
    added(c.store, inp('A2', '9780441172719'));
    expect(c.store.importJson(json)).toEqual({ ok: true, added: 1 });
  });
  it('garbage storage loads empty', () => {
    const s = new FakeStorage();
    s.setItem('bookroulette.v1', 'garbage');
    expect(new Store(s).books().length).toBe(0);
    s.setItem('bookroulette.v1', '{"a":1}');
    expect(new Store(s).books().length).toBe(0);
  });

  it('normalizes ISBNs so ISBN-10 and ISBN-13 collide', () => {
    const { store } = mk();
    const a = added(store, inp('Dune', '0441172717'));
    expect(a.isbn).toBe('9780441172719');
    const r = store.add(inp('Dune', '978-0-441-17271-9'));
    expect(r.ok).toBe(false);
  });
  it('drops invalid ISBN on add', () => {
    const { store } = mk();
    expect(added(store, inp('X', '012345678905')).isbn).toBeUndefined();
  });
  it('update normalizes ISBN, drops invalid, refuses another book\'s ISBN', () => {
    const { store } = mk();
    const a = added(store, inp('A', '9780441172719'));
    const b = added(store, inp('B'));
    store.update(b.id, { isbn: '0441172717', title: 'B2' });
    let bb = store.books().find(x => x.id === b.id)!;
    expect(bb.isbn).toBeUndefined();
    expect(bb.title).toBe('B2');
    store.update(b.id, { isbn: '080442957X' });
    bb = store.books().find(x => x.id === b.id)!;
    expect(bb.isbn).toBe('9780804429573');
    store.update(b.id, { isbn: 'bogus' });
    expect(store.books().find(x => x.id === b.id)!.isbn).toBeUndefined();
    expect(store.books().find(x => x.id === a.id)!.isbn).toBe('9780441172719');
  });
  it('import normalizes ISBNs and dedupes against them', () => {
    const { store } = mk();
    added(store, inp('A', '9780441172719'));
    const book = { id: 'zz', title: 'A', author: 'a', genre: 'g', color: '#fff', addedAt: 1, status: 'unread', isbn: '0441172717' };
    const json = JSON.stringify({ app: 'bookroulette', version: 1, books: [book] });
    expect(store.importJson(json)).toEqual({ ok: true, added: 0 });
  });
  it('setStatus reading demotes previous reading book', () => {
    const { store } = mk();
    const a = added(store, inp('A'));
    const b = added(store, inp('B'));
    store.setStatus(a.id, 'reading');
    store.setStatus(b.id, 'reading');
    expect(store.books().filter(x => x.status === 'reading').map(x => x.id)).toEqual([b.id]);
    expect(store.books().find(x => x.id === a.id)!.status).toBe('unread');
  });
  it('falls back to memory when localStorage access throws', () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    try {
      const store = new Store();
      expect(added(store, inp('A')).title).toBe('A');
      expect(store.books().length).toBe(1);
    } finally {
      if (desc) Object.defineProperty(globalThis, 'localStorage', desc); else delete (globalThis as any).localStorage;
    }
  });
  it('persistent() true with working storage; false and notifies when a write fails', () => {
    const { s, store } = mk();
    expect(store.persistent()).toBe(true);
    let errs = 0;
    store.onSaveError(() => errs++);
    s.setItem = () => { throw new Error('quota'); };
    added(store, inp('Dune'));
    expect(errs).toBe(1);
    expect(store.persistent()).toBe(false);
    expect(store.books()).toHaveLength(1);
  });
  it('persistent() false with in-memory fallback', () => {
    const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
    try { expect(new Store().persistent()).toBe(false); }
    finally { if (orig) Object.defineProperty(globalThis, 'localStorage', orig); else delete (globalThis as any).localStorage; }
  });
  it('importJson rejects wrongly typed optional fields without throwing', () => {
    const { store } = mk();
    const base = { id: 'x', title: 'T', author: 'A', genre: 'G', color: '#fff', status: 'unread', addedAt: 1 };
    for (const bad of [{ isbn: 123 }, { coverUrl: {} }, { finishedAt: 'now' }]) {
      const r = store.importJson(JSON.stringify({ app: 'bookroulette', version: 1, books: [{ ...base, ...bad }] }));
      expect(r.ok).toBe(false);
    }
    expect(store.books()).toHaveLength(0);
  });
});
