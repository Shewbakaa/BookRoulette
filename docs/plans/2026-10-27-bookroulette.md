# BookRoulette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-first web app (PWA) for one user that spins a 3D book carousel to choose their next read, with books added by scanning ISBN barcodes.

**Architecture:** Static single-page app. Pure logic modules (store, pick, genres, lookup, isbn) are unit-tested with Vitest. UI modules render plain DOM and subscribe to the store. Data lives in `localStorage`, and the app deploys to GitHub Pages via a GitHub Action.

**Tech Stack:** Vite 5, vanilla TypeScript, Vitest + jsdom, `html5-qrcode` (scanner), `canvas-confetti`, Web Audio API (sounds). No framework.

**Spec:** `docs/design.md`

## Global Constraints

- Target device: an iPhone running Safari, in a browser tab and launched from the home screen. Don't use `navigator.vibrate` or `BarcodeDetector`.
- The roulette spins **only** when the Spin button is tapped. Nothing auto-spins.
- Data is stored only on the device, in `localStorage` under the key `bookroulette.v1`. There's no backend.
- The Vite `base` is `/BookRoulette/` (GitHub Pages project site).
- Book states are exactly `unread` | `reading` | `finished`. At most one book is `reading`.
- The genre list is Fiction, Fantasy, Sci-Fi, Mystery/Thriller, Romance, Non-fiction, History, Memoir/Biography, Self-help, Other. Users may type their own genre.
- The ring shows at most 12 books (`RING_MAX = 12`). The winner is always drawn from the whole filtered pool.
- Respect `prefers-reduced-motion`: a spin of at most 1.2s, no confetti.
- Visual vibe from mockup option C: a dark purple radial background, bright cards, and a warm orange gradient Spin button.
- Don't create the GitHub repo or push to it without asking the user first.

## Review Focus

1. **Scanning a non-ISBN barcode** (a price/UPC code next to the ISBN): the scan is ignored and scanning continues, with no failed lookup. → `isbn.test.ts`
2. **Lookup offline or with no results**: the manual form opens, pre-filled with the scanned ISBN. Nothing throws. → `lookup.test.ts`
3. **Scanning a book already in the library** (any state): the app says "Already in your library" and doesn't add it again. → `store.test.ts`
4. **The filter leaves 0 or 1 unread books**: 0 shows the empty state with Spin disabled. 1 still spins and lands on it. → `pick.test.ts`
5. **Importing a bad or foreign JSON file**: it's rejected with a message, and the existing library is untouched. Corrupt `localStorage` loads as an empty library rather than crashing. → `store.test.ts`

---

### Task 1: Scaffold project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/style.css`, `src/types.ts`, `.gitignore` (includes `node_modules`, `dist`, `.superpowers`)

**Interfaces:**
- Produces `src/types.ts`:
  ```ts
  export type BookStatus = 'unread' | 'reading' | 'finished';
  export interface Book { id: string; isbn?: string; title: string; author: string; genre: string;
    coverUrl?: string; color: string; status: BookStatus; addedAt: number; finishedAt?: number; }
  export type BookInput = Pick<Book, 'title' | 'author' | 'genre'> & { isbn?: string; coverUrl?: string };
  ```

- [ ] **Step 1:** `git init` in `BookRoulette/`. `npm create vite@5` vanilla-ts layout (by hand is fine). Add the dev deps `vitest jsdom`, the deps `html5-qrcode canvas-confetti`, and `@types/canvas-confetti`. Set `vite.config.ts` to `base: '/BookRoulette/'` and `test.environment: 'jsdom'`.
- [ ] **Step 2:** Set `index.html` viewport to `width=device-width,initial-scale=1,viewport-fit=cover`, with `<div id="app">`.
- [ ] **Step 3:** Run `npm run build` and `npx vitest run --passWithNoTests`. Expected: both succeed.
- [ ] **Step 4:** Commit `chore: scaffold BookRoulette`.

### Task 2: ISBN parsing and book store

**Files:**
- Create: `src/isbn.ts`, `src/store.ts`
- Test: `src/isbn.test.ts`, `src/store.test.ts`

