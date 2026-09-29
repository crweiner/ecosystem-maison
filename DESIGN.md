---
name: ecosystem.maison
description: Automattic's WordPress ecosystem as one day in a hand-lit pixel-art forest, with plain, readable words set into the scene.
colors:
  gold: "#ffcf5a"
  gold-bright: "#ffe39a"
  gold-deep: "#9a5a14"
  ink: "#f7f0e2"
  ink-soft: "#e2d6c0"
  ink-faint: "rgb(247 240 226 / 0.5)"
  night: "#0d0d16"
  night-veil: "rgb(13 13 22 / 0.55)"
  earth: "#121016"
  drop: "rgb(8 8 14 / 0.7)"
  focus: "#ffe39a"
  dawn-plum: "#2a1b3d"
  board-paint: "#2c1d15"
  board-wood: "#7a5234"
typography:
  display:
    fontFamily: "'Pixelify Sans Variable', 'Pixelify Sans', ui-sans-serif, sans-serif"
    fontSize: "clamp(2.6rem, min(1rem + 5.4vw, 13vh), 6rem)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "0.005em"
  headline:
    fontFamily: "'Pixelify Sans Variable', 'Pixelify Sans', ui-sans-serif, sans-serif"
    fontSize: "clamp(2.2rem, min(0.9rem + 4vw, 11vh), 4.75rem)"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "0.005em"
  verse:
    fontFamily: "'Pixelify Sans Variable', 'Pixelify Sans', ui-sans-serif, sans-serif"
    fontSize: "clamp(0.95rem, calc(100cqi / var(--measure, 20)), 2.1rem)"
    fontWeight: 450
    lineHeight: 1.34
  title:
    fontFamily: "'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.15rem, 0.95rem + 0.75vw, 1.5rem)"
    fontWeight: 400
    lineHeight: 1.4
  body:
    fontFamily: "'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Next', ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1rem, 0.94rem + 0.25vw, 1.1875rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.01em"
  caption:
    fontFamily: "'Pixelify Sans Variable', 'Pixelify Sans', ui-sans-serif, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    letterSpacing: "0.02em"
rounded:
  none: "0px"
spacing:
  px: "4px"
  gutter: "clamp(1.25rem, 5vw, 5.5rem)"
  action-gap: "1rem"
components:
  plate-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.night}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.72em 1.15em 0.66em"
    height: "2.75rem"
  plate-primary-hover:
    backgroundColor: "{colors.gold-bright}"
    textColor: "{colors.night}"
  plate-ghost:
    backgroundColor: "{colors.night-veil}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.72em 1.15em 0.66em"
    height: "2.75rem"
  plate-ghost-hover:
    textColor: "{colors.gold-bright}"
  plate-small:
    padding: "0.55em 0.9em 0.5em"
  index-tick:
    backgroundColor: "{colors.ink-faint}"
    size: "8px"
  index-tick-current:
    backgroundColor: "{colors.gold}"
    width: "20px"
  wander-status:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.night}"
    padding: "0.55em 1em 0.5em"
---

# Design System: ecosystem.maison

## Overview

**Creative North Star: "Widescreen Pixel Cinema"**

Every screen is a still from a slow, wordless pixel-art film: small creatures staged in vast, flat-banded light, one clearing per product, walked through a single day from plum dawn to ember dusk. The forest is a fixed canvas behind the page, rendered about 150 world pixels tall and scaled up by a whole number, so each world pixel is a crisp square (the `--px` unit, 2 to 10 CSS px, typically 3 on a small phone and 7 on a 32:9 monitor). The page's own controls, borders, notches, ticks and drop shadows are drawn in that same unit, so a button sits on the same grid as the deer.

The HTML layer is deliberately quiet: cream ink on the forest, one sun-gold accent, a pixel-grid face for titles and verse, a hyperlegible humanist for reading. There are no cards, panels or surfaces. Words are set directly into the scene with a one-pixel hard drop, and depth comes from the world (haze, ridges, trunks), not from UI chrome. The canvas is an enhancement: without script or canvas the page keeps a still, hard-stepped dawn sky and every action works as a plain link.

The world refuses the bright, multi-layer parallax "indie game trailer" forest: no chunky logo, no Start button, no smooth gradients, no fractional scaling.

