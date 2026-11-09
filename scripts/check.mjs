#!/usr/bin/env node
import { readFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const USAGE = `usage: check.mjs <file.svg> [--max-texts 140 (visible in the static view)] [--max-colors 24] [--max-chars 96] [--max-kb 400] [--allow-loop]
Checks one standalone tour SVG and prints "svg check passed", or every problem and exits 1.`;

const args = process.argv.slice(2);
if (!args.length || args[0].startsWith("-")) {
  console.log(USAGE);
  process.exit(2);
}
const file = args[0];
const known = new Set(["--max-texts", "--max-colors", "--max-chars", "--max-kb", "--allow-loop"]);
for (const a of args.slice(1)) if (a.startsWith("--") && !known.has(a)) {
  console.error(`unknown option ${a}\n${USAGE}`);
  process.exit(2);
}
const num = (name, def) => {
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = Number(args[i + 1]);
  if (!Number.isFinite(v)) {
    console.error(`${name} needs a number`);
    process.exit(2);
  }
  return v;
};
if (!existsSync(file)) {
  console.error(`no such file: ${file}`);
  process.exit(2);
}

const src = readFileSync(file, "utf8");
const problems = [];
const fail = (rule, msg) => problems.push(`${rule}: ${msg}`);

function tokenize(s) {
  const nodes = [];
  const stack = [];
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt < 0) break;
    if (s.startsWith("<!--", lt)) {
      const end = s.indexOf("-->", lt);
      if (end < 0) throw new Error("unclosed comment");
      i = end + 3;
      continue;
    }
    if (s.startsWith("<![CDATA[", lt)) {
      const end = s.indexOf("]]>", lt);
      if (end < 0) throw new Error("unclosed CDATA");
      if (stack.length) stack.at(-1).text += s.slice(lt + 9, end);
      i = end + 3;
      continue;
    }
    if (s.startsWith("<?", lt)) {
      const end = s.indexOf("?>", lt);
      if (end < 0) throw new Error("unclosed processing instruction");
      i = end + 2;
      continue;
    }
    if (s.startsWith("<!", lt)) {
      const end = s.indexOf(">", lt);
      if (end < 0) throw new Error("unterminated <! declaration");
      fail("dtd", "DOCTYPE or ENTITY declarations are not allowed");
      i = end + 1;
      continue;
    }
    const between = s.slice(i, lt);
    if (stack.length) stack.at(-1).text += between;
    else if (between.trim()) throw new Error("text outside the root element");
    for (const m of between.matchAll(/&([^;\s]*)(;?)/g)) if (!m[2] || !/^(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+)$/.test(m[1])) throw new Error(`bad entity or bare & near "${between.slice(Math.max(0, m.index - 10), m.index + 10)}"`);
    const m = /^<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/.exec(s.slice(lt, lt + 20000));
    if (!m) throw new Error(`malformed tag near offset ${lt}: ${s.slice(lt, lt + 40)}`);
    const [whole, close, name, attrStr, selfClose] = m;
    if (!close && !stack.length && nodes.length) throw new Error(`a second root element <${name}>`);
    if (close) {
      const open = stack.pop();
      if (!open || open.qname !== name) throw new Error(`</${name}> does not match <${open?.name ?? "nothing"}>`);
    } else {
      const attrs = {};
      for (const a of attrStr.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
        if (a[1] in attrs) throw new Error(`duplicate attribute ${a[1]} on <${name}>`);
        const raw = a[3] ?? a[4];
        for (const m of raw.matchAll(/&([^;\s]*)(;?)/g)) if (!m[2] || !/^(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+)$/.test(m[1])) throw new Error(`bad entity or bare & in ${a[1]} on <${name}>`);
        attrs[a[1]] = raw.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
      }
      const node = { name: name.includes(":") ? name.split(":").pop() : name, qname: name, attrs, text: "", parent: stack.at(-1) ?? null, depth: stack.length, index: nodes.length };
      nodes.push(node);
      if (!selfClose) stack.push(node);
    }
    i = lt + whole.length;
  }
  if (stack.length) throw new Error(`<${stack.at(-1).name}> is never closed`);
  return nodes;
}

