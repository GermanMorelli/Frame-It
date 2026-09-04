# Artboard — Style Reference
> Lime-voltage designer's tabletop. White paper, ink-black type, and one electric green that powers the whole studio.

**Theme:** light

Artboard reads as a designer's toolshed laid out on a white tabletop — clinical canvas, high-contrast near-black type, and a single lime-green voltage that makes active states feel switched on. The system is overwhelmingly light and spacious, with confidence coming from tight tracking on large display type rather than weight or color. Buttons lean outlined rather than filled, borrowing the near-black as their stroke so primary actions feel like ink stamps on paper rather than glossy pills. Category surfaces are coded with soft pastel washes — peach, sky, mint — so visual variety arrives as color-coded cards, not gradients or shadows.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Midnight Ink | `#0d1400` | `--color-midnight-ink` | Primary text, ghost/outline action borders, filled dark buttons — near-black with a faint green undertone carries both editorial type and CTA strokes |
| Lime Voltage | `#aaff00` | `--color-lime-voltage` | Brand accent, active states, highlight tags, energetic punctuation — the single chromatic accent that gives the white canvas its electric charge |
| Paper White | `#ffffff` | `--color-paper-white` | Page canvas, card surfaces, button fills — the foundation everything sits on |
| Olive Stone | `#838976` | `--color-olive-stone` | Muted helper text, secondary icons, neutral badge borders, low-emphasis UI chrome |
| Soft Mist | `#e6e7e4` | `--color-soft-mist` | Hairline dividers, subtle surface edges, low-contrast separators |
| Peach Wash | `#ffe4c3` | `--color-peach-wash` | Category card accent — warm pastel surface for color-coded groupings |
| Sky Wash | `#cbedff` | `--color-sky-wash` | Category card accent — cool pastel surface for color-coded groupings |
| Mint Wash | `#caf3aa` | `--color-mint-wash` | Category card accent — fresh pastel surface for color-coded groupings |

## Tokens — Typography

### Vend Sans — display + label typeface · `--font-vend`
- **Substitute:** Inter
- **Weights:** 400, 600, 700
- **Sizes:** 11px, 13px, 19px, 43px, 61px
- **Line height:** 1.20, 1.50
- **Letter spacing:** -0.033em at 61px, -0.023em at 43px, +0.039em at 13px, +0.045em at 11px
- **Role:** Custom display + label typeface. Headlines run at 43–61px weight 600/700 with tight negative tracking for a compressed, editorial feel. The same family doubles as small all-caps labels at 11–13px with wide positive tracking — a deliberate dual register: whisper-quiet labels, assertive display.

### system-ui — body and supporting text · `--font-sans`
- **Substitute:** system-ui
- **Weights:** 400, 700
- **Sizes:** 16px
- **Line height:** 1.00, 1.50
- **Letter spacing:** 0.031em
- **Role:** Body and supporting text. Stays at 16px with 0.031em tracking — deliberately understated so Vend Sans can lead. No custom body face: the system font is the quiet workhorse, and custom type is reserved for moments of emphasis.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 11px | 1.2 | 0.5px | `--text-caption` |
| label | 13px | 1.2 | 0.51px | `--text-label` |
| body | 16px | 1.5 | 0.5px | `--text-body` |
| subheading | 19px | 1.5 | -0.44px | `--text-subheading` |
| heading | 43px | 1.2 | -0.99px | `--text-heading` |
| display | 61px | 1.2 | -2.01px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px · **Density:** compact

| Name | Value |
|------|-------|
| 4 / 8 / 12 / 16 / 20 / 24 | Tailwind `1 / 2 / 3 / 4 / 5 / 6` |
| 40 / 48 / 100 | Tailwind `10 / 12 / 25` |

### Border Radius

Two radii, and only two: **8px** for buttons, pills, badges, fields and nav elements (`--radius-button`), **12px** for cards and icon containers (`--radius-card`). A third value is a bug.

### Layout

- **Page max-width:** 1200px (`--container-page`, used as `max-w-page`)
- **Section gap:** 64px (`mt-16`)
- **Card padding:** 12–24px
- **Element gap:** 8px

## Components

