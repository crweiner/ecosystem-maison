# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro static site, hosted on Automattic's Spacefast (space `ecosystem-maison` on team `chandler-team`, managed with the `sf` CLI). Source lives in the public GitHub repo `crweiner/ecosystem-maison`, and every change is committed and pushed. The home page is one page, but it must be built from reusable Astro layouts, components and data so more pages or products can be added without restructuring. Follow the architecture of its sibling, cosmos.maison (`../cosmos-maison`, branch `astro-galaxy-home`).

## Users

The general public. They reach ecosystem.maison from outside links, or from cosmos.maison, and are curious enough to click. Some want a quick surprise and will take the random jump straight away. Others want to browse and learn which WordPress products belong to Automattic.

## Product Purpose

ecosystem.maison is the companion to cosmos.maison. Cosmos presents Automattic's consumer brands. This site presents the WordPress side of the business, the "ecosystem." It does two jobs:

1. **Random jump.** "Explore a random ecosystem" sends the visitor straight to the website of one ecosystem product, chosen at random.
2. **Exploration.** A single scrolling page with one stop per ecosystem product, so visitors can see the whole ecosystem and pick one themselves.

A visit succeeds when the visitor leaves for an ecosystem product's site, either through the random jump or through a product stop.

## Positioning

This is the only place that presents Automattic's WordPress products together as one living ecosystem, and the only one that offers a jump to a random member of it. It is the counterpart to cosmos.maison: that site is a galaxy, and this one is a forest.

## Operating Context

- Domain: ecosystem.maison. Sibling site: cosmos.maison.
- Ecosystem products, in page order (each has a stop and is a random-jump destination): **WordPress.com**, **WooCommerce**, **WordPress VIP**, **Jetpack**, **Akismet**, **Newspack**, **Gravatar**. Keep the list as data (the equivalent of cosmos's `src/data/brands.ts`), so adding a product adds its stop, its index entry and a jump destination.
- Random jump: a uniform random pick in the browser that never repeats the product chosen last in the same session. Match cosmos's behavior, including a shareable random-jump route that falls back to a plain list of destinations when JavaScript is off. Spacefast serves static files only.
- Visitors use both pointer and touch devices.

## Capabilities and Constraints

- Home page title: **"Welcome to our Ecosystem"**.
- Supporting line: **"Explore Automattic's ecosystem of WordPress products"**. Visible copy calls the group an "ecosystem," never a "family."
- Primary actions: **"Explore a random ecosystem"** (sends the visitor to a random product's site) and **"I want to explore"** (scrolls down to the product stops). The random action appears at both the very top and the very bottom of the page.
- Each product has its own anchor on the home page with its official logo, a short plain tagline, an original haiku and a link to its site.
- Every outbound link carries `utm_source=ecosystem.maison&utm_medium=referral&utm_campaign=ecosystem` plus a `utm_content` value naming the path the visitor took (for example `jump`, `stop`, `jump-link`, `jump-list`). A single `referral()` helper applies the tags, and no link may leave the site without them.
- Haikus and taglines use no em dashes (owner preference). A tagline describes the product in one line and makes no claims.

## Brand Commitments

The owner stated these binding constraints for the home page:

- The whole site is **beautiful, artistic pixel art** of a thriving forest ecosystem. The visitor scrolls through small scenes of forest life, for example a deer eating grass, a bear catching salmon in a river, or bees pollinating flowers.
- **Top of the page:** a pixel art deer grazing in grass at **sunrise**.
- **Between stops:** each time the visitor scrolls from one level to the next, they pass through pixel art trees.
- **One forest scene per product.** Each product stop is its own scene of forest life.
- **Bottom of the page:** the grazing deer again, this time at **sunset**.
- **Random jump:** when the visitor clicks "Explore a random ecosystem," the deer runs off the right side of the screen, then the random product's site loads.
- The structure mirrors cosmos.maison: hero, product stops with anchors, logo, blurb, haiku and a tagged link, and a random action.

Each product's name and logo must be used exactly as that product publishes them.

## Evidence on Hand

- Sibling implementation and conventions: `../cosmos-maison` (branch `astro-galaxy-home`). This includes its data model, `referral()` tagging, the warp route and its accessibility approach.
- Logos have not been collected yet. Take each official mark from the product's own site or press kit, record its source, and never redraw or approximate it.
- Taglines and haikus are still to be written: original copy in the cosmos style, approved by the owner before it ships. They are not quotes or endorsements.
- There are no testimonials, metrics or press, and none may be invented.

## Product Principles

1. **One click to somewhere real.** Both paths end on a real ecosystem product's site. The deer's exit sets the mood, but it never makes the jump feel slow.
2. **The ecosystem, not a sales pitch.** Each stop introduces its product with one plain line, then links out. It makes no claims about the product.
3. **Wonder without friction.** The forest sets the mood, but the title, the text and both actions stay readable and usable at all times.
4. **A companion, not a copy.** Share cosmos.maison's structure and conventions, but make this site a world of its own.
5. **Built to grow.** Add each new product or page as data plus a reusable template. Never hand-build a one-off section.

## Accessibility & Inclusion

The audience is the general public, so the site targets WCAG 2.2 AA. All animation, including the deer's run, respects `prefers-reduced-motion`. The page must stay fully usable with keyboard, touch and screen readers, and both actions and every product stop must work with the animation turned off. Pixel art scenes are decorative unless they carry meaning, and must never be the only way content is conveyed.
