# BookRoulette — Design

_Date: 2026-10-27_

## Intent

A small, fun phone web app that answers one question: **"What should I read next?"**
One person owns a pile of unread books. They add each book by scanning its barcode
with their phone. When it's time to choose the next read, they spin a flashy 3D
roulette of their books and let it decide. The app should feel playful: animations
everywhere, a big celebration when a book is picked.

## Users and context

- One user, on their phone. No other users, no sharing.
- They use it two ways:
  1. **Pick the next book** (the main use).
  2. **Add new books** now and then, as they buy them.
- It also keeps a list of the books they've finished.

## Goals

- A 3D book-carousel roulette that is fun to watch.
- Add books by scanning the ISBN barcode. Title, author, genre and cover are filled in automatically.
- A manual-entry fallback when the scan finds nothing.
- Filter the roulette by genre before spinning.
- A finished list, fed from the pick screen.

## Non-goals

- Accounts, login, servers, syncing across devices.
- Reviews, ratings, reading progress, social features.
- Desktop-first layout. Desktop should work, but the phone is the target.

## Anti-goals (failure even if it "works")

- The roulette starts spinning on its own. It spins **only** when the user taps Spin.
- Animations that feel cheap or janky on a phone.
- Losing the user's library without warning.

## How it works (decided with the user)

### Main screen: roulette
- A **3D book carousel**: book covers arranged in a ring in 3D. They whirl when spun, and the winner lands facing the user. (The user picked this from mockups; the reference mockup is at `.superpowers/brainstorm/*/content/roulette-style.html`, option C.)
- Each book shows its **real cover image** when one is available. Books without a cover show a **colored card** with the title and author.
- **Genre filter** above or near the carousel. The user picks one or more genres, and only matching unread books are in the ring. The ring updates (animated) when the filter changes. "All" is the default.
- A big **Spin** button under the carousel. Nothing spins until it's tapped.

### Celebration screen (after a spin lands)
- Confetti, the chosen book's card popping in, and a "Your next read!" headline.
- The question **"Already read this one?"**
  - **Yes**: the book moves to the Finished list. The user is offered a **re-spin**, and the new spin runs without that book.
  - **No** (or no answer): the celebration screen **stays open**. It's their pick. They can close or dismiss it when done.
- A **"Start reading"** button on the celebration screen sets the book as **Currently reading** (my call on how a pick is "accepted").

### Currently reading (user asked for this)
- The app remembers one **Currently reading** book.
- It shows on the main screen as a small card or banner above the carousel, with its cover.
- That book is **out of the roulette** while it is being read.
- A **"Finished it!"** button on the banner moves it to the Finished list, with a small celebration. A "Put back" option returns it to the roulette unread.
- If a book is already being read, "Start reading" on a new pick swaps them: the old one goes back to the roulette (my call; confirm with a small prompt).

### Collapsible menu
- A collapsible menu (e.g. a hamburger or slide-up drawer) holds:
  - **Add book**
  - **Library** (user asked for this): a list of every unread book, searchable or grouped by genre. Each book can be **edited** (title, author, genre, cover), **deleted** (with confirm), or **marked finished** by hand.
  - **Finished list**
  - **Backup**: export/import (see Data).
- **Add book flow**:
  1. Open the camera and scan the ISBN barcode on the back of the book.
  2. Look up the book by ISBN to get the title, author, genre and cover.
  3. Show the result for confirmation. The user can edit any field, especially genre, since lookup genres are messy.
  4. If the lookup finds nothing (or the camera can't be used), offer a **manual form**: title, author, genre (cover optional/none → colored card).
- **Finished list**: shows the books read. A book can be moved back to the roulette (undo for an accidental "Yes").

## Constraints

- Runs in a phone browser. It can be added to the home screen so it feels like an app (PWA).
- **The phone is an iPhone (Safari).** This means:
  - There's no `navigator.vibrate`, so no haptics. Use sound and visual feedback instead.
  - There's no native `BarcodeDetector`, so scanning relies on a JS library (ZXing / `html5-qrcode`). The camera uses `playsinline` and the back camera.
  - Test scanning both in a Safari tab and launched from the home screen (iOS has had camera quirks in home-screen mode). If home-screen mode can't scan, fall back to opening the scan in Safari, or to manual entry.
  - Sounds can play only after a user tap (iOS audio unlock). The Spin tap counts.
  - Make sure the 3D carousel runs smoothly in iOS Safari.
- **The camera needs HTTPS. Hosting is GitHub Pages** (user decided). The builder creates a GitHub repo `BookRoulette` and sets up automatic deploys with a GitHub Action, with the build base path set to `/BookRoulette/`. On a free account the repo must be public, so the code is public. Book data stays on the phone. Confirm with the user before creating or pushing the repo. Local testing on a laptop is fine for everything except scanning on the phone.
- **Data lives only on the phone** (browser storage). No backend.
- Because data is local, include **Export / Import** (a JSON file) so a phone change or cleared browser data doesn't wipe the library.

## Builder's calls (my defaults; user hasn't weighed in, change if needed)

- **Stack:** Vite + vanilla TypeScript, or a light framework. The builder chooses. Keep it small and static.
- **Barcode scanning:** a maintained JS library (e.g. `html5-qrcode` or ZXing). Use the native `BarcodeDetector` where supported.
- **Book lookup:** Google Books API by ISBN first, Open Library as fallback. Both are free with no key needed. Genre = first category or subject, normalized to a short list (Fiction, Fantasy, Sci-Fi, Mystery/Thriller, Romance, Non-fiction, History, Memoir/Biography, Self-help, Other). The user can type their own genre.
- **Covers:** use the URL from the lookup. If the image fails to load, fall back to the colored card. Optionally cache the cover in storage so it works offline.
- **Storage:** `localStorage` or IndexedDB.
- **Many books in the ring:** the 3D ring gets crowded past about 12 books. The winner is always picked randomly from the **whole** filtered pool. If the pool is large, the ring shows a sample of about 12 that always includes the winner. Small pools (1–2 books) still animate sensibly. An empty pool shows a friendly "No books here. Add some!" state.
- **Duplicates:** scanning an ISBN that's already in the library shows "Already in your library" rather than adding it twice.
- **Extra fun touches:** a sound on each tick and on landing, plus an animated drawer open/close. Sound has a mute toggle.
- **Book states:** `unread` | `reading` | `finished`. The roulette pool is unread books matching the genre filter.
- **Accessibility:** respect `prefers-reduced-motion` with a shorter, simpler spin.

## Left to the builder

Visual theme details beyond the mockup's vibe (dark purple background, bright colors), file structure, testing approach, and the exact animation timing and easing.