**Key Characteristics:**
- One integer pixel unit (`--px`) for sprites, plate borders, notches, shadows and ticks.
- Light in stepped, flat bands; ordered (4x4 Bayer) dither for every transition, shade and mist.
- One continuous sky: nine keyframes from 05:24 to 20:00, advanced exactly by scroll.
- Every canvas color is a material lit by the current sky (five tones: deep shade, shade, base, lit, rim).
- Controls are notched pixel plates that press down into a one-unit hard shadow.
- Cream words, one gold accent, no surfaces behind text.

## Colors

The HTML palette is tiny and warm (cream ink, sun-gold, near-black night); every other color on screen belongs to the canvas and comes from the day-palette keyframes (see the sidecar `dayPalette`).

### Primary
- **Sun Gold** (gold): the primary plate face, the current-clearing tick, the masthead's pixel sun, link color in the colophon and the /wander/ list, text selection, and the wander-status bar. It is the sun's color on the page.
- **Morning Gold** (gold-bright): hover state of gold elements, ghost-plate hover text, and the focus ring (the `focus` token carries the same value).
- **Burnt Umber** (gold-deep): the primary plate's one-pixel hard shadow and the scrollbar thumb. Never a text or fill color.

### Neutral
- **Cream Ink** (ink): titles, haikus, the masthead wordmark, ghost-plate text.
- **Parchment** (ink-soft): ledes, taglines, captions, the colophon, ghost-plate outline, index labels at rest.
- **Faint Ink** (ink-faint): the arc dots of the sun mark, index ticks at rest, the /wander/ list rules.
- **Night** (night): text on gold; the base of the ghost plate's veil (night-veil, 55%; 80% on hover).
- **Forest Floor** (earth): the page background under the canvas and the scrollbar track.
- **Drop** (drop): the one-pixel type shadow; logos and the sun mark use the same near-black at 55 to 60%.
- **Dawn Plum** (dawn-plum): theme-color and the favicon sky; the no-canvas fallback sky runs hard stops from #1b1433 to #141418.

### Named Rules
**The One Sun Rule.** Gold is the sun's color and the only accent in the HTML layer. It marks the primary action, where you are, and focus. Brand color lives only inside product logos.

**The Lit, Not Painted Rule.** Canvas colors are never picked per scene. A sprite has one albedo and is lit by the sky at its hour through the five-tone Material ramp, so the same deer is plum at dawn and ember at dusk.

## Typography

**Display Font:** Pixelify Sans Variable (with ui-sans-serif)
**Body Font:** Atkinson Hyperlegible Next Variable (with ui-sans-serif, system-ui)

**Character:** A pixel-grid face for the words that belong to the world (titles, haikus, wordmark, index labels) and a hyperlegible humanist for the words you have to read or act on (ledes, taglines, plate labels). The root size scales with the viewport, `clamp(100%, 0.3vw + 0.62vh + 0.1rem, 150%)`, so type keeps its weight against an ultrawide forest.

### Hierarchy
- **Display** (Pixelify 600, clamp(2.6rem, min(1rem + 5.4vw, 13vh), 6rem), 0.98): the hero title only, max 10ch, balanced.
- **Headline** (Pixelify 600, clamp(2.2rem, min(0.9rem + 4vw, 11vh), 4.75rem), 0.98): the close title and utility-page titles.
- **Verse** (Pixelify 450, sized from the column by container units and the longest line, 1.34): the haiku, one verse per line, lines two and three stepped in by 1.1em and 0.55em, with a hanging indent if a verse must wrap.
- **Title** (Atkinson 400, clamp(1.15rem, 0.95rem + 0.75vw, 1.5rem), 1.4): the hero lede, max 30ch, in ink-soft. Stop taglines use the same face at clamp(1rem, 0.95rem + 0.25vw, 1.1875rem), max 34ch.
- **Body** (Atkinson 400, 1.0625rem, 1.5): running text on utility pages.
- **Label** (Atkinson 700, clamp(1rem, 0.94rem + 0.25vw, 1.1875rem), 0.01em): plate labels.
- **Caption** (Pixelify 500, 0.9375rem, 0.02em): wordmark, colophon, index labels.

### Named Rules
**The Voice Rule.** The haiku is the scene's voice and is never set smaller than the tagline on any screen.

**The Two Faces Rule.** Pixelify for what the world says, Atkinson for what the visitor reads and presses. Every word on the page carries the one-pixel hard drop (`--type-shadow`); none sits on a panel.

## Layout