### Top Navigation Bar
Persistent site header. White background, hairline bottom rule, 1200px content column, 24px horizontal padding. Logo lockup left; outlined actions right at 13px Vend Sans weight 600, wide tracking, 8px radius.

### Outlined Action Button
1px solid `#0d1400` border, 8px radius, white fill, ink text at 13px Vend Sans weight 600 with wide tracking, 8px/19px padding. **This is the dominant button pattern** — actions feel like ink-stamped outlines, not filled pills.

### Filled Dark Button
`#0d1400` background, `#ffffff` text, 8px radius. Used sparingly — **one per screen**, reserved for the action the screen exists for.

### Category Filter Pill
Pill with 8px radius, 1px ink border, white fill, 11px Vend Sans weight 600 uppercase with wide tracking. Active variant fills with ink and inverts the text. Sits in a horizontal row with 4px gaps.

### Category Feature Card
White background, 12px radius, 1px `#e6e7e4` hairline, no shadow. A pastel-wash panel on top carries the color coding; the label sits below at 19px Vend Sans with -0.44px tracking.

### Badge / Tag
8px radius, thin 1px `#838976` or `#0d1400` border, white fill, 11px Vend Sans weight 600 at wide tracking, 4px/8px padding. Lime fill for the one number that means "there is work left".

### Field
White fill, 1px `#e6e7e4` hairline, 8px radius, 16px body text. Focus swaps the hairline for the ink stroke. Labels above at 11px uppercase Olive Stone.

## Do's and Don'ts

### Do
- Use Vend Sans for all display, heading and label text; let system-ui carry body copy at 16px without competition
- Keep the tracking registers apart: tight and negative at 43–61px, wide and positive at 11–13px
- Default buttons to the outlined style and reserve the filled-dark variant for the single most important action per screen
- Use 8px radius for buttons, badges, pills and fields; 12px for cards and icon containers
- Pull `#aaff00` only for active states, selected indicators and highlight tags
- Code categories with the three pastel washes; let the rest of the page stay achromatic
- Let whitespace carry the structure: 64px between sections, no visible band dividers

### Don't
- Do not introduce filled colorful buttons — the system is outlined-first, filled-dark-second
- Do not apply the wide label tracking to body or paragraph text
- Do not add drop shadows or elevation to cards — depth comes from pastel washes and hairlines
- Do not use `#aaff00` as a page background or large surface fill
- Do not mix `#0d1400` with pure `#000000` — the faint green undertone is part of the brand voice
- Do not introduce a third border-radius value
- Do not use gradient fills — the system is flat, with color variety delivered through solid pastel surfaces

## Elevation

Elevation is intentionally absent. Cards are separated from the white canvas by 1px hairlines (`#e6e7e4`) and by color — pastel washes, not shadows. Where something needs to feel distinct, it gets a color, not a shadow. Floating panels (the new-project panel) earn their separation with the **ink** stroke instead of the hairline.

## Layout

Max-width 1200px centered content column. A single top bar — no sidebar, no mega-menu. Sections separated by generous 64px vertical gaps with no visible dividers. Cards in a 3-column grid, alternating white and pastel-wash surfaces for rhythm.

---

# How Frame It applies it

The reference above is the system. This part is the record of what it means in this codebase, including the three places where Frame It extends it — an extension is a decision, not a licence to add a fourth.

## Where each piece lives

| Piece | Where |
|---|---|
| Tokens (colors, type scale, radii, `label` / `label-xs` utilities) | `app/globals.css` |
| Button, pill, badge, card and field classes | `lib/ui.ts` — one place, so every screen agrees |
| Top bar and 1200px column | `components/AppShell.tsx` |
| Category feature cards | `components/ProjectCard.tsx`, laid out by `components/ProjectGrid.tsx` |
| Site cover shots (over the pastel wash) | `components/SiteThumb.tsx`, `app/api/thumb/route.ts` |
| People's faces (over the same washes) | `components/Avatar.tsx`, `lib/avatar.ts`, `app/api/avatar/route.ts` |
| The wash table itself — class and hex, one row each | `lib/author-color.ts` |
| Floating context menu (ink stroke, no shadow) | `CardMenu` in `components/ProjectCard.tsx` |
| Filled-dark CTA (one per screen) | `components/CtaButton.tsx` |
| Caution surface (peach) | `components/FormMessage.tsx`, `components/AnnouncementBar.tsx`, the delete section of a project |
| Pastel wash per project, author identity colors | `lib/author-color.ts` |
| Motion tokens and shared movements | `lib/motion.ts` |
| Sliding-ink pill switch (filters, sign-in tabs) | `components/PillSwitch.tsx` |
| The one waiting indicator | `components/PendingBar.tsx` |
| Server-rendered list that enters on arrival | `components/StaggerList.tsx` |
| Wordmark | `components/Logo.tsx`, `public/marca/logo.svg` |
| Marks drawn on the reviewed site | `lib/annotator.ts` |
| The comment list (numbered lime disc, borderless cards) | `components/Sidebar.tsx` |

