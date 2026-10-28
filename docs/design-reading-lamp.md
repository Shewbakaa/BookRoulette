# BookRoulette — "Reading Lamp" Redesign

_Date: 2026-10-27. Extends `docs/design.md`; nothing there changes except the look and motion._

## Why

The user said the shipped app looks like a generic "AI-made" web app. The tells are the purple neon gradient background, the glowing orange gradient pill button, the rainbow pill genre chips, the rainbow confetti, and the frosted cards. They want a look with its own personality, and animations built on current open-source libraries.

They chose direction **C · Reading Lamp** from the mockups (`.superpowers/brainstorm/*/content/lamp-screens.html` and `design-v2.html`, option C).

## Goals

- Every screen restyled to the Reading Lamp look: main, carousel, genre filter, currently-reading, celebration, menu sheet, add-book flow (scan / looking up / form / duplicate), library, finished, backup, swap prompt and toasts.
- UI motion uses **Motion** (motion.dev, MIT, npm `motion`, latest v12 or newer). That covers springs on press, sheet slide-up, staggered list reveals, card pop, chip select, and the banner in and out.
- The celebration uses **warm drifting sparks** (the user confirmed this) instead of rainbow confetti, and `canvas-confetti` is removed.

## Non-goals

- Features, data model, storage, the add/scan flow logic, and pick logic all stay the same.
- No light theme.

## Anti-goals (failure even if it works)

- Any of these left anywhere in the app: purple/neon gradients, gradient text, glowing pill buttons, rainbow multi-color chips, frosted glass panels, or rainbow confetti.
- Animations that feel bouncy and toy-like. The motion should feel weighty and calm, like real objects under a lamp.
- Jank on iPhone. Animate transform and opacity only.

## Look (decided with the user via mockups)

**Mood.** Night reading by lamplight.

**Palette** (CSS tokens):
- Background: a radial "lamp pool" from `#3b3226` at the center through `#1b1712` to `#0f0d0a` at the edges, plus a faint paper-grain noise overlay at about 8% opacity.
- Surfaces: card/sheet `#241f18`, hairlines `#3d3427`.
- Text: `#efe4cf`, muted `#a99878`, dim `#7d6e55`.
- **One accent: brass `#d7a54a`** (deep `#8a6020`). It's used only for interactive or active things: Spin, the primary button, the selected chip underline, the tick mark, and links.

**Type.**
- Instrument Serif for the app title, book titles, headings and the italic question lines.
- Inter Tight for UI text.
- Small uppercase tracked labels for meta text, such as "7 unread on the shelf" and "Now reading".
- Self-host both fonts via `@fontsource` packages so the app works offline and makes no Google Fonts request.

**Components:**
- **Title:** "Book *Roulette*", with *Roulette* in brass italic.
- **Menu button:** a 38px dark round button with a brass glyph.
- **Genre filter:** plain text items with a small superscript count. The selected one is full-ink with a 1px brass underline, and the others are muted. Horizontal scroll. No pills, no fills, no per-genre colors.
- **Currently reading:** a line between two hairlines showing a mini cover, a "Now reading" label, the serif title, and a brass text action "Finished it" (plus "Put back").
- **Carousel:**
  - The 3D ring stays.
  - Book covers have small corner radii and deep soft drop shadows.
  - Books away from the front darken, as if they're out of the lamplight.
  - A soft floor shadow sits under the ring.
  - A brass **pointer icon** sits at the top center: a small downward-pointing brass wedge on a pivot pin (like a prize-wheel flapper), with metallic shading and a soft drop shadow. The user asked for an icon instead of a plain line.
  - Fallback colored cards use muted, book-cloth colors (not neon), with serif titles.
- **Spin:** a round brass push-button about 92px across, with a serif "Spin" label, an inset highlight, and a bottom shade. A tracked caption sits below it.
- **Celebration:**
  - Eyebrow text "Tonight you're reading".
  - A large cover with a warm glow behind it, then the serif title and "author · genre".
  - A brass primary button, "Start reading".
  - The italic serif question "Already read this one?".
  - An outline button, "Yes, set it aside & spin again". After it's tapped, the Re-spin and empty-pool states from the existing spec apply.
  - A text "Close".
