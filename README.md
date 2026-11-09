# Beltline

A skill for coding agents that turns a codebase into a factory tour: one standalone animated SVG where each data structure is a small machine shaped like its behaviour, and a real input rides the belts from entry to output. Every station links to its source line.

![calc example](examples/calc/beltline.svg)

The image above is `examples/calc/`. It shows a tokenizer, a shunting-yard and a stack machine evaluating `2*(3+4)`, plus a rejected `2$`.

For a real program, see `examples/velocitty/`: the [velocitty](https://github.com/valvesky/velocitty) terminal emulator, from a PTY read to pixels on screen, with every station linked to its source at revision 2d5a1a4.

## Install

```sh
git clone https://github.com/valvesky/beltline ~/.claude/skills/beltline   # Claude Code
git clone https://github.com/valvesky/beltline ~/.codex/skills/beltline    # Codex
```

Requires Node 20 or newer, plus Chrome or Chromium for the screenshot checks. The docs page is `docs/index.html`; serve `docs/` with GitHub Pages.

## Use

> make a beltline tour of this repo
> show me how the parser in src/vt works, as a picture
> beltline just the request path, as request.svg

The agent reads the source and traces a concrete input, usually one taken from a test. It then casts each data structure as a machine from the catalogue, writes a small `build.mjs` against the kit, and checks the result until every check reaches zero.

## Layout

| Path | What |
|---|---|
| `SKILL.md` | the workflow the agent follows |
| `references/` | the machine catalogue, layout, the kit API, and verification, each loaded when needed |
| `kit/beltline.mjs` | the drawing, routing, animation, theme and audit library (no dependencies) |
| `scripts/check.mjs` | static SVG checks: self-contained, accessible, reduced motion, and the clutter budget |
| `scripts/check-sources.mjs` | resolves every `data-src="path:line"` at the recorded revision |
| `scripts/capture.mjs` | headless-Chrome frames at chosen moments and widths, reduced motion, `<img>` embed, close-ups |
| `examples/` | `calc` (a small tour), `velocitty` (a whole terminal emulator, linked to its source) and `catalogue` (every machine kind) |
| `evals/` | prompts, fixture repos, and the three-axis rubric |
| `docs/` | the single-page site, with copies of the example tours in `docs/tours/` |

## Develop

```sh
node --test scripts/*.test.mjs        # includes planted-fault controls for every check
node examples/calc/build.mjs && node scripts/check.mjs examples/calc/beltline.svg
```

Any change to the kit must leave both examples passing their audit and checks. After rebuilding an example, copy it into `docs/tours/`; CI fails if the copies drift.

## Limits

- The tours are source-derived walkthroughs, not recordings of the program running.
- A whole large program does not fit on one canvas. The skill builds a plant overview and offers per-subsystem tours instead.
- The SVG has no scripts, so it works as an `<img>` in READMEs and docs. There is no scrubbing or replay; it plays once and holds its end state.
