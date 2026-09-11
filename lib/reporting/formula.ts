import type { BaseMetrics } from "./types";

/**
 * Evaluates the restricted arithmetic expressions stored in
 * reporting.metric_definitions.formula — e.g. "spend / conversions".
 *
 * Deliberately not eval(): definitions are data an analyst can edit, so the
 * grammar is limited to numbers, the four base metric names, + - * / and
 * parentheses. Anything else throws, and division by zero yields null (an
 * undefined metric, not Infinity).
 */
const IDENTIFIERS = [
  "spend",
  "impressions",
  "clicks",
  "conversions",
] as const;

type Token =
  | { type: "number"; value: number }
  | { type: "ident"; value: string }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" };

export class FormulaError extends Error {}

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const char = formula[i];

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      i += 1;
      continue;
    }
    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "op", value: char });
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const match = /^[0-9]*\.?[0-9]+/.exec(formula.slice(i));
      if (!match) {
        throw new FormulaError(`Malformed number in formula: "${formula}"`);
      }
      tokens.push({ type: "number", value: Number(match[0]) });
      i += match[0].length;
      continue;
    }
    if (/[a-z_]/i.test(char)) {
      const match = /^[a-z_][a-z0-9_]*/i.exec(formula.slice(i))!;
      const name = match[0].toLowerCase();
      if (!IDENTIFIERS.includes(name as (typeof IDENTIFIERS)[number])) {
        throw new FormulaError(
          `Unknown metric "${name}" in formula "${formula}". Allowed: ${IDENTIFIERS.join(", ")}.`
        );
      }
      tokens.push({ type: "ident", value: name });
      i += match[0].length;
      continue;
    }

    throw new FormulaError(`Unexpected character "${char}" in formula "${formula}".`);
  }

  return tokens;
}

/**
 * Recursive-descent over: expr := term (("+"|"-") term)*,
 * term := factor (("*"|"/") factor)*, factor := number | ident | "(" expr ")" | "-" factor.
 * A null anywhere (undefined division) propagates to the result.
 */
function parse(tokens: Token[], metrics: BaseMetrics, formula: string): number | null {
  let pos = 0;

  const peek = () => tokens[pos];

  function factor(): number | null {
    const token = peek();
    if (!token) throw new FormulaError(`Unexpected end of formula "${formula}".`);

    if (token.type === "op" && token.value === "-") {
      pos += 1;
      const value = factor();
      return value === null ? null : -value;
    }
    if (token.type === "number") {
      pos += 1;
      return token.value;
    }
    if (token.type === "ident") {
      pos += 1;
      return metrics[token.value as keyof BaseMetrics] ?? 0;
    }
    if (token.type === "paren" && token.value === "(") {
      pos += 1;
      const value = expr();
      const closing = peek();
      if (!closing || closing.type !== "paren" || closing.value !== ")") {
        throw new FormulaError(`Unbalanced parentheses in formula "${formula}".`);
      }
      pos += 1;
      return value;
    }
    throw new FormulaError(`Unexpected token in formula "${formula}".`);
  }

  function term(): number | null {
    let left = factor();
    for (;;) {
      const token = peek();
      if (!token || token.type !== "op" || (token.value !== "*" && token.value !== "/")) {
        return left;
      }
      pos += 1;
      const right = factor();
      if (left === null || right === null) {
        left = null;
        continue;
      }
      if (token.value === "/") {
        left = right === 0 ? null : left / right;
      } else {
        left = left * right;
      }
    }
  }

  function expr(): number | null {
    let left = term();
    for (;;) {
      const token = peek();
      if (!token || token.type !== "op" || (token.value !== "+" && token.value !== "-")) {
        return left;
      }
      pos += 1;
      const right = term();
      if (left === null || right === null) {
        left = null;
        continue;
      }
      left = token.value === "+" ? left + right : left - right;
    }
  }

  const result = expr();
  if (pos !== tokens.length) {
    throw new FormulaError(`Trailing tokens in formula "${formula}".`);
  }
  return result;
}

/** Returns null when the metric is undefined for these totals (e.g. CPA with 0 conversions). */
export function evaluateFormula(formula: string, metrics: BaseMetrics): number | null {
  return parse(tokenize(formula), metrics, formula);
}
