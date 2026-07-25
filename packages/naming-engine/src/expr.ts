import type { Cond, EvalContext, Expr } from "./types.js";

/** Returns true for empty string or whitespace-only (mirrors Excel ISBLANK on trimmed text input). */
function isBlankValue(v: string | undefined): boolean {
  return v === undefined || v.trim() === "";
}

export function evalExpr(expr: Expr, ctx: EvalContext): string {
  if (typeof expr === "string") return expr;

  switch (expr.kind) {
    case "var":
      return ctx.values[expr.key] ?? "";
    case "concat":
      return expr.parts.map((p) => evalExpr(p, ctx)).join("");
    case "upper":
      return evalExpr(expr.value, ctx).toUpperCase();
    case "lower":
      return evalExpr(expr.value, ctx).toLowerCase();
    case "if":
      return evalCond(expr.cond, ctx)
        ? evalExpr(expr.then, ctx)
        : evalExpr(expr.else, ctx);
    default:
      return evalTextFn(expr, ctx);
  }
}

/** Leaf text/number/lookup primitives (split out of evalExpr to keep it simple). */
function evalTextFn(
  expr: Exclude<Expr, string | { kind: "var" | "concat" | "upper" | "lower" | "if" }>,
  ctx: EvalContext,
): string {
  switch (expr.kind) {
    case "lookup": {
      const table = ctx.lookups[expr.table] ?? {};
      const key = evalExpr(expr.key, ctx);
      const hit = table[key];
      if (hit !== undefined) return hit;
      return expr.fallback !== undefined ? evalExpr(expr.fallback, ctx) : "";
    }
    case "find": {
      // Excel FIND is 1-based and errors when not found; callers wrap it in
      // IFERROR(...,0), so an absent match returns the fallback ("0" / "").
      const needle = evalExpr(expr.needle, ctx);
      const idx = evalExpr(expr.haystack, ctx).indexOf(needle);
      if (idx >= 0) return String(idx + 1);
      return expr.fallback !== undefined ? evalExpr(expr.fallback, ctx) : "";
    }
    case "replace": {
      // Excel REPLACE(text, start, count, newText): 1-based start, replace
      // `count` chars with newText.
      const text = evalExpr(expr.text, ctx);
      const start = Number(evalExpr(expr.start, ctx));
      const count = Number(evalExpr(expr.count, ctx));
      if (!Number.isFinite(start) || !Number.isFinite(count)) return text;
      const from = start - 1;
      return text.slice(0, from) + evalExpr(expr.newText, ctx) + text.slice(from + count);
    }
    case "join": {
      const parts = expr.parts.map((p) => evalExpr(p, ctx));
      const kept = expr.skipBlank ? parts.filter((s) => s !== "") : parts;
      return kept.join(expr.delim);
    }
    default:
      return evalSliceFn(expr, ctx);
  }
}

/** Number-driven text primitives: left/right/rept/len/arith. */
function evalSliceFn(
  expr: Extract<Expr, { kind: "left" | "right" | "rept" | "len" | "arith" }>,
  ctx: EvalContext,
): string {
  switch (expr.kind) {
    case "left": {
      const n = Number(evalExpr(expr.count, ctx));
      const text = evalExpr(expr.text, ctx);
      return Number.isFinite(n) ? text.slice(0, Math.max(0, n)) : text;
    }
    case "right": {
      const n = Number(evalExpr(expr.count, ctx));
      const text = evalExpr(expr.text, ctx);
      if (!Number.isFinite(n)) return text;
      return n <= 0 ? "" : text.slice(Math.max(0, text.length - n));
    }
    case "rept": {
      const n = Number(evalExpr(expr.count, ctx));
      const text = evalExpr(expr.text, ctx);
      return Number.isFinite(n) && n > 0 ? text.repeat(Math.floor(n)) : "";
    }
    case "len":
      return String(evalExpr(expr.value, ctx).length);
    case "arith": {
      const l = Number(evalExpr(expr.left, ctx));
      const r = Number(evalExpr(expr.right, ctx));
      if (!Number.isFinite(l) || !Number.isFinite(r)) return "";
      return String(expr.op === "+" ? l + r : l - r);
    }
    default: {
      // Exhaustiveness guard
      const _never: never = expr;
      return _never;
    }
  }
}

export function evalCond(cond: Cond, ctx: EvalContext): boolean {
  switch (cond.kind) {
    case "isBlank":
      return isBlankValue(ctx.values[cond.key]);
    case "notBlank":
      return !isBlankValue(ctx.values[cond.key]);
    case "eq":
      return evalExpr(cond.left, ctx) === evalExpr(cond.right, ctx);
    case "neq":
      return evalExpr(cond.left, ctx) !== evalExpr(cond.right, ctx);
    case "gt": {
      const l = Number(evalExpr(cond.left, ctx));
      const r = Number(evalExpr(cond.right, ctx));
      return Number.isFinite(l) && Number.isFinite(r) && l > r;
    }
    case "and":
      return cond.parts.every((p) => evalCond(p, ctx));
    case "or":
      return cond.parts.some((p) => evalCond(p, ctx));
    case "not":
      return !evalCond(cond.cond, ctx);
    default: {
      const _never: never = cond;
      return _never;
    }
  }
}
