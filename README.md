# Stable Syntax

A one-page site for a fictional web design studio.

Open `index.html` through a local server — `npx serve .` or any static host.
No build step, no dependencies, no framework.

## The idea

"Luminous Editorial." One slow-drifting gradient mesh sits behind the entire
page, fixed, so scrolling reads as movement through a single continuous field
rather than past four separate backgrounds. Everything panel-shaped on the page
is the same glass card primitive — a translucent fill, a gradient hairline drawn
with a masked pseudo-element, and a sheen that tracks the pointer.

The boldness is spent in three places: the hero headline, the numbers, and the
process spine. Everything else is deliberately quiet so those three land.

### Why not the purple gradient

The obvious move for "premium 2026 agency" is a violet-to-magenta mesh. Every
studio ran it in 2024 and it now reads as *AI product*, not *design studio*.
This uses azure → aqua as the signature pair and holds ember in reserve for
warmth in the mesh and the button hover. It stays in the same luminous register
without the association.

## Design system

### Colour

| Token | Dark | Light | Role |
|---|---|---|---|
| `--bg` | `#08090D` | `#F6F8FC` | page |
| `--surface` | `#0F121A` | `#FFFFFF` | opaque panels |
| `--surface-2` | `#141824` | `#F0F3F9` | inputs, chips |
| `--text` | `#EDF1F8` | `#0A0D14` | primary text |
| `--muted` | `#98A2B6` | `#55607A` | secondary text |
| `--line` / `--line-firm` | white 9% / 16% | ink 10% / 20% | hairlines |
| `--azure` | `#5B8CFF` | `#1F5AE0` | accent, gradient start |
| `--aqua` | `#3FD9C4` | `#0A8378` | gradient end, success |
| `--ember` | `#FFA860` | `#B4630B` | warm signal, hover sheen |
| `--warn` | `#FF8D7A` | `#B4231A` | form validation only, never brand |

Every text pair clears WCAG AA in both modes: `--muted` is 7.7:1 on dark and
5.9:1 on light, `--azure` is 6.3:1 and 5.5:1. `--warn` exists separately because
a green error message is a usability problem, not a branding opportunity.

Dark is the default for a first-time visitor rather than a fallback — it is the
identity. A returning visitor's own choice always wins. To follow the OS
instead, swap the fallback in the pre-paint script in `index.html`; the line to
change is commented.

### Type

Three families, each with one job.

- **Display** — Syne, 650–700 weight, tracking -0.045em on the hero and -0.038em
  on section heads. Its wide apertures and flat terminals are what keep the big
  type from reading as generic geometric sans.
- **Body** — Manrope, 400, 17px / 1.65.
- **Data and labels** — Geist Mono, for eyebrows, tags, phase numbers, durations,
  and the footer. Uppercase at 0.16em tracking. The `<link>` in `index.html` and
  `--f-mono` in `styles.css` have to name the same family — if they drift, the
  labels fall back to the system monospace without any error to tell you.

### Shape and motion

- Four radii — 4 / 14 / 22 / 999px — and nothing in between.
- One signature curve, `cubic-bezier(0.22, 0.61, 0.24, 1)`, plus an overshoot
  curve for anything that enters. Four durations: 160 / 320 / 620 / 900ms.
- GSAP ScrollTrigger handles section and card entrances; Lenis forwards its
  scroll updates when smooth scrolling is active. If GSAP is unavailable,
  `IntersectionObserver` keeps process states working and content stays visible.
  The nav condense watches a 1px sentinel, while the read-progress bar and
  parallax use CSS scroll timelines where supported. Older browsers use one
  passive, rAF-batched listener for parallax, with reads before writes.
- Only `transform`, `translate`, `scale` and `opacity` are animated, so nothing
  leaves the compositor.
- `prefers-reduced-motion` collapses everything to its resolved state. The mesh
  keeps its colour and only stops drifting — it is a tint, not a routine.
- `prefers-reduced-transparency` swaps every glass surface for an opaque one;
  `backdrop-filter` is the expensive part, not the colour.
- `prefers-contrast: more` firms up the hairlines and lifts `--muted`.

### The moments

| Where | What |
|---|---|
| Nav (≤900px) | The links become a disclosure panel — Escape and outside-press close it |
| Hero background | A Three.js shader field — see below |
| Hero headline | Words are wrapped in overflow masks and rise on a 55ms stagger |
| Sections and cards | ScrollTrigger reveals on entry, with existing per-element delays |
| Hero stats | Count up from zero on view, ease-out cubic, 1100ms |
| Primary CTA | Magnetic — follows the pointer up to 7px, then releases |
| Every card | Gradient hairline strengthens and a radial sheen tracks the pointer |
| Client row | Duplicated row translated -50%, so the loop point never shows a seam |
| Photography | ±6% scroll-scrubbed parallax inside its frame |
| Process | A gradient spine fills left-to-right (top-to-bottom on mobile), dots landing ahead of it |
| Service image | Grayscale lifts to full colour, image scales, gradient veil recedes |

The magnetic and sheen effects are bound only on `(hover: hover) and (pointer:
fine)`, so touch devices never pay for them.

### A silent scroll-timeline trap

The parallax layer cannot use a plain `animation-timeline: view()` on the image
itself. `overflow: hidden` on the media frame makes **that frame** the image's
nearest scroll container, so the image never scrolls inside its own frame and
the timeline never advances. The failure is silent — the animation holds a
constant progress instead of erroring, so it just looks like the parallax was
never written.

