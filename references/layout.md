# Laying out the floor

## Composition

- **Grid:** 24 px. Machines sit on whole grid cells, given as `at: [col, row]`.
- **Canvas:** about 48 columns (1150 px). It can go up to 56 columns (1350 px) for a Plant tour, never wider. Choose the number of rows so the floor is about 60–70 % full, with no large empty band at the bottom.
- **Main route:** one row, left to right, from the input dock to the output dock. Readers follow it like a sentence.
- **Stores:** directly under, or occasionally above, the machine that owns or writes them, joined by short vertical belts. A store shared by two machines sits between them.
- **Side paths** (rejects, retries, replies, effects) get their own lane below the main row. They branch from a splitter or from a machine's south side. Put no more than three side lanes on one canvas; anything more is a second tour.
- **Level lines:** machines joined by a straight belt whose centres are within about a grid cell of each other snap onto one shared line, so every machine's input and output sit exactly level and the belt runs dead straight. Place machines roughly; the kit levels them. Ports on a side with several belts are spaced evenly around its centre. Set `align: false` on a machine to keep it exactly where you put it.
- **Spacing:** keep at least one grid cell between machines. The audit fails anything closer than half a cell.
- **Labels:** the kit puts each label on a side with no belts, preferring below, then above, then right, then left. Force a side with `labelSide`.

## What stays on the canvas, and what leaves

| On the canvas | Off the canvas |
|---|---|
| Machines, with one label each | Code excerpts |
| The cells the trace touches, with short values | Full field lists, layouts and bit maps |
| Belts, with a condition label only on branch belts | "How it works" prose |
| One caption line, changing per step | Per-step paragraphs |
| The legend, made by the kit | Long lists of alternate paths: make them branches, or a second tour |
| Source links on the stations themselves | A function-to-line table: the stations already link to their lines |
| One `F.gap()` line for each real gap | Coverage notes: the ledger goes into `<metadata>` |

**Text budget:** the kit and `check.mjs` fail above 140 `<text>` elements visible in the static end state. Moving items, earlier captions and earlier cell values are hidden at rest and do not count. A good Line tour shows 40–90; a Plant tour shows 60–120.

## Belts and signals

- **Belts** carry data. They are drawn thick and neutral, with chevrons showing direction.
- **Signals** (`F.signal`) are calls, notifications or wake-ups that carry no data the trace follows. They are drawn as thin dashed lines with an arrowhead.
- **Routing:** the router draws orthogonal routes. Ports are spread along a side automatically, and a belt is pulled straight when the two ports already line up.
  - When a route is ugly, add `via: [[col, row], …]` waypoints, or force `out`/`in` sides (`"n" | "s" | "e" | "w"`).
  - A via point is where the belt turns, so place it in an empty gutter.
- **Crossings:** the audit fails belts that cross. Reorder the machines, move a lane, or turn one of the belts into a signal if it carries no traced data.
- **Paired belts** (push and pop, request and reply) between the same two machines run side by side. The chevrons show which way each one flows.

## Motion the kit adds for you

- **Belts run.** Belts have side rails and rollers that scroll for the whole playback, then stop at the end state.
- **Machines work.** While a machine is active (`at`), or as it takes in or hands on an item, its moving part runs: the press stamps, the cutter chops, worker gears turn, the bucket's tap drips, the counter's lever pulls. At rest everything is in its home pose, so the static view is unchanged.

## Two zoom levels

- **At 1×** the reader sees the shape of the factory: the main row, which machines are stores, where the branches go.
- **At 3×** every value, pointer and label is readable.

If a region only works at 3×, it is too dense. Cut cells, or move part of it to its own tour.
