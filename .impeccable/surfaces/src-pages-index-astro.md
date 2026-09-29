---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/pages/wander.astro"]
---

# Home page (ecosystem.maison)

Scope: the single home page at `/`, plus the shareable `/wander/` random link. Visitor mode: Experience. The forest leads, but the Persuade rule applies: within seconds the visitor must know what this is and see both actions. Success means the visitor leaves for an ecosystem product's site, through the random jump or through a product stop.

Audience: the general public, arriving from outside links or from cosmos.maison, on any screen from small phones to ultrawide monitors (the owner requires that the page look great at every aspect ratio).
Actions: "Explore a random biome" is primary and appears in both the hero and the close. It leaves in the same tab for a random product, never the one chosen last. "Walk the trail" is secondary and scrolls to the first stop.
Content: seven stops (WordPress.com, WooCommerce, WordPress VIP, Jetpack, Akismet, Newspack, Gravatar), each with its official logo, a one-line tagline, an original haiku and a tagged outbound link. No claims, metrics or testimonials.
Constraints: Astro static output on Spacefast, with no server code. WCAG 2.2 AA. The page must work under reduced motion, without canvas and without JS.

Scenes (morning to dusk, in page order): hero, a deer grazing at sunrise · WordPress.com, beavers building a lodge · WooCommerce, squirrels storing acorns in an oak · VIP, a bear catching salmon at a waterfall · Jetpack, a hummingbird darting between flowers · Akismet, a spider web catching gnats while dew slips through · Newspack, bees carrying pollen · Gravatar, fireflies in the dimming wood · close, the deer grazing at sunset.

## Direction contract

THESIS: Each stop is a still from a slow, wordless pixel-art film, with small creatures staged in vast, painterly light. The page refuses the category default: the bright, multi-layer parallax "indie game trailer" forest with a chunky logo and a Start button.
OWN-WORLD: Hand-authored pixel art at a single integer pixel unit (sprites, borders and spacing alike, and never a fractional scale). Light falls in stepped, flat bands and never as smooth gradients. Aerial haze separates the ridge and tree-line layers. Ordered dither makes shade and scrims. The sky runs one continuous day, from plum-and-coral dawn through a high blue noon to amber dusk and an ember sunset. Water mirrors the world above it. UI atoms are pixel plates: a button presses down into its own one-unit hard shadow. The titles use a pixel-grid face, and the reading text uses a hyperlegible humanist.
STORY: The visitor meets a deer at dawn and understands that this is Automattic's WordPress ecosystem as a living forest. They either send the deer running (a random jump) or walk the day through seven creature scenes, one per product, and leave through one.
FIRST VIEWPORT: A full-bleed widescreen dawn: a huge low sun behind stepped ridges, mist, and a lone deer grazing on a grass knoll in the lower third, placed opposite the text. The title "Welcome to our Ecosystem" is large at the left over a dither-shade band, with the line under it and both actions in the same column: Random is a solid sun-gold pixel plate and Explore is an outlined plate. A sun-arc marker sits in the margin, and the stop index sits on the right edge. In portrait, the scene fills the top and the text sits on dark foreground earth.
FORM: Widescreen Pixel Cinema (after Superbrothers' Sword & Sworcery), candidate 4 on the ordered list, seed key ee8a68a3. Signature interaction: the deer's run. Clicking random makes the deer startle, lift its head, turn and bound off the right edge, and the page leaves as it clears the frame (about 1s at most; with reduced motion the page leaves immediately). Also, gentle response to the pointer: grass parts, fireflies drift toward it, deer ears turn. Motion grammar: one shared wind clock rolls gusts through every layer, a wall of tree trunks passes between levels while the next scene swaps in behind them, and the sky advances exactly with scroll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved
- Taglines and haikus are owner-approved (2026-09-28). The close headline ("Pick a path, any path") has not been separately confirmed.
- The logo colorways on the scenes use each brand's published reversed (white) mark where one exists.
