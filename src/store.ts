import type { Book, BookInput, BookStatus } from './types';
import { normalizeIsbn } from './isbn';

const KEY = 'bookroulette.v1';
const PALETTE = ['#e6194b', '#f58231', '#ffe119', '#3cb44b', '#42d4f4', '#4363d8', '#911eb4', '#f032e6'];

/** Deterministic card colour for a title (also used for add-form previews). */
export function colorFor(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function isBook(x: unknown): x is Book {
  if (!x || typeof x !== 'object') return false;
  const b = x as Record<string, unknown>;
  return typeof b.id === 'string' && typeof b.title === 'string' &&
    typeof b.author === 'string' && typeof b.genre === 'string' &&
    typeof b.color === 'string' && typeof b.addedAt === 'number' &&
    (b.status === 'unread' || b.status === 'reading' || b.status === 'finished') &&
    (b.isbn === undefined || typeof b.isbn === 'string') &&
    (b.coverUrl === undefined || typeof b.coverUrl === 'string') &&
    (b.finishedAt === undefined || typeof b.finishedAt === 'number');
}

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
}

// Safari can throw SecurityError just reading `localStorage` when storage is blocked.
function defaultStorage(): Storage {
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      ls.getItem(KEY);
      return ls;
    }
  } catch { /* fall through */ }
  return new MemoryStorage() as unknown as Storage;
}

export type AddResult = { ok: true; book: Book } | { ok: false; reason: 'duplicate'; existing: Book };

export class Store {
  private list: Book[] = [];
  private subs = new Set<() => void>();
  private errSubs = new Set<() => void>();
  private storage: Storage | null;
  private durable: boolean;

  constructor(storage?: Storage) {
    this.storage = storage ?? defaultStorage();
    this.durable = !(this.storage as unknown instanceof MemoryStorage);
    this.load();
  }

  private load(): void {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) this.list = parsed.filter(isBook);
    } catch {
      this.list = [];
    }
  }

  private commit(): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.list));
    } catch { // quota/private mode
      this.durable = false;
      this.errSubs.forEach(fn => fn());
    }
    this.subs.forEach(fn => fn());
  }

  /** False when books only live in memory (storage unavailable or a write failed). */
  persistent(): boolean { return this.durable; }

  /** Called whenever a save to storage fails. */
  onSaveError(fn: () => void): () => void {
    this.errSubs.add(fn);
    return () => { this.errSubs.delete(fn); };
  }

  books(): Book[] { return this.list.map(b => ({ ...b })); }

  subscribe(fn: () => void): () => void {
    this.subs.add(fn);
    return () => { this.subs.delete(fn); };
  }

  add(input: BookInput): AddResult {
    const isbn = input.isbn ? normalizeIsbn(input.isbn) : null;
    if (isbn) {
      const existing = this.list.find(b => b.isbn === isbn);
      if (existing) return { ok: false, reason: 'duplicate', existing: { ...existing } };
    }
    const book: Book = {
      id: crypto.randomUUID(),
      title: input.title,
      author: input.author,
      genre: input.genre,
      color: colorFor(input.title),
      status: 'unread',
      addedAt: Date.now(),
      ...(isbn ? { isbn } : {}),
      ...(input.coverUrl ? { coverUrl: input.coverUrl } : {}),
    };
    this.list.push(book);
    this.commit();
    return { ok: true, book: { ...book } };
  }

  update(id: string, patch: Partial<BookInput>): void {
    const b = this.list.find(x => x.id === id);
    if (!b) return;
    const { isbn: rawIsbn, ...rest } = patch;
    Object.assign(b, rest);
    if ('isbn' in patch) {
      const n = rawIsbn ? normalizeIsbn(rawIsbn) : null;
      if (!n) delete b.isbn;
      else if (!this.list.some(x => x.id !== id && x.isbn === n)) b.isbn = n;
      // else: ISBN belongs to another book; keep this book's current ISBN unchanged.
    }
    this.commit();
  }

  remove(id: string): void {
    const n = this.list.length;
    this.list = this.list.filter(b => b.id !== id);
    if (this.list.length !== n) this.commit();
  }

  setStatus(id: string, s: BookStatus): void {
    const b = this.list.find(x => x.id === id);
    if (!b) return;
    if (s === 'reading') { this.startReading(id); return; }
    this.apply(b, s);
    this.commit();
  }

  private apply(b: Book, s: BookStatus): void {
    b.status = s;
    if (s === 'finished') b.finishedAt = Date.now();
    else delete b.finishedAt;
  }

  startReading(id: string): Book | null {
    const target = this.list.find(x => x.id === id);
    if (!target) return null;
    const prev = this.list.find(x => x.status === 'reading' && x.id !== id);
    if (prev) this.apply(prev, 'unread');
    this.apply(target, 'reading');
    this.commit();
    return prev ? { ...prev } : null;
  }

  current(): Book | undefined {
    const b = this.list.find(x => x.status === 'reading');
    return b ? { ...b } : undefined;
  }

  exportJson(): string {
    return JSON.stringify({ app: 'bookroulette', version: 1, books: this.list }, null, 2);
  }

  importJson(text: string): { ok: true; added: number } | { ok: false; error: string } {
    let data: unknown;
    try { data = JSON.parse(text); } catch { return { ok: false, error: 'Not valid JSON' }; }
    const d = data as { app?: unknown; books?: unknown } | null;
    if (!d || typeof d !== 'object' || d.app !== 'bookroulette') {
      return { ok: false, error: 'Not a BookRoulette export' };
    }
    if (!Array.isArray(d.books) || !d.books.every(isBook)) {
      return { ok: false, error: 'Export contains invalid books' };
    }
    const ids = new Set(this.list.map(b => b.id));
    const isbns = new Set(this.list.map(b => b.isbn).filter(Boolean));
    let added = 0;
    let reading = this.list.some(b => b.status === 'reading');
    for (const b of d.books as Book[]) {
      const copy = { ...b };
      const n = copy.isbn ? normalizeIsbn(copy.isbn) : null;
      if (n) copy.isbn = n; else delete copy.isbn;
      if (ids.has(copy.id) || (copy.isbn && isbns.has(copy.isbn))) continue;
      if (copy.status === 'reading') {
        if (reading) { copy.status = 'unread'; delete copy.finishedAt; } else reading = true;
      }
      this.list.push(copy);
      ids.add(copy.id);
      if (copy.isbn) isbns.add(copy.isbn);
      added++;
    }
    if (added) this.commit();
    return { ok: true, added };
  }
}

export const store = new Store();
