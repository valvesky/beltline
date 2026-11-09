import { test } from "node:test";
import assert from "node:assert/strict";
import { factory, KINDS } from "../kit/beltline.mjs";

const base = () =>
  factory({ title: "t", subtitle: "Illustrative walkthrough, not a recording.", desc: "d", cols: 30, rows: 10 })
    .machine("a", { kind: "press", at: [1, 2], label: "a()", src: "a.js:1" })
    .machine("b", { kind: "rack", at: [10, 2], label: "b[]", src: "a.js:2", cells: ["", "", ""] })
    .machine("c", { kind: "dock", at: [22, 2], label: "out", external: true })
    .belt("a", "b")
    .belt("b", "c");

const quiet = (F) => {
  const err = console.error, log = console.log;
  console.error = console.log = () => {};
  try {
    return F.build();
  } finally {
    console.error = err;
    console.log = log;
    process.exitCode = 0;
  }
};

test("a minimal tour passes the audit and holds its end state in the markup", () => {
  const out = quiet(base().step({ belt: "a->b", item: "7", writes: { b: [[0, "7"]] }, caption: "seven" }));
  assert.deepEqual(out.problems, []);
  assert.match(out.svg, /prefers-reduced-motion: no-preference/);
  assert.match(out.svg, /data-src="a.js:2"/);
  assert.match(out.svg, />7<\/text>/);
});

const faults = [
  ["belt through a machine", (F) => F.machine("x", { kind: "press", at: [5, 1], label: "x()", src: "a.js:3" }).belt("x", "c", { out: "e", in: "w" }).step({ belt: "a->b", item: "1" }), /passes through machine|cross/],
  ["machines overlap", (F) => F.machine("y", { kind: "press", at: [2, 3], label: "y()", src: "a.js:4" }).belt("y", "a").step({ belt: "a->b" }), /closer than half a grid/],
  ["station without source", (F) => F.machine("z", { kind: "press", at: [12, 6], label: "z()" }).belt("b", "z").step({ belt: "a->b" }), /needs src/],
  ["disconnected machine", (F) => F.machine("z", { kind: "press", at: [12, 6], label: "z()", src: "a.js:5" }).step({ belt: "a->b" }), /no belt or signal/],
  ["unknown belt in a step", (F) => F.step({ belt: "a->c", item: "1" }), /unknown belt/],
  ["write to a missing cell", (F) => F.step({ belt: "a->b", writes: { b: [[9, "1"]] } }), /no cell 9/],
  ["value wider than its cell", (F) => F.step({ belt: "a->b", writes: { b: [[0, "123456789"]] } }), /does not fit/],
  ["item too long", (F) => F.step({ belt: "a->b", item: "a very long item value" }), /longer than/],
  ["no steps", (F) => F, /no steps/],
  ["off the floor", (F) => F.machine("w", { kind: "press", at: [28, 2], label: "w()", src: "a.js:6" }).belt("c", "w").step({ belt: "a->b" }), /outside the floor/],
  ["clutter budget", (F) => {
    F.step({ belt: "a->b" });
    for (let i = 0; i < 6; i++) F.machine(`r${i}`, { kind: "rack", at: [1 + (i % 3) * 9, 5 + Math.floor(i / 3) * 2], label: `r${i}`, src: "a.js:1", cells: Array(4).fill("x") });
    for (let i = 0; i < 6; i++) F.signal("a", `r${i}`);
    return F;
  }, /clutter budget|overlap|through|cross|closer/],
];

for (const [name, plant, expect] of faults) {
  test(`planted fault fails the audit: ${name}`, () => {
    const out = quiet(plant(base()));
    assert.ok(out.problems.length > 0, "the audit passed a planted fault, so the check is broken");
    assert.match(out.problems.join("\n"), expect);
  });
}

test("unknown machine kinds are rejected with the list of kinds", () => {
  assert.throws(() => base().machine("q", { kind: "blob", at: [1, 6], label: "q" }), /use one of rack, drum/);
});

