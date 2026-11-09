import { factory } from "../../kit/beltline.mjs";

const F = factory({
  title: "Beltline machine catalogue",
  subtitle: "Every kit machine with sample values. Illustrative, not a recording.",
  desc: "One of each machine kind in the Beltline kit, joined by belts. Inserter arms load and unload the stores, a diverter flap picks a route, a hash pointer finds a bucket, and an LRU moves a node to the front of its list.",
  cols: 50,
  rows: 62,
  maxTexts: 320,
  writeOnFail: process.env.WOF === "1",
});

const src = "kit/beltline.mjs:1";

F.machine("rack", { kind: "rack", at: [1, 3], label: "array · slice", labelSide: "n", src, cells: ["7", "3", "9", "", ""], pointers: { len: 3 } })
  .machine("drum", { kind: "drum", at: [11, 2], label: "ring buffer", src, cells: ["a", "b", "", "", "", ""], pointers: { head: 0, tail: 2 } })
  .machine("hopper", { kind: "hopper", at: [19, 2], label: "queue · channel", src, cells: ["ev1", "ev2", "ev3"] })
  .machine("stack", { kind: "stack", at: [25, 2], label: "stack", src, cells: ["1", "2", ""] })
  .machine("map", { kind: "hashmap", at: [31, 2], label: "hash map", src, cells: ["k1:4", "", "k3:9", "", "k7:2"], chain: { 0: 1 }, pointers: { h: 2 } })
  .machine("out", { kind: "dock", at: [44, 2], label: "boundary", external: true, cells: [""], cellW: 30 });

F.machine("lru", { kind: "lru", at: [1, 10], label: "LRU cache", src, buckets: 3, cells: ["a→2", "b→1", "c→0", "c", "b", "a"], pointers: { h: 1 } })
  .machine("tower", { kind: "tower", at: [16, 10], label: "tree · trie", src, cells: ["m", "f", "t", "a", "h", "", "z"] })
  .machine("list", { kind: "chain", at: [26, 11], label: "doubly linked list", labelSide: "n", src, doubly: true, cells: ["n1", "n2", "n3"] })
  .machine("rec", { kind: "record", at: [36, 10], label: "struct · registers", src, cells: ["head 11", "tail 7", "dirty yes"] });

F.machine("sorter", { kind: "arm", at: [4, 6], label: "arm", src })
  .machine("mover", { kind: "arm", at: [7, 15], label: "arm", src });

F.machine("sel", { kind: "selector", at: [1, 20], label: "state machine", src, states: ["idle", "esc", "csi", "osc"], cells: ["mode esc", "params 0"], cellW: 70, pointers: { state: 1 } })
  .machine("cut", { kind: "cutter", at: [11, 20], label: "tokenizer · parser", src, cells: ["pos 3"], cellW: 50 })
  .machine("split", { kind: "splitter", at: [18, 20], label: "branch", src })
  .machine("press", { kind: "press", at: [25, 18], label: "transform · fn", src })
  .machine("plate", { kind: "plate", at: [32, 18], label: "bitmap · atlas", src, cols: 8, rows: 5, cells: Array.from({ length: 40 }, (_, i) => ([9, 10, 13, 14, 17, 22, 25, 30].includes(i) ? "1" : "")) })
  .machine("lock", { kind: "turnstile", at: [26, 23], label: "lock · mutex", src, pointers: { gate: 0 } });

F.belt("rack", "drum").belt("drum", "hopper").belt("hopper", "stack").belt("stack", "map").belt("map", "out");
F.belt("lru", "tower").belt("tower", "list").belt("list", "rec");
F.belt("sel", "cut").belt("cut", "split")
  .belt("split", "press", { out: "n", in: "w", label: "kind == num" })
  .belt("split", "lock", { out: "s", in: "w", label: "else" })
  .belt("press", "plate");

F.step({ belt: "rack->drum", item: "9", caption: "an inserter lifts the item off the rack and onto the belt" })
  .step({ at: "drum", writes: { drum: [[2, "c"]] }, pointers: { drum: { tail: 3 } }, caption: "ring buffer: c lands in the tail sector and the tail arm turns" })
  .step({ belt: "stack->map", item: "k3", pointers: { map: { h: 2 } }, writes: { map: [[2, "k3:10"]] }, caption: "hash map: h(k3) = 2, so the pointer drops to bucket 2" })
  .step({ arm: "sorter", moves: [{ from: ["rack", 1], to: ["rack", 0] }], writes: { rack: [[1, "7"], [0, ""]] }, caption: "insertion sort: the arm lifts 3, 7 shifts right, and 3 goes in front" })
  .step({ at: "lru", pointers: { lru: { h: 0 } }, caption: "LRU: get(a) hashes to bucket 0 and finds node 2" })
  .step({ arm: "mover", moves: [{ from: ["lru", 5], to: ["lru", 3] }], writes: { lru: [[5, "b"], [4, "c"], [3, ""]] }, caption: "the arm lifts a off the LRU end, the others slide down, a goes to MRU" })
  .step({ belt: "cut->split", item: "42", caption: "the tokenizer cuts a number and hands it to the branch" })
  .step({ belt: "split->press", item: "num 42", caption: "branch: kind == num, so the flap swings to the upper route" })
  .step({ belt: "press->plate", item: "glyph", writes: { plate: [[[11, 12], "a"]] }, caption: "the press renders a glyph and an inserter drops it on the plate" })
  .step({ belt: "cut->split", item: "+", caption: "the next token is an operator" })
  .step({ belt: "split->lock", item: "op +", pointers: { lock: { gate: 1 } }, caption: "branch: else, so the flap swings down and the lock's gate turns" })

