# Kit API: `kit/beltline.mjs`

The kit is a single dependency-free module that runs on Node 20+. A build script declares machines, belts and steps. `F.build(path)` routes, audits and writes the SVG.

```js
import { factory } from "/abs/path/to/beltline/kit/beltline.mjs";

const F = factory({
  title: "velocitty — one PTY read to pixels",              // ≤ 72 chars
  subtitle: "Static walkthrough of 2d5a1a4. Not a recording.",  // ≤ 96 chars, must say walkthrough/not a recording
  desc: "Full sentence for screen readers and search.",
  cols: 48, rows: 14,          // floor size in 24 px grid cells
  rev: "2d5a1a4",              // written as data-rev; check-sources resolves against it
  repo: "valvesky/velocitty",
  baseUrl: "https://github.com/o/r/blob/2d5a1a4/",  // optional: turns sources into links
  speed: 170,                  // belt px per second (default 170)
  maxTexts: 140,               // clutter budget (default 140)
});
```

## Machines

```js
F.machine(id, { kind, at: [col, row], label, src: "path:line", symbol?, cells?, pointers?, ...kindOptions })
```

- `kind`: one of `rack drum hopper stack pigeonholes tower selector cutter press plate chain record turnstile splitter dock`. See `machines.md`.
- `label`: 28 characters or fewer, normally the symbol (`toRpn()`, `tokens[]`, `CircBuffer`).
- `src`: required unless `external: true`. `symbol` is optional; `check-sources` looks for it near the line.
- `cells`: the initial values. `""` is empty.
- `pointers`: `{ name: index }` for `rack` (`x` pointers), `drum` (arms), `selector` (`state`) and `turnstile` (`gate`).
- `labelSide`: `"n" | "s" | "e" | "w"`, to override automatic label placement. By default the label goes on the side with the fewest belts, preferring s, n, e, then w.
- `labelAt: [col, row]` pins the label, anchored at its left edge, when every side is busy.

Options for each kind:

| Kind | Options |
|---|---|
| `rack` | `cellW` (default 30), `more: true` to draw a trailing ellipsis |
| `drum` | `radius` (default 46, or 56 above 6 sectors), `cellW` (default 24). Pointers are named arms whose labels stay upright. |
| `hopper` | `cellW` (default 34) |
| `pigeonholes` | `cols` (default 2), `cellW` (default 52), `evict` |
| `selector` | `states: [names]`, `cellW` for the registers |
| `cutter`, `press` | `cellW` for register cells |
| `plate` | `cols`, `rows`, `pixel` |
| `chain` | `cellW` |
| `record` | `cellW` (default 92) |
| `dock` | `w`, `h`, `cellW`, `external` |
| `splitter` | `h` |

## Edges

```js
F.belt(from, to, { id?, out?, in?, via?, label?, labelAt? })   // data; default id "from->to"
F.signal(from, to, { id?, out?, in?, via?, label? })           // control; default id "from~>to"
```

- `label` is for branch conditions only (`kind == num`, `free < cap/4`). Keep it short.
- `labelAt: [col, row]` pins the label when the automatic spot collides with something.

## Steps

```js
F.step({
  belt: "a->b",                  // optional: an item rides this belt first
  item: "0x1b",                  // ≤ 16 chars; omit for a plain pulse along the belt
  at: "b",                       // optional: highlight this machine while the step works
  writes: { store: [[cell, "value"], ...] },   // applied in order, ~0.22 s apart
  pointers: { store: { head: 3 } },
  caption: "one line, ≤ 96 chars",
  src: "path:line",
});
F.trace("reject");               // following captions get the prefix "reject ·"
```

- Writing `""` clears a cell. Its highlight fades with it.
- A cell index can be an array, which writes several cells at the same moment: `writes: { atlas: [[[11, 12, 19], "a"]] }` paints three pixels at once.
- **The static markup is the end state.** Every cell shows its final value, pointers rest at their final index, and the last caption is visible. Playback starts from the initial values and lands exactly there.
- Steps play once, in order. The total time is the sum of the belt travel and the work, about 1–2 s per step.

## Other calls

- `F.ledger([{ subsystem, station, src, example }])`: the coverage ledger. It is embedded as JSON in `<metadata>` and not drawn.
- `F.gap("vendor/Peak internals not traced")`: one short line in the footer for each real gap.
- `F.raw(svgString, { x, y, w, h })`: an escape hatch for a custom drawing. The box takes part in the overlap audit.
- `F.build(outPath)`: prints `audit passed` and writes the file, or lists the problems, sets exit code 1 and writes nothing. `writeOnFail: true` is a factory option, not a `build` argument; it writes the failing render so you can look at it.
- Belts and signals share port allocation, so a signal never sits on top of a belt. Both are audited for crossings and for running through text.

## Audit messages and fixes

| Message | Fix |
|---|---|
| `belt X passes through machine Y` | Add `via` points around Y, move Y off the line, or force `out`/`in` sides. |
| `belts X and Y cross` | Reorder the machines in that lane, move one store to the other side, or make one of them a signal. |
| `machines A and B are closer than half a grid cell` | Move one of them. Remember that labels need room too. |
| `text overlap` / `text over machine` / `belt runs through text` | Move the machine, set `labelSide`, or set `labelAt` on the belt label. |
| `widest value does not fit` | Shorten the values (show the shape, not the full text) or raise `cellW`. |
| `item … longer than 16 chars` | Show the shape (`7 tokens`, `{fg 170}`) and move the detail to the caption. |
| `has no belt or signal` | Connect it, or delete it: an unconnected machine is clutter. |
| `needs src` | Add `path:line`, or `external: true` for a boundary with no first-party source. |
| `over the clutter budget` | Cut cells, merge machines, drop the side lanes into a second tour. Do not raise `maxTexts` to get past it. Only text visible in the static end state counts; moving items and earlier captions and values do not. |
| `caption line … with its prefix` | The `n/N` and `trace ·` prefixes count toward the limit. Shorten the caption or the trace name. |
| `gap … is longer` | Split it into two `F.gap()` lines. |
| `drum sectors i and j overlap` | Raise `radius` or lower `cellW`. Group bytes into fewer sectors only if the caption says so. |
