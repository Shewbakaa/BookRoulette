# Reading Lamp Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every BookRoulette screen to the approved "Reading Lamp" look. All UI motion moves to Motion (motion.dev), and warm sparks replace confetti. Features and data are unchanged.

**Architecture:**
- The visual rules live as CSS tokens in `src/style.css`, restyled in place. Keep the existing DOM structure and class names that tests rely on.
- One motion module, `src/ui/fx.ts`, wraps Motion: press springs, sparks, sheet and list reveals. Every Motion call goes through it so reduced motion is enforced in one place.
- The carousel keeps `spinTargetAngle` and `ringMath`. Only its visuals, pointer and spin feel change.

**Tech Stack:** Vite 5, vanilla TS, Vitest + jsdom, `motion` (latest, ≥12), `@fontsource/instrument-serif`, `@fontsource-variable/inter-tight`. `canvas-confetti` is removed.

**Spec:** `docs/design-reading-lamp.md` (extends `docs/design.md`). Visual source of truth: `docs/mockups/reading-lamp.html`. Where it disagrees with prose, the mockup wins.

## Global Constraints

- Tokens, exactly:
  - background lamp pool radial `#3b3226` → `#1b1712` → `#0f0d0a`; paper-grain overlay at about 8% opacity
  - card/sheet `#241f18`, hairline `#3d3427`
  - text `#efe4cf`, muted `#a99878`, dim `#7d6e55`
  - brass `#d7a54a`, brass-deep `#8a6020`
- **Brass is the only accent**, used only on interactive or active elements.
- Fonts: Instrument Serif for the title, book titles, headings and italic question lines; Inter Tight for UI. Both self-hosted via @fontsource. No Google Fonts requests.
- Banned anywhere in the app: purple or neon gradients, gradient text, glow on pill buttons, rainbow or per-genre colored chips, frosted glass (`backdrop-filter` blur panels), rainbow confetti, and emoji in UI chrome. The only allowed gradients are the lamp-pool background, Spin's metallic shading, the pointer's metallic shading, and the celebration's warm glow behind the cover.
- Animate transform and opacity only. Target 60fps in iPhone Safari. Respect safe-area insets.
- Reduced motion: no sparks, no stagger, short fades only, spin ≤1.2s. Read it via `reducedMotion()` at call time.
- Normal spin stays about 5s total, with about −8° of wind-back over about 180ms before the main move. The final angle always comes from `spinTargetAngle`.
- `color-scheme: dark`. Manifest `background_color`/`theme_color`, the `theme-color` meta and the Apple status bar all use `#0f0d0a`. Icons are brass on walnut.
- Copy, verbatim:
  - celebration: "Tonight you're reading", "Start reading", "Already read this one?", "Yes — set it aside & spin again", "Close"
  - main: "Now reading", "Finished it", "Put back", "{n} unread on the shelf"
  - add-book: "Point at the barcode on the back", "Looking it up…", "Already on your shelf"
- All existing tests keep passing. Update only tests that assert on confetti or on copy changed above.

## Review Focus

1. **The pointer drifts off-center while flicking.** A Motion `rotate` overwrites the centering `transform`. The pointer must stay centered over the front book at rest, during the spin and after landing. → Task 2 asserts the pointer is centered without a translate transform.
2. **Spark nodes leak.** Repeated celebrations must not accumulate spark DOM nodes. → Task 1 test: after the sparks finish, the container is empty.
3. **Reduced motion still animates.** With reduced motion on, `sparks()` creates nothing and `pressSpring` is a no-op. → Task 1 tests.
4. **Sheet close races open.** Tapping the backdrop mid-open must still close cleanly and release the camera. → Task 4 verifies in the browser; the existing camera-release logic must stay untouched.
5. **Fonts missing offline or in the home-screen app.** Fonts are bundled via @fontsource imports and appear in `dist`. → Task 1 build check: woff2 files exist in `dist/assets`.

---

### Task 1: Foundations: deps, tokens, fonts, fx module, app chrome

**Files:**
- Modify: `package.json`, `src/style.css` (tokens and base only), `src/ui/fx.ts`, `src/main.ts` (font imports), `index.html`, `public/manifest.webmanifest`, `scripts/make-icons.mjs`, `public/*.png`
- Test: `src/ui/fx.test.ts`