F.machine("deque", { kind: "deque", at: [1, 30], label: "deque", labelSide: "n", src, cells: ["", "b", "c", "d", ""], pointers: { front: 1, back: 4 } })
  .machine("heap", { kind: "heap", at: [10, 28], label: "heap · priority queue", src, cells: ["3", "5", "4", "9", "7", "8", ""] })
  .machine("bloom", { kind: "bits", at: [20, 30], label: "bitset · bloom filter", src, cells: ["", "1", "", "", "1", "", "", "", "", "1", "", ""], pointers: { h1: 1, h2: 4, h3: 9 } })
  .machine("table", { kind: "grid", at: [33, 29], label: "matrix · DP table", src, cols: 4, cells: ["0", "1", "1", "2", "1", "1", "2", "", "1", "2", "", ""] })
  .belt("deque", "heap").belt("heap", "bloom").belt("bloom", "table");

F.machine("graph", { kind: "graph", at: [1, 36], label: "graph", src, cells: ["A", "B", "C", "D", "E"], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [0, 2]], directed: true, pointers: { at: 0 } })
  .machine("fan", { kind: "fanout", at: [11, 37], label: "broadcast", src })
  .machine("count", { kind: "counter", at: [18, 35], label: "counter", src, cells: ["0", "4", "1"] })
  .machine("alloc", { kind: "arena", at: [17, 40], label: "arena · bump allocator", src, capacity: 16, sizes: [3, 2, 4, 2], cells: ["hdr", "k", "", ""], pointers: { top: 2 } })
  .machine("join", { kind: "merge", at: [27, 37], label: "merge · join", src })
  .machine("sink", { kind: "dock", at: [33, 37], label: "subscriber", external: true, cells: [""], cellW: 30 })
  .belt("graph", "fan")
  .belt("fan", "count", { out: "n", in: "w" })
  .belt("fan", "alloc", { out: "s", in: "w" })
  .belt("count", "join", { out: "e", in: "n" })
  .belt("alloc", "join", { out: "e", in: "s" })
  .belt("join", "sink");

F.step({ at: "deque", pointers: { deque: { front: 0 } }, writes: { deque: [[0, "a"]] }, caption: "deque: push_front puts a at the front mouth" })
  .step({ belt: "deque->heap", item: "d", pointers: { deque: { back: 3 } }, writes: { deque: [[3, ""]], heap: [[6, "1"]] }, caption: "pop_back sends d on; the heap receives 1 in its last slot" })
  .step({ at: "heap", writes: { heap: [[6, "4"], [2, "1"]] }, caption: "heap: 1 is smaller than its parent 4, so they swap" })
  .step({ at: "heap", writes: { heap: [[2, "3"], [0, "1"]] }, caption: "1 is smaller than the root 3, swap again: the minimum is on top" })
  .step({ belt: "heap->bloom", item: "cat", pointers: { bloom: { h1: 2, h2: 7, h3: 10 } }, writes: { bloom: [[[2, 7, 10], "a"]] }, caption: "bloom filter: three hashes of cat light bits 2, 7 and 10" })
  .step({ belt: "bloom->table", item: "dp", writes: { table: [[7, "3"], [10, "3"], [11, "4"]] }, caption: "DP table: each cell is filled from the one above and to the left" })
  .step({ at: "graph", pointers: { graph: { at: 1 } }, writes: { graph: [[0, "A"], [1, "B"]] }, caption: "graph: a traversal visits A, then follows the edge to B" })
  .step({ at: "graph", pointers: { graph: { at: 2 } }, writes: { graph: [[2, "C"]] }, caption: "B's only edge leads to C, which A also reaches directly" })
  .step({ belt: "graph->fan", item: "visit C", caption: "the visit is published as an event" })
  .step({ belt: ["fan->count", "fan->alloc"], item: "evt", writes: { count: [[2, "2"]], alloc: [[2, "evt"]] }, pointers: { alloc: { top: 3 } }, caption: "broadcast: every subscriber gets a copy; the counter ticks, the arena bumps" })
  .step({ belt: ["count->join", "alloc->join"], item: ["042", "evt"], caption: "merge: both streams join into one" })
  .step({ belt: "join->sink", item: "042+evt", caption: "the joined result reaches the subscriber" })