test("routes stay orthogonal with via points and mixed sides", () => {
  const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 12 })
    .machine("a", { kind: "press", at: [1, 2], label: "a()", src: "a.js:1" })
    .machine("b", { kind: "press", at: [5, 0], label: "b()", src: "a.js:2", labelSide: "e" })
    .belt("a", "b", { out: "e", in: "s", via: [[5, 3]] })
    .step({ belt: "a->b", item: "1" });
  const out = quiet(F);
  for (const m of out.svg.matchAll(/class="belt" data-edge[^>]*|<path d="([^"]+)" class="belt"/g)) {
    if (!m[1]) continue;
    const pts = [...m[1].matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((x) => [+x[1], +x[2]]);
    for (let i = 1; i < pts.length; i++) assert.ok(pts[i][0] === pts[i - 1][0] || pts[i][1] === pts[i - 1][1], `diagonal in ${m[1]}`);
  }
});

test("paired belts between the same machines keep separate lanes", () => {
  const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 22 })
    .machine("a", { kind: "rack", at: [4, 4], label: "a[]", src: "a.js:1", cells: ["", ""], labelSide: "e" })
    .machine("b", { kind: "rack", at: [3, 16], label: "b[]", src: "a.js:2", cells: ["", ""], labelSide: "e" })
    .belt("a", "b")
    .belt("b", "a")
    .step({ belt: "a->b", item: "1" });
  const out = quiet(F);
  const ds = [...out.svg.matchAll(/<path d="([^"]+)" class="belt" data-edge/g)].map((m) => m[1]);
  const xs = ds.map((d) => d.match(/^M([\d.]+)/)[1]);
  assert.equal(new Set(xs).size, 2, `both belts leave at x=${xs[0]}`);
});

test("step sources are kept for check-sources", () => {
  const out = quiet(base().step({ belt: "a->b", item: "7", caption: "seven", src: "a.js:9" }));
  assert.match(out.svg, /class="cap" data-src="a.js:9"/);
});

const more = [
  ["signal through a label", (F) => F.machine("s", { kind: "press", at: [10, 7], label: "s()", src: "a.js:7" }).signal("a", "s", { out: "s", in: "w", via: [[2, 7]] }).machine("t", { kind: "record", at: [3, 6], label: "a long label here", src: "a.js:8", cells: ["x 1"], labelSide: "e" }).belt("t", "s", { out: "n", in: "n", via: [[4, 5], [11, 5]] }).step({ belt: "a->b" }), /runs through text|passes through|cross/],
  ["caption too long with its prefix", (F) => F.trace("a fairly long trace name").step({ belt: "a->b", caption: "x".repeat(80) }), /with its prefix/],
  ["gap too long", (F) => F.gap("y".repeat(95)).step({ belt: "a->b" }), /gap .* is longer/],
  ["drum slots too small for their values", (F) => F.machine("d", { kind: "drum", at: [12, 6], label: "ring", src: "a.js:9", radius: 30, cells: Array(8).fill("xyz") }).belt("b", "d").step({ belt: "a->b" }), /does not fit/],
];
for (const [name, plant, expect] of more) {
  test(`planted fault fails the audit: ${name}`, () => {
    const out = quiet(plant(base()));
    assert.ok(out.problems.length > 0, "the audit passed a planted fault, so the check is broken");
    assert.match(out.problems.join("\n"), expect);
  });
}

test("bulk writes paint several cells at the same moment", () => {
  const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 10 })
    .machine("p", { kind: "plate", at: [1, 2], label: "px", src: "a.js:1", cols: 4, rows: 2 })
    .machine("o", { kind: "dock", at: [10, 2], label: "out", external: true })
    .belt("p", "o")
    .step({ at: "p", writes: { p: [[[0, 1, 2], "a"]] }, caption: "paint" });
  const out = quiet(F);
  assert.deepEqual(out.problems, []);
  assert.equal((out.svg.match(/class="px-hot"/g) ?? []).length, 3);
});

test("hidden playback states do not count against the text budget", () => {
  const F = base();
  for (let i = 0; i < 40; i++) F.step({ belt: "a->b", item: `${i}`, writes: { b: [[0, `${i}`]] }, caption: `step ${i}` });
  const out = quiet(F);
  assert.ok(out.texts < 40, `counted ${out.texts} visible texts`);
  assert.ok(!out.problems.some((p) => /budget/.test(p)), out.problems.join("\n"));
});

test("planted fault fails the audit: label pushed into the header", () => {
  const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 10 })
    .machine("a", { kind: "press", at: [1, 0], label: "a()", src: "a.js:1", labelSide: "n" })
    .machine("b", { kind: "dock", at: [10, 0], label: "b", external: true })
    .belt("a", "b")
    .step({ belt: "a->b", item: "1" });
  const out = quiet(F);
  assert.match(out.problems.join("\n"), /off the floor/);
});

