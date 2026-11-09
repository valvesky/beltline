// Beltline tour of velocitty: bytes from the PTY to pixels.
// Regenerate with: node examples/velocitty/build.mjs   (WOF=1 writes the SVG even when the audit fails)
// Check sources with a velocitty checkout: node scripts/check-sources.mjs examples/velocitty/beltline.svg <velocitty>
import { factory } from "../../kit/beltline.mjs";

const F = factory({
  title: "velocitty — bytes from the PTY to pixels",
  subtitle: "Walkthrough derived from velocitty 2d5a1a4 source and its ring tests. Not a recording.",
  desc: "The shell writes x, ESC [ 3 1 m, y and é to the PTY in two reads. The bytes land in a mirrored ring; a scanner cuts them into runs and holds the unfinished CSI until the second read; the VT sets a red pen, interns it as style 1 and writes cells; the renderer repaints the dirty row from a glyph atlas into a CPU framebuffer that is presented as one damaged strip. A second trace streams an OSC title around the ring through the stream buffer to the window title.",
  cols: 56,
  rows: 15,
  rev: "2d5a1a4",
  repo: "valvesky/velocitty",
  baseUrl: "https://github.com/valvesky/velocitty/blob/2d5a1a4d127784d7b163306df071f91d61d3023c/",
  writeOnFail: process.env.WOF === "1",
});

// ---------- pixel art: 3x5 glyphs for the atlas and the framebuffer ----------
const shapes = {
  x: [[1, 0], [1, 2], [2, 1], [3, 0], [3, 2]],
  y: [[1, 0], [1, 2], [2, 0], [2, 2], [3, 1], [4, 0]],
  e: [[0, 2], [1, 1], [2, 0], [2, 1], [2, 2], [3, 0], [4, 1], [4, 2]],
};
const px = (cols, g, col0, v) => shapes[g].map(([r, c]) => [r * cols + col0 + c, v]);
// the atlas already holds the warmed ASCII glyphs, x and y among them
const atlasInit = Array(60).fill("");
for (const [i, v] of [...px(12, "x", 0, "1"), ...px(12, "y", 4, "1")]) atlasInit[i] = v;

// ---------- machines ----------
// main row (row 5): pty -> ring -> scan -> runs -> feed -> print -> cells -> render -> frame -> window
F.machine("pty", { kind: "dock", at: [1, 5], label: "PTY master", src: "src/platform/platform.zig:291", symbol: "PtySource" })
  .machine("ring", { kind: "drum", at: [5, 4], label: "CircBuffer ring", labelAt: [9.6, 3.2], src: "src/circbuffer.zig:48", symbol: "CircBuffer", cells: ["", "", "", "", "", "", "", ""], pointers: { tail: 0, head: 0 } })
  .machine("scan", { kind: "cutter", at: [10.5, 5], label: "Preparser.scan()", src: "src/preparser.zig:268", symbol: "scan" })
  .machine("runs", { kind: "rack", at: [15.5, 5.5], label: "Preparser.runs", src: "src/preparser.zig:129", symbol: "runs", cellW: 72, cells: ["", ""] })
  .machine("feed", { kind: "splitter", at: [23.5, 4.4583], h: 82, label: "feedOwned()", src: "src/vt.zig:381", symbol: "feedOwnedImpl" })
  .machine("print", { kind: "press", at: [27, 5], label: "printPlain/Utf8", src: "src/vt.zig:1154", symbol: "printPlain" })
  .machine("cells", { kind: "rack", at: [32, 5.0278], label: "Grid cells, row 0", labelSide: "n", src: "src/grid.zig:422", symbol: "cells", cellW: 25, cells: ["", "", "", "", "", "", ""], pointers: { cur: 0 } })
  .machine("render", { kind: "press", at: [41.5417, 5], label: "renderSel()", src: "src/draw.zig:187", symbol: "renderSel" })
  .machine("frame", { kind: "plate", at: [46.5417, 5], label: "Frame.pixels", src: "src/draw.zig:102", symbol: "pixels", cols: 12, rows: 5, pixel: 8 })
  .machine("window", { kind: "dock", at: [52.5, 5], w: 60, label: "window", src: "src/platform/platform.zig:147", symbol: "Window", cellW: 46, cells: [""] });

// above the main row: the pen and the style table it is interned into
F.machine("pen", { kind: "record", at: [24.15, 1.5], label: "Grid pen", src: "src/grid.zig:450", symbol: "fg", cellW: 80, cells: ["fg #aaaaaa"] })
  .machine("styles", { kind: "pigeonholes", at: [29, 1], label: "Styles intern table", src: "src/grid.zig:215", symbol: "Styles", cellW: 66, cells: ["0:#aaaaaa", "", "", ""] });