## The three extensions

1. **A monospace register for machine strings only.** URLs, page paths, CSS selectors and env-var names go in the *system* monospace stack (`font-mono` — no third webfont is downloaded). Machine strings are read character by character, and a proportional face makes `l`/`1` and `rn`/`m` a guessing game. It is never used for prose, headings or labels.

2. **Peach Wash is the caution surface.** The palette has no red, and inventing one would break the ink-on-paper logic. So anything that warns — a rejected field, a page that will not load, the delete section of a project — sits *on* `#ffe4c3` with ink on top, which is the highest-contrast pair in the system. The text always says what is wrong; the color is never the only channel.

3. **Author identity colors are data, not chrome.** The saturated palette in `lib/author-color.ts` lands on top of a stranger's website, so it has to stay visible over any background and keep two people apart at a glance. It is exempt from the palette rules for that reason, and it never appears in the app's own chrome. On the page itself every outline is drawn twice — lime inside, ink outside — because neither alone survives both a white and a black site.

   The avatars share that logic and stop just short of it. A face is identity too, so it is exempt from "no third radius" in the same way an outline is — it is a disc, which the grid of two radii has no name for. But the *surface* it sits on is not exempt: an avatar's background is one of the four the system already owns — the three pastel washes and the hairline grey — so the faces belong here even though the drawings come from outside. Its owner picks which one, and until they do it is the wash their outline color already hashes to, so a team that has never opened the account screen still reads as three colors and not one. Choosing a background is choosing among surfaces the app uses elsewhere, never opening a color picker. The saturated identity color only appears on a face as a ring, and only where the outlines it names are on screen: the team list of a project, never the top bar.

   The style list in `lib/avatar.ts` is closed for the same reason. DiceBear ships fifty-odd sets and most of them have gradients, shadows and volume; the eight in that list are flat and drawn in line, which is how you draw on paper. `backgroundType=solid` is pinned in the route so no style can slip a gradient in.

## Motion

One library — GSAP — and no 3D. The system has no shadow, no gradient and no elevation, so there is no depth to animate; what moves here are flats of paper on a table. Framer Motion would be a second runtime for the same job, and a WebGL canvas would contradict the one rule the surface is built on.

Every duration and curve lives in `lib/motion.ts`, next to the type scale in spirit: motion is a token set, not five separate decisions. Nothing in the app animates on hover, nothing loops for decoration, and nothing animates without a message. The test each one has to pass: **remove it, and something becomes harder to understand.**