- **Sheets:** a `#241f18` bottom sheet with a top hairline, a grab handle, and a serif heading. Rows are separated by hairlines, with a muted detail on the right and brass for actions.
- **Buttons:** primary is solid brass with dark text. Secondary is an outline in hairline color with ink text. Tertiary is text only. All are rounded pills (999px) except Spin, which is a circle. There are no gradients except Spin's metallic shading.
- **Toasts:** a small dark card with a hairline border and a brass dot for ok, or a muted amber for warn.
- **Form inputs:** underlined fields (bottom hairline, brass on focus) and a serif input for the title.

## Motion

- **Library:** Motion `animate` with spring physics. Press: scale to about 0.93 with a stiff spring, released with a softer spring. Never more than a small overshoot.
- **Spin:** keep the existing angle math (`spinTargetAngle`, ring logic). The builder may drive the ring with Motion or keep a CSS transition, but it must feel weighty: a slight wind-back for anticipation, a long ease-out, and a gentle settle on the winner. The pointer flicks on its pivot as each book passes, and the tick sound is kept.
- **Celebration:**
  - The card rises and scales in on a spring.
  - About 20–30 warm sparks (`#ffd98a`, small glowing dots) drift slowly upward and fade, like dust in lamplight, staggered over about 2.5s. They're DOM or CSS, driven by Motion; there's no confetti library.
  - "Finished it!" on the banner gets a smaller spark burst.
- **Sheets:** the sheet slides up on a spring while the backdrop fades. Rows reveal in a stagger of about 40–60ms. Closing reverses it, faster.
- **Chips:** the brass underline slides to the selected item (a shared underline element that moves), and the ring cross-fades.
- **Reduced motion:** no sparks, no stagger, short fades only, and a spin of 1.2s or less, as already specified.

## Constraints

- Same stack: Vite and vanilla TS. Motion's vanilla API (`import { animate, stagger, spring } from "motion"`).
- iPhone Safari target: keep 60fps on transform/opacity, and respect safe-area insets.
- Bundle: Motion's tree-shaken vanilla `animate` is small. Fonts are subset to Latin.

## Builder's calls

- Exact spring constants, spark counts and timings.
- Whether the ring spin is driven by Motion or CSS.
- The noise overlay technique.
- Fallback cover colors, within the "book-cloth" brief: muted terracotta, forest, navy, oxblood, mustard, slate, plum, olive.
- Icon glyphs (no emoji in the UI chrome).

## Settled during review (my calls)

- **Visual source of truth:** `docs/mockups/reading-lamp.html` (main / celebration / menu sheet) is binding for spacing, type sizes, Spin shading, sheet rows, cover shadows. Extract values from it; where the doc and mockup disagree, the mockup wins.
- **Scan screen:** camera viewfinder with four thin brass corner brackets (no glowing frame), muted hint "Point at the barcode on the back", a slow 1px brass scan line. **Looking up:** a muted cover-shaped placeholder with a slow opacity breathe + "Looking it up…" in italic serif — no spinner. **Duplicate:** serif "Already on your shelf" + the book's mini card.
- **Spin timing:** normal spin stays ~5s total; reduced motion ≤1.2s. Final angle always comes from `spinTargetAngle`; the wind-back (≈-8° over ~180ms) is a prelude before the main move. Builder may move the ring to Motion; `ringMath` tests stay valid.
- **Tick nudge:** carousel already reads the live angle per frame for the tick sound — reuse it to flick the pointer icon on its pivot.
- **Tests:** keep existing DOM structure / class names that tests rely on and restyle in place; update tests that assert confetti to assert sparks instead.
- **Reduced motion:** read at call time via the existing `reducedMotion()` helper; all Motion calls go through it. No live-toggle support needed.
- **Dark only:** `color-scheme: dark`; manifest `background_color`/`theme_color`, `theme-color` meta and apple status bar updated to `#0f0d0a`; icons restyled to brass-on-walnut to match.
