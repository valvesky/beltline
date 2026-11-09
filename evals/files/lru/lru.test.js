import { test } from "node:test";
import assert from "node:assert/strict";
import { LRU } from "./lru.js";

test("evicts the least recently used key", () => {
  const c = new LRU(2);
  c.set("a", 1);
  c.set("b", 2);
  c.get("a");
  c.set("c", 3);
  assert.equal(c.get("b"), undefined);
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("c"), 3);
});
