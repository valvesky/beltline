#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { basename, resolve, join } from "node:path";
import { tmpdir } from "node:os";

const USAGE = `usage: capture.mjs <file.svg> [--out dir] [--at 0,25,50,75,100] [--width 1200,390] [--reduced] [--img] [--dark] [--zoom x,y,w,h] [--sheet]
  --at      moments to freeze, in % of the playback (default 0,25,50,75,100)
  --width   viewport widths in CSS px (default: the SVG's own width, and 390)
  --reduced also shoot with prefers-reduced-motion: reduce (must equal the 100% frame)
  --img     also shoot the file embedded as <img> (proves it renders as an image; shows an early frame)
  --dark    shoot in the dark colour scheme
  --zoom    a 3x close-up of the region x,y,w,h in SVG units, at the end state (alone, it shoots only the close-up)
  --sheet   tile every shot into one contact sheet (needs ImageMagick montage)`;

const args = process.argv.slice(2);
if (!args.length || args.includes("-h") || args.includes("--help")) {
  console.log(USAGE);
  process.exit(args.length ? 0 : 2);
}
const file = resolve(args[0]);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i < 0 ? def : args[i + 1];
};
const known = new Set(["--out", "--at", "--width", "--reduced", "--img", "--dark", "--zoom", "--sheet"]);
for (const a of args.slice(1)) if (a.startsWith("--") && !known.has(a)) {
  console.error(`unknown option ${a}\n${USAGE}`);
  process.exit(2);
}
if (!existsSync(file)) {
  console.error(`no such file: ${file}`);
  process.exit(2);
}

const svg = readFileSync(file, "utf8");
const vb = svg.match(/viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)"/);
if (!vb) {
  console.error("capture failed: the root <svg> has no viewBox");
  process.exit(1);
}
const [vw, vh] = [+vb[3], +vb[4]];
const durMatch = svg.match(/data-duration="(\d+)"/);
const durationMs = durMatch ? +durMatch[1] : null;
const zoomOnly = args.includes("--zoom") && !args.includes("--at") && !args.includes("--width");
const ats = zoomOnly ? [] : opt("--at", "0,25,50,75,100").split(",").map(Number);
if (ats.some((n) => !(n >= 0 && n <= 100))) {
  console.error("--at takes percentages between 0 and 100");
  process.exit(2);
}
const widths = opt("--width", `${Math.round(vw)},390`).split(",").map(Number);
const out = resolve(opt("--out", join(tmpdir(), `beltline-capture-${process.pid}`)));
mkdirSync(out, { recursive: true });
const dark = args.includes("--dark");

const chrome = [process.env.CHROME_PATH, "chromium", "chromium-browser", "google-chrome-stable", "google-chrome"].filter(Boolean).find((c) => spawnSync("which", [c]).status === 0 || existsSync(c));
if (!chrome) {
  console.error("capture failed: no Chrome or Chromium found; set CHROME_PATH");
  process.exit(1);
}

const work = join(tmpdir(), `beltline-pages-${process.pid}`);
mkdirSync(work, { recursive: true });

function shoot(name, html, width, height, extra = []) {
  const page = join(work, `${name}.html`);
  writeFileSync(page, html);
  const png = join(out, `${name}.png`);
  const r = spawnSync(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--allow-file-access-from-files", `--window-size=${width},${height}`, `--screenshot=${png}`, ...(dark ? ["--force-dark-mode", "--blink-settings=preferredColorScheme=0"] : ["--blink-settings=preferredColorScheme=1"]), ...extra, `file://${page}`], { encoding: "utf8", timeout: 60000 });
  if (r.status !== 0 || !existsSync(png)) {
    console.error(`capture failed for ${name}: ${r.stderr?.split("\n").slice(-3).join(" ")}`);
    process.exitCode = 1;
    return null;
  }
  return png;
}

const inline = svg.replace(/<\?xml[^>]*>/, "").replace(/^<svg\b/m, '<svg style="width:100%;height:auto;display:block"');
const frozen = (pct, extraCss = "") => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#888}${extraCss}</style>${inline}
<script>
const ms = ${durationMs ?? 0} * ${pct} / 100;
const anims = document.getAnimations();
for (const a of anims) { a.pause(); a.currentTime = ms; }
document.title = "frozen " + anims.length;
</script>`;

const shots = [];
const errors = [];
for (const w of widths) {
  const h = Math.ceil((vh / vw) * w);
  for (const pct of ats) {
    const p = shoot(`w${w}-t${pct}`, frozen(pct), w, h);
    if (p) shots.push(p);
  }
  if (args.includes("--reduced")) {
    const p = shoot(`w${w}-reduced`, frozen(100), w, h, ["--force-prefers-reduced-motion"]);
    if (p) shots.push(p);
  }
}
if (args.includes("--img")) {
  const w = widths[0], h = Math.ceil((vh / vw) * w);
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#888}img{width:100%;display:block}</style><img src="file://${file}">`;
  const p = shoot(`w${w}-img`, html, w, h, ["--virtual-time-budget=1500"]);
  if (p) shots.push(p);
}
const zoom = opt("--zoom", null);
if (zoom) {
  const [x, y, zw, zh] = zoom.split(",").map(Number);
  const scale = 3, w = Math.round(zw * scale), h = Math.round(zh * scale);
  const css = `svg{position:absolute;left:${-x * scale}px;top:${-y * scale}px;width:${vw * scale}px!important}`;
  const p = shoot(`zoom-${x}-${y}`, frozen(100, css), w, h);
  if (p) shots.push(p);
}

if (args.includes("--reduced")) {
  for (const w of widths) {
    const h = Math.ceil((vh / vw) * w);
    const end = existsSync(join(out, `w${w}-t100.png`)) ? join(out, `w${w}-t100.png`) : shoot(`w${w}-t100-ref`, frozen(100), w, h);
    const red = join(out, `w${w}-reduced.png`);
    if (!end || !existsSync(red)) {
      errors.push(`could not shoot both the end state and the reduced-motion view at ${w}px`);
      continue;
    }
    const r = spawnSync("magick", ["compare", "-metric", "AE", "-fuzz", "8%", end, red, "null:"], { encoding: "utf8" });
    const diff = parseFloat((r.stderr || "").trim());
    if (r.error || r.status === null || r.status > 1 || !Number.isFinite(diff)) {
      errors.push(`could not compare the reduced-motion view with the end state (ImageMagick 7 "magick" is required): ${r.error?.message ?? r.stderr?.trim()}`);
      continue;
    }
    if (diff > 40) errors.push(`reduced motion at ${w}px differs from the held end state by ${diff} px; the static markup must equal the last frame`);
  }
}

if (args.includes("--sheet") && shots.length) {
  const sheet = join(out, `${basename(file, ".svg")}-sheet.png`);
  try {
    execFileSync("montage", [...shots.flatMap((s) => ["-label", basename(s, ".png"), s]), "-tile", `${Math.min(3, shots.length)}x`, "-geometry", "900x+8+8", "-background", "#666", sheet]);
    console.log(`sheet ${sheet}`);
  } catch {
    errors.push("montage (ImageMagick) failed or is missing; read the individual shots instead");
  }
}

rmSync(work, { recursive: true, force: true });
for (const s of shots) console.log(`shot ${s}`);
for (const e of errors) console.error(`problem: ${e}`);
if (errors.length) process.exitCode = 1;
console.log(errors.length || process.exitCode ? `capture finished with problems` : `capture done: ${shots.length} shots in ${out}; open and read every one`);