const tour = () =>
  factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 40, rows: 14 })
    .machine("src", { kind: "press", at: [1, 4], label: "in()", src: "a.js:1" })
    .machine("sp", { kind: "splitter", at: [8, 4], label: "branch", src: "a.js:2" })
    .machine("hi", { kind: "hashmap", at: [16, 1], label: "map", src: "a.js:3", cells: ["", "", "", ""], pointers: { h: 0 } })
    .machine("lo", { kind: "lru", at: [16, 8], label: "lru", src: "a.js:4", buckets: 2, cells: ["a→0", "", "a", "b"] })
    .belt("src", "sp")
    .belt("sp", "hi", { out: "n", in: "w", label: "yes" })
    .belt("sp", "lo", { out: "s", in: "w", label: "no" });

test("the splitter flap turns to each route an item takes", () => {
  const out = quiet(tour().step({ belt: "sp->hi", item: "a" }).step({ belt: "sp->lo", item: "b" }));
  assert.deepEqual(out.problems, []);
  const flap = out.svg.match(/<g class="rot" style="transform-origin:[^"]+" id="(bl-a\d+)"><path d="[^"]+" class="flap"/);
  assert.ok(flap, "no animated flap");
  const kf = out.svg.match(new RegExp(`#${flap[1]}\\{animation-name:(k\\d+)\\}`))[1];
  const body = out.svg.match(new RegExp(`@keyframes ${kf}\\{([^\\n]+)\\}`))[1];
  assert.ok(new Set(body.match(/rotate\(-?[\d.]+deg\)/g)).size >= 2, `flap never turns: ${body}`);
});

test("hash map pointers frame the bucket index and the LRU shows both ends", () => {
  const out = quiet(tour().step({ belt: "sp->hi", item: "a", pointers: { hi: { h: 3 } } }));
  assert.match(out.svg, /class="ptr-box"/);
  assert.match(out.svg, />MRU</);
  assert.match(out.svg, />LRU</);
  assert.ok((out.svg.match(/class="idx-n"/g) ?? []).length >= 6);
});

const armTour = () =>
  factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 34, rows: 12 })
    .machine("src", { kind: "dock", at: [1, 2], label: "in", external: true })
    .machine("r", { kind: "rack", at: [10, 2], label: "r[]", src: "a.js:1", cells: ["7", "", "9"] })
    .machine("o", { kind: "dock", at: [24, 2], label: "out", external: true })
    .machine("bot", { kind: "arm", at: [7, 6], label: "arm", src: "a.js:2" })
    .belt("src", "r").belt("r", "o");

test("an arm takes an item off a belt and sets it into the exact slot", () => {
  const out = quiet(armTour().step({ belt: "src->r", item: "3", arm: "bot", moves: [{ from: "belt", to: ["r", 1] }], caption: "place" }));
  assert.deepEqual(out.problems, []);
  assert.equal((out.svg.match(/class="arm-seg"/g) ?? []).length, 2);
  assert.match(out.svg, /class="val val-w" text-anchor="middle" dominant-baseline="central"( id="[^"]+")?>3<\/text>/);
  const item = out.svg.match(/<g class="item[^"]*" opacity="0" id="(bl-a\d+)">/);
  const kf = out.svg.match(new RegExp(`#${item[1]}\\{animation-name:(k\\d+)\\}`))[1];
  const body = out.svg.match(new RegExp(`@keyframes ${kf}\\{([^\\n]+)\\}`))[1];
  const lastMove = Math.max(...[...body.matchAll(/([\d.]+)%\{[^}]*transform/g)].map((m) => +m[1]));
  const fade = Math.max(...[...body.matchAll(/([\d.]+)%\{[^}]*opacity:0/g)].map((m) => +m[1]));
  assert.ok(fade > lastMove + 1, "the item should wait at the belt end for the gripper");
});

test("an arm lifts a piece out of a slot onto an outgoing belt", () => {
  const out = quiet(armTour().machine("bot2", { kind: "arm", at: [19, 6], label: "arm2", src: "a.js:3" }).step({ arm: "bot2", moves: [{ from: ["r", 2], to: "r->o" }], belt: "r->o", item: "9" }).step({ belt: "src->r", item: "x", arm: "bot", moves: [{ from: "belt", to: ["r", 1] }] }));
  assert.deepEqual(out.problems, []);
  const order = out.svg.indexOf("arm-seg");
  assert.ok(order > 0);
});

test("the resting arm is the static end state", () => {
  const out = quiet(armTour().step({ belt: "src->r", item: "3", arm: "bot", moves: [{ from: "belt", to: ["r", 1] }] }));
  const g = out.svg.match(/<g class="rot" style="transform-origin:([\d.]+)px ([\d.]+)px;transform:rotate\(([-\d.]+)deg\)" id="(bl-a\d+)">/);
  assert.ok(g, "no animated arm root");
  const kf = out.svg.match(new RegExp(`#${g[4]}\\{animation-name:(k\\d+)\\}`))[1];
  const body = out.svg.match(new RegExp(`@keyframes ${kf}\\{([^\\n]+)\\}`))[1];
  const last = body.match(/rotate\(([-\d.]+)deg\)\}$/)[1];
  assert.equal(Number(last), Number(g[3]), "the arm does not return to its resting pose");
});

