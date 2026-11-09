# Casting machines

Each canonical store gets exactly one machine. Its shape should show how the structure behaves (what goes in, where it waits, what comes out, what moves) before anyone reads the label. Open `examples/catalogue/beltline.svg` to see every kind drawn.

## The catalogue

| Structure in the code | Kit `kind` | What the reader sees | Cells | Pointers |
|---|---|---|---|---|
| Array, slice, `Vec`, fixed buffer, row | `rack` | equal slots in a row on legs | one per shown index | `x`-pointers (`len`, `i`, `pos`) slide under a slot |
| Ring buffer, circular queue, ring of rows | `drum` | wheel split into sectors around a hub | one per sector, up to 8 | arms (`head`, `tail`) turn |
| Queue, channel, mailbox, event list | `hopper` | funnel feeding a column, first in at the top | waiting items | none: show order by position |
| Stack, call stack, undo list | `stack` | open tube on a spring, filled from the bottom | plates, bottom = index 0 | none: the fill level is the pointer |
| Hash map, dictionary, set, intern table | `pigeonholes` | wall of cubbies | `key:value`, 2 columns | none |
| LRU or bounded cache | `pigeonholes` + `evict: true` | cubbies with an eviction chute | as above | none |
| Tree, trie, heap, B-tree page | `tower` | sorting tower with branching chutes | nodes in breadth-first order, up to 7 | none |
| State machine, mode, parser state | `selector` | rotary dial with a needle, plus optional register cells | `name value` registers | `state` needle turns to the `states[]` index |
| Tokenizer, lexer, splitter of a stream | `cutter` | guillotine over a slot | optional registers (`pos 3`) | none |
| Pure transform, encoder, renderer step | `press` | stamping head over a die | optional registers | none |
| Bitmap, framebuffer, glyph atlas, image | `plate` | grid of pixel tiles | `"1"` ink, `"a"` accent, `""` empty | none |
| Linked list, free list, chain of nodes | `chain` | nodes joined by arrows | one per node | none |
| Struct, record, registers, cursor, config | `record` | cabinet of labelled drawers | `field value`, one per drawer | none |
| Lock, mutex, semaphore, gate | `turnstile` | three-arm gate | none | `gate` turns 60° per index |
| Branch, dispatch, `match`, router | `splitter` | diverter box | none: conditions go on the outgoing belt labels | none |
| Process boundary, OS, file, socket, user | `dock` | hatched loading bay (`external: true` if there is no first-party source) | optional, e.g. the final output | none |

## Rules for casting

1. **One store, one machine.** If two functions share a buffer, both belt into the same machine. Never draw a second copy.
2. **Functions earn a machine only when they change the shape of data or own state.** Tokenizers, parsers, encoders, schedulers and renderers do. Wrappers, getters, forwarding and logging become plain belts.
3. **Show a window, not the whole structure.** Pick the 3–8 cells the trace touches. A 1 MiB buffer is a rack of six cells with `more: true`. A grid of 1,000 rows is a drum or rack of the rows in play.
4. **Values are short and real.** `0x1b`, `'x'`, `csi`, `14`. If the real value is long, show its shape (`"2*(3+4)"`, `7 tokens`, `{fg 170}`) and put the detail in the caption.
5. **Pick by behaviour, not by type name.** A `Vec` used as a stack is a `stack`. A `HashMap` used as an LRU is `pigeonholes` with `evict`. A `struct` that is really a state machine is a `selector`.
6. **When nothing fits,** use the closest kind and say so in the cast table, or draw a custom shape with `F.raw(svg, box)`. Keep it the same size as the kit machines and colour it with the kit classes (`body`, `cell`, `seam`, `mark`).
7. **Merge the trivial.** Three tiny config structs read once are one `record`, or nothing at all.

## The cast table

Write it before any layout and show it to the user:

| Structure | Source | Kind | Cells shown | Why |
|---|---|---|---|---|
| `tokens` | `calc.js:2` | rack, 7 cells + `i` pointer | `2 * ( 3 + 4 )` | contiguous array walked by index |
| `ops` | `calc.js:24` | stack, 3 plates | `* ( +` | push and pop are the whole point |
| ring storage | `ring.c:20` | drum, 8 sectors + `head`/`tail` arms | the bytes of two reads | it wraps around, and the arms show it |
| style table | `style.c:88` | pigeonholes, 2×2 | `0:default`, `1:fg red` | an intern table: key to style |

Cast by what this code does, not by what similar programs usually do. A parser is a `selector` only if its source really keeps a mode or state variable.