**Interfaces:**
- Produces in `src/ui/fx.ts`:
  - `reducedMotion(): boolean` (kept)
  - `afterAnim(el, ms): Promise<void>` (kept)
  - `pressSpring(el: HTMLElement): () => void` adds pointer press/release springs and returns a cleanup function. It's a no-op under reduced motion.
  - `sparks(host: HTMLElement, opts?: { count?: number; burst?: boolean }): Promise<void>` creates warm spark dots (`#ffd98a`, glow) inside `host`, animates them upward and fading with Motion, removes them when done, and resolves. Under reduced motion it creates nothing and resolves immediately. Defaults: `count` 24, drift. `burst: true` gives 12 sparks radiating from the host center.
  - `revealList(items: Element[]): void` staggers a fade/rise of 40–60ms. Under reduced motion items are just shown.
  - `sheetIn(sheet: HTMLElement, backdrop: HTMLElement): Promise<void>` and `sheetOut(...)`: a spring slide-up with backdrop fade, and a faster reverse.
  - `bigParty` and `burstFrom` are **removed**. Callers move to `sparks` in Tasks 3–4. Until then, keep them as thin wrappers over `sparks` so the app compiles. Task 4 deletes them.
- CSS custom properties on `:root`: `--bg-0 #0f0d0a`, `--bg-1 #1b1712`, `--bg-2 #3b3226`, `--card #241f18`, `--line #3d3427`, `--ink #efe4cf`, `--muted #a99878`, `--dim #7d6e55`, `--brass #d7a54a`, `--brass-d #8a6020`, `--serif 'Instrument Serif'`, `--sans 'Inter Tight Variable'`.