const armFaults = [
  ["arm placed too far from its work", (F) => F.machine("bot3", { kind: "arm", at: [30, 10], label: "arm3", src: "a.js:4" }).step({ belt: "src->r", item: "1", arm: "bot3", moves: [{ from: "belt", to: ["r", 0] }] }).step({ belt: "src->r", item: "2", arm: "bot", moves: [{ from: "belt", to: ["r", 1] }] }), /reach to get to its cells/],
  ["arm with a reach too short", (F) => F.machine("bot2", { kind: "arm", at: [12, 7], label: "arm2", src: "a.js:4", reach: 40 }).step({ belt: "src->r", item: "1", arm: "bot2", moves: [{ from: "belt", to: ["r", 2] }] }).step({ belt: "src->r", item: "2", arm: "bot", moves: [{ from: "belt", to: ["r", 1] }] }), /cannot reach/],
  ["arm with no moves", (F) => F.step({ belt: "r->o", item: "1" }), /never moves anything/],
  ["move to a missing cell", (F) => F.step({ belt: "src->r", item: "1", arm: "bot", moves: [{ from: "belt", to: ["r", 9] }] }), /needs from and to/],
  ["arm step on a non-arm", (F) => F.step({ arm: "r", moves: [{ from: "belt", to: ["r", 1] }] }), /not an arm/],
  ["arm shuffling pieces inside one structure", (F) => F.step({ arm: "bot", moves: [{ from: ["r", 0], to: ["r", 1] }] }), /inside r; arms move pieces between a belt and a slot/],
];
for (const [name, plant, expect] of armFaults) {
  test(`planted fault fails the audit: ${name}`, () => {
    const out = quiet(plant(armTour()));
    assert.ok(out.problems.length > 0, "the audit passed a planted fault, so the check is broken");
    assert.match(out.problems.join("\n"), expect);
  });
}

const portsOf = (svg) => {
  const out = {};
  for (const m of svg.matchAll(/<path d="M([\d.]+) ([\d.]+)((?:L[\d.]+ [\d.]+)+)" class="belt" data-edge="[^"]+" data-from="([^"]+)" data-to="([^"]+)"/g)) {
    const pts = [[+m[1], +m[2]], ...[...m[3].matchAll(/L([\d.]+) ([\d.]+)/g)].map((x) => [+x[1], +x[2]])];
    (out[m[4]] ??= []).push({ role: "out", p: pts[0], pts });
    (out[m[5]] ??= []).push({ role: "in", p: pts.at(-1), pts });
  }
  return out;
};

test("machines a few pixels off a shared line snap onto it, so in and out ports are level", () => {
  const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 40, rows: 10 })
    .machine("a", { kind: "dock", at: [1, 2], label: "in", external: true })
    .machine("b", { kind: "rack", at: [6, 2], label: "b[]", src: "a.js:1", cells: ["", "", ""] })
    .machine("c", { kind: "drum", at: [14, 1], label: "c", src: "a.js:2", cells: ["", "", "", ""] })
    .machine("d", { kind: "press", at: [22, 2], label: "d()", src: "a.js:3" })
    .belt("a", "b").belt("b", "c").belt("c", "d")
    .step({ belt: "a->b", item: "1" });
  const out = quiet(F);
  assert.deepEqual(out.problems, []);
  const ports = portsOf(out.svg);
  for (const id of ["b", "c"]) {
    const [i, o] = [ports[id].find((x) => x.role === "in"), ports[id].find((x) => x.role === "out")];
    assert.equal(i.p[1], o.p[1], `${id}: input at y=${i.p[1]}, output at y=${o.p[1]}`);
  }
  for (const m of out.svg.matchAll(/<path d="([^"]+)" class="belt" data-edge/g)) assert.equal((m[1].match(/L/g) ?? []).length, 1, `belt bends: ${m[1]}`);
});