**Interfaces:**
- Produces:
  - `normalizeIsbn(raw: string): string | null`. Strip non-digits/X. Accept a valid ISBN-10 (convert to 13) or an EAN-13 starting with 978/979 with a valid check digit. Anything else returns `null`.
  - `class Store` with `constructor(storage: Storage = localStorage)`, `books(): Book[]`, `subscribe(fn: () => void): () => void`, `add(input: BookInput): { ok: true; book: Book } | { ok: false; reason: 'duplicate'; existing: Book }`, `update(id: string, patch: Partial<BookInput>): void`, `remove(id: string): void`, `setStatus(id: string, s: BookStatus): void` (sets `finishedAt` when `finished`, clears it otherwise), `startReading(id: string): Book | null` (sets id to `reading`. A previous `reading` book goes back to `unread` and is returned), `current(): Book | undefined`, `exportJson(): string`, `importJson(text: string): { ok: true; added: number } | { ok: false; error: string }`.
  - `export const store = new Store()`.
  - `color` is assigned on add from a fixed 8-color palette (mockup colors) by hash of the title.

- [ ] **Step 1: Write failing tests.**
  - `normalizeIsbn('978-0-441-17271-9') === '9780441172719'`. `normalizeIsbn('0441172717') === '9780441172719'`. `normalizeIsbn('012345678905')` (UPC) `=== null`. Bad check digit returns `null`.
  - The store persists to a fake `Storage`, and a new `Store` on the same storage sees the books.
  - `add` with the same ISBN as a `finished` book returns `{ok:false, reason:'duplicate'}`.
  - `startReading(b)` while `a` is reading puts `a` back to `unread`, returns `a`, and leaves `current().id === b`.
  - `setStatus(id,'finished')` sets `finishedAt`. Setting it back to `unread` clears it.
  - `importJson('{nope')` returns `{ok:false}`, and the books are unchanged. `importJson('{"foo":1}')` returns `{ok:false}`.
  - Import merges and skips duplicates by id/ISBN: re-importing the same export gives `added === 0`.
  - Storage holding the invalid JSON `"garbage"` loads as `books().length === 0` without throwing.
- [ ] **Step 2:** Run `npx vitest run src/isbn.test.ts src/store.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement. The export format is `{ app: 'bookroulette', version: 1, books: Book[] }`, and import requires `app === 'bookroulette'`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: book store and ISBN parsing`.

### Task 3: Genre normalization and ISBN lookup

**Files:**
- Create: `src/genres.ts`, `src/lookup.ts`
- Test: `src/genres.test.ts`, `src/lookup.test.ts`

**Interfaces:**
- Produces:
  - `GENRES: readonly string[]` (the list from Global Constraints).
  - `normalizeGenre(raw: string[]): string`. Keyword map, case-insensitive. The first match wins, and no match returns `'Other'`.
  - `allGenres(books: Book[]): string[]` returns GENRES plus any custom genres in use, deduplicated, with only genres that have unread books first.
  - `lookupIsbn(isbn: string, fetchFn: typeof fetch = fetch): Promise<BookInput | null>`. Google Books `https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}` first, then Open Library `https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data`. Covers are forced to `https`. Google `zoom=1` thumbnails are upgraded where possible, and an Open Library cover `-L.jpg` is used if Google has none. A network error or no result from both returns `null`. It never throws.

- [ ] **Step 1: Write failing tests.**
  - `normalizeGenre(['Fiction / Science Fiction / Space Opera']) === 'Sci-Fi'`. `['Juvenile Fiction / Fantasy & Magic'] → 'Fantasy'`. `['Biography & Autobiography'] → 'Memoir/Biography'`. `['Cooking'] → 'Other'`. `[] → 'Other'`.
  - `lookupIsbn` with a fake fetch returning a Google item gets the title, author (joined with `, `), genre and an https cover.
  - Google returns `totalItems: 0` and Open Library has data: the result comes from Open Library.
  - Both fail, or fetch rejects: resolves `null`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: genre normalization and ISBN lookup`.

### Task 4: Pick logic

**Files:**
- Create: `src/pick.ts`
- Test: `src/pick.test.ts`

**Interfaces:**
- Produces:
  - `RING_MAX = 12`.
  - `poolFor(books: Book[], genres: Set<string>): Book[]` returns unread books. An empty set means all genres.
  - `pickWinner(pool: Book[], rng = Math.random): Book | null`.
  - `ringFor(pool: Book[], winner: Book | null, rng = Math.random): Book[]` returns up to `RING_MAX` books in shuffled order. It always contains the winner when one is given, and is stable (same order) when called without a winner for display.
  - `spinTargetAngle(currentAngle: number, ringSize: number, winnerIndex: number, extraTurns: number): number` returns the new rotateY so the winner faces front, always rotating in the same direction by at least `extraTurns × 360`.

- [ ] **Step 1: Write failing tests.**
  - `poolFor` excludes `reading`/`finished`, and filters by the genre set.
  - `pickWinner([])` returns `null`. A single-book pool returns that book.
  - `ringFor` of 30 books has length 12 and includes the winner (across 50 seeded runs). `ringFor` of 3 books has length 3.
  - `spinTargetAngle(0, 8, 3, 4)`: the result mod 360 equals `-(3 * 45) mod 360`, and `|result| >= 1440`. Calling it again from that result keeps decreasing.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: roulette pick logic`.

