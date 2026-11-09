---
name: beltline
description: Turn a source repository, program, or subsystem into one standalone animated SVG "factory tour" where each data structure is a small machine whose shape matches its behaviour (ring buffer = drum, stack = spring tube, hash map = pigeonholes) and a real input rides belts from entry to output with every station linked to its source line. Use for Beltline requests, visual codebase tours, data-flow or architecture pictures, "show me how this code works", explaining a pipeline or parser by tracing a concrete value through it, or any request that used to say factorio.md — even when the user never says "beltline".
license: MIT
compatibility: Claude Code, Codex, OpenCode. Needs Node 20+; Chrome or Chromium for the screenshot checks.
---

# Beltline

A Beltline tour lets a reader watch one concrete input travel through a program and see every structure it changes. The deliverable is one standalone animated SVG, `beltline.svg` by default.

**The one idea: the machine is the explanation.** The reader should understand a structure from its shape and its motion, not from text next to it. A ring buffer is a drum whose head arm turns. A stack is a spring tube that fills from the bottom. A tokenizer is a cutter. When a station needs a paragraph to explain it, the drawing has failed.

The skill fails in two ways:
- **Dashboard.** Every station is a text panel of fields, code and notes, and long tables and alternate paths fill half the canvas. This tour is correct but unreadable.
- **Boxes and arrows.** Identical labelled rectangles, so nothing shows what kind of structure each one is.

The kit in `kit/beltline.mjs` prevents both. The agent decides **what** the machines are and **where** they sit. The kit draws, routes, animates, themes and audits them.

## Examples

- `examples/calc/`: a tokenizer, a shunting-yard and a stack machine, with 10 machines, 20 steps and a reject path. It is the quality bar for a small tour: read `build.mjs` and open `beltline.svg` before you start.
- `examples/velocitty/`: a real terminal emulator, from a PTY read to pixels, made by a fresh agent following this skill. It has 18 machines, two traces and 40 source links, and is the quality bar for a Plant tour. Its `build.mjs` shows drums with named arms, pixel plates painted in bulk, a long return lane and `F.gap()` lines.
- `examples/catalogue/`: every machine kind on one sheet. Open it when casting machines.

## Size it first

| Tier | Scope | Machines | Steps |
|---|---|---|---|
| Station | one path or one structure | ≤ 8 | ≤ 12 |
| Line | one subsystem | ≤ 16 | ≤ 24 |
| Plant | whole program | ≤ 24 | ≤ 30 |

- **Plant tours:** a whole program usually needs more than 24 machines. When it does, build a plant overview whose machines are subsystems, then offer one Line tour per subsystem. Do not cram a whole program into one canvas. Say which tier you chose and why in one line, then build.
- **Pacing:** have a first static render open within the first quarter of the work. Do not quote time estimates.

## Workflow

### 1. Read the source and trace it

Resolve the target. Default to the full program, or a narrower scope when the user names one. Record the revision (`git rev-parse --short HEAD`) and note local changes.

Find the entry points: build manifests, command registrations, routes, startup code or public APIs. Read the implementation, its types and its tests. Follow the actual calls, ownership, mutations, branches and I/O. Derive behaviour from source and tests, not from existing docs or diagrams.

Do not run the project's code to make the tour. Running this skill's own kit and scripts is expected.

Keep a **coverage ledger**: subsystem → source → example value → station. Mark unavailable source and deliberate boundaries such as vendor code and build tooling.

Then trace a concrete input, ideally one taken from a test. For each step, record:
- the caller or event, and the receiving symbol;
- the value before and after;
- the state that changed;
- the next edge;
- the `path:line` that supports it.

Add one alternate trace when a branch matters, such as a rejected input or a retry.

### 2. Cast the machines

Do this step before drawing anything. Read `references/machines.md` first.

- **Stores:** for each canonical store, pick a machine kind from the catalogue whose shape matches the structure's behaviour.
- **Functions:** a function earns a machine only if it changes the shape of the data or owns state. Glue, wrappers and pass-throughs become belts.
- **Cells:** for each store, choose the 3–8 cells the trace actually touches. A large buffer shows a window of them, not its full size.