test("paired belts between a machine and its store run parallel with no jogs", () => {
  const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 14 })
    .machine("f", { kind: "press", at: [4, 2], label: "f()", src: "a.js:1" })
    .machine("s", { kind: "stack", at: [5, 7], label: "s[]", src: "a.js:2", cells: ["", "", ""] })
    .belt("f", "s").belt("s", "f")
    .step({ belt: "f->s", item: "1" });
  const out = quiet(F);
  assert.deepEqual(out.problems, []);
  for (const m of out.svg.matchAll(/<path d="([^"]+)" class="belt" data-edge/g)) assert.equal((m[1].match(/L/g) ?? []).length, 1, `paired belt jogs: ${m[1]}`);
});

test("a machine far off the line is left where the author put it", () => {
  const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 14 })
    .machine("a", { kind: "press", at: [1, 2], label: "a()", src: "a.js:1" })
    .machine("b", { kind: "press", at: [10, 6], label: "b()", src: "a.js:2" })
    .belt("a", "b", { out: "e", in: "w" })
    .step({ belt: "a->b", item: "1" });
  const out = quiet(F);
  assert.match(out.svg, /data-machine="b" data-box="240 208/);
});

test("every machine kind renders and passes the audit on its own", () => {
  const extra = {
    rack: { cells: ["1", ""] }, drum: { cells: ["a", "", "", ""] }, hopper: { cells: ["x"] }, stack: { cells: ["1", ""] },
    hashmap: { cells: ["k:1", ""] }, pigeonholes: { cells: ["k:1", ""] }, lru: { buckets: 2, cells: ["a→0", "", "a", ""] }, tower: { cells: ["m", "f", "t"] },
    selector: { states: ["a", "b"], cells: ["s 1"], cellW: 50 }, cutter: {}, press: {}, plate: { cols: 4, rows: 2 }, chain: { cells: ["n1", "n2"] },
    record: { cells: ["a 1"] }, turnstile: {}, splitter: {}, heap: { cells: ["1", "2", "3"] }, deque: { cells: ["a", ""] }, bits: { cells: ["1", "", "", ""] },
    grid: { cols: 2, cells: ["1", "2", "3", "4"] }, graph: { cells: ["A", "B", "C"], edges: [[0, 1], [1, 2]] }, counter: { cells: ["0", "1"] },
    arena: { capacity: 8, sizes: [2, 3], cells: ["a", ""] }, fanout: {}, merge: {}, dock: { external: true },
    btree: { keys: 2, leaves: 2, cells: ["5", "", "1", "3", "5", "7"] }, trie: { nodes: [[-1, "·"], [0, "a"], [1, "b"]], terminal: [2] },
    tape: { cellW: 40, cells: ["put", ""] }, page: { slots: 2, cells: ["@9", "", "a=1", ""] }, workers: { cells: ["r1", ""] },
    pool: { cells: ["c1", ""] }, bucket: { cells: ["1", "1", ""] }, timerwheel: { cells: ["t1", "", "", ""] },
    swapbuffer: { cols: 3, rows: 2 }, floormap: { cols: 3, rows: 2, pointers: { e: 1 } },
  };
  for (const kind of KINDS.filter((k) => k !== "arm")) {
    const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 40, rows: 14 })
      .machine("src", { kind: "dock", at: [1, 4], label: "in", external: true })
      .machine("m", { kind, at: [8, 3], label: kind, src: "a.js:1", ...(extra[kind] ?? {}) })
      .belt("src", "m")
      .step({ belt: "src->m", item: "1" });
    const out = quiet(F);
    assert.deepEqual(out.problems, [], `${kind}: ${out.problems.join("; ")}`);
    assert.match(out.svg, new RegExp(`class="m m-${kind}"`), kind);
  }
});

