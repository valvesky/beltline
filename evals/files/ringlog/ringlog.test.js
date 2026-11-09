import { test } from "node:test";
import assert from "node:assert/strict";
import { RingLog } from "./ringlog.js";

test("a full ring flushes its oldest line to the sink", () => {
  const out = [];
  const log = new RingLog(3, (l) => out.push(l));
  for (const l of ["boot", "load", "ready", "tick"]) log.write(l);
  assert.deepEqual(out, ["boot"]);
  assert.equal(log.head, 1);
  assert.equal(log.tail, 1);
  log.flush();
  assert.deepEqual(out, ["boot", "load", "ready", "tick"]);
});
