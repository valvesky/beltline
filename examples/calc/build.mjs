import { factory } from "../../kit/beltline.mjs";

const F = factory({
  title: "calc.js — one expression from text to number",
  subtitle: "Static walkthrough of calc.js using the input from calc.test.js. Not a recording.",
  desc: "A tokenizer cuts \"2*(3+4)\" into tokens, toRpn reorders them with an operator stack, and evaluate runs them on a value stack to print 14. A second trace shows \"2$\" rejected with a SyntaxError.",
  repo: "examples/calc",
  cols: 48,
  rows: 12,
});

F.machine("argv", { kind: "dock", at: [1, 2], label: "argv[2]", src: "calc.js:57", cellW: 58, cells: ["2*(3+4)"] })
  .machine("tokenize", { kind: "cutter", at: [6, 2], label: "tokenize()", src: "calc.js:1", symbol: "tokenize" })
  .machine("tokens", { kind: "rack", at: [12, 2], label: "tokens[]", src: "calc.js:2", cells: ["", "", "", "", "", "", ""], pointers: { i: 0 } })
  .machine("toRpn", { kind: "press", at: [23, 2], label: "toRpn()", src: "calc.js:22", symbol: "toRpn" })
  .machine("out", { kind: "rack", at: [30, 2], label: "out[]", src: "calc.js:23", cells: ["", "", "", "", ""] })
  .machine("evaluate", { kind: "press", at: [39, 2], label: "evaluate()", src: "calc.js:40", symbol: "evaluate" })
  .machine("stdout", { kind: "dock", at: [45, 2], w: 48, cellW: 32, label: "stdout", src: "calc.js:57", cells: [""] })
  .machine("ops", { kind: "stack", at: [24, 7], label: "ops[]", src: "calc.js:24", cells: ["", "", ""] })
  .machine("stack", { kind: "stack", at: [40, 7], label: "stack[]", src: "calc.js:41", cells: ["", "", ""] })
  .machine("stderr", { kind: "dock", at: [6, 8], label: "stderr", src: "calc.js:59" });

F.belt("argv", "tokenize")
  .belt("tokenize", "tokens")
  .belt("tokens", "toRpn")
  .belt("toRpn", "out")
  .belt("out", "evaluate")
  .belt("evaluate", "stdout")
  .belt("toRpn", "ops")
  .belt("ops", "toRpn")
  .belt("evaluate", "stack")
  .belt("stack", "evaluate")
  .belt("tokenize", "stderr", { label: "no branch matches" });

F.step({ belt: "argv->tokenize", item: "\"2*(3+4)\"", at: "tokenize", caption: "the expression enters tokenize() as one string", src: "calc.js:57" })
  .step({ belt: "tokenize->tokens", item: "7 tokens", writes: { tokens: [[0, "2"], [1, "*"], [2, "("], [3, "3"], [4, "+"], [5, "4"], [6, ")"]] }, caption: "digit runs become num tokens, + - * / ( ) become op tokens", src: "calc.js:10" })
  .step({ belt: "tokens->toRpn", item: "2", at: "toRpn", caption: "toRpn() walks tokens[] one at a time", src: "calc.js:25" })
  .step({ belt: "toRpn->out", item: "2", writes: { out: [[0, "2"]] }, caption: "a num goes straight to out[]", src: "calc.js:26" })
  .step({ belt: "toRpn->ops", item: "*", pointers: { tokens: { i: 1 } }, writes: { ops: [[0, "*"]] }, caption: "* finds ops[] empty and waits there", src: "calc.js:33" })
  .step({ belt: "toRpn->ops", item: "(", pointers: { tokens: { i: 2 } }, writes: { ops: [[1, "("]] }, caption: "( is pushed as a fence", src: "calc.js:27" })
  .step({ belt: "toRpn->out", item: "3", pointers: { tokens: { i: 3 } }, writes: { out: [[1, "3"]] }, caption: "3 goes to out[]", src: "calc.js:26" })
  .step({ belt: "toRpn->ops", item: "+", pointers: { tokens: { i: 4 } }, writes: { ops: [[2, "+"]] }, caption: "+ is pushed: ( on top has no precedence, so nothing pops", src: "calc.js:32" })
  .step({ belt: "toRpn->out", item: "4", pointers: { tokens: { i: 5 } }, writes: { out: [[2, "4"]] }, caption: "4 goes to out[]", src: "calc.js:26" })
  .step({ belt: "ops->toRpn", item: "+", pointers: { tokens: { i: 6 } }, writes: { ops: [[2, ""], [1, ""]] }, caption: ") pops + back out and drops the ( fence", src: "calc.js:29" })
  .step({ belt: "toRpn->out", item: "+", writes: { out: [[3, "+"]] }, caption: "+ lands in out[]", src: "calc.js:29" })
  .step({ belt: "ops->toRpn", item: "*", writes: { ops: [[0, ""]] }, caption: "input is done, so ops[] drains: *", src: "calc.js:36" })
  .step({ belt: "toRpn->out", item: "*", writes: { out: [[4, "*"]] }, caption: "out[] now holds 2 3 4 + * in postfix order", src: "calc.js:36" })
  .step({ belt: "out->evaluate", item: "2 3 4 + *", at: "evaluate", caption: "evaluate() reads out[] left to right", src: "calc.js:42" })
  .step({ belt: "evaluate->stack", item: "2 3 4", writes: { stack: [[0, "2"], [1, "3"], [2, "4"]] }, caption: "each num is pushed onto stack[]", src: "calc.js:43" })
  .step({ belt: "stack->evaluate", item: "3 4", writes: { stack: [[2, ""], [1, "7"]] }, caption: "+ pops 4 and 3 and pushes 7", src: "calc.js:46" })
  .step({ belt: "stack->evaluate", item: "2 7", writes: { stack: [[1, ""], [0, "14"]] }, caption: "* pops 7 and 2 and pushes 14", src: "calc.js:46" })
  .step({ belt: "evaluate->stdout", item: "14", writes: { stack: [[0, ""]], stdout: [[0, "14"]] }, caption: "the last pop is printed: 14", src: "calc.js:48" })
  .trace("reject")
  .step({ belt: "argv->tokenize", item: "\"2$\"", at: "tokenize", writes: { argv: [[0, "2$"]] }, caption: "\"2$\": 2 is cut, then $ matches no branch", src: "calc.js:15" })
  .step({ belt: "tokenize->stderr", item: "SyntaxError", caption: "SyntaxError \"unexpected '$' at 1\" is printed and the process exits 1", src: "calc.js:59" });

F.ledger([
  { subsystem: "tokenizer", station: "tokenize", src: "calc.js:1", example: "\"2*(3+4)\" and \"2$\"" },
  { subsystem: "shunting-yard", station: "toRpn", src: "calc.js:22", example: "2*(3+4) to 2 3 4 + *" },
  { subsystem: "stack machine", station: "evaluate", src: "calc.js:40", example: "2 3 4 + * to 14" },
  { subsystem: "cli", station: "argv", src: "calc.js:55", example: "node calc.js '2*(3+4)'" },
]);

F.build(new URL("./beltline.svg", import.meta.url).pathname);