Write the cast as a table: structure → kind → cells shown → why. Show the table to the user in one block, then continue without waiting.

### 3. Lay out the floor

Read `references/layout.md`. Then:
- Place machines on the grid so the main route runs left to right on one row.
- Put stores next to the machine that owns them, usually below it.
- Put side paths in their own lanes.
- Write `build.mjs` against the kit (API in `references/kit.md`). Copy the shape of `examples/calc/build.mjs`.

Machines, belts and signals come first. Steps come after.

### 4. Write the steps

Each step is one move along a belt, or one machine at work, plus its writes, pointer moves and a one-line caption with its `src`. Values are what the code really holds at that moment.

The kit derives all timing, keyframes, highlights, the caption sequence, the theme, the reduced-motion handling, and the legend. Never hand-write keyframes.

### 5. Build, check and look

Read `references/verify.md` and run its loop until everything is at zero:

```
node build.mjs                                  # must print: audit passed
node <skill>/scripts/check.mjs beltline.svg     # must print: svg check passed
node <skill>/scripts/check-sources.mjs beltline.svg <repo>   # sources: 0 unresolved
node <skill>/scripts/capture.mjs beltline.svg --at 0,25,50,75,100 --reduced --img --sheet
```

**Open and read every PNG you make.** A zero audit is necessary, not sufficient. Look at each frame as a demanding reviewer would:
- Can you tell what each structure is without reading its label?
- Can you follow the item from input to output?
- Is anything clipped, crowded or ambiguous?

Take close-ups (`--zoom`) of every dense junction. When a fault shows up, fix the cause in `build.mjs` and rebuild. Never patch the SVG by hand.

### 6. Deliver

Write `beltline.svg`, or the name the user asked for, in the target repo or wherever the user said. Keep `build.mjs` next to it as `beltline.build.mjs` so the tour can be regenerated, unless the user asked for the SVG only.

Then summarise:
- the tier;
- the machine cast;
- what the traces cover;
- every gap (unavailable source, or behaviour that was inferred).

Never imply that the animation is a recording of the running program.

After delivering, offer one refactor or follow-up only when a concrete one exists, such as splitting the tour into Line tours or a scoped re-run. Otherwise stop.

## Rules that hold everywhere

- **Colour:**
  - One accent colour, used only for the traced item, written cells, pointers and the active machine. Everything else stays in the neutral tones.
  - All colour comes from theme tokens. Dark mode is automatic.
- **Text:**
  - Each machine has one label of 28 characters or fewer.
  - Cell values are 14 characters or fewer. Items on a belt are 16 characters or fewer.
  - Captions are one line.
  - No paragraphs, code excerpts or field dumps on the canvas. Detail goes in the caption or the user-facing summary. Sources live on the stations themselves as links (`data-src`, and an anchor when `baseUrl` is set), not as a table on the canvas.
- **Structure:**
  - Every store has exactly one machine.
  - Every belt runs from a real producer to a real consumer.
  - Belts never cross or pass through machines (the audit enforces this).
- **Playback:**
  - The static markup is the end state: what you see with motion off is a complete overview.
  - Playback runs once and holds its end state. Reduced-motion viewers see that overview.
  - If the user asks for a loop, explain that an SVG shown as an `<img>` has no pause control, so the tour plays once and holds. Deliver that.
- **Self-contained file:**
  - One SVG root, with no scripts, `foreignObject`, remote assets or fonts.
  - Source links are SVG anchors when a revision URL is known.
- **Honesty:** the subtitle says it is a source-derived walkthrough, not a recording.

## References

| File | Read it |
|---|---|
| `references/machines.md` | before casting (step 2) |
| `references/layout.md` | before placing machines (step 3) |
| `references/kit.md` | while writing `build.mjs`: the API, step fields, options and audit messages |
| `references/verify.md` | at step 5: the check loop, close-ups, faults and fixes, and the definition of done |