test("a step can move items along several belts at once", () => {
  const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 40, rows: 14 })
    .machine("f", { kind: "fanout", at: [4, 5], label: "fan", src: "a.js:1" })
    .machine("a", { kind: "press", at: [12, 1], label: "a()", src: "a.js:2" })
    .machine("b", { kind: "press", at: [12, 9], label: "b()", src: "a.js:3" })
    .belt("f", "a", { out: "n", in: "w" }).belt("f", "b", { out: "s", in: "w" })
    .step({ belt: ["f->a", "f->b"], item: ["x", "y"], caption: "both" });
  const out = quiet(F);
  assert.deepEqual(out.problems, []);
  const starts = [...out.svg.matchAll(/<g class="item[^"]*" opacity="0" id="(bl-a\d+)">/g)].map((m) => out.svg.match(new RegExp(`#${m[1]}\\{animation-name:(k\\d+)\\}`))[1]).map((k) => out.svg.match(new RegExp(`@keyframes ${k}\\{([^\\n]+)\\}`))[1].match(/([\d.]+)%\{opacity:1/)[1]);
  assert.equal(starts.length, 2);
  assert.equal(starts[0], starts[1], "the two items do not leave together");
  assert.equal((out.svg.match(/class="chan chan-bus"/g) ?? []).length, 2);
});

test("a graph pointer walks from node to node", () => {
  const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 12 })
    .machine("g", { kind: "graph", at: [2, 2], label: "g", src: "a.js:1", cells: ["A", "B", "C"], edges: [[0, 1], [1, 2]], directed: true, pointers: { at: 0 } })
    .machine("o", { kind: "dock", at: [16, 3], label: "out", external: true })
    .belt("g", "o")
    .step({ at: "g", pointers: { g: { at: 2 } } });
  const out = quiet(F);
  assert.deepEqual(out.problems, []);
  assert.match(out.svg, /transform:translate\(-?[\d.]+px,-?[\d.]+px\)/);
  assert.equal((out.svg.match(/marker-end="url\(#bl-arrow\)"/g) ?? []).length, 2);
});

test("pointers that come to rest on the same slot stack their names instead of overprinting", () => {
  const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 10 })
    .machine("w", { kind: "tape", at: [1, 3], label: "log", src: "a.js:1", cellW: 40, cells: ["a", "b", ""], pointers: { lsn: 1, commit: 0 } })
    .machine("o", { kind: "dock", at: [14, 3], label: "out", external: true })
    .belt("w", "o")
    .step({ at: "w", pointers: { w: { commit: 1 } } });
  const out = quiet(F);
  assert.deepEqual(out.problems, []);
  const ys = [...out.svg.matchAll(/<text x="[\d.]+" y="([\d.]+)" class="ptr-t"[^>]*>(lsn|commit)</g)].map((m) => +m[1]);
  assert.equal(ys.length, 2);
  assert.notEqual(ys[0], ys[1]);
});

test("resting rotations are inline CSS, never a transform attribute that transform-origin would offset twice", () => {
  const out = quiet(armTour().step({ belt: "src->r", item: "3", arm: "bot", moves: [{ from: "belt", to: ["r", 1] }] }));
  assert.doesNotMatch(out.svg, /transform="rotate\(/);
});

const keyframesOf = (svg, id) => {
  const kf = svg.match(new RegExp(`#${id}\\{animation-name:(k\\d+)\\}`))[1];
  return svg.match(new RegExp(`@keyframes ${kf}\\{([^\\n]+)\\}`))[1];
};
const lineTour = () =>
  factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 40, rows: 14 })
    .machine("a", { kind: "dock", at: [1, 3], label: "in", external: true })
    .machine("b", { kind: "press", at: [12, 3], label: "b()", src: "a.js:1" })
    .machine("c", { kind: "rack", at: [24, 3], label: "c[]", src: "a.js:2", cells: ["", "", ""] })
    .belt("a", "b").belt("b", "c");

