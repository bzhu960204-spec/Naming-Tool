import { evalCond, evalExpr } from "./expr.js";
import type {
  EvalContext,
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
