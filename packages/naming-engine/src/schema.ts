import { z } from "zod";
import type { Cond, Expr, Ruleset } from "./types.js";

/** Zod schema for a Ruleset. Used to validate rulesets imported at runtime (e.g. from Excel). */

const exprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.union([
    z.string(),
    z.object({ kind: z.literal("var"), key: z.string() }),
    z.object({ kind: z.literal("concat"), parts: z.array(exprSchema) }),
    z.object({ kind: z.literal("upper"), value: exprSchema }),
    z.object({ kind: z.literal("lower"), value: exprSchema }),
    z.object({
      kind: z.literal("if"),
      cond: condSchema,
      then: exprSchema,
      else: exprSchema,
    }),
    z.object({
      kind: z.literal("lookup"),
      table: z.string(),
      key: exprSchema,
      fallback: exprSchema.optional(),
    }),
  ]),
);

const condSchema: z.ZodType<Cond> = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal("isBlank"), key: z.string() }),
    z.object({ kind: z.literal("notBlank"), key: z.string() }),
    z.object({ kind: z.literal("eq"), left: exprSchema, right: exprSchema }),
    z.object({ kind: z.literal("neq"), left: exprSchema, right: exprSchema }),
    z.object({ kind: z.literal("and"), parts: z.array(condSchema) }),
    z.object({ kind: z.literal("or"), parts: z.array(condSchema) }),
    z.object({ kind: z.literal("not"), cond: condSchema }),
  ]),
);

const fieldOptionSchema = z.object({
  value: z.string(),
  label: z.string().optional(),
});

const fieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "select", "boolean", "number"]),
  group: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(fieldOptionSchema).optional(),
  default: z.string().optional(),
  placeholder: z.string().optional(),
  help: z.string().optional(),
  showWhen: condSchema.optional(),
});

const outputSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  category: z.string().min(1),
  expr: exprSchema,
  when: condSchema.optional(),
  note: z.string().optional(),
});

export const rulesetSchema: z.ZodType<Ruleset> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(fieldSchema),
  lookups: z.record(z.record(z.string())),
  outputs: z.array(outputSchema),
});

export interface RulesetValidationResult {
  ok: boolean;
  errors: string[];
}

/** Validate a ruleset object plus cross-references (duplicate keys, unknown lookup tables). */
export function validateRuleset(input: unknown): RulesetValidationResult {
  const parsed = rulesetSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    };
  }
  const rs = parsed.data;
  const errors: string[] = [];

  const fieldKeys = new Set<string>();
  for (const f of rs.fields) {
    if (fieldKeys.has(f.key)) errors.push(`Duplicate field key: ${f.key}`);
    fieldKeys.add(f.key);
  }

  const outputKeys = new Set<string>();
  for (const o of rs.outputs) {
    if (outputKeys.has(o.key)) errors.push(`Duplicate output key: ${o.key}`);
    outputKeys.add(o.key);
  }

  const tableNames = new Set(Object.keys(rs.lookups));
  collectLookupTables(rs).forEach((t) => {
    if (!tableNames.has(t)) errors.push(`Output references unknown lookup table: ${t}`);
  });

  return { ok: errors.length === 0, errors };
}

function collectLookupTables(rs: Ruleset): Set<string> {
  const tables = new Set<string>();
  const walkExpr = (e: Expr): void => {
    if (typeof e === "string") return;
    switch (e.kind) {
      case "concat":
        e.parts.forEach(walkExpr);
        break;
      case "upper":
      case "lower":
        walkExpr(e.value);
        break;
      case "if":
        walkCond(e.cond);
        walkExpr(e.then);
        walkExpr(e.else);
        break;
      case "lookup":
        tables.add(e.table);
        walkExpr(e.key);
        if (e.fallback) walkExpr(e.fallback);
        break;
      default:
        break;
    }
  };
  const walkCond = (c: Cond): void => {
    switch (c.kind) {
      case "eq":
      case "neq":
        walkExpr(c.left);
        walkExpr(c.right);
        break;
      case "and":
      case "or":
        c.parts.forEach(walkCond);
        break;
      case "not":
        walkCond(c.cond);
        break;
      default:
        break;
    }
  };
  rs.outputs.forEach((o) => {
    walkExpr(o.expr);
    if (o.when) walkCond(o.when);
  });
  rs.fields.forEach((f) => {
    if (f.showWhen) walkCond(f.showWhen);
  });
  return tables;
}