test("a stream sends several items down one belt, evenly spaced", () => {
  const out = quiet(lineTour().step({ belt: "a->b", stream: ["x", "y", "z"], caption: "three" }));
  assert.deepEqual(out.problems, []);
  const ids = [...out.svg.matchAll(/<g class="item[^"]*" opacity="0" id="(bl-a\d+)">/g)].map((m) => m[1]);
  assert.equal(ids.length, 3);
  const starts = ids.map((id) => +keyframesOf(out.svg, id).match(/([\d.]+)%\{opacity:1/)[1]);
  assert.ok(starts[0] < starts[1] && starts[1] < starts[2], `not staggered: ${starts}`);
  assert.ok(Math.abs(starts[1] - starts[0] - (starts[2] - starts[1])) < 0.01, "uneven spacing");
});

test("a step with previous starts before the last one ends, and only one caption shows at a time", () => {
  const out = quiet(lineTour().step({ belt: "a->b", item: "1", caption: "first" }).step({ belt: "b->c", item: "2", with: "previous", caption: "second" }));
  assert.deepEqual(out.problems, []);
  const items = [...out.svg.matchAll(/<g class="item[^"]*" opacity="0" id="(bl-a\d+)">/g)].map((m) => keyframesOf(out.svg, m[1]));
  const firstEnd = Math.max(...[...items[0].matchAll(/([\d.]+)%\{[^}]*transform/g)].map((m) => +m[1]));
  const secondStart = +items[1].match(/([\d.]+)%\{opacity:1/)[1];
  assert.ok(secondStart < firstEnd, "the second item should leave while the first is still travelling");
  const caps = [...out.svg.matchAll(/class="cap"[^>]*id="(bl-a\d+)"/g)].map((m) => keyframesOf(out.svg, m[1]));
  const offA = Math.max(...[...caps[0].matchAll(/([\d.]+)%\{opacity:1/g)].map((m) => +m[1]));
  const onB = Math.min(...[...caps[1].matchAll(/([\d.]+)%\{opacity:1/g)].map((m) => +m[1]));
  assert.ok(offA <= onB, "captions overlap");
});

const crossTour = (under) =>
  factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 40, rows: 16 })
    .machine("a", { kind: "dock", at: [1, 6], label: "a", external: true })
    .machine("b", { kind: "dock", at: [30, 6], label: "b", external: true })
    .machine("c", { kind: "press", at: [14, 1], label: "c()", src: "a.js:1" })
    .machine("d", { kind: "press", at: [14, 12], label: "d()", src: "a.js:2", labelSide: "e" })
    .belt("a", "b").belt("c", "d", { out: "s", in: "n", under })
    .step({ belt: "c->d", item: "u" });

test("an underground belt may cross another: hoods mark the tunnel and items vanish inside it", () => {
  const out = quiet(crossTour(true));
  assert.deepEqual(out.problems, []);
  assert.equal((out.svg.match(/class="hood"/g) ?? []).length, 2);
  assert.match(out.svg, /class="ground"/);
  const id = out.svg.match(/<g class="item[^"]*" opacity="0" id="(bl-a\d+)">/)[1];
  const opacities = [...keyframesOf(out.svg, id).matchAll(/opacity:([01])/g)].map((m) => m[1]).join("");
  assert.match(opacities, /1+0+1+/, `item never disappears underground: ${opacities}`);
});

test("planted fault fails the audit: a crossing with no underground belt", () => {
  const out = quiet(crossTour(undefined));
  assert.match(out.problems.join("\n"), /cross; reroute with via points, or mark one belt under: true/);
});

test("planted fault fails the audit: going underground right next to a bend", () => {
  const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 40, rows: 16 })
    .machine("a", { kind: "dock", at: [1, 6], label: "a", external: true })
    .machine("b", { kind: "dock", at: [30, 6], label: "b", external: true })
    .machine("c", { kind: "press", at: [14, 1], label: "c()", src: "a.js:1" })
    .machine("d", { kind: "press", at: [22, 12], label: "d()", src: "a.js:2", labelSide: "e" })
    .belt("a", "b").belt("c", "d", { out: "s", in: "n", under: true, via: [[15.6, 7.6]] })
    .step({ belt: "c->d", item: "u" });
  const out = quiet(F);
  assert.match(out.problems.join("\n"), /too close to a bend|cross/);
});

test("items are drawn in the shape of their kind", () => {
  const out = quiet(lineTour().step({ belt: "a->b", item: "0x1b", as: "chip" }).step({ belt: "b->c", item: "tok", as: "hex" }));
  assert.deepEqual(out.problems, []);
  assert.match(out.svg, /class="item item-chip"/);
  assert.match(out.svg, /class="item item-hex"[^>]*>(?:<path d="M[^"]+Z" class="item-b"\/>)/);
  const bad = quiet(lineTour().step({ belt: "a->b", item: "x", as: "blob" }));
  assert.match(bad.problems.join("\n"), /not one of pill, chip, hex, crate, letter/);
});

test("rectangular machine bodies carry corner bolts and a top highlight; round ones do not", () => {
  const out = quiet(lineTour().step({ belt: "a->b", item: "1" }));
  const press = out.svg.match(/<g class="m m-press"[^]*?<\/g>/)[0];
  assert.equal((press.match(/class="bolt"/g) ?? []).length, 4);
  assert.match(press, /class="bevel"/);
  const drum = quiet(factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 10 }).machine("r", { kind: "drum", at: [2, 2], label: "r", src: "a.js:1", cells: ["", "", "", ""] }).machine("o", { kind: "dock", at: [14, 3], label: "o", external: true }).belt("r", "o").step({ belt: "r->o", item: "1" }));
  assert.doesNotMatch(drum.svg.match(/<g class="m m-drum"[^]*?<\/g>/)[0], /class="bolt"/);
});

test("port collars carry an arrow pointing into the machine on inputs and out of it on outputs", () => {
  const out = quiet(lineTour().step({ belt: "a->b", item: "1" }));
  const arrows = [...out.svg.matchAll(/<path d="M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)L[\d.]+ [\d.]+Z" class="collar-arrow"\/>/g)].map((m) => ({ tip: [+m[1], +m[2]], base: [+m[3], +m[4]] }));
  assert.equal((out.svg.match(/class="collar"/g) ?? []).length, 4);
  assert.equal(arrows.length, 4);
  const box = out.svg.match(/data-machine="b" data-box="([\d.]+) [\d.]+ ([\d.]+)/);
  const left = +box[1], right = left + +box[2];
  const at = (x) => arrows.find((a) => Math.abs(a.tip[0] - x) < 6);
  assert.ok(at(left).tip[0] > at(left).base[0], "the input arrow on the left side should point right, into b");
  assert.ok(at(right).tip[0] > at(right).base[0], "the output arrow on the right side should point right, out of b");
  assert.doesNotMatch(out.svg, /class="mouth"/);
});

test("tree and graph nodes are circles, and pointer frames take the shape of their target", () => {
  const heap = quiet(factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 10 }).machine("h", { kind: "heap", at: [2, 1], label: "h", src: "a.js:1", cells: ["1", "2", "3"] }).machine("o", { kind: "dock", at: [16, 2], label: "o", external: true }).belt("h", "o").step({ belt: "h->o", item: "1" }));
  assert.equal((heap.svg.match(/<circle [^>]*class="cell"/g) ?? []).length, 3);
  const trie = quiet(factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 10 }).machine("t", { kind: "trie", at: [2, 1], label: "t", src: "a.js:1", nodes: [[-1, "·"], [0, "a"]], terminal: [1], pointers: { at: 0 } }).machine("o", { kind: "dock", at: [16, 2], label: "o", external: true }).belt("t", "o").step({ at: "t", pointers: { t: { at: 1 } } }));
  assert.match(trie.svg, /<circle [^>]*class="ring2"/);
  assert.match(trie.svg, /<circle [^>]*class="ptr-box"/);
  const bt = quiet(factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 10 }).machine("b", { kind: "btree", at: [2, 1], label: "b", src: "a.js:1", keys: 2, leaves: 2, cells: ["5", "", "1", "3", "5", "7"], pointers: { at: 0 } }).machine("o", { kind: "dock", at: [20, 2], label: "o", external: true }).belt("b", "o").step({ at: "b", pointers: { b: { at: 1 } } }));
  assert.match(bt.svg, /<rect [^>]*rx="4" class="ptr-box"/);
});

test("broadcast and merge are drawn as light junctions with no box or bolts", () => {
  const F = factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 40, rows: 14 })
    .machine("f", { kind: "fanout", at: [4, 5], label: "fan", src: "a.js:1" })
    .machine("a", { kind: "press", at: [12, 1], label: "a()", src: "a.js:2" })
    .machine("b", { kind: "press", at: [12, 9], label: "b()", src: "a.js:3" })
    .belt("f", "a", { out: "n", in: "w" }).belt("f", "b", { out: "s", in: "w" })
    .step({ belt: ["f->a", "f->b"], item: ["x", "y"] });
  const out = quiet(F);
  const group = out.svg.match(/<g class="m m-fanout"[^>]*>(.*?)<\/g>/)[1];
  assert.doesNotMatch(group, /class="body"|class="bolt"/);
  assert.match(out.svg, /class="hub-ring"/);
});
