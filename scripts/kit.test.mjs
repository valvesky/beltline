import { test } from "node:test";
import assert from "node:assert/strict";
import { factory } from "../kit/beltline.mjs";

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
  const ds = [...out.svg.matchAll(/<path d="([^"]+)" class="belt"/g)].map((m) => m[1]);
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
  ["drum sectors overlap", (F) => F.machine("d", { kind: "drum", at: [12, 6], label: "ring", src: "a.js:9", radius: 30, cellW: 40, cells: Array(8).fill("") }).belt("b", "d").step({ belt: "a->b" }), /drum sectors/],
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
  factory({ title: "t", subtitle: "Illustrative, not a recording.", desc: "d", cols: 30, rows: 12 })
    .machine("r", { kind: "rack", at: [2, 2], label: "r[]", src: "a.js:1", cells: ["7", "3", "9"] })
    .machine("o", { kind: "dock", at: [16, 2], label: "out", external: true })
    .machine("bot", { kind: "arm", at: [4, 6], label: "arm", src: "a.js:2" })
    .belt("r", "o");

test("an arm lifts a piece, holds it while others shift, and sets it down", () => {
  const out = quiet(armTour().step({ arm: "bot", moves: [{ from: ["r", 1], to: ["r", 0] }], writes: { r: [[1, "7"], [0, ""]] }, caption: "sort" }));
  assert.deepEqual(out.problems, []);
  assert.equal((out.svg.match(/class="arm-seg"/g) ?? []).length, 2);
  const cells = [...out.svg.matchAll(/class="val[^"]*" text-anchor="middle" dominant-baseline="central"(?: id="[^"]+")?>([^<]*)</g)].map((m) => m[1]);
  assert.ok(cells.includes("3") && cells.includes("7"));
  assert.match(out.svg, /class="item-b"[^>]*\/><text[^>]*class="item-t"[^>]*>3</);
  const end = out.svg.match(/<text x="([\d.]+)" y="[\d.]+" class="val val-w" text-anchor="middle" dominant-baseline="central"( id="[^"]+")?>3<\/text>/);
  assert.ok(end, "3 is not written at the target");
});

test("the resting arm is the static end state", () => {
  const out = quiet(armTour().step({ arm: "bot", moves: [{ from: ["r", 1], to: ["r", 0] }] }));
  const g = out.svg.match(/<g class="rot" style="transform-origin:([\d.]+)px ([\d.]+)px" transform="rotate\(([-\d.]+) [\d.]+ [\d.]+\)" id="(bl-a\d+)">/);
  assert.ok(g, "no animated arm root");
  const kf = out.svg.match(new RegExp(`#${g[4]}\\{animation-name:(k\\d+)\\}`))[1];
  const body = out.svg.match(new RegExp(`@keyframes ${kf}\\{([^\\n]+)\\}`))[1];
  const last = body.match(/rotate\(([-\d.]+)deg\)\}$/)[1];
  assert.equal(Number(last), Number(g[3]), "the arm does not return to its resting pose");
});

const armFaults = [
  ["arm placed too far from its cells", (F) => F.machine("far", { kind: "rack", at: [22, 9], label: "far", src: "a.js:3", cells: ["x"] }).belt("far", "o").step({ arm: "bot", moves: [{ from: ["r", 0], to: ["far", 0] }] }), /reach to get to its cells/],
  ["arm with a reach too short", (F) => { F.machine("bot2", { kind: "arm", at: [12, 7], label: "arm2", src: "a.js:4", reach: 40 }); return F.step({ arm: "bot2", moves: [{ from: ["r", 0], to: ["r", 2] }] }).step({ arm: "bot", moves: [{ from: ["r", 1], to: ["r", 0] }] }); }, /cannot reach/],
  ["arm with no moves", (F) => F.step({ belt: "r->o", item: "1" }), /never moves anything/],
  ["move to a missing cell", (F) => F.step({ arm: "bot", moves: [{ from: ["r", 0], to: ["r", 9] }] }), /needs from/],
  ["arm step on a non-arm", (F) => F.step({ arm: "r", moves: [{ from: ["r", 0], to: ["r", 1] }] }), /not an arm/],
];
for (const [name, plant, expect] of armFaults) {
  test(`planted fault fails the audit: ${name}`, () => {
    const out = quiet(plant(armTour()));
    assert.ok(out.problems.length > 0, "the audit passed a planted fault, so the check is broken");
    assert.match(out.problems.join("\n"), expect);
  });
}
