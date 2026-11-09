# Casting machines

Each canonical store gets exactly one machine. Its shape should show how the structure behaves (what goes in, where it waits, what comes out, what moves) before anyone reads the label. Open `examples/catalogue/beltline.svg` to see every kind drawn.

Belts never just touch a machine: each one enters through a dark slot.

## The catalogue

| Structure in the code | Kit `kind` | What the reader sees | Cells | Pointers |
|---|---|---|---|---|
| Array, slice, `Vec`, fixed buffer, row | `rack` | equal slots in a row on legs | one per shown index | `x`-pointers (`len`, `i`, `pos`) slide under a slot |
| Ring buffer, circular queue, ring of rows | `drum` | wheel split into sectors around a hub | one per sector, up to 8 | arms (`head`, `tail`) turn |
| Queue, channel, mailbox, event list | `hopper` | funnel feeding a column, first in at the top | waiting items | none: show order by position |
| Stack, call stack, undo list | `stack` | open tube on a spring, filled from the bottom | plates, bottom = index 0 | none: the fill level is the pointer |
| Hash map, dictionary, set, intern table | `hashmap` | numbered bucket rack; collisions chain off to the right | one `key:value` per bucket, then the `chain` cells | `h` frames the bucket the key hashes to |
| LRU or bounded cache built from a map plus a doubly linked list | `lru` | hash index on the left, MRU ⇄ LRU node list on the right, eviction chute at the LRU end | `buckets` map cells (`key→node`), then the list nodes from MRU to LRU | `h` frames the map bucket |
| Heap, priority queue | `heap` | binary heap inside a pyramid frame, minimum at the apex | nodes in breadth-first order, up to 7 | none: show sift-up and sift-down as writes |
| Deque, double-ended queue, work-stealing queue | `deque` | tube flared at both mouths | one per slot | `front` and `back` slide under the slots |
| Bitset, bloom filter, bitmap index, visited set | `bits` | strip of lamps, indexed every 4 | `"1"` lit, `"a"` lit by this trace, `""` off | one pointer per hash (`h1`, `h2`, `h3`) points down from above |
| Matrix, 2D array, table, DP table, page table | `grid` | value grid with row and column rails | row-major, `cols` per row | none |
| Graph, adjacency list, dependency or call graph | `graph` | pegboard of nodes on a ring, joined by edges (`directed: true` for arrows) | one per node, up to 7 | `at` is a ring that walks the traversal |
| Counter, refcount, sequence number, semaphore count | `counter` | odometer of digit wheels with a lever | one digit per wheel | none |
| Arena, bump allocator, slab, free space in a buffer | `arena` | memory bar of blocks sized by `sizes`, free tail dashed | one per block | `top` marks the next free offset from above |
| Broadcast, pub/sub, event emitter, observer list | `fanout` | one inlet wired by a bus to every outlet | none | none: move items on all outlets in one step |
| Join, merge, mux, `select` over channels, zip | `merge` | many inlets wired by a bus to one outlet | none | none |
| B-tree, B+tree index | `btree` | root node of keys above leaf nodes, leaves linked for range scans | root keys, then each leaf's keys, `keys` per node | `at` frames the node the search is in |
| Trie, radix tree, URL router, prefix index | `trie` | n-ary tree built from `nodes: [[parent, "char"], …]`, terminal nodes ringed | one per node, defaulting to its character | `at` walks the lookup |
| Write-ahead log, append-only log, event store, Kafka partition | `tape` | film strip with an append head on the right | one record per frame | `lsn`, `commit`, `checkpoint` markers above |
| Slotted page, heap page, row page | `page` | header, slot directory growing down, tuples growing up, free gap between | `slots` offsets first, then tuples from the bottom up | none |
| Thread pool, worker pool, executor | `workers` | bank of workstations with gears between intake and output rails | the job each worker holds (`""` = idle) | none |
| Object pool, connection pool, free list of objects | `pool` | rail of hooks; an empty hook means checked out | one object per hook | none |
| Rate limiter, token bucket, leaky bucket, semaphore permits | `bucket` | bucket of token lamps under a refill tap | `"1"` token present, `""` taken | none |
| Timer wheel, timeout scheduler, cron | `timerwheel` | clock face with timer slots on the rim | one per slot, up to 12 | `now` is the sweeping hand |
| Double buffer, swap chain, front/back state | `swapbuffer` | two pixel panes with a swap lever | pane A pixels, then pane B | `front` frames the pane on screen |
| Spatial grid, quadtree, broad-phase, tile map | `floormap` | board of buckets; `split` cells show quadtree subdivision | none | each entity is a named token that moves between buckets |
| Tree, trie, B-tree page | `tower` | sorting tower with branching chutes | nodes in breadth-first order, up to 7 | none |
| State machine, mode, parser state | `selector` | rotary dial with a needle, plus optional register cells | `name value` registers | `state` needle turns to the `states[]` index |
| Tokenizer, lexer, splitter of a stream | `cutter` | guillotine over a slot | optional registers (`pos 3`) | none |
| Pure transform, encoder, renderer step | `press` | stamping head over a die | optional registers | none |
| Bitmap, framebuffer, glyph atlas, image | `plate` | grid of pixel tiles | `"1"` ink, `"a"` accent, `""` empty | none |
| Linked list, free list, chain of nodes | `chain` (`doubly: true` for prev and next links) | nodes joined by arrows | one per node | none |
| Struct, record, registers, cursor, config | `record` | cabinet of labelled drawers | `field value`, one per drawer | none |
| Lock, mutex, semaphore, gate | `turnstile` | three-arm gate | none | `gate` turns 60° per index |
| Branch, dispatch, `match`, router | `splitter` | diverter: one inlet, an outlet per route, and a flap that swings to the route each item takes | none: conditions go on the outgoing belt labels | none: the kit animates the flap from the steps |
| An operation that moves individual pieces: move-to-front, sorting, eviction into another store, compaction | `arm` | a long double-jointed arm on a pedestal that reaches into a cell, grips the piece, carries it and sets it down | none | none: the kit solves the joints from the cells it reaches |
| Process boundary, OS, file, socket, user | `dock` | hatched loading bay (`external: true` if there is no first-party source) | optional, e.g. the final output | none |