| What moves | Why |
|---|---|
| The column of a standalone screen enters in reading order (`Reveal`) | The login and not-found screens are one block of text; entering in order says where to start reading |
| The project grid enters — again on every filter change (`StaggerList`) | "Tuyos" navigates to a new URL and rebuilds the grid in place. Two similar lists would look like a filter that did nothing |
| The lit ink slides from pill to pill (`PillSwitch`) | What you pressed is at the edge of the screen and what changed is in the middle. The travel ties them together |
| The name field opens and closes (sign-up tab) | It pushes down the button the finger was already aiming at. Opening shows where the shove came from |
| The submit button sinks and springs back (`CtaButton`) | The press is felt before the server answers |
| A lime bar sweeps while something is in flight (`PendingBar`) | One waiting idiom for the whole app — a submitted form and a client's site that has not loaded. It promises activity, not progress: neither one can say how far along it is |
| A rejected field shakes (`shake`) | The error points at where to go back to, not just that something failed |
| A validation message drops in (`FormMessage`) | The eye follows it to where it appears instead of finding it already there |
| The announcement bar opens to its height (`AnnouncementBar`) | It arrives mid-session and pushes the whole workspace down. Appearing at once reads as everything moving on its own |
| The draft form unfolds in the sidebar | The click happened inside the iframe, half a screen away. What opens is what carries the eye to where you now have to type |
| The comment list closes its gaps by moving (`useListMotion`) | Deleting and resolving are round trips to the database with no optimism: the list settles tenths of a second after the click, far from where you are looking |
| A new comment card fades up into place | The save is not optimistic — the card existing *is* the receipt |
| The resolved disc pinches (`pop`) | Says which of eight cards answered, on the one 32px target that means it |
| A lime frame lights around the preview while picking | The order is given in the sidebar and carried out inside the iframe. Without it the only sign the mode is armed is a crosshair cursor you see only once you are already over the target |
| The loading veil fades instead of vanishing | An opaque panel disappearing in one frame reads as a paint bug |
| A card menu drops in on open (`CardMenu`) | It appears under the cursor, away from what the eye was on. The 6px travel says it came from the card that was pressed |
| A cover shot fades in over its wash (`SiteThumb`) | It lands seconds after the card, from a third party that may never answer. Cutting in reads as a paint glitch; fading reads as a photo that has just arrived |
| An avatar does **not** fade (`Avatar`) | The counter-example, and it belongs in this table for that reason. The face arrives over a disc of the very wash it carries as its own background, so there is no color change to soften and nothing to explain. A fade here would be an animation with no message — the test every row above had to pass |
| The mark on the reviewed page beats twice (`lib/annotator.ts`) | One flash of colour on someone else's page is indistinguishable from a rendering artifact; two beats read as a signal |

**Reduced motion is a first-class path, not a fallback.** Entrances declare themselves through `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`; loose movement — a click, an error — asks `reducedMotion()`. Their starting states live in `app/globals.css` behind `(scripting: enabled) and (prefers-reduced-motion: no-preference)`, so a browser without JS and a person who asked for stillness both get the finished screen and never a hidden one. Anything an animation *establishes* (a lit pill, a mounted field) is also correct without it: nothing that matters may depend on a tween running.

## Fitts's law, as applied

- **The card is the target.** A project card opens the workspace from anywhere in it (a stretched `after` overlay, so the markup stays one link deep). Everything else — settings, delete — is in a menu, opened with the right button anywhere on the card or with a 32px `···` in the title row. That button is not a duplicate: a right-click cannot be discovered, reached from a keyboard, or performed on a phone.
- **The screen's verb is the biggest thing on it.** One filled-dark button, at least 48px tall, full-width in forms: "Crear proyecto", "Abrir espacio de trabajo", "Comentar un elemento".
- **A face is not a target.** Avatars are never clickable and never carry a tooltip of their own. They sit inside something that already is one — the account pill, a team row, a comment card — so a 24px disc never becomes a 24px hit area competing with the row it labels. The one exception is the account screen, where picking a face *is* the action, and there the target is a 40px drawing inside a 12px-radius card, not the disc.
- **A comment is one target, and the number is its handle.** In the review sidebar the whole card — disc, author, text — goes to the element on the page. The issue number sits in a 32px lime disc, the largest and only saturated thing in the column, because it is what ties a row in the list to an outline on the site. Resolved swaps the number for a check on grey, so "what is left" is legible by scanning for green.
- **Destructive actions are deliberately small and far.** Delete, remove, sign out stay in the quiet text register — never next to something pulled dozens of times a day. What makes them findable is the surface they sit on, not their size. In the card menu, where there is no surface to sit on, the peach only arrives under the pointer — and the browser's own confirmation, which nothing can paint over, is what actually stands between a slip and someone else's comments.

## Borders

One hairline per boundary that actually divides two kinds of thing — the sidebar from the site, the chrome from the list, the page from its footer. Never one per row: a list of eight comments is not eight rectangles. What separates items in a list is space; what says which one you are about to press is the `#e6e7e4` fill under the pointer.

## Copy

One idea per line, and no line that repeats what the screen already shows. Helper text appears only when it says something invisible — that you are a viewer, that the page did not load, that you must now click inside it. When a button explains itself, nothing goes under it.