### Task 5: Main screen: carousel, filter, spin, sound

**Files:**
- Create: `src/ui/carousel.ts`, `src/ui/filter.ts`, `src/sound.ts`, `src/ui/bookCard.ts`
- Modify: `src/main.ts`, `src/style.css`

**Interfaces:**
- Consumes: `store`, `poolFor`, `ringFor`, `pickWinner`, `spinTargetAngle`, `allGenres`.
- Produces:
  - `bookCard(book: Book): HTMLElement` renders the cover `<img>` with `onerror` falling back to a colored card (title + author on `book.color`). It's reused by the carousel, celebration, library and finished list.
  - `createCarousel(root: HTMLElement): { render(books: Book[]): void; spin(ring: Book[], winner: Book): Promise<void> }`. A 3D ring using `perspective` + `rotateY(i*360/n) translateZ(r)`, with radius from ring size. The spin is about 5s with `cubic-bezier(.12,.8,.12,1)`. It calls `sound.tick()` each time a card passes front (requestAnimationFrame reading the computed transform) and resolves on `transitionend`. The reduced-motion spin is ≤1.2s.
  - `createFilter(root, onChange: (genres: Set<string>) => void)`: horizontally scrollable genre chips, multi-select, with "All" clearing them.
  - `sound`: `{ unlock(): void; tick(): void; land(): void; muted: boolean; toggle(): void }`. Web Audio oscillators, no audio files. `unlock()` is called on the first tap. Mute is persisted in `localStorage` as `bookroulette.muted`.
- Behavior: Spin is disabled with an empty pool or while spinning, and the empty state reads "No books here — add some!". A filter change re-renders the ring with a quick fade/scale animation. The ring is never spun on load.

- [ ] **Step 1:** Implement the modules and wire `main.ts`. Seed sample data only through a `?demo` query param (the 8 mockup books) for manual testing.
- [ ] **Step 2:** Run `npx vitest run`. Expected: all earlier tests still PASS.
- [ ] **Step 3:** Run `npm run dev`. In the browser pane at 375×812 with `?demo`, check: nothing moves on load. Spin lands with the winner facing front. Filtering to one genre shrinks the ring. Filtering to a genre with 0 books shows the empty state with Spin disabled. Take a screenshot.
- [ ] **Step 4:** Commit `feat: 3D carousel roulette with genre filter`.

### Task 6: Celebration and Currently reading

**Files:**
- Create: `src/ui/celebrate.ts`, `src/ui/readingBanner.ts`
- Modify: `src/main.ts`, `src/style.css`

**Interfaces:**
- Consumes: `bookCard`, `store.setStatus`, `store.startReading`, `store.current`, `sound.land`.
- Produces:
  - `showCelebration(book: Book, actions: { onAlreadyRead(): void; onStartReading(): void; onClose(): void }): void`. Full-screen overlay with `canvas-confetti` bursts, a "🎉 Your next read!" headline, the card popping in with a spring scale/rotate, and the buttons **"Yes, I've read it"**, **"Start reading"** and **Close**, under the question "Already read this one?". **Yes** → `setStatus(finished)`, then the overlay swaps to "Moved to Finished ✓" with a **Re-spin** button (re-spinning closes the overlay and spins with the book gone). Nothing else closes the overlay except Close or Start reading.
  - `renderReadingBanner(root: HTMLElement, book: Book | undefined): void` shows the cover thumbnail, "Currently reading", the title, **Finished it!** (→ `finished` + a confetti burst) and **Put back** (→ `unread`).
- Start reading while another book is reading: `confirm()`-style in-app prompt "Swap with *{current title}*? It goes back in the roulette." before calling `startReading`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Browser check with `?demo`: spin → celebration. Yes → Re-spin → the new ring lacks the book. Start reading → banner shown, book not in the ring. Finished it! → banner gone. Take screenshots.
- [ ] **Step 3:** Commit `feat: celebration screen and currently reading`.

### Task 7: Menu drawer and Add book (scan + manual)