## Rules for casting

1. **One store, one machine.** If two functions share a buffer, both belt into the same machine. Never draw a second copy.
2. **Functions earn a machine only when they change the shape of data or own state.** Tokenizers, parsers, encoders, schedulers and renderers do. Wrappers, getters, forwarding and logging become plain belts.
3. **Show a window, not the whole structure.** Pick the 3–8 cells the trace touches. A 1 MiB buffer is a rack of six cells with `more: true`. A grid of 1,000 rows is a drum or rack of the rows in play.
4. **Values are short and real.** `0x1b`, `'x'`, `csi`, `14`. If the real value is long, show its shape (`"2*(3+4)"`, `7 tokens`, `{fg 170}`) and put the detail in the caption.
5. **Pick by behaviour, not by type name.** A `Vec` used as a stack is a `stack`. A map plus a linked list kept in recency order is an `lru`, even if the code calls it a cache. A plain bounded map with no recency list is a `hashmap` with `evict: true`. A `struct` that is really a state machine is a `selector`.
6. **When nothing fits,** use the closest kind and say so in the cast table, or draw a custom shape with `F.raw(svg, box)`. Keep it the same size as the kit machines and colour it with the kit classes (`body`, `cell`, `seam`, `mark`).
7. **Use an arm only when moving a piece is the point.** An LRU hit that relinks a node to the front, an insertion sort, a compaction, an eviction into a free list: these are worth an arm. Pushing onto a stack or writing a cell is not, so use plain writes. One arm per structure, parked beside it, is the norm.
8. **Merge the trivial.** Three tiny config structs read once are one `record`, or nothing at all.

## The cast table

Write it before any layout and show it to the user:

| Structure | Source | Kind | Cells shown | Why |
|---|---|---|---|---|
| `tokens` | `calc.js:2` | rack, 7 cells + `i` pointer | `2 * ( 3 + 4 )` | contiguous array walked by index |
| `ops` | `calc.js:24` | stack, 3 plates | `* ( +` | push and pop are the whole point |
| ring storage | `ring.c:20` | drum, 8 sectors + `head`/`tail` arms | the bytes of two reads | it wraps around, and the arms show it |
| style table | `style.c:88` | hashmap, 4 buckets | `0:default`, `1:fg red` | an intern table: key to style |
| glyph cache | `cache.c:9` | lru, 3 buckets + 3 nodes | `é→2`, then `é x y` | the source keeps a map of node indexes and a prev/next list |

Give branches their own sides: send routes out the top and bottom (`out: "n"`, `out: "s"`) so the flap's swing is obvious.

Cast by what this code does, not by what similar programs usually do. A parser is a `selector` only if its source really keeps a mode or state variable.