- [ ] **Step 1:** `npm i motion @fontsource/instrument-serif @fontsource-variable/inter-tight` and `npm rm canvas-confetti @types/canvas-confetti`.
- [ ] **Step 2: Write failing tests** in `fx.test.ts`. Use jsdom and mock `matchMedia`.
  - `sparks(host)` resolves, and `host.querySelectorAll('.spark').length === 0` afterwards (use fake timers, or mock Motion's `animate` to resolve immediately).
  - With reduced motion: `sparks` never appends a `.spark`.
  - With reduced motion: `pressSpring` adds no listeners. Spy on `addEventListener`.
- [ ] **Step 3:** Run `npx vitest run src/ui/fx.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement `fx.ts`.**
  - Import fonts in `main.ts`: `@fontsource/instrument-serif/400.css`, `@fontsource/instrument-serif/400-italic.css` and `@fontsource-variable/inter-tight`.
  - Rewrite the `:root` tokens, `html`/`body` base (`color-scheme: dark`, lamp-pool background, grain overlay via a fixed pseudo-element with an inline SVG `feTurbulence` data URI at 0.08 opacity, safe-area padding) and the shared button classes:
    - primary: solid brass, dark text `#21170a`, inset top highlight
    - secondary: hairline outline, ink text
    - tertiary: text only
    - all pills at 999px
  - Remove every old purple/neon token.
- [ ] **Step 5: Update app chrome.**
  - Manifest and `index.html` colors become `#0f0d0a`.
  - In `make-icons.mjs`, redraw the icon as brass on walnut: a brass ring of 8 muted book-cloth slices on `#1b1712` with a brass pointer wedge at the top. Regenerate the PNGs.
- [ ] **Step 6:** Run `npx vitest run`, `npx tsc --noEmit` and `npm run build`. Expected: all pass, and `ls dist/assets/*.woff2` lists the font files.
- [ ] **Step 7:** Commit `feat: reading lamp foundations — tokens, fonts, motion fx`.

### Task 2: Main screen: header, genre filter, carousel, pointer, Spin

**Files:**
- Modify: `src/main.ts` (header markup), `src/ui/filter.ts`, `src/ui/carousel.ts`, `src/ui/bookCard.ts`, `src/store.ts` (palette constant only), `src/style.css` (main-screen sections)
- Test: `src/ui/ringMath.test.ts` (unchanged, must pass), `src/ui/carousel.pointer.test.ts` (new)

**Interfaces:**
- Consumes: `pressSpring` and `reducedMotion` from Task 1; `spinTargetAngle` and `ringFor` (unchanged).
- Produces: the same `createCarousel`/`createFilter` signatures as today. `filter` gains a sliding underline element (`.filter-underline`) positioned under the selected item with Motion (x/width).
- The store fallback palette changes to book-cloth colors: terracotta `#a4532f`, forest `#2f4a3a`, navy `#1e2a44`, oxblood `#6b2430`, mustard `#a07a2a`, slate `#3f4a52`, plum `#4f3550`, olive `#5b5a32`. Existing books keep their stored color, and only new books get the new palette.

- [ ] **Step 1: Write a failing test** in `carousel.pointer.test.ts`. Render the carousel into jsdom. The pointer element `.pointer` exists, is an inline `<svg>`, and its inline style has no `translate` in `transform`; it's centered via `left: calc(50% - Wpx)`. Also assert `aria-hidden="true"`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement the main screen, matching the "Main" phone in the mockup.**
  - **Header:** serif "Book *Roulette*" with *Roulette* in brass italic, and a 38px round dark menu button with a brass ≡ glyph (SVG, not emoji).
  - **Filter:** plain text items with superscript counts, muted when unselected, ink when selected. One brass 1px underline slides to the selected item with a Motion spring. Horizontal scroll, no pills.
  - **Carousel:**
    - Covers get a 3px radius and shadow `0 20px 30px -12px #000`.
    - Non-front books darken using the existing per-frame shade, max about 0.45.
    - A soft elliptical floor shadow sits under the ring.
    - Fallback cards use book-cloth colors with the serif title.
    - Remove all old glow, burst and reflection styles.
  - **Pointer:** use the mockup's brass wedge SVG, 22×26, with a pivot pin and metallic gradient. Position it top-center over the ring with `left: calc(50% - 11px)` and `transform-origin: 50% 4px`. On each per-frame book pass, flick it with Motion `rotate: [0, -14, 0]` over about 0.2s. No flicks under reduced motion.
  - **Spin feel:** a wind-back prelude (about −8° over 180ms, ease-out), then the main move to `spinTargetAngle` over the remaining duration (about 5s total) with a long ease-out, then a gentle settle. Motion or CSS is your choice. The reduced-motion spin stays ≤1.2s with no wind-back.
  - **Spin button:** a 92px brass circle with metallic radial shading, inset highlight and bottom shade, a serif "Spin" label and `pressSpring`. Below it, the caption "{n} unread on the shelf" in tracked uppercase dim text. The disabled state is desaturated, at about 40% opacity.
  - Empty state: a serif italic line "No books here — add some!" in muted text, with no emoji.
- [ ] **Step 4:** Run `npx vitest run`, `npx tsc --noEmit` and `npm run build`. Expected: PASS.
- [ ] **Step 5:** Browser check at 375×812 on `/BookRoulette/?demo`:
  - Compare with `docs/mockups/reading-lamp.html` (Main phone) and take a screenshot.
  - Spin and confirm the pointer stays centered by measuring that the pointer's rect center equals the stage center within 1px, before, during and after the spin.
  - Confirm the underline slides between chips.
- [ ] **Step 6:** Commit `feat: reading lamp main screen and brass pointer`.

### Task 3: Celebration, reading banner, swap prompt, toasts

**Files:**
- Modify: `src/ui/celebrate.ts`, `src/ui/readingBanner.ts`, `src/ui/prompt.ts`, `src/ui/toast.ts`, `src/style.css` (those sections)
- Test: `src/ui/celebrate.test.ts`, `src/ui/readingBanner.test.ts`, `src/ui/prompt.test.ts` (update only copy and confetti assertions)

**Interfaces:**
- Consumes: `sparks`, `pressSpring`, `afterAnim` and `reducedMotion` from Task 1.
- Produces: the same exported signatures (`showCelebration`, `celebrationOpen`, `renderReadingBanner`, `askConfirm`, `toast`).

- [ ] **Step 1: Update the tests** for the new copy: "Tonight you're reading", "Yes — set it aside & spin again", "Now reading", "Finished it". Replace any confetti assertion with: `sparks` is called on open, mocking `./fx`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3: Implement, matching the "Celebration" phone in the mockup.**
  - **Celebration:**
    - A warm radial glow behind the cover, and a tracked uppercase brass eyebrow.
    - The large cover springs in (rise + scale), with a serif title and "author · genre" in muted text.
    - Primary "Start reading", then the italic serif "Already read this one?", then the secondary button "Yes — set it aside & spin again", then a tertiary "Close".
    - Call `sparks(overlay)` on open.
    - The "Moved to Finished ✓" and "No books left — add some!" states keep their logic and are restyled.
  - **Reading banner:** a line between hairlines with a mini cover, a "Now reading" dim label, the serif title, and brass text actions "Finished it" and "Put back". "Finished it" calls `sparks(banner, { burst: true })`. Animate in and out with Motion.
  - **Swap prompt:** a `#241f18` dialog with a hairline border, a serif message, a primary "Swap" and a secondary "Cancel".
  - **Toasts:** a dark card with a hairline border and a 6px brass dot (ok), muted dot (info) or amber `#c98a3a` dot (warn). It slides and fades in with Motion.
- [ ] **Step 4:** Run `npx vitest run`, `npx tsc --noEmit` and `npm run build`. Expected: PASS.
- [ ] **Step 5:** Browser check with `?demo`: spin, and the celebration matches the mockup with drifting sparks. Then Start reading shows the banner, Finished it shows the spark burst, and the swap prompt and toasts look right. Count `.spark` nodes after 4s: 0. Take screenshots.
- [ ] **Step 6:** Commit `feat: reading lamp celebration, banner, prompt and toasts`.

### Task 4: Sheets, add-book flow, forms, library, finished, backup

**Files:**
- Modify: `src/ui/drawer.ts`, `src/ui/addBook.ts`, `src/ui/bookForm.ts`, `src/ui/library.ts`, `src/ui/finished.ts`, `src/ui/backup.ts`, `src/ui/fx.ts` (delete `bigParty`/`burstFrom`), `src/style.css` (those sections)
- Test: the existing `addFlow`, `scanner`, `bookForm` and `listLogic` tests must pass. Update the `bookForm`/`addBook` copy assertions only if they hit the changed copy ("Already on your shelf", "Looking it up…", "Point at the barcode on the back").

**Interfaces:**
- Consumes: `sheetIn`, `sheetOut`, `revealList` and `pressSpring` from Task 1.
- Produces: the same `createDrawer`, `openSheet`, `openAddBook`, `openLibrary`, `openFinished` and `openBackup` signatures. Don't touch the camera start/stop and token logic.

- [ ] **Step 1: Implement, matching the "Menu sheet" phone in the mockup.**
  - **Sheets:**
    - `#241f18` with a top hairline, 22px top radius, a 36×4 grab handle and a serif heading.
    - Opening and closing use `sheetIn`/`sheetOut`, and rows use `revealList`.
    - Menu rows are separated by hairlines, with muted right-side details and brass for actions. The details are: "Scan ↗" on Add a book, the unread count on Library, the read count on Finished, "Export · Import" on Backup, and "On"/"Off" on Sound.
  - **Add book:**
    - **Viewfinder:** four thin brass corner brackets and a slow 1px brass scan line (Motion y loop, none under reduced motion), with the hint "Point at the barcode on the back".
    - **Looking up:** a muted cover-shaped placeholder with an opacity breathe, the italic serif "Looking it up…", and a secondary "Enter manually" button.
    - **Duplicate:** the serif "Already on your shelf" plus the book's mini card.
    - Toasts keep their existing copy unless it's listed above.
  - **Forms:** underlined inputs (bottom hairline, brass on focus), a serif title input, and the genre select styled to match.
  - **Library and Finished:** serif section headers (genre), rows between hairlines with a mini cover, the serif title and muted author, and brass text actions. The search field is underlined.
  - **Backup:** serif note text, a primary "Export" and a secondary "Import".
- [ ] **Step 2:** Delete `bigParty` and `burstFrom` from `fx.ts` and fix their callers. `grep -rn "bigParty\|burstFrom\|canvas-confetti" src` must return nothing.
- [ ] **Step 3: Anti-goal sweep.** `grep -niE "backdrop-filter|linear-gradient\(.*(#[89a-f][0-9a-f]{2}[a-f]|purple|violet)|text-fill-color|background-clip:\s*text" src/style.css` must return nothing. Also manually confirm that no emoji appear in UI chrome strings.
- [ ] **Step 4:** Run `npx vitest run`, `npx tsc --noEmit` and `npm run build`. Expected: PASS.
- [ ] **Step 5:** Browser check at 375×812:
  - The menu sheet matches the mockup.
  - The Add-book camera-error fallback, `__testIsbn('9780441172719')` → looking up → form, a duplicate, the library with search, finished, and backup all render in the new style.
  - Tap the backdrop mid-open and confirm the sheet closes.
  - Take screenshots.
- [ ] **Step 6:** Commit `feat: reading lamp sheets, add-book, library and backup`.