let nodes;
try {
  nodes = tokenize(src);
} catch (e) {
  fail("xml", e.message);
  nodes = [];
}
if (spawnSync("which", ["xmllint"]).status === 0) {
  const r = spawnSync("xmllint", ["--noout", file], { encoding: "utf8" });
  if (r.status !== 0) fail("xml", `xmllint: ${r.stderr.trim().split("\n")[0]}`);
}

const root = nodes[0];
if (!nodes.length && !problems.length) fail("root", "no elements found");
if (nodes.length) {
  if (root.qname !== "svg") fail("root", `root element is <${root.name}>, not <svg>`);
  if (root.attrs.xmlns !== "http://www.w3.org/2000/svg") fail("root", 'root <svg> needs xmlns="http://www.w3.org/2000/svg"');
  if (!root.attrs.viewBox) fail("root", "root <svg> needs a viewBox");
  if (nodes.filter((n) => n.name === "svg").length > 1) fail("root", "nested <svg> elements; use one root canvas");
  const kids = nodes.filter((n) => n.parent === root);
  if (kids[0]?.name !== "title") fail("a11y", "the first child of <svg> must be <title>");
  if (!kids.some((n) => n.name === "desc")) fail("a11y", "<svg> needs a <desc>");
}

const banned = { script: "scripts do not run in <img> and are not allowed", foreignObject: "foreignObject breaks image embedding", iframe: "no iframes", image: "no raster or external images; draw with SVG shapes", animate: "SMIL ignores prefers-reduced-motion; use CSS keyframes", animateTransform: "SMIL ignores prefers-reduced-motion; use CSS keyframes", animateMotion: "SMIL ignores prefers-reduced-motion; use CSS keyframes", set: "SMIL ignores prefers-reduced-motion; use CSS keyframes", "font-face": "no embedded fonts" };
for (const n of nodes) {
  if (banned[n.name]) fail("banned", `<${n.name}>: ${banned[n.name]}`);
  for (const [k, v] of Object.entries(n.attrs)) {
    if (/^on/i.test(k)) fail("banned", `event handler ${k} on <${n.name}>`);
    if (/^\s*javascript:/i.test(v)) fail("banned", `javascript: URL on <${n.name}>`);
    if ((k === "href" || k === "xlink:href") && n.name !== "a" && !v.startsWith("#")) fail("remote", `<${n.name} ${k}="${v}"> loads an external resource`);
    if (/url\(\s*['"]?(?!#)/i.test(v)) fail("remote", `${k} on <${n.name}> loads ${v}`);
    if (k === "style" && /animation|transition/i.test(v)) fail("motion", `inline style on <${n.name}> animates outside the reduced-motion gate`);
  }
}

const css = nodes.filter((n) => n.name === "style").map((n) => n.text).join("\n");
const allText = `${css}\n${src}`;
if (/@import/.test(css)) fail("remote", "@import in <style>");
if (/@font-face/.test(css)) fail("remote", "@font-face in <style>; use system font stacks");
for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)/g)) if (!m[1].startsWith("#")) fail("remote", `url(${m[1]}) in <style>`);