**Files:**
- Create: `src/ui/drawer.ts`, `src/ui/addBook.ts`, `src/scanner.ts`, `src/ui/bookForm.ts`
- Modify: `src/main.ts`, `src/style.css`

**Interfaces:**
- Consumes: `normalizeIsbn`, `lookupIsbn`, `store.add`, `GENRES`.
- Produces:
  - `createDrawer(items: { label: string; icon: string; open(): void }[]): void`. A floating menu button opens a slide-up sheet with a springy animation and backdrop. Items: Add book, Library, Finished, Backup, Sound on/off.
  - `startScanner(el: HTMLElement, onIsbn: (isbn: string) => void): Promise<() => Promise<void>>`. `Html5Qrcode` with `facingMode: 'environment'`, formats limited to EAN_13/EAN_8/UPC_A. Each decode goes through `normalizeIsbn`, and non-ISBN results are ignored. It returns a stop fn. Camera permission/denied errors reject.
  - `bookForm(initial: Partial<BookInput>, onSave: (b: BookInput) => void): HTMLElement`: title and author required, a genre select from `GENRES` plus a "Custom…" text option, cover preview using `bookCard`.
- Add flow: scan → "Looking up…" shimmer → found: form pre-filled to confirm/edit → Save → `store.add`. Duplicate → "Already in your library" toast. Lookup `null` → "Couldn't find it — add it manually" with the form (ISBN kept). Camera error, or tapping "Enter manually" → empty form. A success toast pops with a small bounce, and the new book flies into the ring.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `npx vitest run`. Expected: PASS.
- [ ] **Step 3:** Browser check: drawer opens and closes with the animation. A manual add appears in the ring. Calling the scan callback with `9780441172719` from the console (expose `window.__testIsbn` in dev only) runs the lookup and fills Dune. Take a screenshot.
- [ ] **Step 4:** Commit `feat: menu drawer and add book via scan or manual entry`.

### Task 8: Library, Finished list, Backup

**Files:**
- Create: `src/ui/library.ts`, `src/ui/finished.ts`, `src/ui/backup.ts`
- Modify: `src/main.ts`, `src/style.css`

**Interfaces:**
- Consumes: `store.*`, `bookForm`, `bookCard`.
- Produces:
  - `openLibrary()`: a sheet listing unread books grouped by genre, with a search box. Per book: Edit (opens `bookForm`), Mark finished, and Delete (a confirm step).
  - `openFinished()`: finished books, newest first, showing "finished {date}" and **Move back to roulette** (→ `unread`).
  - `openBackup()`: **Export** downloads `bookroulette-backup-YYYY-MM-DD.json` via a Blob. **Import** uses a file input → `importJson` → a toast with the added count or the error.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Browser check: edit genre → the filter chips update. Delete removes the book from the ring. Export, then import of the same file → "0 added".
- [ ] **Step 3:** Commit `feat: library, finished list and backup`.

### Task 9: PWA and GitHub Pages deploy

**Files:**
- Create: `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `.github/workflows/deploy.yml`, `README.md`
- Modify: `index.html` (manifest link, `apple-mobile-web-app-capable`, theme color `#120c26`, apple-touch-icon)

- [ ] **Step 1:** Generate simple icons (a book on a roulette-colored disc) with a small Node/canvas script or an SVG→PNG conversion. Write the manifest (`display: standalone`, `start_url: '/BookRoulette/'`).
- [ ] **Step 2:** `deploy.yml`: on push to `main`, run `npm ci`, `npm test -- --run` and `npm run build`, then `actions/upload-pages-artifact` + `actions/deploy-pages`.
- [ ] **Step 3:** Run `npm run build && npx vite preview`, then open `/BookRoulette/` in the browser pane. Expected: the app loads with no 404s for assets or the manifest.
- [ ] **Step 4:** Commit `chore: PWA manifest and Pages deploy`.
- [ ] **Step 5:** **Ask the user** before running `gh repo create BookRoulette --public --source . --push` and enabling Pages (Settings → Pages → Source: GitHub Actions, via `gh api`). Then confirm the Action passes and the site URL loads.

### Task 10: iPhone check (user)

- [ ] **Step 1:** Give the user the Pages URL. They open it in Safari, scan a real book, add to the home screen, scan again from the home-screen app, and spin.
- [ ] **Step 2:** Fix whatever they report. If scanning from the home-screen app fails, add a hint in the Add sheet: "Camera not working? Open in Safari" plus manual entry.
