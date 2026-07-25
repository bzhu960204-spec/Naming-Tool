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
    case "lookup": {
      const table = ctx.lookups[expr.table] ?? {};
      const key = evalExpr(expr.key, ctx);
      const hit = table[key];
      if (hit !== undefined) return hit;
      return expr.fallback !== undefined ? evalExpr(expr.fallback, ctx) : "";
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