A full-bleed canvas fixed behind a scrolling page. Each clearing (hero, seven stops, close) is at least one small-viewport height (`100svh`); between clearings sits an empty 50svh band; the wall of trunks crosses the frame over that band plus half a screen either side (about 1.5 screen heights of scroll), and the next clearing swaps in behind its densest trunks. Every trunk rank enters exactly at the right edge and leaves exactly at the left, so nothing appears or vanishes inside the frame. Each clearing is painted once at its own hour and never re-tinted while scrolling; time passes behind the wall, and the masthead's sun mark tracks the interpolated hour continuously.

Stops use a 12-column grid (gap min(1.5rem, 1.6vw)) with side gutters of clamp(1.25rem, 5vw, 5.5rem), safe-area aware. Copy alternates sides down the day: columns 1 to 5 on even stops, 7 to 11 on odd ones (max 31rem); at 1099px and below it widens to six columns. The engine reads where the copy sits and stages the scene's creatures in the remaining space. The hero copy sits bottom-left (max min(46rem, 52vw)); the close copy sits right.

Breakpoints: stacked below 760px wide, and in portrait up to 1099px: the scene fills the top 52 to 56svh and the words sit below it on the dark forest floor. Short landscape (height 520px or less) tightens padding and shrinks the display to about 13vh. The stop index drops its labels to ticks only below 760px wide or 520px tall; coarse pointers get 2.75rem targets.

The pixel unit is `round(vh / 150)`, capped so at least ~110 world pixels fit across, clamped to 2 to 10 CSS px, and written to `--px` on the root.

## Elevation & Depth

The HTML layer is flat. Depth is the world's: three hazed ridges (far mountains, a hazed middle treeline, the forest edge) dissolve into the sky's `haze` color with distance, trunks run far-to-near with near ones dark and rimmed, and water mirrors whatever is drawn above it. The only UI shadows are one-unit hard drops, straight down, never blurred.

### Shadow Vocabulary
- **Type drop** (`0 max(2px, calc(var(--px) / 2)) 0 rgb(8 8 14 / 0.7)`): every word on the page, like type set into the scene.
- **Plate floor** (`filter: drop-shadow(0 var(--px) 0 var(--gold-deep))`): the primary plate stands on one world pixel of burnt umber; the ghost plate stands on night at 60%.
- **Mark drop** (`drop-shadow(0 max(2px, calc(var(--px) / 2)) 0 rgb(8 8 14 / 0.55 to 0.6))`): product logos, the sun mark, index ticks.

**The Resting Forest Rule.** The world animates at 24 frames a second while someone is scrolling, pointing or tapping. Left alone for six seconds it keeps breathing at 8 frames a second, sleeping between frames on a timer, and any activity returns it to 24 at once. Hidden tabs do not animate at all.

**The Forest Answers Rule.** Every clearing answers the hand in its own terms, and nothing needs explaining. Hover: grass, reeds, flowers, foxglove spikes and ferns swing on soft, slightly underdamped springs when a moving hand brushes them, in the direction and with the speed of the swipe, exactly like a passing gust (a resting hand pushes nothing, so stems never snap); water carries a wake; the web trembles where it is touched; the stag, squirrel, hummingbird, bees and fireflies notice. Tap: grass flattens in a spreading ring; water splashes (rings plus a crown of drops); the stag hops away and looks back; a swimming beaver slaps its tail and dives; the oak sheds leaves and acorns and its climber hurries; tapping near the falls sends a salmon leaping into the bear's jaws; a foxglove springs, sheds petals and draws the hummingbird; the web rings, shakes loose its dew and brings the spider; a flower puffs pollen and calls the bees, the lime tree drops blossom and empties its hollow; nearby fireflies flash as one. Taps never land on words, controls or boards, or mid-wall. On a fine pointer the cursor becomes a pointer over anything that would answer. Under reduced motion there is no ambient loop, but a tap still plays out briefly so it is acknowledged.

