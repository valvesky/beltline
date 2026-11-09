import { factory } from "../../kit/beltline.mjs";

const F = factory({
  title: "Beltline machine catalogue",
  subtitle: "Every kit machine with sample values. Illustrative, not a recording.",
  desc: "One of each machine kind in the Beltline kit, joined by belts, with a short trace that writes cells and moves pointers.",
  cols: 50,
  rows: 16,
  maxTexts: 160,
});

const kinds = [
  ["rack", "array · slice", [1, 2], { cells: ["7", "3", "9", "", ""], pointers: { len: 2 } }],
  ["drum", "ring buffer", [10, 1], { cells: ["a", "b", "", "", "", ""], pointers: { head: 0, tail: 2 } }],
  ["hopper", "queue · channel", [17, 1], { cells: ["ev1", "ev2", "ev3"] }],
  ["stack", "stack", [22, 1], { cells: ["1", "2", ""] }],
  ["pigeonholes", "hash map · cache", [27, 2], { cells: ["k1:4", "k7:2", "k3:9", ""] }],
  ["pigeonholes", "LRU cache", [33, 2], { cells: ["a:1", "b:2", "c:3", "d:4"], evict: true }],
  ["tower", "tree · trie", [40, 1], { cells: ["m", "f", "t", "a", "h", "", "z"] }],
  ["selector", "state machine", [1, 9], { states: ["idle", "esc", "csi", "osc"], cells: ["mode esc", "params 0"], cellW: 70, pointers: { state: 0 } }],
  ["cutter", "tokenizer · parser", [10, 9], { cells: ["pos 3"], cellW: 50 }],
  ["press", "transform · fn", [16, 9], {}],
  ["plate", "bitmap · atlas", [22, 9], { cols: 8, rows: 5, cells: Array.from({ length: 40 }, (_, i) => ([9, 10, 13, 14, 17, 22, 25, 30].includes(i) ? "1" : "")) }],
  ["chain", "linked list", [28, 10], { cells: ["n1", "n2", "n3"] }],
  ["record", "struct · registers", [36, 9], { cells: ["head 11", "tail 7", "dirty yes"] }],
  ["turnstile", "lock · mutex", [42, 10], { pointers: { gate: 0 } }],
  ["splitter", "branch", [46, 9], {}],
  ["dock", "boundary", [47, 2], { external: true, labelSide: "s", cells: [""], cellW: 30 }],
];

const ids = [];
for (const [kind, label, at, extra] of kinds) {
  const id = `${kind}-${at.join("-")}`;
  ids.push(id);
  F.machine(id, { kind, label, at, src: kind === "dock" ? undefined : `kit/beltline.mjs:1`, ...extra });
}
const top = ids.slice(0, 7), bottom = ids.slice(7, 15);
for (let i = 0; i < top.length - 1; i++) F.belt(top[i], top[i + 1]);
F.belt(top.at(-1), "dock-47-2");
for (let i = 0; i < bottom.length - 1; i++) F.belt(bottom[i], bottom[i + 1]);
F.signal(top[0], bottom[0], { label: "call" });

F.step({ belt: `${top[0]}->${top[1]}`, item: "9", writes: { [top[0]]: [[3, "4"]] }, pointers: { [top[0]]: { len: 4 } }, caption: "rack: a write lands in a cell, the len pointer moves" })
  .step({ belt: `${top[1]}->${top[2]}`, item: "d", writes: { [top[1]]: [[2, "d"]] }, pointers: { [top[1]]: { tail: 3 } }, caption: "drum: the tail arm turns one slot" })
  .step({ at: bottom[0], pointers: { [bottom[0]]: { state: 2 } }, writes: { [bottom[0]]: [[0, "mode csi"]] }, caption: "selector: the needle turns to the new state" })
  .step({ at: bottom[3], writes: { [bottom[3]]: [[11, "a"], [12, "a"]] }, caption: "plate: pixels are painted in place" })
  .step({ at: bottom[6], pointers: { [bottom[6]]: { gate: 1 } }, caption: "turnstile: the gate turns when the lock is taken" });

F.build(new URL("./beltline.svg", import.meta.url).pathname);
