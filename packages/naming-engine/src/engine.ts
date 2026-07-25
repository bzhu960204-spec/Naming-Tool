import { evalCond, evalExpr } from "./expr.js";
import type {
  Cond,
  EvalContext,
  Expr,
  Field,
  GeneratedName,
  Ruleset,
} from "./types.js";

export interface ValidationIssue {
  fieldKey: string;
  label: string;
  message: string;
}

function buildContext(ruleset: Ruleset, values: Record<string, string>): EvalContext {
  return { values, lookups: ruleset.lookups };
}

/**
 * The set of input field keys that a given set of outputs actually depends on.
 *
 * Every output is an expression tree; the fields it reads appear as
 * `{kind:"var", key}` nodes and as `isBlank/notBlank/eq/...` conditions. Walking
 * those trees yields the exact inputs needed to compute the selected outputs — no
 * hand-maintained mapping required. The result is transitively closed over field
 * `showWhen` conditions (a required field may itself be gated by another field).
 */
export function fieldsForOutputs(
  ruleset: Ruleset,
  outputKeys: ReadonlySet<string>,
): Set<string> {
  const deps = new Set<string>();

  for (const o of ruleset.outputs) {
    if (!outputKeys.has(o.key)) continue;
    collectExprFields(o.expr, deps);
    if (o.when) collectCondFields(o.when, deps);
  }

  closeOverShowWhen(ruleset.fields, deps);
  return deps;
}

/**
 * Expand `deps` in place so it also contains any field referenced by the
 * `showWhen` of a field already in `deps` (transitively).
 */
function closeOverShowWhen(fields: Field[], deps: Set<string>): void {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const seen = new Set<string>();
  let frontier = [...deps];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const key of frontier) {
      if (seen.has(key)) continue;
      seen.add(key);
      const showWhen = byKey.get(key)?.showWhen;
      if (!showWhen) continue;
      const before = deps.size;
      collectCondFields(showWhen, deps);
      if (deps.size !== before) next.push(...deps);
    }
    frontier = next;
  }
}

/** Collect the field keys read by an expression tree into `deps`. */
function collectExprFields(e: Expr, deps: Set<string>): void {
  if (typeof e === "string") return;
  switch (e.kind) {
    case "var":
      deps.add(e.key);
      return;
    case "concat":
    case "join":
      e.parts.forEach((p) => collectExprFields(p, deps));
      return;
    case "upper":
    case "lower":
    case "len":
      collectExprFields(e.value, deps);
      return;
    case "if":
      collectCondFields(e.cond, deps);
      collectExprFields(e.then, deps);
      collectExprFields(e.else, deps);
      return;
    case "lookup":
      collectExprFields(e.key, deps);
      if (e.fallback) collectExprFields(e.fallback, deps);
      return;
    case "find":
      collectExprFields(e.needle, deps);
      collectExprFields(e.haystack, deps);
      if (e.fallback) collectExprFields(e.fallback, deps);
      return;
    case "replace":
      collectExprFields(e.text, deps);
      collectExprFields(e.start, deps);
      collectExprFields(e.count, deps);
      collectExprFields(e.newText, deps);
      return;
    case "left":
    case "right":
    case "rept":
      collectExprFields(e.text, deps);
      collectExprFields(e.count, deps);
      return;
    case "arith":
      collectExprFields(e.left, deps);
      collectExprFields(e.right, deps);
      return;
  }
}

/** Collect the field keys referenced by a condition into `deps`. */
function collectCondFields(c: Cond, deps: Set<string>): void {
  switch (c.kind) {
    case "isBlank":
    case "notBlank":
      deps.add(c.key);
      return;
    case "eq":
    case "neq":
    case "gt":
      collectExprFields(c.left, deps);
      collectExprFields(c.right, deps);
      return;
    case "and":
    case "or":
      c.parts.forEach((p) => collectCondFields(p, deps));
      return;
    case "not":
      collectCondFields(c.cond, deps);
      return;
  }
}

/** Fields that are currently applicable given the entered values (respects `showWhen`). */
export function visibleFields(
  ruleset: Ruleset,
  values: Record<string, string>,
): Field[] {
  const ctx = buildContext(ruleset, values);
  return ruleset.fields.filter(
    (f) => !f.showWhen || evalCond(f.showWhen, ctx),
  );
}

/** Validate that visible + required fields are filled. */
export function validateInputs(
  ruleset: Ruleset,
  values: Record<string, string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const f of visibleFields(ruleset, values)) {
    if (f.required) {
      const val = values[f.key];
      if (val === undefined || val.trim() === "") {
        issues.push({
          fieldKey: f.key,
          label: f.label,
          message: `${f.label} is required.`,
        });
      }
    }
  }
  return issues;
}

/** Generate all applicable names for the given inputs. */
export function generateNames(
  ruleset: Ruleset,
  values: Record<string, string>,
): GeneratedName[] {
  const ctx = buildContext(ruleset, values);
  const results: GeneratedName[] = [];
  for (const out of ruleset.outputs) {
    if (out.when && !evalCond(out.when, ctx)) continue;
    results.push({
      key: out.key,
      label: out.label,
      category: out.category,
      ...(out.section !== undefined ? { section: out.section } : {}),
      value: evalExpr(out.expr, ctx),
      ...(out.note !== undefined ? { note: out.note } : {}),
    });
  }
  return results;
}

/** Group generated names by their category, preserving first-seen order. */
export function groupByCategory(
  names: GeneratedName[],
): { category: string; items: GeneratedName[] }[] {
  const order: string[] = [];
  const map = new Map<string, GeneratedName[]>();
  for (const n of names) {
    if (!map.has(n.category)) {
      map.set(n.category, []);
      order.push(n.category);
    }
    map.get(n.category)!.push(n);
  }
  return order.map((category) => ({ category, items: map.get(category)! }));
}