The fix is to name the timeline on an ancestor that is not clipped
(`.bento__cell--image`) and point the image at it.

There used to be a second trap here, worth knowing if you ever add a pinned
layout back: a `position: sticky` element does not move relative to the
scrollport while pinned, so a view timeline on anything inside it collapses the
same way. The fix is the same — hang the timeline on an unpinned ancestor.

The depth lives in one place, the `--px` custom property, and both engines read
it — the keyframes directly, `app.js` through `getComputedStyle`. Keep it below
the `scale` headroom (1.14 gives 7% a side) or the translation drags a frame
edge into view at the extremes.

### The hero field (Three.js)

One full-screen quad running a domain-warped fBm gradient in the brand colours.
No lights, no textures, no geometry beyond the quad — the whole scene is a single
draw call and the cost is entirely in the fragment shader. It reads the palette
from the CSS custom properties, so the theme toggle retints the shader rather
than fighting it.

Two things it does that are worth keeping if you edit it:

- **It renders at 0.65× pixel ratio, deliberately below 1.** The usual advice is
  to cap `devicePixelRatio` at 2, but that is for scenes with edges. At full DPR
  this shader saturated the GPU badly enough to starve `requestAnimationFrame`
  and stall the page's ordinary CSS transitions — the headline visibly failed to
  finish animating. At 0.65× with four fBm octaves it holds 118fps and looks
  identical, because nothing in it has detail finer than a few hundred pixels.
- **A measured scrim sits between the field and the copy.** At full strength a
  ribbon blends to roughly `#206660`, and `--muted` body text on that is 2.6:1 —
  a fail. The `.hero::after` gradient holds the copy side at 5:1 or better while
  leaving the right-hand side, where the field is brightest and no text sits,
  almost untouched. If you raise `uAlpha`, re-check that number.

It bows out silently in four cases — no canvas, no `THREE` global (CDN blocked),
no WebGL context, or `prefers-reduced-motion` — and in every one the CSS mesh
behind it is simply left alone, so the hero always has a background. It pauses
when the hero scrolls out of view or the tab is hidden, and disposes its geometry,
material and renderer on `pagehide`.

**Three.js is loaded from cdnjs, pinned to r128.** Keep the version pinned — a
floating `latest` URL silently breaks the scene whenever the CDN updates.

**GSAP and ScrollTrigger are loaded from cdnjs, pinned together at 3.12.5.**
Keep their versions in lockstep; if either script is unavailable, page content
stays visible and the observer fallback handles the process states.

It is one of three external origins the page depends on at runtime, none of
which resolve offline: cdnjs for Three.js and GSAP, Google Fonts for the three
families, and `picsum.photos` for the placeholder imagery. Self-host all of
them for production. Only the fonts are render-blocking; the field and the
images each degrade on their own.

## Before this goes live

This page is intended for `stablesyntax.com`, replacing the WordPress site.
Everything below is outstanding.

**Still fabricated — the blocking items:**

- **The client marquee.** Ledgerline, Kestrel Health, Osmo, Tandem Freight,
  Fieldnote, Bright Harbor, Northform and Almanac Bank are invented, and they sit
  under the heading "Trusted by teams at". The marks are geometric monograms
  rather than borrowed real logos, which is the only reason this is a content
  problem and not also a trademark one. Real names generally need the client's
  permission; the loop works fine with three.
- **The testimonial.** "Priya Raghunathan, VP Product, Ledgerline" is an invented
  person saying an invented thing. A named endorsement that was never given is
  the highest-risk item on the page. Replace it with a real quote you have
  written permission to publish, or delete the section.

**Resolved, for the record:** the three case studies (Ledgerline, Kestrel Health,
Osmo) and their invented metrics have been removed, along with the sticky deck
that presented them. The three hero stats no longer invent anything — see the
comment above `.stats` in `index.html` for what they now claim and why they are
still placeholders. The old Capabilities section, which described a design-systems
studio that does not exist, has been replaced by Services: the six real services
from `stablesyntax.com`, rewritten in this page's voice. Confirm each description
still matches what you actually do.

**Also outstanding:**

- **No city.** The contact block says "Nigeria — WAT (GMT+1)" because
  `stablesyntax.com` publishes no address. A studio should be able to say where
  it sits; add the city.
- **Trading disclosures.** The footer now says "Registered in Nigeria". If that
  means registered with the CAC, the RC number and registered address belong in
  the footer — the claim currently stands on its own.
- **Email.** The page uses `stablesyntax@gmail.com`, the address already in use.
  If you move to `hello@stablesyntax.com`, confirm it actually receives before
  shipping; a bouncing address is worse than a Gmail one.
- **No privacy policy**, and the form collects a name, email and free-text brief.
- **The contact form has no backend.** `send()` in `app.js` resolves after 900ms
  so the loading, success and error states are all reachable. Point it at a real
  endpoint; the rejection branch is already wired to the error state.
- **Images** are `picsum.photos` placeholders. Desaturated and veiled so stock
  reads as intentional, but still stock.
- **Fonts** load from Google Fonts via `<link>`. Self-host them for production.
- **No favicon** (the 404 in the console) and **no Open Graph or Twitter tags**.

## Files

```
index.html    markup
styles.css    tokens, layout, motion, scroll timelines
scene.js      the hero's Three.js field (optional — the page works without it)
app.js        theme, nav, headline split, reveals, marquee, parallax fallback,
              sheen, magnetics, counters, form
```
