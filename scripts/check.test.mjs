import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const HERE = new URL(".", import.meta.url).pathname;
const CHECK = join(HERE, "check.mjs");
const GOOD = readFileSync(join(HERE, "../examples/calc/beltline.svg"), "utf8");
const dir = mkdtempSync(join(tmpdir(), "beltline-check-"));

function run(svg, ...extra) {
  const f = join(dir, `t${Math.random().toString(36).slice(2)}.svg`);
  writeFileSync(f, svg);
  return spawnSync(process.execPath, [CHECK, f, ...extra], { encoding: "utf8" });
}

test("the calc example passes", () => {
  const r = run(GOOD);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /svg check passed/);
});

const faults = [
  ["unclosed element", (s) => s.replace("</desc>", ""), /xml/],
  ["script element", (s) => s.replace("</svg>", "<script>1</script></svg>"), /<script>/],
  ["foreignObject", (s) => s.replace("</svg>", "<foreignObject/></svg>"), /foreignObject/],
  ["SMIL animate", (s) => s.replace("</svg>", '<rect><animate attributeName="x"/></rect></svg>'), /SMIL/],
  ["event handler", (s) => s.replace("<rect ", '<rect onclick="x()" '), /event handler/],
  ["duplicate id", (s) => s.replace("</svg>", '<g id="bl-a0"/></svg>'), /used 2 times/],
  ["dangling url ref", (s) => s.replace("</svg>", '<rect fill="url(#nope)"/></svg>'), /#nope is referenced/],
  ["remote font", (s) => s.replace("<style>", "<style>@import url(https://x.test/f.css);"), /@import/],
  ["animation outside the motion query", (s) => s.replace("<style>", "<style>.x{animation:k0 1s}"), /outside @media/],
  ["infinite loop", (s) => s.replace("<style>", "<style>@media (prefers-reduced-motion: no-preference){.x{animation:k0 1s infinite}}"), /loops forever/],
  ["no title first", (s) => s.replace(/<title[^>]*>[^<]*<\/title>/, ""), /<title>/],
  ["paragraph text", (s) => s.replace("</svg>", `<text>${"word ".repeat(30)}</text></svg>`), /chars/],
  ["too many visible texts", (s) => s.replace("</svg>", "<text>x</text>".repeat(120) + "</svg>"), /visible <text> elements/],
  ["too many playback states", (s) => s.replace("</svg>", '<g opacity="0">' + "<text>x</text>".repeat(600) + "</g></svg>"), /in total/],
  ["too many colours", (s) => s.replace("<style>", `<style>${Array.from({ length: 30 }, (_, i) => `.c${i}{fill:#${(0x100000 + i * 4099).toString(16).slice(0, 6)}}`).join("")}`), /colour literals/],
  ["external image", (s) => s.replace("</svg>", '<image href="https://x.test/a.png"/></svg>'), /external|raster/],
  ["inline style animation", (s) => s.replace("</svg>", '<rect style="animation:k0 1s both"/></svg>'), /inline style/],
  ["media query with an alternative", (s) => s.replace("<style>", "<style>@media (prefers-reduced-motion:no-preference), (min-width:1px){rect{animation:k0 1s both}}"), /exactly/],
  ["upper-case animation property", (s) => s.replace("<style>", "<style>.x{ANIMATION:k0 1s}"), /outside @media/],
  ["namespace-prefixed SMIL", (s) => s.replace("</svg>", '<s:animate xmlns:s="http://www.w3.org/2000/svg" attributeName="x"/></svg>'), /SMIL/],
  ["entity-escaped javascript URL", (s) => s.replace("</svg>", '<a href="java&#x73;cript:alert(1)"><text>x</text></a></svg>'), /javascript/],
  ["remote paint server", (s) => s.replace("<rect ", '<rect fill="url(https://x.test/p.svg#p)" '), /loads/],
  ["bare ampersand", (s) => s.replace("</desc>", " & more</desc>"), /bare &|entity/],
  ["second root element", (s) => s + "<svg/>", /second root/],
  ["unterminated declaration", (s) => s + "<!", /unterminated|outside/],
];

for (const [name, mutate, expect] of faults) {
  test(`planted fault fails: ${name}`, () => {
    const svg = mutate(GOOD);
    assert.notEqual(svg, GOOD, "the mutation did not change the file, so this control proves nothing");
    const r = run(svg);
    assert.equal(r.status, 1, `expected failure, got:\n${r.stdout}${r.stderr}`);
    assert.match(r.stderr, expect);
    assert.match(r.stderr, /svg check failed/);
  });
}

test("unknown options are rejected before checking", () => {
  const r = run(GOOD, "--max-text", "3");
  assert.equal(r.status, 2);
});

const SOURCES = join(HERE, "check-sources.mjs");
const CALC = join(HERE, "../examples/calc");
function sources(svg) {
  const f = join(dir, `s${Math.random().toString(36).slice(2)}.svg`);
  writeFileSync(f, svg);
  return spawnSync(process.execPath, [SOURCES, f, CALC], { encoding: "utf8" });
}

test("check-sources passes the calc example", () => {
  const r = sources(GOOD);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /sources: 0 unresolved/);
});

for (const [name, attr] of [["missing file", 'data-src="nope.js:1"'], ["line past the end", 'data-src="calc.js:999"'], ["single-quoted bad source", "data-src='calc.js:999'"], ["range past the end", 'data-src="calc.js:1-99999"'], ["symbol not near the line", 'data-src="calc.js:1" data-symbol="evaluate"']]) {
  test(`check-sources planted fault fails: ${name}`, () => {
    const r = sources(GOOD.replace("</svg>", `<g ${attr}/></svg>`));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /unresolved/);
  });
}

for (const script of ["check.mjs", "check-sources.mjs", "capture.mjs"]) {
  test(`${script} loads and prints its usage`, () => {
    const r = spawnSync(process.execPath, [join(HERE, script), "--help"], { encoding: "utf8" });
    assert.ok(r.status === 0 || r.status === 2, `${script} crashed: ${r.stderr}`);
    assert.match(r.stdout + r.stderr, /usage:/);
  });
}

test("hidden playback text does not count against the visible budget", () => {
  const r = run(GOOD.replace("</svg>", '<g opacity="0">' + "<text>x</text>".repeat(60) + "</g></svg>"));
  assert.equal(r.status, 0, r.stderr);
});
