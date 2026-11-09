# Changelog

## [Unreleased]

### Added
- The kit (`kit/beltline.mjs`): 16 machine kinds cast by behaviour, orthogonal belt routing with port distribution, keyframes compiled from steps, light and dark tokens, reduced-motion gating, a legend and source index, and a build-time audit.
- `scripts/check.mjs`, `check-sources.mjs` and `capture.mjs`, with planted-fault tests.
- References: `machines.md` (the casting catalogue), `layout.md`, `kit.md` and `verify.md`.
- Examples: `calc` (the small-tour bar), `velocitty` (a real terminal emulator, the Plant-tour bar, linked to its source at 2d5a1a4) and `catalogue`.
- Evals with a three-axis rubric (correctness, visual design, visual clarity) and two fixture repos.

### Changed (catalogue, from owner review)
- Belts enter machines through visible slots, and stores are loaded and unloaded by inserter arms that swing when an item arrives or leaves.
- The branch is a real diverter: one inlet, an outlet per route, and a flap that swings to the route each item takes.
- New `hashmap` (numbered bucket rack, `h` frame, collision chains) replaces the cubby wall; `pigeonholes` stays as an alias.
- New `lru`: a hash index next to a doubly linked MRU ⇄ LRU list with an eviction chute, matching the common implementation. `chain` gains `doubly`.
- Machines carry `data-box`, and the docs crops are generated from it.

### Fixed (from the first real run, on velocitty, and an independent review)
- Routes could get a diagonal segment after simplification; paired belts could collapse onto one line.
- Belts and signals now share port allocation; signals are audited for crossings and text.
- The text budget counts only text visible in the static end state, so the Plant tier fits.
- Caption and gap limits include their prefixes, matching `check.mjs`.
- Drums: named, upright arm labels; `cellW`; bigger default radius above 6 sectors; sector overlap audit. Hopper `cellW`. Bulk writes. Machine `labelAt`.
- Step `src` values are now emitted and resolved by `check-sources`.
- `check.mjs` closes several fail-open paths (inline animation, media-query alternatives, prefixed SMIL, escaped `javascript:`, remote paint servers, malformed XML without xmllint). `capture.mjs` fails when it cannot compare the reduced-motion view, and `--zoom` alone shoots only the close-up.

### Changed
- Renamed from `factorio-md` to `beltline`. The default output is now `beltline.svg`.
- The workflow adds sizing tiers and a casting pass before layout, and moves all drawing from hand-written SVG to the kit.
- Clutter budget: one label per machine, short values, one caption line, and no code or prose on the canvas.
