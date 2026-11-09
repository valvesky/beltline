import { writeFileSync } from "node:fs";

const CHAR_W = 6.7;
const FADE = 0.12;
const LIMITS = { texts: 140, itemChars: 16, labelChars: 28, valueChars: 14, captionChars: 96 };

export const THEME = {
  light: {
    paper: "#f3f1ea", dot: "#d9d5c9", ink: "#2a2925", mid: "#76726a", lo: "#b8b3a6",
    body: "#e6e2d7", cell: "#fbfaf6", belt: "#d3cebf", accent: "#d9731a", "accent-ink": "#ffffff", "accent-soft": "#f6dcc2", slot: "#3a3732", hl: "#ffffff",
  },
  dark: {
    paper: "#191917", dot: "#2b2a26", ink: "#e7e3d8", mid: "#9b968a", lo: "#5b5850",
    body: "#262521", cell: "#1e1d1a", belt: "#35332d", accent: "#f0943c", "accent-ink": "#1a1208", "accent-soft": "#4a3220", slot: "#0c0c0b", hl: "#3d3b35",
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
const ITEM_KINDS = ["pill", "chip", "hex", "crate", "letter"];
const BOLTED = new Set(["rack", "hashmap", "pigeonholes", "lru", "selector", "cutter", "press", "plate", "record", "splitter", "dock", "heap", "bits", "grid", "graph", "counter", "arena", "fanout", "merge", "btree", "trie", "page", "workers", "pool", "swapbuffer", "floormap"]);

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
    const blade = `<path d="M${mx - 10} ${y + 6}H${mx + 10}L${mx + 3} ${y + 30}H${mx - 3}Z" class="blade"/>`;
    svg += `<path d="M${x + 8} ${y + 40}H${x + w - 8}" class="slot"/><path d="M${mx - 18} ${y + 40}v-6M${mx + 18} ${y + 40}v-6" class="seam"/>`;
    const cells = cellsRow(x + 6, y + 52, regs, m.cellW ?? 34, 22);
    return { w, h, body: { x, y, w, h }, svg, cells, work: [{ type: "stamp", svg: blade, dy: 8 }] };
  },
  press(m, x, y) {
    const regs = m.cells.length, w = Math.max(76, regs * (m.cellW ?? 34) + 12), h = 56 + (regs ? 26 : 0);
    let svg = rect(x, y, w, h, "body", 4);
    const mx = x + w / 2;
    const ram = `<path d="M${mx} ${y + 4}V${y + 16}" class="rod"/>` + rect(mx - 16, y + 16, 32, 10, "head", 2);
    svg += `<path d="M${x + 10} ${y + 44}H${x + w - 10}" class="slot"/>` + rect(mx - 12, y + 36, 24, 6, "die", 1);
    const cells = cellsRow(x + 6, y + 52, regs, m.cellW ?? 34, 22);
    return { w, h, body: { x, y, w, h }, svg, cells, work: [{ type: "stamp", svg: ram, dy: 8 }] };
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
  heap(m, x, y) {
    const n = Math.min(m.cells.length, 7), nw = m.cellW ?? 26, nh = 18, w = m.w ?? 168, h = m.h ?? 128;
    const ax = x + w / 2, top = y + 10, base = y + h - 8;
    let svg = rect(x, y, w, h, "body", 4) + `<path d="M${ax} ${top}L${x + 10} ${base}H${x + w - 10}Z" class="well"/>`;
    const cells = [];
    const levels = [top + 30, top + 64, top + 98];
    for (let i = 0; i < n; i++) {
      const l = Math.floor(Math.log2(i + 1)), k = i + 1 - 2 ** l, count = 2 ** l;
      const span = ((levels[l] - top) / (base - top)) * (w - 20);
      const cx = ax + (k - (count - 1) / 2) * (span / count);
      cells.push({ x: cx - nw / 2, y: levels[l] - nh / 2, w: nw, h: nh, round: true });
    }
    for (let i = 1; i < n; i++) {
      const c = cells[i], pr = cells[Math.floor((i - 1) / 2)];
      svg += `<path d="M${r1(pr.x + pr.w / 2)} ${r1(pr.y + pr.h)}L${r1(c.x + c.w / 2)} ${r1(c.y)}" class="seam"/>`;
    }
    return { w, h, body: { x, y, w, h }, svg, cells };
  },
  deque(m, x, y) {
    const n = m.cells.length, cw = m.cellW ?? 30, ch = 22, fl = 14, w = n * cw + fl * 2 + 8, h = ch + 16;
    const svg = `<path d="M${x} ${y}L${x + fl} ${y + 7}H${x + w - fl}L${x + w} ${y}V${y + h}L${x + w - fl} ${y + h - 7}H${x + fl}L${x} ${y + h}Z" class="body"/>`;
    const cells = cellsRow(x + fl + 4, y + (h - ch) / 2, n, cw, ch);
    const pointer = { mode: "x", at: (i) => ({ x: cells[Math.min(i, n - 1)].x + cw / 2, y: y + h + 1 }) };
    return { w, h, body: { x, y, w, h }, svg, cells, pointer };
  },
  bits(m, x, y) {
    const n = m.cells.length, d = m.cellW ?? 16, pad = 8, w = n * d + pad * 2, h = d + pad * 2 + 10;
    let svg = rect(x, y, w, h, "body", 4) + rect(x + pad - 2, y + pad - 2, n * d + 4, d + 4, "well", 3);
    const cells = Array.from({ length: n }, (_, i) => ({ x: x + pad + i * d + 1, y: y + pad + 1, w: d - 2, h: d - 2, pixel: true, lamp: true }));
    const idx = [];
    for (let i = 0; i < n; i += 4) idx.push({ x: x + pad + i * d + d / 2, y: y + pad + d + 8, s: String(i) });
    const pointer = { mode: "x", above: true, at: (i) => ({ x: x + pad + i * d + d / 2, y: y - 1 }) };
    return { w, h, body: { x, y, w, h }, svg, cells, idx, pointer };
  },
  grid(m, x, y) {
    const cols = m.cols ?? 4, n = m.cells.length, rows = Math.ceil(n / cols), cw = m.cellW ?? 30, ch = 20, hd = 14, pad = 6;
    const w = pad * 2 + hd + cols * cw, h = pad * 2 + hd + rows * ch;
    let svg = rect(x, y, w, h, "body", 3) + rect(x + pad + hd, y + pad, cols * cw, hd - 2, "idx-rail", 2) + rect(x + pad, y + pad + hd, hd - 2, rows * ch, "idx-rail", 2);
    const cells = Array.from({ length: n }, (_, i) => ({ x: x + pad + hd + (i % cols) * cw, y: y + pad + hd + Math.floor(i / cols) * ch, w: cw, h: ch }));
    const idx = [];
    for (let c = 0; c < cols; c++) idx.push({ x: x + pad + hd + c * cw + cw / 2, y: y + pad + (hd - 2) / 2, s: String(c) });
    for (let r = 0; r < rows; r++) idx.push({ x: x + pad + (hd - 2) / 2, y: y + pad + hd + r * ch + ch / 2, s: String(r) });
    return { w, h, body: { x, y, w, h }, svg, cells, idx };
  },
  graph(m, x, y) {
    const n = Math.min(m.cells.length, 7), R = m.radius ?? 44, nw = m.cellW ?? 26, nh = 20, w = 2 * R + nw + 24, h = 2 * R + nh + 20;
    const cx = x + w / 2, cy = y + h / 2;
    let svg = rect(x, y, w, h, "body", 6) + rect(x + 5, y + 5, w - 10, h - 10, "well", 4);
    const centers = Array.from({ length: n }, (_, i) => {
      const a = ((m.startAngle ?? -90) + (i * 360) / n) * (Math.PI / 180);
      return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
    });
    for (const [a, b] of m.edges ?? []) {
      const [x1, y1] = centers[a], [x2, y2] = centers[b];
      const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, sa = 15, sb = m.directed ? 17 : 15;
      svg += `<path d="M${r1(x1 + ux * sa)} ${r1(y1 + uy * sa)}L${r1(x2 - ux * sb)} ${r1(y2 - uy * sb)}" class="link"${m.directed ? ` marker-end="url(#bl-arrow)"` : ""}/>`;
    }
    const cells = centers.map(([px, py]) => ({ x: px - nw / 2, y: py - nh / 2, w: nw, h: nh, round: true }));
    const pointer = { mode: "xy", at: (i) => ({ x: centers[i][0], y: centers[i][1], w: nw + 8, h: nh + 8 }) };
    return { w, h, body: { x, y, w, h }, svg, cells, pointer };
  },
  counter(m, x, y) {
    const n = m.cells.length, dw = m.cellW ?? 16, dh = 26, pad = 7, w = n * dw + pad * 2 + 12, h = dh + pad * 2;
    let svg = rect(x, y, w, h, "body", 4) + rect(x + pad - 2, y + pad - 2, n * dw + 4, dh + 4, "well", 2);
    const cells = cellsRow(x + pad, y + pad, n, dw, dh);
    for (const c of cells) svg += `<path d="M${r1(c.x + 2)} ${r1(c.y + 4)}h${r1(c.w - 4)}M${r1(c.x + 2)} ${r1(c.y + c.h - 4)}h${r1(c.w - 4)}" class="tick"/>`;
    const lever = `<path d="M${x + w - 9} ${y + 8}V${y + h - 12}" class="rod"/>`;
    svg += `<circle cx="${x + w - 9}" cy="${y + h - 9}" r="3" class="pivot"/>`;
    return { w, h, body: { x, y, w, h }, svg, cells, digits: true, work: [{ type: "wiggle", svg: lever, cx: x + w - 9, cy: y + h - 9 }] };
  },
  arena(m, x, y) {
    const unit = m.unit ?? 10, cap = m.capacity ?? 16, sizes = m.sizes ?? m.cells.map(() => 2), pad = 6, ch = 22;
    const w = cap * unit + pad * 2, h = ch + pad * 2;
    let svg = rect(x, y, w, h, "body", 3);
    const cells = [];
    let off = 0;
    for (const sz of sizes) {
      cells.push({ x: x + pad + off * unit, y: y + pad, w: sz * unit, h: ch });
      off += sz;
    }
    if (off < cap) svg += rect(x + pad + off * unit, y + pad, (cap - off) * unit, ch, "free", 2);
    const edge = (i) => x + pad + sizes.slice(0, i).reduce((a, b) => a + b, 0) * unit;
    const pointer = { mode: "x", above: true, at: (i) => ({ x: edge(i), y: y - 1 }) };
    return { w, h, body: { x, y, w, h }, svg, cells, pointer };
  },
  fanout(m, x, y) {
    const w = m.w ?? 44, h = m.h ?? 60;
    const svg = rect(x, y, w, h, "body", 4) + rect(x + 4, y + 4, w - 8, h - 8, "well", 3);
    return { w, h, body: { x, y, w, h }, svg, cells: [], bus: { cx: x + w / 2, cy: y + h / 2 } };
  },
  btree(m, x, y) {
    const k = m.keys ?? 3, L = m.leaves ?? 3, cw = m.cellW ?? 22, ch = 18, pad = 8, gap = 16, drop = 34;
    const nodeW = k * cw + 6, w = pad * 2 + L * nodeW + (L - 1) * gap, h = pad * 2 + ch + 6 + drop + ch + 6;
    let svg = rect(x, y, w, h, "body", 4) + rect(x + 4, y + 4, w - 8, h - 8, "well", 3);
    const nodes = [{ x: x + (w - nodeW) / 2, y: y + pad }];
    for (let i = 0; i < L; i++) nodes.push({ x: x + pad + i * (nodeW + gap), y: y + pad + ch + 6 + drop });
    const cells = [];
    for (const nd of nodes) {
      svg += rect(nd.x, nd.y, nodeW, ch + 6, "nodebox", 3);
      for (let j = 0; j < k; j++) cells.push({ x: nd.x + 3 + j * cw, y: nd.y + 3, w: cw, h: ch });
    }
    const root = nodes[0];
    for (let i = 0; i < L; i++) {
      const sx = root.x + 3 + (k * cw * (i + 0.5)) / L, lf = nodes[i + 1];
      svg += `<path d="M${r1(sx)} ${r1(root.y + ch + 6)}L${r1(lf.x + nodeW / 2)} ${r1(lf.y)}" class="seam"/>`;
      if (i < L - 1) svg += `<path d="M${r1(lf.x + nodeW)} ${r1(lf.y + (ch + 6) / 2)}H${r1(nodes[i + 2].x - 2)}" class="link" marker-end="url(#bl-arrow)"/>`;
    }
    const pointer = { mode: "xy", at: (i) => ({ x: nodes[i].x + nodeW / 2, y: nodes[i].y + (ch + 6) / 2, w: nodeW + 6, h: ch + 12 }) };
    return { w, h, body: { x, y, w, h }, svg, cells, pointer };
  },
  trie(m, x, y) {
    const nodes = m.nodes ?? [[-1, "·"]], n = nodes.length, nw = 20, nh = 18, colW = 26, rowH = 30, pad = 8;
    const kids = nodes.map(() => []);
    nodes.forEach(([p], i) => p >= 0 && kids[p].push(i));
    const depth = nodes.map(() => 0), slot = nodes.map(() => 0);
    let leafN = 0;
    const walk = (i, d) => {
      depth[i] = d;
      if (!kids[i].length) slot[i] = leafN++;
      else {
        kids[i].forEach((c) => walk(c, d + 1));
        slot[i] = (slot[kids[i][0]] + slot[kids[i].at(-1)]) / 2;
      }
    };
    walk(0, 0);
    const maxD = Math.max(...depth);
    const w = pad * 2 + leafN * colW, h = pad * 2 + maxD * rowH + nh;
    let svg = rect(x, y, w, h, "body", 4) + rect(x + 4, y + 4, w - 8, h - 8, "well", 3);
    const cells = nodes.map((_, i) => ({ x: x + pad + slot[i] * colW + (colW - nw) / 2, y: y + pad + depth[i] * rowH, w: nw, h: nh, round: true }));
    nodes.forEach(([p], i) => {
      if (p < 0) return;
      const a = cells[p], b = cells[i];
      svg += `<path d="M${r1(a.x + nw / 2)} ${r1(a.y + nh)}L${r1(b.x + nw / 2)} ${r1(b.y)}" class="seam"/>`;
    });
    for (const t of m.terminal ?? []) svg += rect(cells[t].x - 3, cells[t].y - 3, nw + 6, nh + 6, "nodebox", 12);
    const pointer = { mode: "xy", at: (i) => ({ x: cells[i].x + nw / 2, y: cells[i].y + nh / 2, w: nw + 8, h: nh + 8 }) };
    return { w, h, body: { x, y, w, h }, svg, cells, pointer, init: nodes.map(([, c]) => c) };
  },
  tape(m, x, y) {
    const n = m.cells.length, cw = m.cellW ?? 34, ch = 22, pad = 6, tail = 28, headW = 14;
    const w = pad + n * cw + tail + headW, h = ch + 18;
    let svg = rect(x, y, w - headW, h, "tape", 2);
    for (let hx = x + 5; hx < x + w - headW - 6; hx += 10) svg += rect(hx, y + 2.5, 4, 3, "hole", 1) + rect(hx, y + h - 5.5, 4, 3, "hole", 1);
    const cells = cellsRow(x + pad, y + 9, n, cw, ch);
    svg += rect(x + pad + n * cw + 2, y + 9, tail - 6, ch, "free", 2);
    svg += rect(x + w - headW, y + 4, headW, h - 8, "body", 2) + `<path d="M${x + w - headW} ${y + h / 2}h-5" class="rod"/>`;
    const pointer = { mode: "x", above: true, at: (i) => ({ x: i >= n ? x + pad + n * cw + 8 : cells[i].x + cw / 2, y: y - 1 }) };
    return { w, h, body: { x, y, w, h }, svg, cells, pointer };
  },
  page(m, x, y) {
    const ns = m.slots ?? 3, nt = Math.max(0, m.cells.length - ns), w = m.w ?? 132, pad = 6, slotW = m.slotW ?? 28, th = 18, h = m.h ?? 32 + nt * th + 34;
    let svg = rect(x, y, w, h, "body", 3) + rect(x + pad, y + pad, w - pad * 2, 8, "idx-rail", 2);
    const cells = [];
    for (let i = 0; i < ns; i++) cells.push({ x: x + pad + i * slotW, y: y + pad + 11, w: slotW - 2, h: 16 });
    for (let j = 0; j < nt; j++) cells.push({ x: x + pad, y: y + h - pad - (j + 1) * th, w: w - pad * 2, h: th - 1 });
    const freeTop = y + pad + 30, freeBot = y + h - pad - nt * th - 3;
    if (freeBot - freeTop > 6) svg += rect(x + pad, freeTop, w - pad * 2, freeBot - freeTop, "free", 2) + `<path d="M${x + w / 2} ${freeTop + 4}v6m0 ${r1(freeBot - freeTop - 20)}v6" class="seam"/>`;
    return { w, h, body: { x, y, w, h }, svg, cells };
  },
  workers(m, x, y) {
    const n = m.cells.length, cw = m.cellW ?? 54, rowH = 28, pad = 6, w = pad * 2 + 16 + 20 + cw + 16, h = pad * 2 + n * rowH;
    let svg = rect(x, y, w, h, "body", 4);
    const inX = x + pad + 4, outX = x + w - pad - 4;
    svg += `<path d="M${inX} ${y + pad + rowH / 2}V${y + h - pad - rowH / 2}M${outX} ${y + pad + rowH / 2}V${y + h - pad - rowH / 2}" class="rail"/>`;
    const cells = [], work = [];
    for (let i = 0; i < n; i++) {
      const cy = y + pad + i * rowH + rowH / 2, gx = x + pad + 24;
      svg += `<path d="M${inX} ${cy}H${gx - 9}M${x + pad + 36 + cw} ${cy}H${outX}" class="seam"/>`;
      let gear = `<circle cx="${gx}" cy="${cy}" r="7" class="gear"/>`;
      for (let t = 0; t < 6; t++) {
        const a = (t * Math.PI) / 3;
        gear += `<path d="M${r1(gx + Math.cos(a) * 7)} ${r1(cy + Math.sin(a) * 7)}L${r1(gx + Math.cos(a) * 9.5)} ${r1(cy + Math.sin(a) * 9.5)}" class="tooth"/>`;
      }
      gear += `<path d="M${gx - 4} ${cy}h8" class="tooth"/><circle cx="${gx}" cy="${cy}" r="2.4" class="pivot"/>`;
      work.push({ type: "spin", svg: gear, cx: gx, cy });
      cells.push({ x: x + pad + 36, y: cy - 10, w: cw, h: 20 });
    }
    return { w, h, body: { x, y, w, h }, svg, cells, work };
  },
  pool(m, x, y) {
    const n = m.cells.length, cw = m.cellW ?? 30, ch = 20, pad = 8, gap = 8, w = pad * 2 + n * cw + (n - 1) * gap, h = pad + 14 + ch + pad;
    let svg = rect(x, y, w, h, "body", 4) + `<path d="M${x + 5} ${y + pad + 2}H${x + w - 5}" class="rail"/>`;
    const cells = cellsRow(x + pad, y + pad + 14, n, cw, ch, gap);
    for (const c of cells) svg += `<path d="M${r1(c.x + c.w / 2)} ${y + pad + 2}v6a3 3 0 0 0 6 0" class="hook"/>`;
    return { w, h, body: { x, y, w, h }, svg, cells };
  },
  bucket(m, x, y) {
    const n = m.cells.length, cols = m.cols ?? 3, rows = Math.ceil(n / cols), d = 13, top = 16, w = cols * d + 34, h = top + rows * d + 14;
    const bx0 = x + 6, bx1 = x + w - 6;
    let svg = `<path d="M${x + 4} ${y + 3}H${x + 20}V${y + 10}" class="tap"/>`;
    const drip = `<circle cx="${x + 20}" cy="${y + 13}" r="2.2" class="drip"/>`;
    svg += `<path d="M${bx0} ${y + top}L${bx0 + 6} ${y + h}H${bx1 - 6}L${bx1} ${y + top}" class="bucket"/>`;
    const cells = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      cells.push({ x: x + (w - cols * d) / 2 + c * d + 1, y: y + h - 6 - (r + 1) * d + 1, w: d - 2, h: d - 2, pixel: true, lamp: true });
    }
    return { w, h, body: { x, y, w, h }, svg, cells, work: [{ type: "drip", svg: drip }] };
  },
  timerwheel(m, x, y) {
    const n = m.cells.length, R = m.radius ?? (n > 8 ? 60 : 52), cx = x + R, cy = y + R, cw = m.cellW ?? 26;
    let svg = `<circle cx="${cx}" cy="${cy}" r="${R}" class="body"/><circle cx="${cx}" cy="${cy}" r="${R - 5}" class="well"/>`;
    const ang = (i) => (i / n) * 360 - 90;
    const cells = [];
    for (let i = 0; i < n; i++) {
      const a = (ang(i) * Math.PI) / 180;
      svg += `<path d="M${r1(cx + Math.cos(a) * (R - 5))} ${r1(cy + Math.sin(a) * (R - 5))}L${r1(cx + Math.cos(a) * (R - 11))} ${r1(cy + Math.sin(a) * (R - 11))}" class="tick"/>`;
      cells.push({ x: cx + Math.cos(a) * R * 0.64 - cw / 2, y: cy + Math.sin(a) * R * 0.64 - 8, w: cw, h: 16, round: true });
    }
    const pointer = { mode: "rot", cx, cy, r: R * 0.88, angle: ang, needle: true };
    return { w: 2 * R, h: 2 * R, body: { x, y, w: 2 * R, h: 2 * R }, svg, cells, pointer };
  },
  swapbuffer(m, x, y) {
    const cols = m.cols ?? 5, rows = m.rows ?? 4, px = m.pixel ?? 9, pad = 9, gapX = 30, pw = cols * px, ph = rows * px;
    const w = pad * 2 + pw * 2 + gapX, h = pad * 2 + ph;
    let svg = rect(x, y, w, h, "body", 4);
    const panes = [x + pad, x + pad + pw + gapX];
    const cells = [];
    for (const p0 of panes) {
      svg += rect(p0 - 2, y + pad - 2, pw + 4, ph + 4, "well", 2);
      for (let i = 0; i < cols * rows; i++) cells.push({ x: p0 + (i % cols) * px, y: y + pad + Math.floor(i / cols) * px, w: px, h: px, pixel: true });
    }
    const mx = x + pad + pw + gapX / 2, my = y + h / 2;
    svg += `<path d="M${mx - 9} ${my - 6}L${mx + 9} ${my + 6}" class="rod"/><circle cx="${mx}" cy="${my}" r="3" class="pivot"/>`;
    svg += `<path d="M${mx - 6} ${my - 12}h12l-3 -3M${mx + 6} ${my + 12}h-12l3 3" class="seam"/>`;
    const pointer = { mode: "xy", at: (i) => ({ x: panes[i] + pw / 2, y: y + pad + ph / 2, w: pw + 10, h: ph + 10 }) };
    return { w, h, body: { x, y, w, h }, svg, cells, pointer };
  },
  floormap(m, x, y) {
    const cols = m.cols ?? 4, rows = m.rows ?? 3, cs = m.cellSize ?? 30, pad = 6, w = pad * 2 + cols * cs, h = pad * 2 + rows * cs;
    let svg = rect(x, y, w, h, "body", 4) + rect(x + pad, y + pad, cols * cs, rows * cs, "well", 2);
    for (let c = 1; c < cols; c++) svg += `<path d="M${x + pad + c * cs} ${y + pad}v${rows * cs}" class="seam"/>`;
    for (let r = 1; r < rows; r++) svg += `<path d="M${x + pad} ${y + pad + r * cs}h${cols * cs}" class="seam"/>`;
    for (const b of m.split ?? []) {
      const bx = x + pad + (b % cols) * cs, by = y + pad + Math.floor(b / cols) * cs;
      svg += `<path d="M${bx + cs / 2} ${by}v${cs}M${bx} ${by + cs / 2}h${cs}" class="split"/>`;
    }
    const pointer = { mode: "token", at: (i) => ({ x: x + pad + (i % cols) * cs + cs / 2, y: y + pad + Math.floor(i / cols) * cs + cs / 2 }) };
    return { w, h, body: { x, y, w, h }, svg, cells: [], pointer };
  },
  arm(m, x, y) {
    const w = 36, h = 36, cx = x + w / 2, cy = y + h / 2;
    const svg = rect(x, y, w, h, "pedestal", 5) + `<circle cx="${cx}" cy="${cy}" r="12" class="pedestal-ring"/>`;
    return { w, h, body: { x, y, w, h }, svg, cells: [], armBase: { cx, cy } };
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
MACHINES.merge = MACHINES.fanout;
export const KINDS = Object.keys(MACHINES);

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
      machines.set(id, { id, ...spec, x, y, geo, cells: geo.cells.map((c, i) => ({ ...c, init: spec.cells[i] ?? geo.init?.[i] ?? "", events: [] })), pointers: Object.fromEntries(Object.entries(m.pointers ?? {}).map(([k, v]) => [k, { init: v, events: [] }])), hot: [] });
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
    const horiz = side === "e" || side === "w";
    const len = horiz ? b.h : b.w;
    const gap = Math.min(16, len / (count + 1));
    const off = (k - (count - 1) / 2) * gap;
    const cy = Math.round(b.y + b.h / 2 + off), cx = Math.round(b.x + b.w / 2 + off);
    if (side === "e") return [b.x + b.w, cy];
    if (side === "w") return [b.x, cy];
    if (side === "s") return [cx, b.y + b.h + (m.geo.h - b.h)];
    return [cx, b.y];
  }

  function regeo(m, x, y) {
    m.x = x;
    m.y = y;
    const prev = m.cells;
    m.geo = MACHINES[m.kind](m, x, y);
    m.cells = m.geo.cells.map((c, i) => ({ ...c, init: prev[i]?.init ?? "", events: prev[i]?.events ?? [] }));
  }

  function alignLines(edges) {
    const snap = G * 0.8;
    for (let pass = 0; pass < 4; pass++) for (const axis of ["row", "col"]) {
      const parent = new Map();
      const find = (id) => (parent.get(id) === id ? id : (parent.set(id, find(parent.get(id))), parent.get(id)));
      for (const id of machines.keys()) parent.set(id, id);
      const center = (m) => (axis === "row" ? m.geo.body.y + m.geo.body.h / 2 : m.geo.body.x + m.geo.body.w / 2);
      for (const e of edges) {
        const a = machines.get(e.from), b = machines.get(e.to);
        if (!a || !b || a.align === false || b.align === false || e.via) continue;
        const out = e.out ?? autoSide(a, b), inn = e.in ?? opposite[autoSide(a, b)];
        const straight = axis === "row" ? (out === "e" && inn === "w") || (out === "w" && inn === "e") : (out === "s" && inn === "n") || (out === "n" && inn === "s");
        if (straight && Math.abs(center(a) - center(b)) <= snap) parent.set(find(b.id), find(a.id));
      }
      const groups = new Map();
      for (const id of machines.keys()) {
        const r = find(id);
        if (!groups.has(r)) groups.set(r, []);
        groups.get(r).push(machines.get(id));
      }
      for (const group of groups.values()) {
        if (group.length < 2) continue;
        const line = center(group[0]);
        for (const m of group.slice(1)) {
          const d = line - center(m);
          if (Math.abs(d) < 0.01) continue;
          if (axis === "row") regeo(m, m.x, m.y + d);
          else regeo(m, m.x + d, m.y);
        }
      }
    }
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
      if (!e.p0 || !e.p1) continue;
      const d0 = DIRS[e.outSide], d1 = DIRS[e.inSide];
      const k0 = 0.5, k1 = 0.5;
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

  const armTouched = new Set();
  function compile() {
    const timeline = [];
    let t = 0.6, traceLabel = null, n = 0, lastStep = null;
    const total = steps.filter((s) => !s.trace).length;
    for (const s of steps) {
      if (s.trace) {
        traceLabel = s.trace;
        continue;
      }
      n++;
      if (s.with === "previous" && lastStep) t = lastStep.start + (s.delay ?? 0.35);
      else if (s.with && s.with !== "previous") fail(`step ${n}: with must be "previous"`);
      const start = t;
      const stepItems = [];
      const runBelts = () => {
      if (s.belt) {
        const ids = Array.isArray(s.belt) ? s.belt : [s.belt];
        const items = Array.isArray(s.item) ? s.item : ids.map(() => s.item);
        let longest = 0, bad = false;
        ids.forEach((id, k) => {
          const e = [...belts, ...signals].find((b) => b.id === id);
          if (!e) {
            fail(`step ${n}: unknown belt ${id}`);
            bad = true;
            return;
          }
          if (!e.pts) return;
          const dur = Math.max(0.6, e.len / (opts.speed ?? 170));
          longest = Math.max(longest, dur);
          const stream = s.stream && ids.length === 1 ? s.stream : null;
          const list = stream ?? [items[k]];
          const gap = s.gap ?? 0.34;
          if (stream) longest = Math.max(longest, dur + (stream.length - 1) * gap);
          const kind = s.as ?? e.carries ?? "pill";
          if (!ITEM_KINDS.includes(kind)) fail(`step ${n}: item kind "${kind}" is not one of ${ITEM_KINDS.join(", ")}`);
          list.forEach((item, q) => {
            const t0 = t + q * gap;
            if (item != null) {
              if (String(item).length > LIMITS.itemChars) fail(`step ${n}: item "${item}" is longer than ${LIMITS.itemChars} chars; show the shape, put detail in the caption`);
              const tl = { type: "item", e, item, kind, t0, t1: t0 + dur };
              timeline.push(tl);
              stepItems.push(tl);
              const src0 = machines.get(e.from), dst0 = machines.get(e.to);
              if (src0?.geo.work) (src0.workWin ??= []).push([Math.max(0.05, t0 - 0.7), t0]);
              if (dst0?.geo.work) (dst0.workWin ??= []).push([t0 + dur, t0 + dur + 0.8]);
            } else timeline.push({ type: "pulse", e, t0, t1: t0 + dur });
          });
        });
        if (bad) return false;
        t += longest;
      }
        return true;
      };
      let heldWrites = false, heldPointers = false;
      const runArm = () => {
        const A = machines.get(s.arm);
        if (!A || A.kind !== "arm") {
          fail(`step ${n}: ${s.arm} is not an arm machine`);
          return false;
        }
        const valueAt = (cell) => (cell.events.length ? cell.events.at(-1).v : cell.init);
        let tt = t + 0.1;
        const nHeld = Object.values(s.writes ?? {}).reduce((a, l) => a + l.length, 0);
        const beltOf = (ref) => (typeof ref === "string" ? belts.find((b) => b.id === (ref === "belt" ? (Array.isArray(s.belt) ? s.belt[0] : s.belt) : ref)) : null);
        (s.moves ?? []).forEach((mv, i) => {
          const fb = beltOf(mv.from), tb = beltOf(mv.to);
          const fc = fb ? null : machines.get(mv.from?.[0])?.cells[mv.from?.[1]];
          const tc = tb ? null : machines.get(mv.to?.[0])?.cells[mv.to?.[1]];
          if ((!fb && !fc) || (!tb && !tc) || (typeof mv.from === "string" && !fb) || (typeof mv.to === "string" && !tb)) {
            fail(`step ${n}: arm move ${i + 1} needs from and to: a belt id (or "belt") or [machine, cell] that exist`);
            return;
          }
          if (fc && tc && mv.from[0] === mv.to[0]) {
            fail(`step ${n}: arm ${A.id} moves a piece inside ${mv.from[0]}; arms move pieces between a belt and a slot or between two machines, so show this with writes`);
            return;
          }
          let pickAt = null;
          if (fb?.pts) {
            const { cx: ax, cy: ay } = A.geo.armBase;
            let best = null, run = 0;
            for (let q = 1; q < fb.pts.length; q++) {
              const [p0, p1] = [fb.pts[q - 1], fb.pts[q]];
              const L = Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1]);
              const f = L ? Math.max(0, Math.min(1, ((ax - p0[0]) * (p1[0] - p0[0]) + (ay - p0[1]) * (p1[1] - p0[1])) / (L * L))) : 0;
              const px = p0[0] + (p1[0] - p0[0]) * f, py = p0[1] + (p1[1] - p0[1]) * f, dd = Math.hypot(px - ax, py - ay);
              if (!best || dd < best.dd) best = { dd, at: Math.min(fb.len - 14, Math.max(14, run + L * f)) };
              run += L;
            }
            pickAt = best.at;
          }
          const fromPt = fb ? (fb.pts ? pointAt(fb.pts, pickAt) : null) : [fc.x + fc.w / 2, fc.y + fc.h / 2];
          const toPt = tb ? (tb.pts ? pointAt(tb.pts, Math.min(18, tb.len)) : null) : [tc.x + tc.w / 2, tc.y + tc.h / 2];
          if (!fromPt || !toPt) return;
          const arriving = fb ? stepItems.find((tl) => tl.e === fb) : null;
          if (arriving && i === 0) {
            arriving.stopAt = pickAt;
            arriving.t1 = arriving.t0 + (arriving.t1 - arriving.t0) * (pickAt / fb.len);
            tt = Math.max(arriving.t0 + 0.1, arriving.t1 - 0.5);
          }
          for (const ref of [mv.from, mv.to]) if (Array.isArray(ref)) armTouched.add(ref[0]);
          const value = mv.value ?? (fc ? valueAt(fc) : arriving?.item ?? "");
          if (String(value).length > LIMITS.itemChars) fail(`step ${n}: arm carries "${value}", longer than ${LIMITS.itemChars} chars`);
          const reach = tt + 0.5, grip = Math.max(reach + 0.2, (arriving?.t1 ?? 0) + 0.05), hold = i === 0 ? nHeld * 0.22 : 0, drop = grip + 0.75 + hold, after = drop + 0.2;
          if (arriving) arriving.hold = grip;
          if (fc && mv.clear !== false) fc.events.push({ t: grip, v: "" });
          if (i === 0) {
            for (const [mid, moves2] of Object.entries(s.pointers ?? {})) {
              const pm = machines.get(mid);
              for (const [name, idx] of Object.entries(moves2)) {
                if (!pm?.pointers[name]) fail(`step ${n}: ${mid} has no pointer ${name}`);
                else pm.pointers[name].events.push({ t: grip, i: idx });
              }
            }
            heldPointers = true;
            let k = 0;
            for (const [mid, list] of Object.entries(s.writes ?? {})) {
              const m = machines.get(mid);
              for (const [ci, v] of list) {
                if (!m?.cells[ci]) fail(`step ${n}: ${mid} has no cell ${ci}`);
                else m.cells[ci].events.push({ t: grip + 0.3 + k * 0.22, v });
                k++;
              }
            }
            heldWrites = true;
          }
          if (tc) tc.events.push({ t: drop, v: value });
          A.armMoves = A.armMoves ?? [];
          A.armMoves.push({ fromPt, toPt, value, t0: tt, reach, grip, drop, after });
          tt = after;
        });
        A.hot.push([start, tt + 0.5]);
        A.armRests = A.armRests ?? [];
        A.armRests.push(tt + 0.55);
        t = tt + 0.6;
        return true;
      };
      const armFirst = s.arm && (s.moves ?? []).some((mv) => typeof mv.to === "string");
      if (armFirst) {
        if (!runArm()) continue;
        if (s.belt && !runBelts()) continue;
      } else {
        if (s.belt && !runBelts()) continue;
        if (s.arm && !runArm()) continue;
      }
      const writes = heldWrites ? [] : Object.entries(s.writes ?? {});
      const nWrites = writes.reduce((a, [, list]) => a + list.length, 0);
      const pointerMoves = heldPointers ? [] : Object.entries(s.pointers ?? {});
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
      const cap = { type: "caption", n, total, text: capText, t0: start, t1: t, src: s.src };
      if (s.with === "previous" && lastStep) {
        lastStep.cap.t1 = Math.min(lastStep.cap.t1, start - 0.2);
        t = Math.max(t, lastStep.end);
        cap.t1 = t;
      }
      timeline.push(cap);
      lastStep = { start, end: t, cap };
      t += 0.15;
    }
    return { timeline, T: t + 0.4 };
  }

  function render() {
    alignLines([...belts, ...signals]);
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
    let svgUnderBelts = "", svgGround = "", svgUnder = "", svgPorts = "", svgArms = "", svgMachines = "", svgCells = "", svgBelts = "", svgSignals = "", svgLabels = "", svgItems = "", svgHot = "";

    for (const A of machines.values()) {
      if (A.kind !== "arm") continue;
      const { cx: bx, cy: by } = A.geo.armBase;
      const mvs = A.armMoves ?? [];
      const center = (c) => [c.x + c.w / 2, c.y + c.h / 2];
      const pts = mvs.flatMap((mv) => [mv.fromPt, mv.toPt]);
      const far = Math.max(60, ...pts.map(([px, py]) => Math.hypot(px - bx, py - by)));
      const L1 = Math.ceil(A.reach ? A.reach / 2 : far * 0.56), L2 = L1;
      const cap = A.maxReach ?? G * 9;
      if (!A.reach && L1 + L2 > cap) fail(`arm ${A.id} would need a ${L1 + L2}px reach to get to its cells (limit ${cap}px); place it closer to the structures it moves`);
      const meanA = pts.length ? Math.atan2(pts.reduce((a, p) => a + p[1], 0) / pts.length - by, pts.reduce((a, p) => a + p[0], 0) / pts.length - bx) * 180 / Math.PI : -90;
      const others = [...machines.values()].filter((o) => o.id !== A.id).map((o) => ({ x: o.geo.body.x - 8, y: o.geo.body.y - 8, w: o.geo.body.w + 16, h: o.geo.h + 30 }));
      const poseClear = ([a0, a1]) => {
        const e0 = [bx + Math.cos((a0 * Math.PI) / 180) * L1, by + Math.sin((a0 * Math.PI) / 180) * L1];
        const t0 = [e0[0] + Math.cos(((a0 + a1) * Math.PI) / 180) * L2, e0[1] + Math.sin(((a0 + a1) * Math.PI) / 180) * L2];
        const samples = [];
        for (const [p, q] of [[[bx, by], e0], [e0, t0]]) for (let k = 1; k <= 8; k++) samples.push([p[0] + ((q[0] - p[0]) * k) / 8, p[1] + ((q[1] - p[1]) * k) / 8]);
        return samples.every(([px, py]) => px > 4 && px < W - 4 && py > HEAD + 4 && py < HEAD + floorH - 4 && !others.some((o) => px > o.x && px < o.x + o.w && py > o.y && py < o.y + o.h));
      };
      const candidates = [];
      for (const d of [-40, 40, -70, 70, 0, -110, 110, -150, 150, 180]) for (const f of [115, -115, 140, -140]) candidates.push([meanA + 180 + d, f]);
      const rest = candidates.find(poseClear) ?? [meanA + 180 - 40, 115];
      const restElbow = [bx + Math.cos((rest[0] * Math.PI) / 180) * L1, by + Math.sin((rest[0] * Math.PI) / 180) * L1];
      const restTip = [restElbow[0] + Math.cos(((rest[0] + rest[1]) * Math.PI) / 180) * L2, restElbow[1] + Math.sin(((rest[0] + rest[1]) * Math.PI) / 180) * L2];
      A.armGeo = { L1, L2, rest, restElbow, restTip };
      A.armSegs = [[[bx, by], restElbow], [restElbow, restTip]];
    }
    const hitsArm = (box) => [...machines.values()].some((A) => (A.armSegs ?? []).some(([a, b]) => Array.from({ length: 9 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / 8, a[1] + ((b[1] - a[1]) * k) / 8]).some(([px, py]) => px > box.x - 4 && px < box.x + box.w + 4 && py > box.y - 4 && py < box.y + box.h + 4)));

    for (const m of machines.values()) {
      const g = m.geo;
      boxes.push({ ...g.body, id: m.id });
      if (!m.label) fail(`machine ${m.id}: needs a label`);
      if (String(m.label ?? "").length > LIMITS.labelChars) fail(`machine ${m.id}: label "${m.label}" is longer than ${LIMITS.labelChars} chars`);
      if (!m.src && !m.external) fail(`machine ${m.id}: needs src "path:line" (or external: true for a boundary)`);
      const href = m.src && opts.baseUrl ? `${opts.baseUrl}${m.src.replace(/:(\d+)$/, "#L$1")}` : null;
      let inner = g.svg;
      if (BOLTED.has(m.kind)) {
        const b = g.body;
        inner += `<path d="M${r1(b.x + 5)} ${r1(b.y + 1.6)}H${r1(b.x + b.w - 5)}" class="bevel"/>`;
        for (const [bx, by] of [[b.x + 3.6, b.y + 3.6], [b.x + b.w - 3.6, b.y + 3.6], [b.x + 3.6, b.y + b.h - 3.6], [b.x + b.w - 3.6, b.y + b.h - 3.6]]) inner += `<circle cx="${r1(bx)}" cy="${r1(by)}" r="1.25" class="bolt"/>`;
      }
      for (const d of g.idx ?? []) inner += text(d.x, d.y, d.s, "idx-n", "middle", ` dominant-baseline="central"`);
      for (const d of g.ends ?? []) {
        inner += text(d.x, d.y, d.s, "end-t", "middle");
        addText({ x: d.x - textW(d.s, 8) / 2, y: d.y - 8, w: textW(d.s, 8), h: 9 }, `${m.id}.end`, `${m.id} ${d.s} label`);
      }
      const wins = [...m.hot, ...(m.workWin ?? [])].sort((a, b) => a[0] - b[0]).reduce((acc, w0) => {
        const last = acc.at(-1);
        if (last && w0[0] <= last[1] + 0.05) last[1] = Math.max(last[1], w0[1]);
        else acc.push([...w0]);
        return acc;
      }, []);
      for (const part of g.work ?? []) {
        const f = [];
        if (part.type === "spin") {
          let turned = 0;
          f.push([0, "transform:rotate(0deg)"]);
          for (const [a, b] of wins) {
            const revs = Math.max(1, Math.round((b - a) / 0.9));
            f.push([a, `transform:rotate(${turned}deg)`]);
            turned += 360 * revs;
            f.push([b, `transform:rotate(${turned}deg)`]);
          }
        } else {
          const period = part.type === "drip" ? 0.6 : 0.42;
          f.push([0, part.type === "drip" ? "transform:translate(0px,0px);opacity:1" : part.type === "wiggle" ? "transform:rotate(0deg)" : "transform:translate(0px,0px)"]);
          for (const [a, b] of wins) for (let c = a; c < Math.max(b - period * 0.5, a + 0.01); c += period) {
            if (part.type === "stamp") f.push([c, "transform:translate(0px,0px)"], [c + period * 0.45, `transform:translate(0px,${part.dy}px)`], [c + period, "transform:translate(0px,0px)"]);
            else if (part.type === "wiggle") f.push([c, "transform:rotate(0deg)"], [c + period * 0.35, "transform:rotate(28deg)"], [c + period, "transform:rotate(0deg)"]);
            else f.push([c, "transform:translate(0px,0px);opacity:1"], [c + 0.4, "transform:translate(0px,9px);opacity:0"], [c + 0.41, "transform:translate(0px,0px);opacity:0"], [c + period, "transform:translate(0px,0px);opacity:1"]);
          }
        }
        const origin = part.cx != null ? ` style="transform-origin:${part.cx}px ${part.cy}px"` : "";
        inner += wins.length && f.length > 1 ? `<g class="rot"${origin}${animAttr(f)}>${part.svg}</g>` : part.svg;
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
      const side = m.labelSide ?? order.find((sd) => busy[sd] === busy[order[0]] && !tipBoxes.some((t) => overlap(t, place(sd).box, 2)) && !hitsArm(place(sd).box)) ?? order.find((sd) => !hitsArm(place(sd).box)) ?? order[0];
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
      if (m.kind === "drum" || m.kind === "timerwheel") for (let i = 0; i < m.cells.length; i++) for (let j = i + 1; j < m.cells.length; j++) if (overlap(m.cells[i], m.cells[j], -1)) {
        fail(`${m.id}: drum sectors ${i} and ${j} overlap; raise radius or lower cellW`);
        i = j = m.cells.length;
      }
      for (const [ci, c] of m.cells.entries()) {
        if (c.pixel) {
          const shapeOf = (cls, extra = "") => (c.lamp ? `<circle cx="${r1(c.x + c.w / 2)}" cy="${r1(c.y + c.h / 2)}" r="${r1(c.w / 2 - 0.5)}" class="${cls}"${extra}/>` : rect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1, cls, 0, extra));
          svgCells += shapeOf(c.lamp ? "lamp-off" : "px-off");
          const states = [{ t: 0, v: c.init }, ...c.events.sort((a, b) => a.t - b.t)];
          states.forEach((st, si) => {
            if (!st.v) return;
            const cls = st.v === "a" ? "px-hot" : "px-on";
            const until = states[si + 1]?.t;
            const frames = si === 0 && states.length === 1 ? null : [[0, "opacity:0"], [st.t, "opacity:0"], [st.t + FADE, "opacity:1"], ...(until ? [[until, "opacity:1"], [until + FADE, "opacity:0"]] : [])];
            if (si === 0) frames && frames.splice(0, 3, [0, "opacity:1"]);
            const final = si === states.length - 1;
            svgCells += shapeOf(cls, `${final ? "" : ` opacity="0"`}${frames ? animAttr(frames) : ""}`);
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
        } else if (pg.mode === "token") {
          const k = Object.keys(m.pointers).indexOf(name);
          const off = (i) => {
            const c = pg.at(i), same = Object.entries(m.pointers).filter(([, q]) => (q.events.length ? q.events.at(-1).i : q.init) === i).map(([nm]) => nm);
            const j = Math.max(0, same.indexOf(name)), cnt = Math.max(1, same.length);
            return { x: c.x + (j - (cnt - 1) / 2) * 15, y: c.y };
          };
          const fp = off(finalI), nm = name.slice(0, 2);
          const shape = `<circle cx="${r1(fp.x)}" cy="${r1(fp.y)}" r="7.5" class="token"/>` + text(fp.x, fp.y, nm, "token-t", "middle", ` dominant-baseline="central"`);
          let frames = null;
          if (evs.length) {
            frames = [];
            seq.forEach((st, kk) => {
              const at0 = pg.at(st.i);
              if (kk) {
                const pv = pg.at(seq[kk - 1].i);
                frames.push([st.t, `transform:translate(${r1(pv.x - fp.x)}px,${r1(pv.y - fp.y)}px)`]);
              }
              frames.push([kk ? st.t + 0.4 : 0, `transform:translate(${r1(at0.x - fp.x)}px,${r1(at0.y - fp.y)}px)`]);
            });
          }
          void k;
          svgCells += `<g class="ptr-g"${frames ? animAttr(frames) : ""}>${shape}</g>`;
        } else if (pg.mode === "xy") {
          const fp = pg.at(finalI);
          const shape = rect(fp.x - fp.w / 2, fp.y - fp.h / 2, fp.w, fp.h, "ptr-box", fp.h / 2);
          let frames = null;
          if (evs.length) {
            frames = [];
            seq.forEach((st, k) => {
              const at0 = pg.at(st.i);
              if (k) {
                const pv = pg.at(seq[k - 1].i);
                frames.push([st.t, `transform:translate(${r1(pv.x - fp.x)}px,${r1(pv.y - fp.y)}px)`]);
              }
              frames.push([k ? st.t + 0.35 : 0, `transform:translate(${r1(at0.x - fp.x)}px,${r1(at0.y - fp.y)}px)`]);
            });
          }
          svgCells += `<g class="ptr-g"${frames ? animAttr(frames) : ""}>${shape}</g>`;
        } else if (pg.mode === "x") {
          const fp = pg.at(finalI);
          const nm = name.slice(0, 6), tw = textW(nm, 9);
          const finalOf = (q) => (q.events.length ? [...q.events].sort((u, v) => u.t - v.t).at(-1).i : q.init);
          const stackK = Object.entries(m.pointers).filter(([, q]) => finalOf(q) === finalI).map(([nn]) => nn).indexOf(name);
          const lift = Math.max(0, stackK) * 10;
          const shape = pg.above
            ? `<path d="M${r1(fp.x)} ${r1(fp.y)}l-5 -8h10z" class="ptr"/>` + text(fp.x, fp.y - 11 - lift, nm, "ptr-t")
            : `<path d="M${r1(fp.x)} ${r1(fp.y + 1)}l-5 8h10z" class="ptr"/>` + text(fp.x, fp.y + 19 + lift, nm, "ptr-t");
          addText(pg.above ? { x: fp.x - tw / 2, y: fp.y - 20 - lift, w: tw, h: 9 } : { x: fp.x - tw / 2, y: fp.y + 10 + lift, w: tw, h: 9 }, `${m.id}.ptr.${name}`, `${m.id} pointer ${name}`);
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
        const travel = Math.max(12, Math.round((T * 34) / 12) * 12);
        let beltSvg = "";
        beltSvg += `<path d="${pathD(e.pts)}" class="belt-rail"/><path d="${pathD(e.pts)}" class="belt" data-edge="${esc(e.id)}" data-from="${esc(e.from)}" data-to="${esc(e.to)}"/><path d="${pathD(e.pts)}" class="belt-roll"${animAttr([[0, "stroke-dashoffset:0px"], [T, `stroke-dashoffset:-${travel}px`]])}/>`;
        for (let d = 22; d < e.len - 14; d += 44) {
          const p = pointAt(e.pts, d), q = pointAt(e.pts, d + 1);
          const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) * (180 / Math.PI);
          beltSvg += `<path d="M-3 -3.5L1.5 0L-3 3.5" class="chev" transform="translate(${r1(p[0])} ${r1(p[1])}) rotate(${r1(ang)})"/>`;
        }
        if (e.under) svgUnderBelts += beltSvg;
        else svgBelts += beltSvg;
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
      if (!segsCross(s.a, s.b, u.a, u.b)) continue;
      const under = s.e.kind === "belt" && u.e.kind === "belt" && !!s.e.under !== !!u.e.under ? (s.e.under ? s : u) : null;
      if (!under) {
        fail(`${s.e.kind} ${s.e.id} and ${u.e.kind} ${u.e.id} cross; reroute with via points, or mark one belt under: true to send it underground`);
        continue;
      }
      const over = under === s ? u : s;
      const hz = under.a[1] === under.b[1];
      const cx = hz ? over.a[0] : under.a[0], cy = hz ? under.a[1] : over.a[1];
      const room = (seg, p) => Math.min(Math.abs(p - (seg.a[0] === seg.b[0] ? seg.a[1] : seg.a[0])), Math.abs(p - (seg.a[0] === seg.b[0] ? seg.b[1] : seg.b[0])));
      if (room(under, hz ? cx : cy) < 22 || room(over, hz ? cy : cx) < 14) fail(`belt ${under.e.id} goes underground too close to a bend; give it at least a grid cell of straight belt on each side of ${over.e.id}`);
      const H = 17;
      svgGround += hz ? rect(cx - H + 4, cy - 8, 2 * H - 8, 16, "ground") : rect(cx - 8, cy - H + 4, 16, 2 * H - 8, "ground");
      for (const sgn of [-1, 1]) svgGround += hz ? rect(cx + sgn * H - 4, cy - 8, 8, 16, "hood", 2) : rect(cx - 8, cy + sgn * H - 4, 16, 8, "hood", 2);
      let along = 0;
      for (let k = 1; k < under.e.pts.length; k++) {
        const p0 = under.e.pts[k - 1], p1 = under.e.pts[k];
        if (p0 === under.a && p1 === under.b) {
          along += Math.abs((hz ? cx : cy) - (hz ? p0[0] : p0[1]));
          break;
        }
        along += Math.abs(p1[0] - p0[0]) + Math.abs(p1[1] - p0[1]);
      }
      (under.e.tunnels ??= []).push([along - H, along + H]);
    }
    for (const m of machines.values()) if (!connected.has(m.id) && !armTouched.has(m.id) && m.kind !== "arm") fail(`machine ${m.id} has no belt or signal; connect it or remove it`);

    for (const tl of timeline) {
      if (tl.type === "item") {
        const w = textW(tl.item) + 14;
        const frames = [[0, "opacity:0"], [tl.t0, "opacity:0"], [tl.t0 + FADE, "opacity:1"]];
        const dur = tl.t1 - tl.t0;
        let acc = 0;
        const stop = tl.stopAt ?? tl.e.len;
        for (let k = 0; k < tl.e.pts.length; k++) {
          const p = tl.e.pts[k];
          const next = k ? acc + Math.abs(p[0] - tl.e.pts[k - 1][0]) + Math.abs(p[1] - tl.e.pts[k - 1][1]) : 0;
          if (next >= stop - 0.01) {
            const q = pointAt(tl.e.pts, stop);
            frames.push([tl.t1, `transform:translate(${r1(q[0])}px,${r1(q[1])}px)`]);
            break;
          }
          acc = next;
          frames.push([tl.t0 + (acc / stop) * dur, `transform:translate(${r1(p[0])}px,${r1(p[1])}px)`]);
        }
        frames.splice(1, 0, [0, `transform:translate(${r1(tl.e.pts[0][0])}px,${r1(tl.e.pts[0][1])}px)`]);
        for (const [d0, d1] of tl.e.tunnels ?? []) {
          if (d1 > stop) continue;
          const ta = tl.t0 + (d0 / stop) * dur, tb = tl.t0 + (d1 / stop) * dur;
          frames.push([ta, "opacity:1"], [ta + 0.05, "opacity:0"], [tb - 0.05, "opacity:0"], [tb, "opacity:1"]);
        }
        const gone = tl.hold ?? tl.t1;
        frames.push([gone, "opacity:1"], [gone + FADE, "opacity:0"]);
        const kindSvg = {
          pill: rect(-w / 2, -9, w, 18, "item-b", 9),
          chip: rect(-w / 2 + 2, -8, w - 4, 16, "item-b", 2),
          hex: `<path d="M${r1(-w / 2)} 0L${r1(-w / 2 + 6)} -9H${r1(w / 2 - 6)}L${r1(w / 2)} 0L${r1(w / 2 - 6)} 9H${r1(-w / 2 + 6)}Z" class="item-b"/>`,
          crate: rect(-w / 2, -10, w, 20, "item-b", 1.5) + `<path d="M${r1(-w / 2 + 3)} -10v20M${r1(w / 2 - 3)} -10v20" class="slat"/>`,
          letter: rect(-w / 2, -9, w, 18, "item-b", 1.5) + `<path d="M${r1(-w / 2)} -9L0 -3L${r1(w / 2)} -9" class="flap-l"/>`,
        }[tl.kind ?? "pill"];
        svgItems += `<g class="item item-${tl.kind ?? "pill"}" opacity="0"${animAttr(frames)}>${kindSvg}${text(0, tl.kind === "letter" ? 2 : 0, tl.item, "item-t", "middle", ` dominant-baseline="central"`)}</g>`;
      } else if (tl.type === "pulse") {
        svgItems += `<path d="${pathD(tl.e.pts)}" class="pulse" opacity="0"${animAttr(windows([[tl.t0, tl.t1]]))}/>`;
      }
    }

    const moves = timeline.filter((tl) => tl.type === "item" || tl.type === "pulse");
    for (const m of machines.values()) {
      if (!m.geo.bus) continue;
      const { cx, cy } = m.geo.bus;
      for (const e of belts) {
        if (e.from === m.id && e.p0) svgMachines += `<path d="M${cx} ${cy}L${r1(e.p0[0])} ${r1(e.p0[1])}" class="bus"/>`;
        if (e.to === m.id && e.p1) svgMachines += `<path d="M${r1(e.p1[0])} ${r1(e.p1[1])}L${cx} ${cy}" class="bus"/>`;
      }
      svgPorts += `<circle cx="${cx}" cy="${cy}" r="4.5" class="hub-dot"/>`;
    }
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
    for (const A of machines.values()) {
      if (A.kind !== "arm") continue;
      const { cx: bx, cy: by } = A.geo.armBase;
      const mvs = A.armMoves ?? [];
      const center = (c) => [c.x + c.w / 2, c.y + c.h / 2];
      const { L1, L2, rest, restElbow, restTip } = A.armGeo;
      if (!mvs.length) fail(`arm ${A.id} never moves anything; give it steps with moves, or remove it`);
      for (const [a, b] of [[[bx, by], restElbow], [restElbow, restTip]]) {
        const box = { x: Math.min(a[0], b[0]) - 5, y: Math.min(a[1], b[1]) - 5, w: Math.abs(a[0] - b[0]) + 10, h: Math.abs(a[1] - b[1]) + 10 };
        for (const t of texts) if (overlap(t, box)) {
          const steps = 8, hit = Array.from({ length: steps + 1 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps]).some(([px, py]) => px > t.x - 4 && px < t.x + t.w + 4 && py > t.y - 4 && py < t.y + t.h + 4);
          if (hit) fail(`arm ${A.id} rests across text: ${t.what}; move the arm or set labelSide on that machine`);
        }
        for (const bb of boxes) if (bb.id !== A.id && [0.5, 1].some((f) => { const px = a[0] + (b[0] - a[0]) * f, py = a[1] + (b[1] - a[1]) * f; return px > bb.x && px < bb.x + bb.w && py > bb.y && py < bb.y + bb.h; })) fail(`arm ${A.id} rests over machine ${bb.id}; move the arm`);
      }
      const ik = ([px, py], near) => {
        const dx = px - bx, dy = py - by, d = Math.hypot(dx, dy);
        if (d > L1 + L2 - 1 || d < Math.abs(L1 - L2) + 4) {
          fail(`arm ${A.id} cannot reach a cell ${Math.round(d)}px away (reach ${L1 + L2}px); move the arm closer or set reach`);
          return near;
        }
        const c2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
        const t2 = (Math.acos(Math.max(-1, Math.min(1, c2))) * 180) / Math.PI;
        const t1 = (Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin((t2 * Math.PI) / 180), L1 + L2 * Math.cos((t2 * Math.PI) / 180))) * 180 / Math.PI;
        const unwrap = (a, ref) => a + 360 * Math.round((ref - a) / 360);
        return [unwrap(t1, near[0]), t2];
      };
      const f1 = [], f2 = [], f3 = [];
      const pose = (time, [a1, a2]) => {
        f1.push([time, `transform:rotate(${r1(a1)}deg)`]);
        f2.push([time, `transform:rotate(${r1(a2)}deg)`]);
        f3.push([time, `transform:rotate(${r1(-(a1 + a2))}deg)`]);
      };
      pose(0, rest);
      let cur = rest;
      const rests = new Set(A.armRests ?? []);
      for (const mv of mvs) {
        const src = ik(mv.fromPt, cur);
        const dst = ik(mv.toPt, src);
        pose(mv.t0, cur);
        pose(mv.reach, src);
        pose(mv.grip, src);
        pose(mv.drop, dst);
        pose(mv.after, dst);
        cur = dst;
        for (const r of rests) if (Math.abs(r - mv.after - 0.55) < 1e-6) {
          pose(r, rest);
          cur = rest;
        }
      }
      const ex = bx + L1, tx = bx + L1 + L2;
      const g1 = mvs.length ? animAttr(f1) : "", g2 = mvs.length ? animAttr(f2) : "", g3 = mvs.length ? animAttr(f3) : "";
      let tokens = "";
      for (const mv of mvs) {
        const w = textW(mv.value) + 12;
        tokens += `<g opacity="0"${animAttr([[0, "opacity:0"], [mv.grip, "opacity:0"], [mv.grip + 0.08, "opacity:1"], [mv.drop, "opacity:1"], [mv.drop + 0.08, "opacity:0"]])}>${rect(tx - w / 2, by + 6, w, 16, "item-b", 8)}${text(tx, by + 14, mv.value, "item-t", "middle", ` dominant-baseline="central"`)}</g>`;
      }
      svgArms += `<g class="rot" style="transform-origin:${bx}px ${by}px;transform:rotate(${r1(rest[0])}deg)"${g1}>` +
        `<path d="M${bx} ${by}H${ex}" class="arm-seg"/><path d="M${bx} ${by}H${ex}" class="arm-core"/>` +
        `<g class="rot" style="transform-origin:${ex}px ${by}px;transform:rotate(${r1(rest[1])}deg)"${g2}>` +
        `<path d="M${ex} ${by}H${tx}" class="arm-seg"/><path d="M${ex} ${by}H${tx}" class="arm-core"/>` +
        `<path d="M${tx - 2} ${by - 7}V${by + 7}M${tx - 2} ${by - 7}h8M${tx - 2} ${by + 7}h8" class="grip"/>` +
        `<g class="tip" style="transform:rotate(${r1(-(rest[0] + rest[1]))}deg)"${g3}>${tokens}</g>` +
        `<circle cx="${ex}" cy="${by}" r="5" class="arm-joint"/></g>` +
        `<circle cx="${bx}" cy="${by}" r="6.5" class="arm-joint"/><circle cx="${bx}" cy="${by}" r="2.6" class="arm-pin"/></g>`;
    }

    for (const r of raws) {
      if (r.box) for (const b of boxes) if (overlap(r.box, b)) fail(`raw drawing overlaps machine ${b.id}`);
      svgMachines += r.svg;
    }

    for (const t of texts) if (t.y < HEAD + 2 || t.x < 0 || t.x + t.w > W || t.y + t.h > HEAD + floorH) fail(`text off the floor: ${t.what} reaches outside the ${cols}x${rows} floor (into the header or margin)`);
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i], b = texts[j];
        if (a.owner === b.owner && a.owner.endsWith(".cell")) continue;
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
.belt-rail{fill:none;stroke:var(--lo);stroke-width:12;stroke-linejoin:round}.belt{fill:none;stroke:var(--belt);stroke-width:9;stroke-linejoin:round}.belt-roll{fill:none;stroke:var(--lo);stroke-width:7;stroke-dasharray:1.6 10.4;opacity:.75}.chev{fill:none;stroke:var(--lo);stroke-width:1.4}
.mouth{fill:var(--slot)}.ground{fill:var(--paper)}.hood{fill:var(--slot)}.bolt{fill:var(--mid)}.bevel{stroke:var(--hl);stroke-width:1.4;stroke-linecap:round;opacity:.8}
.slat{stroke:var(--accent-ink);stroke-width:1.2;opacity:.55}.flap-l{fill:none;stroke:var(--accent-ink);stroke-width:1.2;opacity:.6}.nodebox{fill:none;stroke:var(--ink);stroke-width:1.2}.tape{fill:var(--body);stroke:var(--ink);stroke-width:1.2}.hole{fill:var(--paper);stroke:var(--lo);stroke-width:.6}
.rail{stroke:var(--mid);stroke-width:2.2;stroke-linecap:round}.gear{fill:var(--body);stroke:var(--ink);stroke-width:1.4}.tooth{stroke:var(--ink);stroke-width:2}.hook{fill:none;stroke:var(--ink);stroke-width:1.6;stroke-linecap:round}
.tap{fill:none;stroke:var(--ink);stroke-width:3;stroke-linecap:round}.drip{fill:var(--accent)}.bucket{fill:var(--body);stroke:var(--ink);stroke-width:1.4;stroke-linejoin:round}
.split{stroke:var(--mid);stroke-width:1;stroke-dasharray:2 2}.token{fill:var(--accent);stroke:var(--ink);stroke-width:1}.token-t{font-size:8px;font-weight:700;fill:var(--accent-ink)}.bus{stroke:var(--ink);stroke-width:2.6;stroke-linecap:round}.hub-dot{fill:var(--accent);stroke:var(--ink);stroke-width:1.2}
.lamp-off{fill:var(--cell);stroke:var(--lo);stroke-width:1}.free{fill:none;stroke:var(--lo);stroke-dasharray:3 3}.well{fill:var(--cell);stroke:var(--lo);stroke-width:1}.route{fill:none;stroke:var(--lo);stroke-width:1.2;stroke-dasharray:3 3}
.idx-rail{fill:var(--belt)}.idx-n{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:9px;fill:var(--mid)}.end-t{font-size:8px;font-weight:700;letter-spacing:.06em;fill:var(--mid)}
.ptr-box{fill:none;stroke:var(--accent);stroke-width:2}.arm-seg{stroke:var(--ink);stroke-width:9;stroke-linecap:round}.arm-core{stroke:var(--body);stroke-width:5;stroke-linecap:round}.arm-joint{fill:var(--body);stroke:var(--ink);stroke-width:1.6}.arm-pin{fill:var(--accent)}.grip{fill:none;stroke:var(--ink);stroke-width:2.4;stroke-linecap:round}.pedestal{fill:var(--body);stroke:var(--ink);stroke-width:1.2}.pedestal-ring{fill:var(--cell);stroke:var(--mid);stroke-width:1}
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
<g class="belts">${svgUnderBelts}${svgGround}${svgBelts}</g>
<g class="signals">${svgSignals}</g>
<g class="hot-g">${svgHot}</g>
<g class="machines">${svgMachines}</g>
<g class="ports">${svgPorts}</g>
<g class="arms">${svgUnder}</g>
<g class="cells">${svgCells}</g>
<g class="labels">${svgLabels}</g>
<g class="items">${svgItems}</g>
<g class="arms-top">${svgArms}</g>
<g class="caption">${svgCaps}</g>
<g class="legend">${svgLegend}</g>
<g class="index">${svgIndex}</g>
<g class="gaps">${svgGaps}</g>
</svg>
`;
    const nTexts = (svg.match(/<text\b/g) ?? []).length - (svg.match(/<text\b[^>]*\bopacity="0"/g) ?? []).length - (svg.match(/<g class="item[^"]*" opacity="0"/g) ?? []).length;
    if (nTexts > (opts.maxTexts ?? LIMITS.texts)) fail(`${nTexts} visible text elements is over the clutter budget of ${opts.maxTexts ?? LIMITS.texts}; cut cells, shorten traces or split the tour`);
    return { svg, texts: nTexts, duration: T, problems };
  }

  return api;
}
