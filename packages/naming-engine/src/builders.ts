import type { Cond, Expr } from "./types.js";

/** Readable builder helpers for authoring output expressions (keeps rulesets concise). */

export const v = (key: string): Expr => ({ kind: "var", key });

export const concat = (...parts: Expr[]): Expr => ({ kind: "concat", parts });

export const upper = (value: Expr): Expr => ({ kind: "upper", value });

export const lower = (value: Expr): Expr => ({ kind: "lower", value });

export const iff = (cond: Cond, thenE: Expr, elseE: Expr): Expr => ({
  kind: "if",
  cond,
  then: thenE,
  else: elseE,
});

export const lookup = (table: string, key: Expr, fallback?: Expr): Expr => ({
  kind: "lookup",
  table,
  key,
  ...(fallback !== undefined ? { fallback } : {}),
});

export const isBlank = (key: string): Cond => ({ kind: "isBlank", key });

export const notBlank = (key: string): Cond => ({ kind: "notBlank", key });

export const eq = (left: Expr, right: Expr): Cond => ({ kind: "eq", left, right });

export const neq = (left: Expr, right: Expr): Cond => ({ kind: "neq", left, right });

export const and = (...parts: Cond[]): Cond => ({ kind: "and", parts });

export const or = (...parts: Cond[]): Cond => ({ kind: "or", parts });

export const not = (cond: Cond): Cond => ({ kind: "not", cond });