// below the main row: stream buffer, title, dirty bits, glyph cache, atlas
F.machine("stream", { kind: "rack", at: [3.75, 10], label: "stream buffer", src: "src/circbuffer.zig:71", symbol: "stream", cellW: 72, cells: ["", ""] })
  .machine("title", { kind: "record", at: [24.75, 10], label: "VtState.title", labelSide: "w", src: "src/vt.zig:163", symbol: "title", cellW: 62, cells: [""] })
  .machine("dirty", { kind: "plate", at: [35, 10], label: "line_dirty bits", src: "src/vt.zig:151", symbol: "line_dirty", cols: 8, rows: 1, pixel: 12 })
  .machine("glyphs", { kind: "pigeonholes", at: [41.5, 9], label: "glyph LRU cache", src: "src/type.zig:149", symbol: "cache", cellW: 52, evict: true, cells: ["", "", "", ""] })
  .machine("atlas", { kind: "plate", at: [48.25, 9], label: "glyph atlas", src: "src/type.zig:147", symbol: "atlas", cols: 12, rows: 5, pixel: 6, cells: atlasInit });

// ---------- belts ----------
F.belt("pty", "ring")
  .belt("ring", "scan")
  .belt("scan", "runs")
  .belt("runs", "feed")
  .belt("feed", "print")
  .belt("print", "cells")
  .belt("cells", "render")
  .belt("render", "frame")
  .belt("frame", "window")
  .belt("feed", "pen", { out: "e", label: "SGR" })
  .belt("pen", "styles")
  .belt("styles", "print")
  .belt("dirty", "render", { out: "e", in: "w" })
  .belt("render", "glyphs")
  .belt("glyphs", "atlas")
  .belt("atlas", "frame")
  .belt("ring", "stream")
  .belt("pty", "stream", { out: "s", in: "w" })
  .belt("stream", "scan", { out: "e", in: "s" })
  .belt("feed", "title", { out: "e", label: "OSC" })
  .belt("title", "window", { out: "s", in: "s", via: [[26.25, 14], [53.75, 14]] });

// ---------- main trace: x ESC[31m y é, in two reads ----------
F.step({ belt: "pty->ring", item: "x ESC[3", writes: { ring: [[0, "x"], [1, "1b"], [2, "[3"]] }, pointers: { ring: { head: 3 } }, caption: "read A: readSource copies 4 bytes from the PTY into the ring at head", src: "src/circbuffer.zig:236" })
  .step({ belt: "ring->scan", at: "scan", pointers: { ring: { tail: 1 } }, caption: "scan cuts text x; ESC[3 has no final byte yet, so 3 bytes are held and tail stops at 1", src: "src/preparser.zig:357" })
  .step({ belt: "scan->runs", item: "txt x", writes: { runs: [[0, "txt x"]] }, caption: "this drain's run list: one text run whose 1-byte prefix is printable ASCII", src: "src/preparser.zig:319" })
  .step({ belt: "runs->feed", at: "feed", caption: "drain() hands the runs to VtState through its Sink", src: "src/circbuffer.zig:338" })
  .step({ belt: "feed->print", item: "x", writes: { cells: [[0, "x:0"]] }, pointers: { cells: { cur: 1 } }, caption: "printPlain writes x with the default pen, style 0 (frame 1 paints it)", src: "src/vt.zig:1184" })
  .step({ belt: "pty->ring", item: "1 m y c3 a9", writes: { ring: [[3, "1m"], [4, "y"], [5, "c3"], [6, "a9"]] }, pointers: { ring: { head: 7 } }, caption: "read B: 5 more bytes arrive; head reaches offset 9", src: "src/circbuffer.zig:236" })
  .step({ belt: "ring->scan", at: "scan", pointers: { ring: { tail: 7 } }, caption: "scan restarts at tail: the CSI is whole and parsed once, then text yé; tail = head", src: "src/preparser.zig:359" })
  .step({ belt: "scan->runs", item: "2 runs", writes: { runs: [[0, "csi 31m"], [1, "txt yé"]] }, caption: "the reused run list now holds csi 31m and text yé", src: "src/circbuffer.zig:363" })
  .step({ belt: "feed->pen", item: "31", at: "feed", writes: { pen: [[0, "fg #aa0000"]] }, caption: "a CSI ending in m goes straight to csi.sgr: SGR 31 sets the pen to palette 1", src: "src/vt.zig:419" })
  .step({ belt: "pen->styles", item: "{fg aa0000}", writes: { styles: [[1, "1:#aa0000"]] }, caption: "penId() misses the memo and the map, so Styles.add appends the pen as id 1", src: "src/grid.zig:353" })
  .step({ belt: "styles->print", item: "id 1", at: "print", caption: "text yé arrives; each cell this pen writes carries style id 1", src: "src/vt.zig:1237" })
  .step({ belt: "print->cells", item: "y é", writes: { cells: [[1, "y:1"], [2, "é:1"]], dirty: [[0, "a"]] }, pointers: { cells: { cur: 3 } }, caption: "printPlain writes y; printUtf8 decodes c3 a9 to U+00E9; row 0 is marked dirty", src: "src/vt.zig:580" })
  .step({ belt: "dirty->render", at: "render", caption: "frame 2: renderSel repaints only rows whose dirty bit is set, background first", src: "src/draw.zig:279" })
  .step({ belt: "render->glyphs", item: "é", caption: "x and y come from the warmed ASCII table; é misses the glyph LRU", src: "src/type.zig:439" })
  .step({ belt: "glyphs->atlas", item: "é bitmap", writes: { glyphs: [[0, "é→atlas"]], atlas: px(12, "e", 8, "a") }, caption: "rasterizeAt draws é, the atlas packs it on a shelf, and the LRU keeps its slot", src: "src/type.zig:571" })
  .step({ belt: "atlas->frame", item: "coverage", writes: { frame: [...px(12, "x", 0, "1"), ...px(12, "y", 4, "a"), ...px(12, "e", 8, "a")], dirty: [[0, ""]] }, caption: "blitGlyph mixes coverage: x in #aaaaaa, y and é in #aa0000; dirty bits clear", src: "src/draw.zig:1104" })
  .step({ belt: "frame->window", item: "row 0 strip", caption: "Presenter copies only the damaged pixel rows, then presentRect shows them", src: "src/main.zig:470" });

