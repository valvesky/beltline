# Changelog

## [Unreleased]

### Added
- The kit (`kit/beltline.mjs`): 16 machine kinds cast by behaviour, orthogonal belt routing with port distribution, keyframes compiled from steps, light and dark tokens, reduced-motion gating, a legend and source index, and a build-time audit.
- `scripts/check.mjs`, `check-sources.mjs` and `capture.mjs`, with planted-fault tests.
- References: `machines.md` (the casting catalogue), `layout.md`, `kit.md` and `verify.md`.
- Examples: `calc` (the small-tour bar), `velocitty` (a real terminal emulator, the Plant-tour bar, linked to its source at 2d5a1a4) and `catalogue`.
- Evals with a three-axis rubric (correctness, visual design, visual clarity) and two fixture repos.

### Changed (beauty review, from owner review)
- Redrawn after a catalogue beauty review:
  - the drum and timer wheel have ring-segment slots, rim markers and a hub hand;
  - docks are shuttered loading bays;
  - diverters, fan-outs and merges are channel junctions;
  - the LRU has a real eviction tray;
  - the cutter is a guillotine;
  - the slotted page has a shrinking gap with arrows;
  - the WAL tape is calmer;
  - the tower, chain and turnstile have solid, bolted bodies;
  - the bucket has a valve tap;
  - floor-map tokens are spaced apart;
  - arms park in the roomiest pose clear of machines and belts.
- `capture.mjs --machines` renders every machine at 2x into one sheet. `verify.md` has a beauty rubric and a beauty pass, and the evals score beauty as a fourth axis, with a catalogue eval requiring every machine to reach 8.

### Changed (factory feel, from owner review)
- Arms in the catalogue now do what Factorio's filter inserters do: a mixed token stream runs past two arms that pick digits and operators into their bins (a partition). Arms pick at the point on the belt nearest them, and bins filled only by arms count as connected.
- Streams (`stream`), pipelining (`with: "previous"`), underground belts (`under: true`) and item shapes (`as`/`carries`: chip, hex, crate, letter).
- Rectangular machine bodies get corner bolts and a top highlight. Colour budgets count only direct colours, not theme tokens.
- Arms now do the inserter's job: they take an arriving item off the end of a belt and set it in the exact slot, or lift a piece out of a store onto an outgoing belt. A move inside one structure is rejected; use writes. Arms pick a resting pose that clears every machine.
- Belts have side rails and rollers that scroll during playback.
- Machines visibly work while active or handling an item: the press stamps, the cutter chops, gears turn, the tap drips, the lever pulls.
- Fixed: arms at rest were drawn detached when motion was reduced, because their resting rotation was a transform attribute that transform-origin offset a second time. Resting rotations are now inline CSS, and capture.mjs compares the end state at half size so rasterization noise on animated layers no longer hides or fakes a mismatch.

### Changed (catalogue, from owner review)
- Ten machines for databases, servers and game engines: `btree`, `trie`, `tape` (WAL), `page` (slotted page), `workers`, `pool`, `bucket` (token bucket), `timerwheel`, `swapbuffer` (double buffer) and `floormap` (spatial grid with moving entity tokens). Pointers resting on the same slot stack their names.
- Nine more machines: `heap` (pyramid), `deque` (two-ended tube), `bits` (lamp strip for bitsets and bloom filters), `grid` (matrix and DP tables), `graph` (pegboard with a walking ring), `counter` (odometer), `arena` (bump allocator), and `fanout` and `merge` (bus wiring for broadcast and join). A step can move items along several belts at once.
- Belts enter machines through visible slots.
- New `arm`: a long double-jointed arm on a pedestal, solved with two-link inverse kinematics, that lifts a piece out of a cell, holds it while other cells shift, and sets it down. For moves that are the point of the code, such as LRU move-to-front and sorting.
- The branch is a real diverter: one inlet, an outlet per route, and a flap that swings to the route each item takes.
- New `hashmap` (numbered bucket rack, `h` frame, collision chains) replaces the cubby wall; `pigeonholes` stays as an alias.
- New `lru`: a hash index next to a doubly linked MRU ⇄ LRU list with an eviction chute, matching the common implementation. `chain` gains `doubly`.
- Machines carry `data-box`, and the docs crops are generated from it.
- Machines joined by a straight belt snap onto one shared line, and ports are spaced evenly around the centre of a side, so every machine's input and output are level. This replaces the old belt-straightening, which slid ports off centre.

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
