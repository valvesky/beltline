#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";

const USAGE = `usage: check-sources.mjs <file.svg> <repo-dir> [--rev <sha>] [--window 12]
Resolves every data-src="path:line" against the repo (at data-rev or --rev when given)
and, when data-symbol is set, finds that symbol within --window lines of the reference.
Prints "sources: 0 unresolved" or each failure and exits 1.`;

const args = process.argv.slice(2);
if (args.length < 2 || args[0].startsWith("-")) {
  console.log(USAGE);
  process.exit(2);
}
const [file, repoArg] = args;
const known = new Set(["--rev", "--window"]);
for (const a of args.slice(2)) if (a.startsWith("--") && !known.has(a)) {
  console.error(`unknown option ${a}\n${USAGE}`);
  process.exit(2);
}
const opt = (n, d) => (args.indexOf(n) < 0 ? d : args[args.indexOf(n) + 1]);
const repo = resolve(repoArg);
if (!existsSync(file) || !existsSync(repo)) {
  console.error(`missing ${!existsSync(file) ? file : repo}`);
  process.exit(2);
}
const svg = readFileSync(file, "utf8");
const rev = opt("--rev", svg.match(/<svg\b[^>]*\bdata-rev="([^"]+)"/)?.[1] ?? null);
const windowLines = Number(opt("--window", 12));

const git = (...a) => spawnSync("git", ["-C", repo, ...a], { encoding: "utf8", maxBuffer: 64 << 20 });
const cache = new Map();
function lines(path) {
  if (cache.has(path)) return cache.get(path);
  let text = null;
  if (rev) {
    const r = git("show", `${rev}:${path}`);
    if (r.status === 0) text = r.stdout;
    else {
      const top = git("rev-parse", "--show-prefix");
      if (top.status === 0 && top.stdout.trim()) {
        const r2 = git("show", `${rev}:${top.stdout.trim()}${path}`);
        if (r2.status === 0) text = r2.stdout;
      }
    }
  } else if (existsSync(join(repo, path))) text = readFileSync(join(repo, path), "utf8");
  const out = text == null ? null : text.split("\n");
  cache.set(path, out);
  return out;
}

const refs = [];
for (const m of svg.matchAll(/<[a-zA-Z][\w:.-]*\b[^>]*\bdata-src\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/g)) {
  const sm = m[0].match(/\bdata-symbol\s*=\s*(?:"([^"]+)"|'([^']+)')/);
  refs.push({ src: m[1] ?? m[2], sym: sm ? sm[1] ?? sm[2] : null });
}
const rawCount = (svg.match(/\bdata-src\s*=/g) ?? []).length;
const problems = [];
if (!refs.length) problems.push("no data-src attributes found; every station needs one");
if (rawCount !== refs.length) problems.push(`${rawCount - refs.length} data-src attributes could not be parsed`);
for (const { src, sym } of refs) {
  const mm = src.match(/^(.+?)(?::|#L)(\d+)(?:-L?(\d+))?$/);
  if (!mm) {
    problems.push(`data-src "${src}" is not path:line`);
    continue;
  }
  const [, path, a, b] = mm;
  const L = lines(path);
  if (!L) {
    problems.push(`${src}: ${path} does not exist${rev ? ` at ${rev}` : ""}`);
    continue;
  }
  const n = Number(a);
  const end = b ? Number(b) : n;
  if (n < 1 || end > L.length || end < n) {
    problems.push(`${src}: lines ${n}${b ? `-${end}` : ""} are outside 1-${L.length} or reversed`);
    continue;
  }
  if (sym) {
    const leaf = sym.split(/::|\.|#/).pop();
    const lo = Math.max(0, n - 1 - windowLines), hi = Math.min(L.length, n + windowLines);
    if (!L.slice(lo, hi).some((l) => l.includes(leaf))) problems.push(`${src}: symbol ${sym} is not within ${windowLines} lines`);
  }
}
if (problems.length) {
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`sources: ${problems.length} unresolved of ${refs.length}`);
  process.exit(1);
}
console.log(`sources: 0 unresolved (${refs.length} checked${rev ? ` at ${rev}` : " in the working tree"})`);
