import { test } from "node:test";
import assert from "node:assert/strict";
import { calc, tokenize, toRpn } from "./calc.js";

test("2*(3+4) is 14", () => assert.equal(calc("2*(3+4)"), 14));

test("rpn of 2*(3+4)", () => {
  assert.deepEqual(toRpn(tokenize("2*(3+4)")).map((t) => t.text), ["2", "3", "4", "+", "*"]);
});

test("rejects a stray character", () => assert.throws(() => tokenize("2$"), /unexpected '\$' at 1/));
