# Verify like a critic

Render it and look at it, as a demanding reviewer would, before anyone else does. Rendering is cheap; guessing is expensive. Every script below fails closed: it exits 1 on any problem and prints a fixed success line only when everything is at zero.

## The loop

1. **`node build.mjs`** must print `audit passed`. The audit checks:
   - belts and signals through machines;
   - belt crossings;
   - machines closer than half a grid cell, or off the floor;
   - text overlaps, text over machines, and belts through text;
   - values that don't fit their cells;
   - missing `src`;
   - disconnected machines;
   - unknown belts, cells or pointers in steps;
   - the clutter budget.
2. **`node scripts/check.mjs beltline.svg`** must print `svg check passed`. It checks:
   - well-formed XML, an `<svg>` root with `xmlns` and `viewBox`, and `<title>` first and `<desc>` present;
   - no scripts, `foreignObject`, SMIL, event handlers, remote assets or fonts;
   - unique ids, and every `#ref` resolved;
   - every animation inside `prefers-reduced-motion: no-preference`;
   - no infinite loops;
   - a dark-mode block;
   - the text, line-length and colour budgets;
   - the size budget;
   - the "not a recording" disclosure.
3. **`node scripts/check-sources.mjs beltline.svg <repo>`** must print `sources: 0 unresolved`. Every `data-src` must exist at `data-rev`, with the line in range and `data-symbol` nearby.
4. **`node scripts/capture.mjs beltline.svg --at 0,25,50,75,100 --reduced --img --sheet`** freezes the animation at each moment. It shoots the SVG's own width and 390 px, the reduced-motion view and the `<img>` embed, and fails if the reduced-motion view differs from the held end state.
5. **Open and read every PNG**, then take close-ups of every dense junction:
   ```
   node scripts/capture.mjs beltline.svg --at 100 --zoom x,y,w,h
   ```
   On its own, `--zoom` shoots only the close-up. Compare each close-up with the previous round's shot of the same region.
6. **Beauty pass.** `node scripts/capture.mjs beltline.svg --machines` renders every machine at 2× from its recorded box and tiles them into `beltline-machines.png`. Score each machine against the beauty rubric below. Anything under 8 gets fixed before delivery:
   - a placement problem (an arm parked badly, a label crowding a cell) is fixed in `build.mjs`;
   - a drawing problem (the machine itself is ugly) is fixed in the kit, then the catalogue and every example are rebuilt.

## Beauty rubric

Score each machine out of 10 and take away points for each fault:

| Criterion | What a 10 looks like | Typical faults |
|---|---|---|
| Solid body | A filled body in the shared stroke weight, or a body that *is* the shape (ring, tube, funnel, bucket). Nothing floats loose. | thin frames, nodes or parts with no plate under them |
| One motif | One visual idea names the kind at a glance: ring, pyramid, shutters, gears, hooks, guillotine. | generic boxes, two competing ideas, decoration with no meaning |
| Cells belong | Values sit in slots that are part of the machine. Nothing crosses a value. | pill stickers on top of seams, pointers or arms running through values |
| Clean joints | Belts enter through slots on the centre line; channels, arms and pointers keep clear of labels and of other machines. | stray strokes, scratches, lines that end in mid-air, labels drifting away from what they name |
| Calm | Neutral tones plus the one accent, about three line weights, at least 3 px between elements, text at least 9 px at 1×. | clutter, cramped cells, tiny text, colour noise |
| Composed at rest | The static end state looks finished: arms parked clear, pointers on their slots, nothing half-moved. | arms folded over belts or machines, flaps at odd angles |

Roughly: 10 is all six; take off about 1 for each fault; under 8 means fix it.

A zero audit is necessary, not sufficient. The checks catch geometry and markup faults. Only looking catches a tour that is correct but unclear.

## What to look for, in order

1. **Can a newcomer name each structure from its shape alone?** Cover the labels mentally. A drum should read as a ring, a stack as a stack. If not, recast it (`machines.md`).
2. **Can the eye follow the main route?** Trace it on the 0 % and 100 % frames: input dock → … → output dock, in one row, without hunting.
3. **Does the item actually move through the frames in order?** Check the 25/50/75 % frames. The item should be where its caption says, and values should change in the right cells.
4. **Does the end state tell the whole story?** Assume the reader never plays the animation. The final cells, pointer positions and last caption must still explain the result.
5. **At 390 px,** do the shapes and the route still read, even if the values don't? If not, the floor is too wide or too dense. A Plant canvas is reduced about 3.5× at 390 px, so only its shapes and route need to survive there.
6. **Clutter:** any place where the eye stops because of text rather than shape. Remove it.
7. **Dark mode:** shoot with `--dark` once and check that nothing disappears.

## Common faults and fixes

| Symptom | Cause | Fix |
|---|---|---|
| The tour reads like a dashboard | Fields, code and notes on the canvas | Cut to the cells the trace touches. Detail goes in captions and the summary. |
| Every machine looks the same | Functions cast as machines, stores cast as `press` | Recast: stores get their structure's kind, glue functions become belts. |
| The eye zig-zags | The main route is spread across rows | Put the main route on one row and push the stores below their owners. |
| A belt looks like a joint | Two belts touch or run on top of each other | Add `via`, or force a different `out`/`in` side. |
| A value is truncated or overflows | A long literal in a cell | Show the shape, or raise `cellW` on that machine only. |
| A caption says something the frame doesn't show | Caption and writes are in different steps | Put the write in the same step as its caption. |
| The playback is long and boring | One step per trivial event | Merge consecutive writes into one step; keep about 1–2 s per step. |
| Reduced-motion view differs from the end state | Hand-edited SVG, or `F.raw` content with its own animation | Never hand-edit; give raw content no animation. |

## Definition of done

- [ ] `audit passed`, `svg check passed`, `sources: 0 unresolved`, and `capture done` with no problems.
- [ ] Every PNG was opened and read, plus close-ups of every dense junction.
- [ ] Every value, condition and source pointer was checked against the inspected revision.
- [ ] The coverage ledger has no unexplained first-party runtime subsystem. Every gap is stated in the footer and in the summary.
- [ ] The cast table, the tier and the gaps are reported to the user, and the tour is never called a recording.
