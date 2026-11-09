import { factory } from "../../kit/beltline.mjs";

const F = factory({
  title: "Beltline machine catalogue",
  subtitle: "Every kit machine with sample values. Illustrative, not a recording.",
  desc: "One of each machine kind in the Beltline kit, joined by belts. Inserter arms load and unload the stores, a diverter flap picks a route, a hash pointer finds a bucket, and an LRU moves a node to the front of its list.",
  cols: 50,
  rows: 27,
  maxTexts: 160,
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
  .step({ belt: "split->lock", item: "op +", pointers: { lock: { gate: 1 } }, caption: "branch: else, so the flap swings down and the lock's gate turns" });

F.build(new URL("./beltline.svg", import.meta.url).pathname);