**The Park Signage Rule.** The words never sit on bare sky. In the dawn and dusk meadows they are carved into a park entrance sign (umber painted planks, a cream routed border groove, a cap board). At each product clearing they are posted on a trailhead kiosk: a shingled cedar roof, a dark painted plank panel (#2c1d15, barely tinted by the hour so text always clears AA), and a wooden frame lit by the clearing's own hour. Signs carry no posts: they scroll with the words, so posts tied to the ground would stretch as you scroll. A wing of pinned things faces the scene: a parchment trail map of the clearing's landmark with a red "you are here" dot, an enamel pictogram of the resident, and a pamphlet box; on stacked layouts they sit in a band above the words. Pictograms only, never painted words. The site's small print (the colophon) is part of the closing sign, under its actions and a faint divider, never floating over the scene. Boards are drawn by the engine (src/scripts/forest/signs.ts) from the words' box, so they scroll with the text; they step aside during the deer's run, and without the forest a plain CSS board stands in. A small fixed readout ("3 / 7 · WordPress VIP") opposite the masthead names the current clearing on every screen, including touch.

### Named Rules
**The Hard Light Rule.** Light falls in stepped, flat bands and shadows are hard. Where the world needs a gradient (sun glow, sky, mist, shade) it steps through dithered bands; no smooth gradient appears on the canvas or in the fallback sky.

## Shapes

Everything is rectilinear and on the pixel grid. There are no border radii. Plates take a notched corner: one `--px` step cut from each corner with a clip-path, the pixel-art way of rounding. Icons are drawn on an 8x8 grid in whole cells (`shape-rendering: crispEdges`); the sun mark is a dotted pixel arc over a one-pixel ground line. On the canvas, trunks are round by shading (dark far limb, lit band toward the sun, a single rim pixel on the sunward contour), crowns are leaf clumps, and rocks are broken stone.

## Components

### Buttons (pixel plates)
Tactile and toy-like: a plate is a notched gold tile that you press into the ground.
- **Shape:** notched rectangle, one `--px` step per corner; min height 2.75rem.
- **Primary:** sun-gold face, night label (Atkinson 700), pixel icon at 3 `--px` wide after the label, standing on a one-unit burnt-umber floor.
- **Hover / Active / Focus:** hover brightens to morning gold; active drops the plate one `--px` and removes its floor, animated in `steps(2, end)` over 120ms; focus is a one-`--px` morning-gold outline offset 1.5 `--px`.
- **Ghost:** night veil at 55% with a one-`--px` inset parchment outline and cream label; on hover the veil deepens to 80% and outline and label turn gold.
- **Small:** 1rem label, tighter padding; used for each stop's outbound "Visit" link.

### Navigation (stop index)
- A fixed column of pixel ticks on the right edge (2 `--px` squares in faint ink). The current clearing's tick grows to a 5 `--px` gold bar; hovering or focusing reveals the product name in Pixelify, stepping in (`steps(3, end)`, 200ms). The index fades out while the deer runs.

### Sun Mark (masthead)
- A 17 `--px` pixel arc with a 3x3 gold sun that moves along it with the forest's hour, beside the wordmark caption. It is the page's clock.

### Stop (clearing)
- Logo (the product's official mark, reversed white where published, with a mark drop), tagline in parchment, haiku in cream Pixelify, and a small ghost plate out. Alternates sides; the engine stages creatures opposite.

### Wander status
- A flat sun-gold bar at the top center with a night Pixelify label ("Following the deer to ..."), shown while the page leaves. It is not notched, unlike the plates.

### The deer's run (signature interaction)
- The random action startles the deer, which turns and bounds off the right edge; the page leaves as it clears the frame, capped at 1.3s. Under reduced motion or without the canvas, the status shows and the page leaves after 600ms.

## Do's and Don'ts

### Do:
- **Do** draw every UI edge, notch, tick, outline and shadow in whole multiples of `--px`.
- **Do** light new sprites through the Material ramp from a single albedo; let the sky at the scene's hour color them.
- **Do** step every transition in the world with ordered dither and flat bands; step UI motion too (`steps()` timing for presses and the index).
- **Do** give each new product a clearing with its own creature, an hour in page order, a tagline, a haiku and a tagged link, added as data.
- **Do** keep a still, working page without script, canvas or motion: the stepped fallback sky, plain links, no wall under reduced motion (a clean cut halfway between clearings).
- **Do** use each product's official logo as published, never redrawn.

### Don't:
- **Don't** scale the world by a fractional amount or smooth it (`image-rendering: pixelated`).
- **Don't** use smooth CSS or canvas gradients, blurred shadows or border radii.
- **Don't** put words on cards or panels; words sit in the scene with the type drop.
- **Don't** add a second accent color to the HTML layer; gold is the sun.
- **Don't** add a parallax stack of saturated layers, a chunky logo or a Start button.