// ---------- title trace: an OSC split across two reads ----------
F.trace("title")
  .step({ belt: "pty->ring", item: "ESC]0;open", caption: "read C: an OSC 0 title with no terminator yet lands at offset 9", src: "src/circbuffer.zig:236" })
  .step({ belt: "ring->stream", item: "ESC]0;open", writes: { stream: [[0, "ESC]0;open"]], runs: [[0, ""], [1, ""]] }, caption: "scan finds no BEL or ST: openStream copies 8 bytes out and the ring is empty", src: "src/circbuffer.zig:362" })
  .step({ belt: "pty->stream", item: "BEL END", writes: { stream: [[1, "BEL"]] }, caption: "read D goes straight to the stream buffer; BEL ends it, END returns to the ring", src: "src/circbuffer.zig:276" })
  .step({ belt: "stream->scan", item: "osc run", at: "scan", writes: { runs: [[0, "osc 0;open"], [1, "txt END"]] }, caption: "finishStream emits the OSC as a stream run, ahead of the ring's END", src: "src/circbuffer.zig:439" })
  .step({ belt: "feed->title", item: "open", at: "feed", writes: { title: [[0, "open"]], stream: [[0, ""], [1, ""]], cells: [[3, "E:1"], [4, "N:1"], [5, "D:1"]], dirty: [[0, "a"]] }, pointers: { cells: { cur: 6 } }, caption: "Osc.dispatch sets the title; END then prints red after é and dirties row 0", src: "src/osc.zig:27" })
  .step({ belt: "title->window", item: "open", writes: { window: [[0, "open"]] }, caption: "drainHost passes the new title to the window once per loop", src: "src/main.zig:277" });

F.ledger([
  { subsystem: "event loop", station: "frame->window", src: "src/main.zig:1072", example: "readSource, drain, renderSel, present per tick" },
  { subsystem: "PTY + window (Peak)", station: "pty, window", src: "src/platform/platform.zig:252", example: "reads A-D; title open" },
  { subsystem: "input ring", station: "ring, stream", src: "src/circbuffer.zig:164", example: "x ESC[3 held, then 1 m y c3 a9; OSC streamed" },
  { subsystem: "run scanner + CSI cache", station: "scan, runs", src: "src/preparser.zig:268", example: "txt x | csi 31m, txt yé | osc 0;open, txt END" },
  { subsystem: "VT dispatch", station: "feed", src: "src/vt.zig:381", example: "text, SGR and OSC runs" },
  { subsystem: "SGR / CSI apply", station: "pen", src: "src/csi.zig:272", example: "SGR 31 -> fg #aa0000" },
  { subsystem: "OSC", station: "title", src: "src/osc.zig:8", example: "OSC 0;open" },
  { subsystem: "grid + styles", station: "cells, styles", src: "src/grid.zig:215", example: "x:0 y:1 é:1, style 1 interned" },
  { subsystem: "UTF-8 printing", station: "print", src: "src/vt.zig:580", example: "c3 a9 -> U+00E9" },
  { subsystem: "renderer", station: "render, dirty, frame", src: "src/draw.zig:187", example: "row 0 repaint" },
  { subsystem: "glyphs", station: "glyphs, atlas", src: "src/type.zig:403", example: "é miss, rasterize, pack" },
  { subsystem: "keyboard to PTY", station: "not drawn", src: "src/key.zig:12", example: "gap (Up -> ESC[A -> PeakPty.pending)" },
  { subsystem: "kitty / sixel graphics", station: "not drawn", src: "src/kitty.zig:1", example: "gap" },
  { subsystem: "selection, scrollback reflow, fonts, config, debug overlay", station: "not drawn", src: "src/select.zig:1", example: "gap" },
]);

F.gap("not traced: keys to PTY, kitty/sixel images, selection, scrollback reflow, fonts, config")
  .gap("not traced: pressure-mode skipping, VT replies; Peak C internals are vendored")
  .gap("bytes from circbuffer.zig tests (1080, 655) regrouped into reads; ids assume a fresh VT");

F.build(new URL("./beltline.svg", import.meta.url).pathname);