const ids = new Map();
for (const n of nodes) if (n.attrs.id) ids.set(n.attrs.id, (ids.get(n.attrs.id) ?? 0) + 1);
for (const [id, c] of ids) if (c > 1) fail("ids", `id "${id}" is used ${c} times`);
const refs = new Set();
for (const m of allText.matchAll(/url\(\s*['"]?#([^'")\s]+)/g)) refs.add(m[1]);
for (const n of nodes) for (const [k, v] of Object.entries(n.attrs)) if ((k === "href" || k === "xlink:href") && v.startsWith("#")) refs.add(v.slice(1));
for (const m of css.matchAll(/#([A-Za-z][\w-]*)\s*\{/g)) if (!/^[0-9a-fA-F]{3,8}$/.test(m[1])) refs.add(m[1]);
for (const n of nodes) if (n.attrs["aria-labelledby"]) for (const id of n.attrs["aria-labelledby"].split(/\s+/)) refs.add(id);
for (const r of refs) if (!ids.has(r)) fail("refs", `#${r} is referenced but no element has that id`);

function stripBlocks(text, re) {
  let out = "", i = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index;
    if (start < i) continue;
    out += text.slice(i, start);
    let depth = 0, j = text.indexOf("{", start);
    for (; j < text.length; j++) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}" && --depth === 0) break;
    }
    i = j + 1;
  }
  return out + text.slice(i);
}
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
for (const m of cssNoComments.matchAll(/@media([^{]*)\{/g)) if (/prefers-reduced-motion/i.test(m[1]) && !/^\s*\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)\s*$/i.test(m[1])) fail("motion", `@media${m[1]}: gate motion with exactly "(prefers-reduced-motion: no-preference)", nothing else in the query`);
const outsideMotionQuery = stripBlocks(stripBlocks(cssNoComments, /@media\s*\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)\s*\{/gi), /@keyframes\s+[\w-]+\s*\{/gi);
if (/\banimation(-name)?\s*:/i.test(outsideMotionQuery)) fail("motion", "an animation is declared outside @media (prefers-reduced-motion: no-preference); reduced-motion viewers must get the still overview");
if (/\btransition\s*:/i.test(outsideMotionQuery)) fail("motion", "a transition is declared outside the no-preference media query");
if (/\binfinite\b/.test(css) && !args.includes("--allow-loop")) fail("motion", "an animation loops forever; play once and hold the end state (pass --allow-loop if a pause control exists)");
if (/@keyframes/.test(css) && !/prefers-reduced-motion\s*:\s*no-preference/.test(css)) fail("motion", "keyframes exist but nothing is gated on prefers-reduced-motion: no-preference");
if (/@keyframes/.test(css) && !/prefers-color-scheme/.test(css)) fail("theme", "no prefers-color-scheme block; define colours as tokens with a dark override");

const texts = nodes.filter((n) => n.name === "text");
const hidden = (n) => {
  for (let p = n; p; p = p.parent) if (p.attrs.opacity === "0" || /(^|;)\s*(display\s*:\s*none|visibility\s*:\s*hidden)/.test(p.attrs.style ?? "")) return true;
  return false;
};
const visible = texts.filter((t) => !hidden(t));
const maxTexts = num("--max-texts", 140);
if (visible.length > maxTexts) fail("clutter", `${visible.length} visible <text> elements in the static view (budget ${maxTexts}); move detail out of the canvas`);
if (texts.length > maxTexts * 4) fail("clutter", `${texts.length} <text> elements in total; the playback has too many states`);
const maxChars = num("--max-chars", 96);
for (const t of texts) {
  const s = (t.text + nodes.filter((n) => n.parent === t).map((n) => n.text).join("")).replace(/\s+/g, " ").trim();
  if (s.length > maxChars) fail("clutter", `a text line has ${s.length} chars (max ${maxChars}): "${s.slice(0, 50)}…"`);
}
const colors = new Set();
for (const m of allText.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b(?![\w-]*\s*\{)/g)) colors.add(m[1].toLowerCase());
for (const m of allText.matchAll(/rgba?\([^)]*\)|hsla?\([^)]*\)/g)) colors.add(m[0].replace(/\s/g, ""));
const maxColors = num("--max-colors", 24);
if (colors.size > maxColors) fail("clutter", `${colors.size} distinct colour literals (budget ${maxColors}); use the theme tokens`);
const markupFills = nodes.filter((n) => n.name !== "stop" && /^#|^rgb/.test(n.attrs.fill ?? "") ).length;
if (markupFills > 12) fail("theme", `${markupFills} elements set a literal fill in markup; colour through classes and tokens so dark mode works`);
const kb = statSync(file).size / 1024;
if (kb > num("--max-kb", 400)) fail("size", `${kb.toFixed(0)} KB is over the size budget`);
if (!/not a recording|illustrative|walkthrough/i.test(src)) fail("honesty", "nothing in the SVG says this is a source-derived walkthrough rather than a recording");

if (problems.length) {
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`svg check failed: ${problems.length} problem${problems.length > 1 ? "s" : ""}`);
  process.exit(1);
}
console.log(`svg check passed (${visible.length} visible texts of ${texts.length}, ${colors.size} colours, ${kb.toFixed(0)} KB)`);
