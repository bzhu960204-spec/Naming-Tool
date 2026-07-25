/**
 * Core types for the config-driven naming engine.
 *
 * A `Ruleset` fully describes a naming domain as DATA:
 *   - `fields`  : the inputs a user fills in (mirrors the Excel "Master data" inputs)
 *   - `lookups` : reference tables (mirrors the Excel "DropDown - DO NOT EDIT" sheet)
 *   - `outputs` : generated names, each an expression tree that mirrors the Excel
 *                 CONCATENATE / IF / ISBLANK / OR / VLOOKUP formulas.
 *
 * Because rulesets are data, most future changes (new message-type codes, new
 * output patterns, new conditional segments) are edits to a ruleset — no code change.
 */

/** An expression that evaluates to a string. A bare string is a literal. */
export type Expr =
  | string
  | { kind: "var"; key: string }
  | { kind: "concat"; parts: Expr[] }
  | { kind: "upper"; value: Expr }
  | { kind: "lower"; value: Expr }
  | { kind: "if"; cond: Cond; then: Expr; else: Expr }
  | { kind: "lookup"; table: string; key: Expr; fallback?: Expr };

/** A boolean condition (mirrors Excel IF/OR/AND/ISBLANK). */
export type Cond =
  | { kind: "isBlank"; key: string }
  | { kind: "notBlank"; key: string }
  | { kind: "eq"; left: Expr; right: Expr }
  | { kind: "neq"; left: Expr; right: Expr }
  | { kind: "and"; parts: Cond[] }
  | { kind: "or"; parts: Cond[] }
  | { kind: "not"; cond: Cond };

export type FieldType = "text" | "select" | "boolean" | "number";

export interface FieldOption {
  value: string;
  label?: string;
}

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  group?: string;
  required?: boolean;
  options?: FieldOption[];
  default?: string;
  placeholder?: string;
  help?: string;
  /** When present, the field is only shown/collected if this condition is true. */
  showWhen?: Cond;
}

export interface OutputDef {
  key: string;
  label: string;
  category: string;
  expr: Expr;
  /** Source worksheet this name comes from, used to group results like Excel tabs. */
  section?: string;
  /** When present, the output is only produced if this condition is true. */
  when?: Cond;
  note?: string;
}

export interface Ruleset {
  id: string;
  name: string;
  /** Human-facing version label, e.g. "63" or "2026.07". */
  version: string;
  description?: string;
  fields: Field[];
  lookups: Record<string, Record<string, string>>;
  outputs: OutputDef[];
}

export interface GeneratedName {
  key: string;
  label: string;
  category: string;
  section?: string;
  value: string;
  note?: string;
}

export interface EvalContext {
  values: Record<string, string>;
  lookups: Record<string, Record<string, string>>;
}
