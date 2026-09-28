---
target: critique home
total_score: 21
max_score: 32
na_heuristics: 7,10
p0_count: 2
p1_count: 2
target_identity: "file:/Users/chandlerweinera8c/Documents/GitHub/ecosystem-maison/src/pages/index.astro"
target_fingerprint: "sha256:e7059d318d6ef27f535176ee4a65af187fd94cfc8aceefff4923e9ba8cace385"
target_path: /Users/chandlerweinera8c/Documents/GitHub/ecosystem-maison/src/pages/index.astro
timestamp: 2026-09-28T22-24-59Z
slug: src-pages-index-astro
---
Method: dual-agent (A: design review · B: detector + browser evidence). Assessed build: dafa531 (frozen). Fixes made in the same run are marked FIXED.

## Design Health Score (21/32, 66%, Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Stop index went dark for the whole wall (FIXED: last clearing stays lit); sun-mark clock tiny |
| 2 | Match System / Real World | 3 | Forest metaphor lands; "Explore a random ecosystem" leaves the site for one product, not an ecosystem |
| 3 | User Control and Freedom | 3 | Anchors, back to top, modifier-click bypass; random jump gives no outbound cue |
| 4 | Consistency and Standards | 3 | "Explore" means both scroll-down and leave-the-site |
| 5 | Error Prevention | 3 | No-repeat random, 1.3s cap, no-JS/no-canvas fallbacks |
| 6 | Recognition Rather Than Recall | 2 | Seven index ticks unlabeled at rest; no labels on touch |
| 7 | Flexibility and Efficiency | n/a | One-page experience |
| 8 | Aesthetic and Minimalist Design | 2 | Beautiful clearings, but half the scroll was a flickering wall; shade pool reads as a dark cloud |
| 9 | Error Recovery | 3 | pageshow restores after back button |
| 10 | Help and Documentation | n/a | Self-explanatory |

## Design Specificity
Authored, not interchangeable: one lit day, creature-per-product, pixel plates on the deer's grid, dawn/dusk bookends. The tree wall was the generic part and 53% of the document. Detector: 11 advisory design-system-font-size findings (fluid clamp endpoints off the DESIGN.md ramp; record or consolidate); live overlay: 1 false positive (colophon line-length), 1 true low-impact (index ticks transition width — FIXED to transform).

## Priority Issues
1. [P0] Scroll flicker: whole-frame tone steps every 40–60px (sky re-tinted per 0.05h during walls) and the wall re-randomizing 87×/transition (conditional rng draws). FIXED: clearings keep their own hour; trunks laid out once, deterministically.
2. [P0] Trees popping in/out inside the viewport (parallax ranks started/ended on screen; cull margin shorter than branch stubs). FIXED: every rank enters/leaves exactly at the passage bounds with padding; 16/16 boundaries measured ≤1.6% change (ambient).
3. [P1] Wall too long and too fast (125svh × 8 = 53% of page; 5.3 px sideways per px scrolled; bright rims strobed). FIXED in part: gap 50svh, page 17,100→11,700px, ~2.5 px/px, soft rims. Open: a curtain or 1:1 vertical dolly would remove lateral speed entirely.
4. [P1] Screen-locked dither made wall edges and the text shade crawl. FIXED: wall dither in wall space, shade anchored to the copy.
5. [P2] Shade pool reads as a dark cloud in daylight skies; VIP tagline dips to 4.0:1 over its brightest pixels; index unlabeled on touch; "Explore" double meaning. OPEN.

## Persona Red Flags
Jordan: random button has no outbound cue; index dots unexplained. Casey: momentum flicks stopped mid-wall on text-less frames (now shorter); index unlabeled on touch. Sam: >50% frame change per scroll tick with bright rims (FIXED to gradual motion); VIP tagline 4.0:1.

## Minor Observations
Sun-mark arc dot overlaps the masthead caption; colophon small over busy reeds; sky constant within a clearing while DESIGN.md says it advances with scroll (now by design, update DESIGN.md); phone Jetpack frame can catch no hummingbird.

## Questions
Should the wall become the page's most authored moment (a curtain, or a 1:1 vertical dolly)? Should eight walls become four by grouping products into morning/noon/afternoon clearings?
