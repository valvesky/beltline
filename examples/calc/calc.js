export function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " ") { i++; continue; }
    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < src.length && src[j] >= "0" && src[j] <= "9") j++;
      tokens.push({ kind: "num", text: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/()".includes(c)) { tokens.push({ kind: "op", text: c }); i++; continue; }
    throw new SyntaxError(`unexpected '${c}' at ${i}`);
  }
  return tokens;
}

const PREC = { "+": 1, "-": 1, "*": 2, "/": 2 };

export function toRpn(tokens) {
  const out = [];
  const ops = [];
  for (const t of tokens) {
    if (t.kind === "num") out.push(t);
    else if (t.text === "(") ops.push(t);
    else if (t.text === ")") {
      while (ops.length && ops.at(-1).text !== "(") out.push(ops.pop());
      ops.pop();
    } else {
      while (ops.length && PREC[ops.at(-1).text] >= PREC[t.text]) out.push(ops.pop());
      ops.push(t);
    }
  }
  while (ops.length) out.push(ops.pop());
  return out;
}

export function evaluate(rpn) {
  const stack = [];
  for (const t of rpn) {
    if (t.kind === "num") { stack.push(Number(t.text)); continue; }
    const b = stack.pop();
    const a = stack.pop();
    stack.push(t.text === "+" ? a + b : t.text === "-" ? a - b : t.text === "*" ? a * b : a / b);
  }
  return stack.pop();
}

export function calc(src) {
  return evaluate(toRpn(tokenize(src)));
}

if (import.meta.main) {
  try {
    console.log(calc(process.argv[2] ?? ""));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
