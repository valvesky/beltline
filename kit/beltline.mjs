import { writeFileSync } from "node:fs";

const CHAR_W = 6.7;
const FADE = 0.12;
const LIMITS = { texts: 140, itemChars: 16, labelChars: 28, valueChars: 14, captionChars: 96 };

export const THEME = {
  light: {
    paper: "#f3f1ea", dot: "#d9d5c9", ink: "#2a2925", mid: "#76726a", lo: "#b8b3a6",
    body: "#e6e2d7", cell: "#fbfaf6", belt: "#d3cebf", accent: "#d9731a", "accent-ink": "#ffffff", "accent-soft": "#f6dcc2", slot: "#3a3732",
  },
  dark: {
    paper: "#191917", dot: "#2b2a26", ink: "#e7e3d8", mid: "#9b968a", lo: "#5b5850",
    body: "#262521", cell: "#1e1d1a", belt: "#35332d", accent: "#f0943c", "accent-ink": "#1a1208", "accent-soft": "#4a3220", slot: "#0c0c0b",
  },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r1 = (n) => Math.round(n * 10) / 10;
const textW = (s, size = 11) => String(s).length * CHAR_W * (size / 11);
const rect = (x, y, w, h, cls, rx = 0, extra = "") =>
  `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"${rx ? ` rx="${rx}"` : ""} class="${cls}"${extra}/>`;
const text = (x, y, s, cls, anchor = "middle", extra = "") =>
  `<text x="${r1(x)}" y="${r1(y)}" class="${cls}" text-anchor="${anchor}"${extra}>${esc(s)}</text>`;
const pathD = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${r1(p[0])} ${r1(p[1])}`).join("");
const overlap = (a, b, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;

function segHitsBox(a, b, box, inset = 2) {
  const x0 = box.x + inset, x1 = box.x + box.w - inset, y0 = box.y + inset, y1 = box.y + box.h - inset;
  if (a[1] === b[1]) {
    const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]);
    return a[1] > y0 && a[1] < y1 && hi > x0 && lo < x1;
  }
  const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
  return a[0] > x0 && a[0] < x1 && hi > y0 && lo < y1;
}

function segsCross(a, b, c, d) {
  const h1 = a[1] === b[1], h2 = c[1] === d[1];
  if (h1 === h2) return false;
  const [h, v] = h1 ? [[a, b], [c, d]] : [[c, d], [a, b]];
  const x = v[0][0], y = h[0][1];
  const inH = x > Math.min(h[0][0], h[1][0]) && x < Math.max(h[0][0], h[1][0]);
  const inV = y > Math.min(v[0][1], v[1][1]) && y < Math.max(v[0][1], v[1][1]);
  return inH && inV;
}

const DIRS = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] };

function cellsRow(x, y, n, cw, ch, gap = 0) {
  return Array.from({ length: n }, (_, i) => ({ x: x + i * (cw + gap), y, w: cw, h: ch }));
}

function cellsCol(x, y, n, cw, ch, gap = 0, upward = false) {
  return Array.from({ length: n }, (_, i) => ({ x, y: upward ? y - (i + 1) * ch - i * gap : y + i * (ch + gap), w: cw, h: ch }));
}

const MACHINES = {
  rack(m, x, y) {
    const n = m.cells.length, cw = m.cellW ?? 30, ch = 24, pad = 6;
    const w = n * cw + pad * 2 + (m.more ? 18 : 0), h = ch + pad * 2;
    const cells = cellsRow(x + pad, y + pad, n, cw, ch);
    let svg = rect(x, y, w, h, "body", 4);
    svg += `<path d="M${x + 8} ${y + h}v5M${x + w - 8} ${y + h}v5" class="leg"/>`;
    if (m.more) svg += text(x + w - pad - 7, y + h / 2, "…", "dim", "middle", ` dominant-baseline="central"`);
    const pointer = { mode: "x", at: (i) => ({ x: cells[i].x + cw / 2, y: y + h + 1 }) };
    return { w, h: h + 5, body: { x, y, w, h }, svg, cells, pointer };
  },
  drum(m, x, y) {
    const n = m.cells.length, R = m.radius ?? (n > 6 ? 56 : 46), cx = x + R, cy = y + R;
    let svg = `<circle cx="${cx}" cy="${cy}" r="${R}" class="body"/><circle cx="${cx}" cy="${cy}" r="${R * 0.28}" class="hub"/>`;
    const cells = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 2 * Math.PI - Math.PI / 2;
      svg += `<path d="M${r1(cx + Math.cos(a0) * R * 0.28)} ${r1(cy + Math.sin(a0) * R * 0.28)}L${r1(cx + Math.cos(a0) * R)} ${r1(cy + Math.sin(a0) * R)}" class="seam"/>`;
      const am = a0 + Math.PI / n, rr = R * 0.66;
      const cw = m.cellW ?? 24;
      cells.push({ x: cx + Math.cos(am) * rr - cw / 2, y: cy + Math.sin(am) * rr - 9, w: cw, h: 18, round: true });
    }
    const pointer = { mode: "rot", cx, cy, r: R + 7, tipLabel: R + 16, angle: (i) => ((i + 0.5) / n) * 360 - 90 };
    return { w: 2 * R, h: 2 * R, body: { x, y, w: 2 * R, h: 2 * R }, svg, cells, pointer };
  },
  hopper(m, x, y) {
    const n = m.cells.length, cw = m.cellW ?? 34, ch = 20, w = cw + 28, top = 24;
    const cells = cellsCol(x + (w - cw) / 2, y + top + 4, n, cw, ch);
    const h = top + 8 + n * ch;
    let svg = `<path d="M${x} ${y}H${x + w}L${x + (w + cw) / 2 + 4} ${y + top}V${y + h}H${x + (w - cw) / 2 - 4}V${y + top}Z" class="body"/>`;
    return { w, h, body: { x, y, w, h }, svg, cells };
  },
  stack(m, x, y) {
    const n = m.cells.length, cw = 36, ch = 20, w = cw + 12, spring = 12;
    const h = n * ch + spring + 10;
    const cells = cellsCol(x + 6, y + h - spring - 4, n, cw, ch, 0, true);
    let svg = `<path d="M${x} ${y}V${y + h}H${x + w}V${y}" class="tube"/>`;
    let z = `M${x + 8} ${y + h - 3}`;
    for (let i = 0; i < 6; i++) z += `L${x + 8 + (i + 0.5) * ((w - 16) / 6)} ${y + h - (i % 2 ? 3 : spring)}`;
    svg += `<path d="${z}L${x + w - 8} ${y + h - 3}" class="seam"/>`;
    return { w, h, body: { x, y, w, h }, svg, cells };
  },
  hashmap(m, x, y) {
    const chain = m.chain ?? {}, ch = 22, cw = m.cellW ?? 56, idxW = 16, pad = 6, linkCw = m.chainW ?? 40;
    const chained = Object.values(chain).reduce((a, b) => a + b, 0);
    const n = m.cells.length - chained;
    const maxChain = Math.max(0, ...Object.values(chain));
    const w = pad + idxW + cw + (maxChain ? maxChain * (linkCw + 14) : 0) + pad + (m.evict ? 22 : 0), h = n * ch + pad * 2;
    let svg = rect(x, y, w, h, "body", 3) + rect(x + pad, y + pad, idxW, n * ch, "idx-rail", 2);
    const cells = [], idx = [];
    for (let i = 0; i < n; i++) {
      cells.push({ x: x + pad + idxW, y: y + pad + i * ch, w: cw, h: ch });
      idx.push({ x: x + pad + idxW / 2, y: y + pad + i * ch + ch / 2, s: String(i) });
    }
    for (const b of Object.keys(chain).map(Number).sort((a, c) => a - c)) {
      let prev = cells[b];
      for (let k = 0; k < chain[b]; k++) {
        const c = { x: prev.x + prev.w + 14, y: prev.y + 3, w: linkCw, h: ch - 6, round: true };
        svg += `<path d="M${r1(prev.x + prev.w)} ${r1(prev.y + prev.h / 2)}H${r1(c.x - 2)}" class="link" marker-end="url(#bl-arrow)"/>`;
        cells.push(c);
        prev = c;
      }
    }
    if (m.evict) svg += `<path d="M${x + w - 18} ${y + h - 6}l14 10M${x + w - 18} ${y + h - 14}l14 10" class="seam"/>`;
    const pointer = { mode: "y", at: (i) => ({ x: x + pad - 1, y: y + pad + i * ch + ch / 2, w: idxW + 2, h: ch - 2 }) };
    return { w, h, body: { x, y, w, h }, svg, cells, pointer, idx };
  },
  lru(m, x, y) {
    const nb = m.buckets ?? 4, nn = m.cells.length - nb, ch = 22, cw = m.cellW ?? 50, idxW = 16, pad = 6, nw = m.nodeW ?? 34, gap = 18;
    const listX = x + pad + idxW + cw + 22;
    const w = listX - x + nn * nw + (nn - 1) * gap + pad + 18, h = Math.max(nb * ch + pad * 2, 64);
    let svg = rect(x, y, w, h, "body", 3) + rect(x + pad, y + pad, idxW, nb * ch, "idx-rail", 2);
    const cells = [], idx = [];
    for (let i = 0; i < nb; i++) {
      cells.push({ x: x + pad + idxW, y: y + pad + i * ch, w: cw, h: ch });
      idx.push({ x: x + pad + idxW / 2, y: y + pad + i * ch + ch / 2, s: String(i) });
    }
    const ly = y + h / 2 - 11;
    for (let i = 0; i < nn; i++) cells.push({ x: listX + i * (nw + gap), y: ly, w: nw, h: 22, round: true });
    for (let i = 0; i < nn - 1; i++) {
      const a = cells[nb + i], b = cells[nb + i + 1];
      svg += `<path d="M${r1(a.x + a.w)} ${r1(ly + 7)}H${r1(b.x - 2)}" class="link" marker-end="url(#bl-arrow)"/><path d="M${r1(b.x)} ${r1(ly + 15)}H${r1(a.x + a.w + 2)}" class="link" marker-end="url(#bl-arrow)"/>`;
    }
    svg += `<path d="M${r1(listX - 14)} ${y + 6}V${y + h - 6}" class="seam"/>`;
    const last = cells.at(-1);
    svg += `<path d="M${r1(last.x + last.w + 4)} ${r1(ly + 22)}l10 ${r1(y + h - ly - 22)}M${r1(last.x + last.w - 6)} ${r1(ly + 24)}l10 ${r1(y + h - ly - 24)}" class="seam"/>`;
    const ends = nn ? [{ x: cells[nb].x + nw / 2, y: ly - 7, s: m.mru ?? "MRU" }, { x: last.x + nw / 2, y: ly - 7, s: m.lruLabel ?? "LRU" }] : [];
    const pointer = { mode: "y", at: (i) => ({ x: x + pad - 1, y: y + pad + i * ch + ch / 2, w: idxW + 2, h: ch - 2 }) };
    return { w, h, body: { x, y, w, h }, svg, cells, pointer, idx, ends };
  },
  tower(m, x, y) {
    const n = Math.min(m.cells.length, 7), nw = 28, nh = 18, lvGap = 16, w = 4 * (nw + 6) + 6;
    const cells = [];
    const pos = (lvl, k) => {
      const count = 2 ** lvl, slot = w / count;
      return { x: x + slot * k + (slot - nw) / 2, y: y + 6 + lvl * (nh + lvGap), w: nw, h: nh };
    };
    let svg = "";
    for (let i = 0; i < n; i++) {
      const lvl = Math.floor(Math.log2(i + 1)), k = i + 1 - 2 ** lvl;
      const c = pos(lvl, k);
      cells.push(c);
      if (i) {
        const p = cells[Math.floor((i - 1) / 2)];
        svg += `<path d="M${r1(p.x + nw / 2)} ${r1(p.y + nh)}V${r1(c.y - lvGap / 2)}H${r1(c.x + nw / 2)}V${r1(c.y)}" class="chute"/>`;
      }
    }
    const h = cells.reduce((a, c) => Math.max(a, c.y + c.h), y) - y + 6;
    svg = rect(x, y, w, h, "frame", 3) + svg;
    return { w, h, body: { x, y, w, h }, svg, cells };
  },
  selector(m, x, y) {
    const states = m.states ?? [], R = 24, cx = x + R + 6, cy = y + R + 6;
    const regs = m.cells.length, rw = m.cellW ?? 64, w = 2 * R + 12 + (regs ? rw + 10 : 0), h = Math.max(2 * R + 12, regs * 22 + 12);
    let svg = rect(x, y, w, h, "body", 4) + `<circle cx="${cx}" cy="${cy}" r="${R}" class="dial"/>`;
    const ang = (i) => (states.length ? (i / states.length) * 360 - 90 : -90);
    states.forEach((_, i) => {
      const a = (ang(i) * Math.PI) / 180;
      svg += `<path d="M${r1(cx + Math.cos(a) * (R - 5))} ${r1(cy + Math.sin(a) * (R - 5))}L${r1(cx + Math.cos(a) * R)} ${r1(cy + Math.sin(a) * R)}" class="tick"/>`;
    });
    const cells = cellsCol(x + 2 * R + 16, y + 6, regs, rw, 22);
    const pointer = { mode: "rot", cx, cy, r: R - 8, angle: ang, needle: true };
    return { w, h, body: { x, y, w, h }, svg, cells, pointer };
  },
  cutter(m, x, y) {
    const regs = m.cells.length, w = Math.max(76, regs * (m.cellW ?? 34) + 12), h = 56 + (regs ? 26 : 0);
    let svg = rect(x, y, w, h, "body", 4);
    const mx = x + w / 2;
    svg += `<path d="M${mx - 10} ${y + 6}H${mx + 10}L${mx + 3} ${y + 30}H${mx - 3}Z" class="blade"/>`;
    svg += `<path d="M${x + 8} ${y + 40}H${x + w - 8}" class="slot"/><path d="M${mx - 18} ${y + 40}v-6M${mx + 18} ${y + 40}v-6" class="seam"/>`;
    const cells = cellsRow(x + 6, y + 52, regs, m.cellW ?? 34, 22);
    return { w, h, body: { x, y, w, h }, svg, cells };
  },
  press(m, x, y) {
    const regs = m.cells.length, w = Math.max(76, regs * (m.cellW ?? 34) + 12), h = 56 + (regs ? 26 : 0);
    let svg = rect(x, y, w, h, "body", 4);
    const mx = x + w / 2;
    svg += `<path d="M${mx} ${y + 4}V${y + 16}" class="rod"/>` + rect(mx - 16, y + 16, 32, 10, "head", 2);
    svg += `<path d="M${x + 10} ${y + 44}H${x + w - 10}" class="slot"/>` + rect(mx - 12, y + 36, 24, 6, "die", 1);
    const cells = cellsRow(x + 6, y + 52, regs, m.cellW ?? 34, 22);
    return { w, h, body: { x, y, w, h }, svg, cells };
  },
  plate(m, x, y) {
    const cols = m.cols ?? 8, rows = m.rows ?? 5, px = m.pixel ?? 10, pad = 6;
    const w = cols * px + pad * 2, h = rows * px + pad * 2;
    const cells = Array.from({ length: cols * rows }, (_, i) => ({ x: x + pad + (i % cols) * px, y: y + pad + Math.floor(i / cols) * px, w: px, h: px, pixel: true }));
    let svg = rect(x, y, w, h, "body", 2);
    return { w, h, body: { x, y, w, h }, svg, cells };
  },
  chain(m, x, y) {
    const n = m.cells.length, cw = m.cellW ?? 30, ch = 22, gap = m.doubly ? 18 : 14;
    const cells = cellsRow(x, y + 4, n, cw, ch, gap);
    let svg = "";
    for (let i = 0; i < n - 1; i++) {
      const a = cells[i], b = cells[i + 1];
      if (m.doubly) svg += `<path d="M${r1(a.x + a.w)} ${r1(a.y + 7)}H${r1(b.x - 2)}" class="link" marker-end="url(#bl-arrow)"/><path d="M${r1(b.x)} ${r1(a.y + 15)}H${r1(a.x + a.w + 2)}" class="link" marker-end="url(#bl-arrow)"/>`;
      else svg += `<path d="M${r1(a.x + a.w)} ${r1(a.y + ch / 2)}H${r1(b.x - 2)}" class="link" marker-end="url(#bl-arrow)"/>`;
    }
    const w = n * cw + (n - 1) * gap, h = ch + 8;
    return { w, h, body: { x, y, w, h }, svg, cells, round: true };
  },
  record(m, x, y) {
    const n = m.cells.length, cw = m.cellW ?? 92, ch = 20, pad = 5;
    const w = cw + pad * 2, h = n * ch + pad * 2;
    const cells = cellsCol(x + pad, y + pad, n, cw, ch);
    let svg = rect(x, y, w, h, "body", 3);
    cells.forEach((c) => (svg += `<path d="M${r1(c.x + c.w - 9)} ${r1(c.y + c.h / 2)}h5" class="handle"/>`));
    return { w, h, body: { x, y, w, h }, svg, cells, valueAnchor: "start" };
  },
  turnstile(m, x, y) {
    const R = 20, cx = x + R + 4, cy = y + R + 4;
    let svg = `<circle cx="${cx}" cy="${cy}" r="${R + 4}" class="body"/>`;
    const pointer = { mode: "rot", cx, cy, r: R, angle: (i) => i * 60, arms: true };
    return { w: 2 * R + 8, h: 2 * R + 8, body: { x, y, w: 2 * R + 8, h: 2 * R + 8 }, svg, cells: [], pointer };
  },
  splitter(m, x, y) {
    const w = m.w ?? 56, h = m.h ?? 64;
    const svg = rect(x, y, w, h, "body", 4) + rect(x + 4, y + 4, w - 8, h - 8, "well", 3);
    return { w, h, body: { x, y, w, h }, svg, cells: [], flap: { cx: x + w / 2, cy: y + h / 2 } };
  },
  dock(m, x, y) {
    const n = m.cells.length, cw = m.cellW ?? 46;
    const w = m.w ?? Math.max(58, cw + 16), h = m.h ?? 58;
    let svg = rect(x, y, w, h, "dock", 2) + rect(x + 6, y + 6, w - 12, h - 12, "bay", 1);
    const cells = cellsCol(x + (w - cw) / 2, y + (h - n * 22) / 2, n, cw, 22);
    return { w, h, body: { x, y, w, h }, svg, cells };
  },
};

MACHINES.pigeonholes = MACHINES.hashmap;
export const KINDS = Object.keys(MACHINES);
const STORES = new Set(["rack", "drum", "hopper", "stack", "pigeonholes", "hashmap", "lru", "tower", "chain", "record", "plate"]);

export function factory(opts) {
  const G = opts.grid ?? 24;
  const cols = opts.cols, rows = opts.rows;
  if (!cols || !rows) throw new Error("factory({cols, rows}) is required");
  const W = cols * G, HEAD = 64, floorH = rows * G;
  const machines = new Map(), belts = [], signals = [], steps = [], raws = [], gaps = [];
  let ledger = opts.ledger ?? [];
  const problems = [];
  const fail = (msg) => problems.push(msg);
  if (String(opts.title ?? "").length > 72) fail(`title is longer than 72 chars`);
  if (String(opts.subtitle ?? "").length > LIMITS.captionChars) fail(`subtitle is longer than ${LIMITS.captionChars} chars`);
  if (!/not a recording|illustrative/i.test(`${opts.subtitle ?? ""} ${opts.desc ?? ""}`)) fail("say in the subtitle that this is a source-derived walkthrough, not a recording");
  const at = (c, r) => [c * G, HEAD + r * G];

  const api = {
    grid: G,
    machine(id, m) {
      if (machines.has(id)) throw new Error(`duplicate machine ${id}`);
      if (!MACHINES[m.kind]) throw new Error(`machine ${id}: unknown kind ${m.kind}; use one of ${KINDS.join(", ")}`);
      const [x, y] = at(...m.at);
      const spec = { ...m, cells: m.cells ?? [] };
      const geo = MACHINES[m.kind](spec, x, y);
      machines.set(id, { id, ...spec, x, y, geo, cells: geo.cells.map((c, i) => ({ ...c, init: spec.cells[i] ?? "", events: [] })), pointers: Object.fromEntries(Object.entries(m.pointers ?? {}).map(([k, v]) => [k, { init: v, events: [] }])), hot: [] });
      return api;
    },
    belt(from, to, o = {}) {
      belts.push({ id: o.id ?? `${from}->${to}`, from, to, kind: "belt", ...o });
      return api;
    },
    signal(from, to, o = {}) {
      signals.push({ id: o.id ?? `${from}~>${to}`, from, to, kind: "signal", ...o });
      return api;
    },
    step(s) {
      steps.push(s);
      return api;
    },
    trace(label) {
      steps.push({ trace: label });
      return api;
    },
    raw(svg, box) {
      raws.push({ svg, box });
      return api;
    },
    gap(s) {
      gaps.push(s);
      return api;
    },
    ledger(rows) {
      ledger = rows;
      return api;
    },
    build(outPath) {
      const out = render();
      if (problems.length) {
        for (const p of problems) console.error(`  - ${p}`);
        console.error(`audit failed: ${problems.length} problem${problems.length > 1 ? "s" : ""}`);
        process.exitCode = 1;
        if (!opts.writeOnFail) return out;
      } else console.log("audit passed");
      if (outPath) writeFileSync(outPath, out.svg);
      if (outPath) console.log(`wrote ${outPath} (${out.svg.length} bytes, ${out.texts} visible texts, ${out.duration.toFixed(1)} s playback)`);
      return out;
    },
  };

  function portPoint(m, side, k, count) {
    const b = m.geo.body;
    const f = (k + 1) / (count + 1);
    if (side === "e") return [b.x + b.w, Math.round(b.y + b.h * f)];
    if (side === "w") return [b.x, Math.round(b.y + b.h * f)];
    if (side === "s") return [Math.round(b.x + b.w * f), b.y + b.h + (m.geo.h - b.h)];
    return [Math.round(b.x + b.w * f), b.y];
  }

  function autoSide(a, b) {
    const ab = a.geo.body, bb = b.geo.body;
    const dx = bb.x + bb.w / 2 - (ab.x + ab.w / 2), dy = bb.y + bb.h / 2 - (ab.y + ab.h / 2);
    const horizontalGap = dx > 0 ? bb.x - (ab.x + ab.w) : ab.x - (bb.x + bb.w);
    const verticalGap = dy > 0 ? bb.y - (ab.y + ab.h) : ab.y - (bb.y + bb.h);
    if (horizontalGap >= verticalGap) return dx >= 0 ? "e" : "w";
    return dy >= 0 ? "s" : "n";
  }

  const opposite = { e: "w", w: "e", n: "s", s: "n" };

  function route(edges) {
    const slots = new Map();
    for (const e of edges) {
      const a = machines.get(e.from), b = machines.get(e.to);
      if (!a || !b) {
        fail(`${e.kind} ${e.id}: unknown machine ${!a ? e.from : e.to}`);
        continue;
      }
      e.outSide = e.out ?? autoSide(a, b);
      e.inSide = e.in ?? opposite[autoSide(a, b)];
      for (const [m, side, role] of [[a, e.outSide, "out"], [b, e.inSide, "in"]]) {
        const key = `${m.id}:${side}`;
        if (!slots.has(key)) slots.set(key, []);
        slots.get(key).push({ e, role });
      }
    }
    for (const [key, list] of slots) {
      const [mid, side] = key.split(":");
      const m = machines.get(mid);
      const horiz = side === "e" || side === "w";
      list.sort((p, q) => {
        const op = machines.get(p.role === "out" ? p.e.to : p.e.from), oq = machines.get(q.role === "out" ? q.e.to : q.e.from);
        return horiz ? op.geo.body.y - oq.geo.body.y : op.geo.body.x - oq.geo.body.x;
      });
      list.forEach(({ e, role }, k) => {
        e[role === "out" ? "p0" : "p1"] = portPoint(m, side, k, list.length);
        e[role === "out" ? "outShared" : "inShared"] = list.length > 1;
      });
    }
    for (const e of edges) {
      if (!e.p0 || !e.p1 || e.via || (e.outShared && e.inShared)) continue;
      const vertical = (e.outSide === "s" && e.inSide === "n") || (e.outSide === "n" && e.inSide === "s");
      const horizontal = (e.outSide === "e" && e.inSide === "w") || (e.outSide === "w" && e.inSide === "e");
      const tb = machines.get(e.to).geo.body, fb = machines.get(e.from).geo.body;
      if (vertical) {
        const lo = Math.max(tb.x, fb.x) + 6, hi = Math.min(tb.x + tb.w, fb.x + fb.w) - 6;
        if (!e.inShared && e.p0[0] >= lo && e.p0[0] <= hi) e.p1 = [e.p0[0], e.p1[1]];
        else if (!e.outShared && e.p1[0] >= lo && e.p1[0] <= hi) e.p0 = [e.p1[0], e.p0[1]];
      }
      if (horizontal) {
        const lo = Math.max(tb.y, fb.y) + 6, hi = Math.min(tb.y + tb.h, fb.y + fb.h) - 6;
        if (!e.inShared && e.p0[1] >= lo && e.p0[1] <= hi) e.p1 = [e.p1[0], e.p0[1]];
        else if (!e.outShared && e.p1[1] >= lo && e.p1[1] <= hi) e.p0 = [e.p0[0], e.p1[1]];
      }
    }
    for (const e of edges) {
      if (!e.p0 || !e.p1) continue;
      const d0 = DIRS[e.outSide], d1 = DIRS[e.inSide];
      const useArms = opts.inserters !== false && e.kind === "belt" && e.arm !== false;
      e.armOut = useArms && STORES.has(machines.get(e.from).kind);
      e.armIn = useArms && STORES.has(machines.get(e.to).kind);
      const k0 = e.armOut ? 1 : 0.5, k1 = e.armIn ? 1 : 0.5;
      const s0 = [e.p0[0] + d0[0] * G * k0, e.p0[1] + d0[1] * G * k0];
      const s1 = [e.p1[0] + d1[0] * G * k1, e.p1[1] + d1[1] * G * k1];
      const via = (e.via ?? []).map(([c, r]) => at(c, r));
      const pts = [e.p0, s0];
      let axis = d0[0] ? "h" : "v";
      const targets = [...via, s1];
      targets.forEach((t, i) => {
        const a = pts.at(-1);
        const last = i === targets.length - 1;
        const enterAxis = last ? (d1[0] ? "h" : "v") : null;
        if (a[0] !== t[0] && a[1] !== t[1]) {
          if (enterAxis && enterAxis === axis) {
            if (axis === "h") {
              const mx = Math.round((a[0] + t[0]) / 2 / (G / 2)) * (G / 2);
              pts.push([mx, a[1]], [mx, t[1]]);
            } else {
              const my = Math.round((a[1] + t[1]) / 2 / (G / 2)) * (G / 2);
              pts.push([a[0], my], [t[0], my]);
            }
          } else if (axis === "h") pts.push([t[0], a[1]]);
          else pts.push([a[0], t[1]]);
        }
        pts.push(t);
        const p = pts.at(-2);
        axis = p[1] === t[1] ? "h" : "v";
      });
      pts.push(e.p1);
      const simple = [pts[0]];
      for (const p of pts.slice(1)) {
        const last = simple.at(-1);
        if (last[0] === p[0] && last[1] === p[1]) continue;
        const prev = simple.at(-2);
        if (prev && ((prev[0] === last[0] && last[0] === p[0]) || (prev[1] === last[1] && last[1] === p[1]))) simple[simple.length - 1] = p;
        else simple.push(p);
      }
      e.pts = simple;
      for (let i = 1; i < e.pts.length; i++) {
        const a = e.pts[i - 1], b = e.pts[i];
        if (a[0] !== b[0] && a[1] !== b[1]) fail(`${e.kind} ${e.id}: the route has a diagonal segment; adjust via points`);
      }
      e.len = 0;
      for (let i = 1; i < e.pts.length; i++) e.len += Math.abs(e.pts[i][0] - e.pts[i - 1][0]) + Math.abs(e.pts[i][1] - e.pts[i - 1][1]);
    }
  }

  function pointAt(pts, d) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const L = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      if (d <= L) {
        const f = L ? d / L : 0;
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      }
      d -= L;
    }
    return pts.at(-1);
  }

  function edgeLabelBox(e) {
    if (!e.label) return null;
    const tw = textW(e.label, 10) + 6, th = 13;
    if (e.labelAt) {
      const [x, y] = at(...e.labelAt);
      return { x, y: y - th / 2, w: tw, h: th, anchor: "start" };
    }
    let best = null;
    for (let i = 1; i < e.pts.length; i++) {
      const a = e.pts[i - 1], b = e.pts[i];
      const L = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      if (!best || L > best.L) best = { a, b, L };
    }
    const { a, b } = best;
    if (a[1] === b[1]) {
      const mx = (a[0] + b[0]) / 2;
      return { x: mx - tw / 2, y: a[1] - 10 - th, w: tw, h: th, anchor: "middle" };
    }
    const my = (a[1] + b[1]) / 2;
    return { x: a[0] + 10, y: my - th / 2, w: tw, h: th, anchor: "start" };
  }

  function compile() {
    const timeline = [];
    let t = 0.6, traceLabel = null, n = 0;
    const total = steps.filter((s) => !s.trace).length;
    for (const s of steps) {
      if (s.trace) {
        traceLabel = s.trace;
        continue;
      }
      n++;
      const start = t;
      if (s.belt) {
        const e = [...belts, ...signals].find((b) => b.id === s.belt);
        if (!e) {
          fail(`step ${n}: unknown belt ${s.belt}`);
          continue;
        }
        if (!e.pts) continue;
        const dur = Math.max(0.6, e.len / (opts.speed ?? 170));
        if (s.item != null) {
          if (String(s.item).length > LIMITS.itemChars) fail(`step ${n}: item "${s.item}" is longer than ${LIMITS.itemChars} chars; show the shape, put detail in the caption`);
          timeline.push({ type: "item", e, item: s.item, t0: t, t1: t + dur });
        } else timeline.push({ type: "pulse", e, t0: t, t1: t + dur });
        t += dur;
      }
      const writes = Object.entries(s.writes ?? {});
      const nWrites = writes.reduce((a, [, list]) => a + list.length, 0);
      const pointerMoves = Object.entries(s.pointers ?? {});
      const work = s.at || nWrites || pointerMoves.length ? Math.max(0.8, 0.22 * nWrites + 0.4) : 0;
      let k = 0;
      for (const [mid, list] of writes) {
        const m = machines.get(mid);
        if (!m) {
          fail(`step ${n}: writes to unknown machine ${mid}`);
          continue;
        }
        for (const [cis, value] of list) {
          for (const ci of Array.isArray(cis) ? cis : [cis]) {
            if (!m.cells[ci]) {
              fail(`step ${n}: ${mid} has no cell ${ci}`);
              continue;
            }
            if (String(value).length > LIMITS.valueChars && !m.cells[ci].pixel) fail(`step ${n}: value "${value}" in ${mid}[${ci}] is longer than ${LIMITS.valueChars} chars`);
            m.cells[ci].events.push({ t: t + 0.2 + k * 0.22, v: value });
          }
          k++;
        }
      }
      for (const [mid, moves] of pointerMoves) {
        const m = machines.get(mid);
        for (const [name, idx] of Object.entries(moves)) {
          if (!m?.pointers[name]) {
            fail(`step ${n}: ${mid} has no pointer ${name}`);
            continue;
          }
          m.pointers[name].events.push({ t: t + 0.2, i: idx });
        }
      }
      if (s.at) {
        const m = machines.get(s.at);
        if (!m) fail(`step ${n}: unknown machine ${s.at}`);
        else m.hot.push([start, t + work]);
      }
      t += work;
      const capText = `${traceLabel ? traceLabel + " · " : ""}${s.caption ?? ""}`;
      const shown = `${n}/${total} ${capText}`;
      if (shown.length > LIMITS.captionChars) fail(`step ${n}: the caption line "${shown.slice(0, 40)}…" is ${shown.length} chars with its prefix (max ${LIMITS.captionChars})`);
      timeline.push({ type: "caption", n, total, text: capText, t0: start, t1: t, src: s.src });
      t += 0.15;
    }
    return { timeline, T: t + 0.4 };
  }

  function render() {
    route([...belts, ...signals]);
    const { timeline, T } = compile();
    const pct = (s) => `${Math.min(100, Math.max(0, (s / T) * 100)).toFixed(3)}%`;
    const css = [];
    let kfN = 0;
    const anim = (frames) => {
      const name = `k${kfN++}`;
      const merged = new Map();
      for (const [time, decl] of frames.map((f, i) => [...f, i]).sort((a, b) => a[0] - b[0] || a[2] - b[2])) {
        const k = pct(time);
        merged.set(k, merged.has(k) ? `${merged.get(k)};${decl}` : decl);
      }
      if (!merged.has(pct(0))) merged.set(pct(0), frames[0][1]);
      if (!merged.has(pct(T))) merged.set(pct(T), frames.at(-1)[1]);
      const body = [...merged.entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0])).map(([p, d]) => `${p}{${d}}`).join("");
      css.push({ name, body });
      return name;
    };
    const windows = (spans, holdLast = false) => {
      const f = [[0, "opacity:0"]];
      spans.forEach(([a, b], i) => {
        f.push([a, "opacity:0"], [a + FADE, "opacity:1"]);
        if (!(holdLast && i === spans.length - 1)) f.push([b, "opacity:1"], [b + FADE, "opacity:0"]);
      });
      return f;
    };
    const animated = [];
    const animAttr = (frames) => {
      const name = anim(frames);
      const id = `bl-a${animated.length}`;
      animated.push({ id, name });
      return ` id="${id}"`;
    };

    const boxes = [];
    const texts = [];
    const addText = (box, owner, what) => texts.push({ ...box, owner, what });
    let svgUnder = "", svgPorts = "", svgArms = "", svgMachines = "", svgCells = "", svgBelts = "", svgSignals = "", svgLabels = "", svgItems = "", svgHot = "";

    for (const m of machines.values()) {
      const g = m.geo;
      boxes.push({ ...g.body, id: m.id });
      if (!m.label) fail(`machine ${m.id}: needs a label`);
      if (String(m.label ?? "").length > LIMITS.labelChars) fail(`machine ${m.id}: label "${m.label}" is longer than ${LIMITS.labelChars} chars`);
      if (!m.src && !m.external) fail(`machine ${m.id}: needs src "path:line" (or external: true for a boundary)`);
      const href = m.src && opts.baseUrl ? `${opts.baseUrl}${m.src.replace(/:(\d+)$/, "#L$1")}` : null;
      let inner = g.svg;
      for (const d of g.idx ?? []) inner += text(d.x, d.y, d.s, "idx-n", "middle", ` dominant-baseline="central"`);
      for (const d of g.ends ?? []) {
        inner += text(d.x, d.y, d.s, "end-t", "middle");
        addText({ x: d.x - textW(d.s, 8) / 2, y: d.y - 8, w: textW(d.s, 8), h: 9 }, `${m.id}.end`, `${m.id} ${d.s} label`);
      }
      svgMachines += `<g class="m m-${m.kind}" data-machine="${esc(m.id)}" data-box="${r1(g.body.x)} ${r1(g.body.y)} ${r1(g.body.w)} ${r1(g.h)}"${m.src ? ` data-src="${esc(m.src)}"` : ""}${m.symbol ? ` data-symbol="${esc(m.symbol)}"` : ""}>${href ? `<a href="${esc(href)}">` : ""}${inner}${href ? "</a>" : ""}</g>`;
      const busy = { s: 0, n: 0, e: 0, w: 0 };
      for (const e of [...belts, ...signals]) {
        if (e.from === m.id && e.outSide) busy[e.outSide]++;
        if (e.to === m.id && e.inSide) busy[e.inSide]++;
      }
      const lw = textW(m.label ?? "", 11);
      const b = g.body;
      const place = (side) => {
        let lx = b.x + b.w / 2, ly = b.y + g.h + 14, la = "middle";
        if (side === "n") ly = b.y - 7;
        if (side === "e") [lx, ly, la] = [b.x + b.w + 8, b.y + b.h / 2 + 4, "start"];
        if (side === "w") [lx, ly, la] = [b.x - 8, b.y + b.h / 2 + 4, "end"];
        return { lx, ly, la, box: { x: la === "middle" ? lx - lw / 2 : la === "start" ? lx : lx - lw, y: ly - 10, w: lw, h: 13 } };
      };
      const tipBoxes = [];
      if (g.pointer?.tipLabel) Object.entries(m.pointers).forEach(([name, p], k) => {
        const evs = [...p.events].sort((a, c) => a.t - c.t);
        const rad = (g.pointer.angle(evs.length ? evs.at(-1).i : p.init) * Math.PI) / 180, tr = g.pointer.tipLabel + k * 14;
        const tw = textW(name.slice(0, 4), 9), tx = g.pointer.cx + Math.cos(rad) * tr, ty = g.pointer.cy + Math.sin(rad) * tr;
        tipBoxes.push({ x: tx - tw / 2, y: ty - 5, w: tw, h: 10 });
      });
      const order = ["s", "n", "e", "w"].sort((a, c) => busy[a] - busy[c]);
      const side = m.labelSide ?? order.find((sd) => busy[sd] === busy[order[0]] && !tipBoxes.some((t) => overlap(t, place(sd).box, 2))) ?? order[0];
      let { lx, ly, la, box } = place(side);
      const hits = tipBoxes.filter((t) => overlap(t, box, 2));
      if (hits.length && side === "s") ly = Math.max(...hits.map((t) => t.y + t.h)) + 13;
      if (hits.length && side === "n") ly = Math.min(...hits.map((t) => t.y)) - 4;
      if (m.labelAt) [lx, ly, la] = [...at(...m.labelAt), "start"];
      svgLabels += text(lx, ly, m.label ?? m.id, "lbl", la);
      addText({ x: la === "middle" ? lx - lw / 2 : la === "start" ? lx : lx - lw, y: ly - 10, w: lw, h: 13 }, m.id, `label of ${m.id}`);
      if (m.hot.length) {
        const pad = 5, b = g.body;
        svgHot += rect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, "hot", 6, ` opacity="0"${animAttr(windows(m.hot))}`);
      }
      if (m.kind === "drum") for (let i = 0; i < m.cells.length; i++) for (let j = i + 1; j < m.cells.length; j++) if (overlap(m.cells[i], m.cells[j], -1)) {
        fail(`${m.id}: drum sectors ${i} and ${j} overlap; raise radius or lower cellW`);
        i = j = m.cells.length;
      }
      for (const [ci, c] of m.cells.entries()) {
        if (c.pixel) {
          svgCells += rect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1, "px-off");
          const states = [{ t: 0, v: c.init }, ...c.events.sort((a, b) => a.t - b.t)];
          states.forEach((st, si) => {
            if (!st.v) return;
            const cls = st.v === "a" ? "px-hot" : "px-on";
            const until = states[si + 1]?.t;
            const frames = si === 0 && states.length === 1 ? null : [[0, "opacity:0"], [st.t, "opacity:0"], [st.t + FADE, "opacity:1"], ...(until ? [[until, "opacity:1"], [until + FADE, "opacity:0"]] : [])];
            if (si === 0) frames && frames.splice(0, 3, [0, "opacity:1"]);
            const final = si === states.length - 1;
            svgCells += rect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1, cls, 0, `${final ? "" : ` opacity="0"`}${frames ? animAttr(frames) : ""}`);
          });
          continue;
        }
        svgCells += c.round ? rect(c.x, c.y, c.w, c.h, "cell", 9) : rect(c.x, c.y, c.w, c.h, "cell", 2);
        const written = c.events.length > 0;
        if (written) {
          const evs = [...c.events].sort((a, b) => a.t - b.t);
          const f = [[0, "opacity:0"]];
          let on = false;
          for (const ev of evs) {
            const want = ev.v !== "" && ev.v != null;
            if (want !== on) f.push([ev.t, `opacity:${on ? 1 : 0}`], [ev.t + FADE, `opacity:${want ? 1 : 0}`]);
            on = want;
          }
          svgCells += rect(c.x, c.y, c.w, c.h, "mark", c.round ? 9 : 2, `${on ? "" : ` opacity="0"`}${animAttr(f)}`);
        }
        const states = [{ t: 0, v: c.init }, ...c.events.sort((a, b) => a.t - b.t)];
        const anchor = g.valueAnchor === "start" ? "start" : "middle";
        const vx = anchor === "start" ? c.x + 6 : c.x + c.w / 2, vy = c.y + c.h / 2;
        const maxLen = Math.max(...states.map((s) => String(s.v).length));
        if (textW("x".repeat(maxLen), 11) > c.w - 4) fail(`${m.id}[${ci}]: widest value (${maxLen} chars) does not fit a ${Math.round(c.w)}px cell; widen cellW or shorten values`);
        states.forEach((st, si) => {
          if (st.v === "" || st.v == null) return;
          const until = states[si + 1]?.t;
          const final = si === states.length - 1;
          let attrs = ` dominant-baseline="central"`;
          if (states.length > 1) {
            const f = si === 0 ? [[0, "opacity:1"]] : [[0, "opacity:0"], [st.t, "opacity:0"], [st.t + FADE, "opacity:1"]];
            if (until != null) f.push([until, "opacity:1"], [until + FADE * 0.5, "opacity:0"]);
            attrs += `${final ? "" : ` opacity="0"`}${animAttr(f)}`;
          }
          svgCells += text(vx, vy, st.v, written && si > 0 ? "val val-w" : "val", anchor, attrs);
          addText({ x: anchor === "start" ? vx : vx - textW(st.v) / 2, y: vy - 6, w: textW(st.v), h: 12 }, `${m.id}.cell`, `${m.id}[${ci}]`);
        });
      }
      for (const [name, p] of Object.entries(m.pointers)) {
        const pg = g.pointer;
        if (!pg) {
          fail(`machine ${m.id} (${m.kind}) has no pointer support`);
          continue;
        }
        const evs = p.events.sort((a, b) => a.t - b.t);
        const finalI = evs.length ? evs.at(-1).i : p.init;
        const seq = [{ t: 0, i: p.init }, ...evs];
        if (pg.mode === "y") {
          const fp = pg.at(finalI);
          const shape = rect(fp.x, fp.y - fp.h / 2, fp.w, fp.h, "ptr-box", 2);
          let frames = null;
          if (evs.length) {
            frames = [];
            seq.forEach((st, k) => {
              if (k) frames.push([st.t, `transform:translate(0px,${r1(pg.at(seq[k - 1].i).y - fp.y)}px)`]);
              frames.push([k ? st.t + 0.3 : 0, `transform:translate(0px,${r1(pg.at(st.i).y - fp.y)}px)`]);
            });
          }
          svgCells += `<g class="ptr-g"${frames ? animAttr(frames) : ""}>${shape}</g>`;
        } else if (pg.mode === "x") {
          const fp = pg.at(finalI);
          const shape = `<path d="M${r1(fp.x)} ${r1(fp.y + 1)}l-5 8h10z" class="ptr"/>` + text(fp.x, fp.y + 19, name.slice(0, 5), "ptr-t");
          addText({ x: fp.x - textW(name.slice(0, 5), 9) / 2, y: fp.y + 10, w: textW(name.slice(0, 5), 9), h: 11 }, `${m.id}.ptr`, `${m.id} pointer ${name}`);
          let frames = null;
          if (evs.length) {
            frames = [];
            seq.forEach((s, k) => {
              const dx = pg.at(s.i).x - fp.x;
              if (k) frames.push([s.t, `transform:translate(${r1(pg.at(seq[k - 1].i).x - fp.x)}px,0px)`]);
              frames.push([k ? s.t + 0.3 : 0, `transform:translate(${r1(dx)}px,0px)`]);
            });
          }
          svgCells += `<g class="ptr-g"${frames ? animAttr(frames) : ""}>${shape}</g>`;
        } else {
          const fa = pg.angle(finalI);
          const rad = (fa * Math.PI) / 180;
          let shape;
          if (pg.arms) shape = [0, 120, 240].map((d) => { const a = rad + (d * Math.PI) / 180; return `<path d="M${pg.cx} ${pg.cy}L${r1(pg.cx + Math.cos(a) * pg.r)} ${r1(pg.cy + Math.sin(a) * pg.r)}" class="arm"/>`; }).join("");
          else shape = `<path d="M${pg.cx} ${pg.cy}L${r1(pg.cx + Math.cos(rad) * pg.r)} ${r1(pg.cy + Math.sin(rad) * pg.r)}" class="${pg.needle ? "needle" : "arm"}"/><circle cx="${r1(pg.cx + Math.cos(rad) * pg.r)}" cy="${r1(pg.cy + Math.sin(rad) * pg.r)}" r="${pg.needle ? 2.5 : 4}" class="ptr"/>`;
          let frames = null;
          if (evs.length) {
            frames = [];
            seq.forEach((s, k) => {
              const d = pg.angle(s.i) - fa;
              if (k) frames.push([s.t, `transform:rotate(${r1(pg.angle(seq[k - 1].i) - fa)}deg)`]);
              frames.push([k ? s.t + 0.35 : 0, `transform:rotate(${r1(d)}deg)`]);
            });
          }
          let tip = "";
          if (pg.tipLabel) {
            const k = Object.keys(m.pointers).indexOf(name);
            const tr = pg.tipLabel + k * 14;
            const tx = pg.cx + Math.cos(rad) * tr, ty = pg.cy + Math.sin(rad) * tr;
            const tw = textW(name.slice(0, 4), 9);
            addText({ x: tx - tw / 2, y: ty - 5, w: tw, h: 10 }, `${m.id}.tip${k}`, `${m.id} arm label ${name}`);
            const counter = frames ? frames.map(([t, d]) => [t, d.replace(/rotate\((-?[\d.]+)deg\)/, (_, v) => `rotate(${-Number(v)}deg)`)]) : null;
            tip = `<g class="tip"${counter ? animAttr(counter) : ""}>${text(tx, ty, name.slice(0, 4), "ptr-t", "middle", ` dominant-baseline="central"`)}</g>`;
          }
          svgUnder += `<g class="rot" style="transform-origin:${pg.cx}px ${pg.cy}px"${frames ? animAttr(frames) : ""}>${shape}${tip}</g>`;
        }
      }
    }

    for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) if (overlap(a, b, G * 0.5)) fail(`machines ${a.id} and ${b.id} are closer than half a grid cell`);
    for (const b of boxes) if (b.x < 0 || b.y < HEAD || b.x + b.w > W || b.y + b.h > HEAD + floorH) fail(`machine ${b.id} is outside the floor (${cols}x${rows} cells)`);

    const connected = new Set();
    const edgesAll = [...belts, ...signals];
    for (const e of edgesAll) {
      if (!e.pts) continue;
      connected.add(e.from).add(e.to);
      const segs = e.pts.slice(1).map((p, i) => [e.pts[i], p]);
      segs.forEach(([a, b], si) => {
        for (const box of boxes) {
          const own = box.id === e.from || box.id === e.to;
          if (own && (si === 0 || si === segs.length - 1)) continue;
          if (segHitsBox(a, b, box)) fail(`${e.kind} ${e.id} passes through machine ${box.id}; add via points or move a machine`);
        }
      });
      const lb = edgeLabelBox(e);
      if (lb) {
        const lx = lb.anchor === "middle" ? lb.x + lb.w / 2 : lb.x + 3;
        if (e.kind === "belt") svgLabels += text(lx, lb.y + 10, e.label, "cond", lb.anchor);
        else svgLabels += text(lx, lb.y + 10, e.label, "sig-t", lb.anchor);
        addText(lb, e.id, `label of ${e.id}`);
      }
      if (e.kind === "belt") {
        svgBelts += `<path d="${pathD(e.pts)}" class="belt" data-edge="${esc(e.id)}" data-from="${esc(e.from)}" data-to="${esc(e.to)}"/>`;
        for (let d = e.armOut ? 46 : 22; d < e.len - (e.armIn ? 40 : 14); d += 44) {
          const p = pointAt(e.pts, d), q = pointAt(e.pts, d + 1);
          const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) * (180 / Math.PI);
          svgBelts += `<path d="M-3 -3.5L1.5 0L-3 3.5" class="chev" transform="translate(${r1(p[0])} ${r1(p[1])}) rotate(${r1(ang)})"/>`;
        }
        for (const [pt, side] of [[e.p0, e.outSide], [e.p1, e.inSide]]) {
          const hz = side === "e" || side === "w";
          svgPorts += rect(pt[0] - (hz ? 3 : 8), pt[1] - (hz ? 8 : 3), hz ? 6 : 16, hz ? 16 : 6, "mouth", 1.5);
        }
      } else {
        svgSignals += `<path d="${pathD(e.pts)}" class="sig" marker-end="url(#bl-arrow)" data-edge="${esc(e.id)}" data-from="${esc(e.from)}" data-to="${esc(e.to)}"/>`;
      }
    }
    const edgeSegs = edgesAll.filter((e) => e.pts).flatMap((e) => e.pts.slice(1).map((p, i) => ({ e, a: e.pts[i], b: p })));
    for (let i = 0; i < edgeSegs.length; i++) for (let j = i + 1; j < edgeSegs.length; j++) {
      const s = edgeSegs[i], u = edgeSegs[j];
      if (s.e === u.e) continue;
      if (segsCross(s.a, s.b, u.a, u.b)) fail(`${s.e.kind} ${s.e.id} and ${u.e.kind} ${u.e.id} cross; reroute with via points (crossings read as joints)`);
    }
    for (const m of machines.values()) if (!connected.has(m.id)) fail(`machine ${m.id} has no belt or signal; connect it or remove it`);

    for (const tl of timeline) {
      if (tl.type === "item") {
        const w = textW(tl.item) + 14;
        const frames = [[0, "opacity:0"], [tl.t0, "opacity:0"], [tl.t0 + FADE, "opacity:1"]];
        const dur = tl.t1 - tl.t0;
        let acc = 0;
        tl.e.pts.forEach((p, k) => {
          if (k) acc += Math.abs(p[0] - tl.e.pts[k - 1][0]) + Math.abs(p[1] - tl.e.pts[k - 1][1]);
          frames.push([tl.t0 + (acc / tl.e.len) * dur, `transform:translate(${r1(p[0])}px,${r1(p[1])}px)`]);
        });
        frames.splice(1, 0, [0, `transform:translate(${r1(tl.e.pts[0][0])}px,${r1(tl.e.pts[0][1])}px)`]);
        frames.push([tl.t1, "opacity:1"], [tl.t1 + FADE, "opacity:0"]);
        svgItems += `<g class="item" opacity="0"${animAttr(frames)}>${rect(-w / 2, -9, w, 18, "item-b", 9)}${text(0, 0, tl.item, "item-t", "middle", ` dominant-baseline="central"`)}</g>`;
      } else if (tl.type === "pulse") {
        svgItems += `<path d="${pathD(tl.e.pts)}" class="pulse" opacity="0"${animAttr(windows([[tl.t0, tl.t1]]))}/>`;
      }
    }

    const moves = timeline.filter((tl) => tl.type === "item" || tl.type === "pulse");
    for (const m of machines.values()) {
      if (!m.geo.flap) continue;
      const outs = belts.filter((e) => e.from === m.id && e.p0);
      if (!outs.length) continue;
      const { cx, cy } = m.geo.flap;
      const ang = (e) => (Math.atan2(e.p0[1] - cy, e.p0[0] - cx) * 180) / Math.PI;
      const reach = (e) => Math.hypot(e.p0[0] - cx, e.p0[1] - cy);
      const L = Math.min(...outs.map(reach)) * 0.78;
      for (const e of outs) svgMachines += `<path d="M${cx} ${cy}L${r1(e.p0[0])} ${r1(e.p0[1])}" class="route"/>`;
      const ins = belts.filter((e) => e.to === m.id && e.p1);
      for (const e of ins) svgMachines += `<path d="M${r1(e.p1[0])} ${r1(e.p1[1])}L${cx} ${cy}" class="route"/>`;
      const evs = moves.filter((tl) => tl.e.from === m.id).map((tl) => ({ t: Math.max(0.05, tl.t0 - 0.35), a: ang(tl.e) }));
      const finalA = evs.length ? evs.at(-1).a : ang(outs[0]);
      let frames = null;
      if (evs.length) {
        frames = [[0, `transform:rotate(${r1(evs[0].a - finalA)}deg)`]];
        let cur = evs[0].a;
        for (const ev of evs) {
          frames.push([ev.t, `transform:rotate(${r1(cur - finalA)}deg)`], [ev.t + 0.3, `transform:rotate(${r1(ev.a - finalA)}deg)`]);
          cur = ev.a;
        }
      }
      const rad = (finalA * Math.PI) / 180;
      svgPorts += `<g class="rot" style="transform-origin:${cx}px ${cy}px"${frames ? animAttr(frames) : ""}><path d="M${cx} ${cy}L${r1(cx + Math.cos(rad) * L)} ${r1(cy + Math.sin(rad) * L)}" class="flap"/></g><circle cx="${cx}" cy="${cy}" r="3.2" class="pivot"/>`;
    }
    const armBoxes = [];
    for (const e of belts.filter((x) => x.pts)) {
      for (const [on, pt, side, role] of [[e.armOut, e.p0, e.outSide, "out"], [e.armIn, e.p1, e.inSide, "in"]]) {
        if (!on) continue;
        const d = DIRS[side], bx = pt[0] + d[0] * 15, by = pt[1] + d[1] * 15;
        const restOut = role === "in";
        const tipX = bx + d[0] * 19 * (restOut ? 1 : -1), tipY = by + d[1] * 19 * (restOut ? 1 : -1);
        const px = -d[1] * 5.5, py = d[0] * 5.5;
        const swings = moves.filter((tl) => tl.e === e).map((tl) => (role === "in" ? tl.t1 - 0.12 : Math.max(0.05, tl.t0 - 0.32)));
        const sweepBox = (sign) => {
          const qx = -d[1] * sign, qy = d[0] * sign;
          const xs = [bx + d[0] * 19, bx - d[0] * 19, bx + qx * 19, bx - qx * 6, bx - 6, bx + 6].filter((v, i) => i < 4 || !d[0]);
          const ys = [by + d[1] * 19, by - d[1] * 19, by + qy * 19, by - qy * 6, by - 6, by + 6].filter((v, i) => i < 4 || !d[1]);
          return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), id: e.id };
        };
        const clean = (bx2) => !texts.some((t) => overlap(t, bx2) && t.owner !== `${e.from}.cell` && t.owner !== `${e.to}.cell`);
        const sign = !swings.length || clean(sweepBox(1)) ? 1 : clean(sweepBox(-1)) ? -1 : 1;
        const deg = 180 * sign;
        let frames = null;
        if (swings.length) {
          frames = [[0, "transform:rotate(0deg)"]];
          let last = -1;
          for (const ts of swings) {
            if (ts < last) continue;
            frames.push([ts, "transform:rotate(0deg)"], [ts + 0.22, `transform:rotate(${deg}deg)`], [ts + 0.48, "transform:rotate(0deg)"]);
            last = ts + 0.5;
          }
        }
        armBoxes.push(swings.length ? sweepBox(sign) : { x: Math.min(bx, tipX) - 6, y: Math.min(by, tipY) - 6, w: Math.abs(tipX - bx) + 12, h: Math.abs(tipY - by) + 12, id: e.id });
        svgArms += `<circle cx="${r1(bx)}" cy="${r1(by)}" r="5.5" class="ins-base"/><g class="rot" style="transform-origin:${r1(bx)}px ${r1(by)}px"${frames ? animAttr(frames) : ""}><path d="M${r1(bx)} ${r1(by)}L${r1(tipX)} ${r1(tipY)}" class="ins-arm"/><path d="M${r1(tipX - px)} ${r1(tipY - py)}L${r1(tipX + px)} ${r1(tipY + py)}" class="ins-hand"/></g><circle cx="${r1(bx)}" cy="${r1(by)}" r="2.2" class="ins-pin"/>`;
      }
    }
    const ownedBy = (t, e) => [e.from, e.to].some((id) => t.owner === `${id}.cell`);
    for (const t of texts) for (const a of armBoxes) if (overlap(t, a) && !ownedBy(t, belts.find((x) => x.id === a.id))) fail(`text over an inserter arm: ${t.what} covers the arm on ${a.id}`);

    for (const r of raws) {
      if (r.box) for (const b of boxes) if (overlap(r.box, b)) fail(`raw drawing overlaps machine ${b.id}`);
      svgMachines += r.svg;
    }

    for (const t of texts) if (t.y < HEAD + 2 || t.x < 0 || t.x + t.w > W || t.y + t.h > HEAD + floorH) fail(`text off the floor: ${t.what} reaches outside the ${cols}x${rows} floor (into the header or margin)`);
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i], b = texts[j];
        if (a.owner === b.owner && (a.owner.endsWith(".cell") || a.owner.endsWith(".ptr"))) continue;
        if (overlap(a, b, 1)) fail(`text overlap: ${a.what} and ${b.what}`);
      }
      for (const b of boxes) if (b.id !== texts[i].owner && !texts[i].owner.startsWith(b.id + ".") && overlap(texts[i], b)) fail(`text over machine: ${texts[i].what} covers ${b.id}`);
    }
    for (const e of edgesAll.filter((x) => x.pts)) {
      const segs = e.pts.slice(1).map((p, i) => [e.pts[i], p]);
      for (const t of texts) {
        if (t.owner === e.id) continue;
        for (const [a, b] of segs) if (segHitsBox(a, b, { x: t.x - 4, y: t.y - 4, w: t.w + 8, h: t.h + 8 }, 0)) {
          fail(`${e.kind} ${e.id} runs through text: ${t.what}`);
          break;
        }
      }
    }

    const capY = HEAD + floorH + 22;
    const caps = timeline.filter((x) => x.type === "caption");
    let svgCaps = "";
    caps.forEach((c, i) => {
      const final = i === caps.length - 1;
      const f = windows([[c.t0, c.t1 + 0.15]], final);
      svgCaps += `<text x="${G}" y="${capY}" class="cap"${c.src ? ` data-src="${esc(c.src)}"` : ""}${final ? "" : ` opacity="0"`}${animAttr(f)}><tspan class="cap-n">${c.n}/${c.total}</tspan>  ${esc(c.text)}</text>`;
    });
    if (!caps.length) fail("no steps: trace at least one concrete input with F.step()");

    const used = new Set([...machines.values()].map((m) => m.kind));
    const legend = [
      ["belt", "data belt"],
      ...(signals.length ? [["sig", "call / signal"]] : []),
      ["item", "traced value"],
      ...([...machines.values()].some((m) => m.cells.some((c) => c.events.length)) ? [["mark", "written by this trace"]] : []),
    ];
    let lx = W - G;
    let svgLegend = "";
    for (const [k, label] of legend.reverse()) {
      const tw = textW(label, 10);
      lx -= tw;
      svgLegend += text(lx, capY, label, "leg-t", "start");
      lx -= 30;
      if (k === "belt") svgLegend += `<path d="M${lx} ${capY - 4}h24" class="belt"/>`;
      if (k === "sig") svgLegend += `<path d="M${lx} ${capY - 4}h20" class="sig" marker-end="url(#bl-arrow)"/>`;
      if (k === "item") svgLegend += rect(lx + 2, capY - 11, 20, 14, "item-b", 7);
      if (k === "mark") svgLegend += rect(lx + 4, capY - 12, 16, 16, "mark", 2);
      lx -= 16;
    }

    const srcRows = opts.sourceIndex ? [...machines.values()].filter((m) => m.src) : [];
    const colW = Math.ceil(Math.max(120, ...srcRows.map((m) => textW(`${m.label}  ${m.src}`, 10))) + 28);
    const idxCols = Math.max(1, Math.floor((W - 2 * G) / colW));
    const idxRowsN = Math.ceil(srcRows.length / idxCols);
    const idxTop = capY + 26;
    let svgIndex = "";
    srcRows.forEach((m, i) => {
      const cx = G + (i % idxCols) * colW, cy = idxTop + Math.floor(i / idxCols) * 15;
      const href = opts.baseUrl ? `${opts.baseUrl}${m.src.replace(/:(\d+)$/, "#L$1")}` : null;
      const row = `<text x="${cx}" y="${cy}" class="idx-l" text-anchor="start">${esc(m.label)}<tspan dx="8" class="idx-s">${esc(m.src)}</tspan></text>`;
      svgIndex += href ? `<a href="${esc(href)}">${row}</a>` : row;
    });
    const gapY = srcRows.length ? idxTop + idxRowsN * 15 + 6 : capY + 24;
    let svgGaps = "";
    gaps.forEach((g, i) => {
      if (`gap: ${g}`.length > LIMITS.captionChars) fail(`gap "${g.slice(0, 40)}…" is longer than ${LIMITS.captionChars - 5} chars; split it`);
      svgGaps += text(G, gapY + i * 14, `gap: ${g}`, "gap", "start");
    });
    const H = Math.ceil((gaps.length || srcRows.length ? gapY + gaps.length * 14 + 10 : capY + 16) / 2) * 2;

    const tok = (t) => Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(";");
    const style = `
.bl{${tok(THEME.light)}}
@media (prefers-color-scheme: dark){.bl{${tok(THEME.dark)}}}
.bl text{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;fill:var(--ink)}
.bg{fill:var(--paper)}.floor-dot{fill:var(--dot)}
.ttl{font-size:16px;font-weight:650}.sub{font-size:11px;fill:var(--mid)}
.body{fill:var(--body);stroke:var(--ink);stroke-width:1.2}.frame{fill:none;stroke:var(--lo);stroke-width:1}
.hub,.dial{fill:var(--cell);stroke:var(--ink);stroke-width:1}.seam,.tick{fill:none;stroke:var(--mid);stroke-width:1}
.tube{fill:var(--body);stroke:var(--ink);stroke-width:1.4}.leg{stroke:var(--ink);stroke-width:1.2}
.blade{fill:var(--mid)}.slot{stroke:var(--ink);stroke-width:2}.rod{stroke:var(--ink);stroke-width:3}.head,.die{fill:var(--mid)}
.chute,.link{fill:none;stroke:var(--mid);stroke-width:1}.flap{stroke:var(--accent);stroke-width:3.2;stroke-linecap:round}.pivot{fill:var(--ink)}.handle{stroke:var(--mid);stroke-width:1.6}
.dock{fill:var(--body);stroke:var(--ink);stroke-width:1.2}.bay{fill:none;stroke:var(--lo);stroke-dasharray:3 3}
.cell{fill:var(--cell);stroke:var(--lo);stroke-width:1}.mark{fill:var(--accent-soft);stroke:var(--accent);stroke-width:1.4}
.px-off{fill:var(--cell)}.px-on{fill:var(--ink)}.px-hot{fill:var(--accent)}
.val{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px}
.lbl{font-size:11px;font-weight:600;fill:var(--mid);letter-spacing:.02em}
.cond{font-size:10px;font-style:italic;fill:var(--mid)}.sig-t{font-size:10px;fill:var(--mid)}
.belt{fill:none;stroke:var(--belt);stroke-width:9;stroke-linejoin:round}.chev{fill:none;stroke:var(--lo);stroke-width:1.4}
.mouth{fill:var(--slot)}.well{fill:var(--cell);stroke:var(--lo);stroke-width:1}.route{fill:none;stroke:var(--lo);stroke-width:1.2;stroke-dasharray:3 3}
.idx-rail{fill:var(--belt)}.idx-n{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:9px;fill:var(--mid)}.end-t{font-size:8px;font-weight:700;letter-spacing:.06em;fill:var(--mid)}
.ptr-box{fill:none;stroke:var(--accent);stroke-width:2}.ins-base{fill:var(--body);stroke:var(--ink);stroke-width:1.2}.ins-arm{stroke:var(--ink);stroke-width:3;stroke-linecap:round}.ins-hand{stroke:var(--ink);stroke-width:2.6;stroke-linecap:round}.ins-pin{fill:var(--accent)}
.sig{fill:none;stroke:var(--mid);stroke-width:1.1;stroke-dasharray:4 3}.arrow{fill:var(--mid)}
.ptr{fill:var(--accent)}.ptr-t{font-size:9px;font-weight:700;fill:var(--accent)}.arm{stroke:var(--accent);stroke-width:2.4;stroke-linecap:round}.needle{stroke:var(--accent);stroke-width:2}
.hot{fill:none;stroke:var(--accent);stroke-width:2}
.item-b{fill:var(--accent)}.item-t{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;font-weight:700;fill:var(--accent-ink)}
.pulse{fill:none;stroke:var(--accent);stroke-width:2;stroke-dasharray:4 3}
.cap{font-size:12px}.cap-n{font-weight:700;fill:var(--accent)}.leg-t{font-size:10px;fill:var(--mid)}
.idx-l{font-size:10px;fill:var(--ink)}.idx-s{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;fill:var(--mid)}.gap{font-size:10px;fill:var(--mid);font-style:italic}
.rule{stroke:var(--lo);stroke-width:1}
.item,.ptr-g,.rot{transform-box:view-box}.tip{transform-box:fill-box;transform-origin:center}
${css.map((k) => `@keyframes ${k.name}{${k.body}}`).join("\n")}
@media (prefers-reduced-motion: no-preference){
.bl [id^="bl-a"]{animation-duration:${T.toFixed(2)}s;animation-timing-function:linear;animation-fill-mode:both;animation-iteration-count:1}
${animated.map((a) => `#${a.id}{animation-name:${a.name}}`).join("")}
}`;

    const metadata = JSON.stringify({ generator: "beltline-kit", rev: opts.rev ?? null, repo: opts.repo ?? null, ledger, gaps, durationSeconds: +T.toFixed(2) });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="bl" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="bl-title bl-desc"${opts.rev ? ` data-rev="${esc(opts.rev)}"` : ""} data-duration="${Math.round(T * 1000)}">
<title id="bl-title">${esc(opts.title)}</title>
<desc id="bl-desc">${esc(opts.desc)}</desc>
<metadata>${esc(metadata)}</metadata>
<style>${style}</style>
<defs><pattern id="bl-dots" width="${G}" height="${G}" patternUnits="userSpaceOnUse"><circle cx="${G / 2}" cy="${G / 2}" r="1" class="floor-dot"/></pattern>
<marker id="bl-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="arrow"/></marker></defs>
<rect width="${W}" height="${H}" class="bg"/>
<rect y="${HEAD}" width="${W}" height="${floorH}" fill="url(#bl-dots)"/>
${text(G, 28, opts.title, "ttl", "start")}
${text(G, 47, opts.subtitle ?? "", "sub", "start")}
<path d="M0 ${HEAD + floorH + 0.5}H${W}" class="rule"/>
<g class="belts">${svgBelts}</g>
<g class="signals">${svgSignals}</g>
<g class="hot-g">${svgHot}</g>
<g class="machines">${svgMachines}</g>
<g class="ports">${svgPorts}</g>
<g class="arms">${svgUnder}</g>
<g class="cells">${svgCells}</g>
<g class="labels">${svgLabels}</g>
<g class="items">${svgItems}</g>
<g class="inserters">${svgArms}</g>
<g class="caption">${svgCaps}</g>
<g class="legend">${svgLegend}</g>
<g class="index">${svgIndex}</g>
<g class="gaps">${svgGaps}</g>
</svg>
`;
    const nTexts = (svg.match(/<text\b/g) ?? []).length - (svg.match(/<text\b[^>]*\bopacity="0"/g) ?? []).length - (svg.match(/<g class="item" opacity="0"/g) ?? []).length;
    if (nTexts > (opts.maxTexts ?? LIMITS.texts)) fail(`${nTexts} visible text elements is over the clutter budget of ${opts.maxTexts ?? LIMITS.texts}; cut cells, shorten traces or split the tour`);
    return { svg, texts: nTexts, duration: T, problems };
  }

  return api;
}