F.machine("wal", { kind: "tape", at: [1, 48], label: "write-ahead log", src, cellW: 46, cells: ["begin", "put a", "put b", "", ""], pointers: { ckpt: 0, lsn: 2, commit: 0 } })
  .machine("page", { kind: "page", at: [15, 46], label: "slotted page", src, slots: 3, cells: ["@96", "@78", "", "a=1", "k=7", ""] })
  .machine("btree", { kind: "btree", at: [23, 46], label: "B+tree", src, keys: 3, leaves: 3, cells: ["10", "20", "", "3", "7", "", "10", "14", "", "20", "25", ""], pointers: { at: 0 } })
  .machine("trie", { kind: "trie", at: [38, 46], label: "trie · router", src, nodes: [[-1, "·"], [0, "c"], [0, "d"], [1, "a"], [1, "o"], [3, "r"], [3, "t"], [4, "w"], [2, "o"]], terminal: [5, 6, 7, 8], pointers: { at: 0 } })
  .belt("wal", "page").belt("page", "btree").belt("btree", "trie");

F.machine("pool", { kind: "pool", at: [1, 56], label: "connection pool", src, cells: ["c1", "c2", "c3", ""] })
  .machine("workers", { kind: "workers", at: [10, 55], label: "worker pool", src, cells: ["req 7", "", ""] })
  .machine("bucket", { kind: "bucket", at: [20, 56], label: "token bucket", src, cols: 3, cells: ["1", "1", "1", "1", "", ""] })
  .machine("wheel", { kind: "timerwheel", at: [26, 55], label: "timer wheel", src, radius: 60, cells: ["", "t1", "", "", "t2", "", "", ""], pointers: { now: 0 } })
  .machine("swap", { kind: "swapbuffer", at: [35, 56], label: "double buffer", src, cols: 5, rows: 4, cells: Array.from({ length: 40 }, (_, i) => ([6, 7, 8, 11, 13, 16, 17, 18].includes(i) ? "1" : "")), pointers: { front: 0 } })
  .machine("floor", { kind: "floormap", at: [44, 55], label: "spatial grid", src, cols: 4, rows: 3, split: [6], pointers: { p1: 5, p2: 6, p3: 6 } })
  .belt("pool", "workers").belt("workers", "bucket").belt("bucket", "wheel").belt("wheel", "swap").belt("swap", "floor");

F.step({ at: "wal", pointers: { wal: { lsn: 3, commit: 3 } }, writes: { wal: [[3, "commit"]] }, caption: "WAL: commit is appended at the head and the commit mark moves up to it" })
  .step({ belt: "wal->page", item: "put b", writes: { page: [[2, "@60"], [5, "b=2"]] }, caption: "slotted page: a new slot points at b=2, written from the bottom up" })
  .step({ belt: "page->btree", item: "key 8", pointers: { btree: { at: 1 } }, caption: "B+tree: 8 < 10, so the search goes down the first child" })
  .step({ at: "btree", writes: { btree: [[5, "8"]] }, caption: "8 lands in the first leaf, still in sorted order" })
  .step({ belt: "btree->trie", item: "cat", pointers: { trie: { at: 1 } }, caption: "trie: looking up cat follows c" })
  .step({ at: "trie", pointers: { trie: { at: 3 } }, caption: "then a, shared with car" })
  .step({ at: "trie", pointers: { trie: { at: 6 } }, caption: "then t, a terminal node: cat is in the trie" })
  .step({ belt: "pool->workers", item: "c2", writes: { pool: [[1, ""]], workers: [[1, "req 8"]] }, caption: "pool: a worker checks out connection c2 to serve request 8" })
  .step({ belt: "workers->bucket", item: "req 9", writes: { bucket: [[3, ""]] }, caption: "token bucket: request 9 takes a token; three are left" })
  .step({ belt: "bucket->wheel", item: "timeout", pointers: { wheel: { now: 2 } }, writes: { wheel: [[6, "t3"]] }, caption: "timer wheel: the hand ticks on and t3 is filed four slots ahead" })
  .step({ belt: "wheel->swap", item: "frame", writes: { swap: [[[26, 27, 28, 31, 33, 36, 37, 38], "a"]] }, caption: "double buffer: the next frame is drawn into the back pane" })
  .step({ at: "swap", pointers: { swap: { front: 1 } }, caption: "swap: the back pane becomes the one on screen" })
  .step({ belt: "swap->floor", item: "move", pointers: { floor: { p1: 7 } }, caption: "spatial grid: p1 crosses into the next cell; the split cell holds two" });

F.build(new URL("./beltline.svg", import.meta.url).pathname);
