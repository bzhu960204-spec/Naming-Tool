import type { Ruleset } from "@dsv/naming-engine";

export interface FieldChange {
  key: string;
  label: string;
}
export interface OutputChange {
  key: string;
  label: string;
}

export interface RulesetDiff {
  fieldsAdded: FieldChange[];
  fieldsRemoved: FieldChange[];
  fieldsChanged: FieldChange[];
  outputsAdded: OutputChange[];
  outputsRemoved: OutputChange[];
  /** Output whose label/category/note changed but expression did NOT. */
  outputsMetaChanged: OutputChange[];
  /** Output whose generation expression (logic) changed. */
  outputsLogicChanged: OutputChange[];
  lookupsAdded: string[];
  lookupsRemoved: string[];
  lookupsChanged: string[];
}

export type UpdateClass = "data-only" | "logic-change" | "structural";

export interface Preflight {
  classification: UpdateClass;
  /** True when the change can be self-served without a developer. */
  selfServe: boolean;
  summary: string;
  diff: RulesetDiff;
}

function keyed<T extends { key: string }>(arr: T[]): Map<string, T> {
  return new Map(arr.map((x) => [x.key, x]));
}

function exprOf(o: { expr: unknown; when?: unknown }): string {
  return JSON.stringify({ expr: o.expr, when: o.when ?? null });
}

function metaOf(o: { label: string; category: string; note?: string }): string {
  return JSON.stringify({ label: o.label, category: o.category, note: o.note ?? null });
}

export function diffRulesets(oldR: Ruleset, newR: Ruleset): RulesetDiff {
  const of = keyed(oldR.fields);
  const nf = keyed(newR.fields);
  const oo = keyed(oldR.outputs);
  const no = keyed(newR.outputs);

  const fieldsAdded: FieldChange[] = [];
  const fieldsRemoved: FieldChange[] = [];
  const fieldsChanged: FieldChange[] = [];
  for (const [k, f] of nf) {
    if (!of.has(k)) fieldsAdded.push({ key: k, label: f.label });
    else if (JSON.stringify(of.get(k)) !== JSON.stringify(f))
      fieldsChanged.push({ key: k, label: f.label });
  }
  for (const [k, f] of of) {
    if (!nf.has(k)) fieldsRemoved.push({ key: k, label: f.label });
  }

  const outputsAdded: OutputChange[] = [];
  const outputsRemoved: OutputChange[] = [];
  const outputsMetaChanged: OutputChange[] = [];
  const outputsLogicChanged: OutputChange[] = [];
  for (const [k, o] of no) {
    const prev = oo.get(k);
    if (!prev) {
      outputsAdded.push({ key: k, label: o.label });
    } else if (exprOf(prev) !== exprOf(o)) {
      outputsLogicChanged.push({ key: k, label: o.label });
    } else if (metaOf(prev) !== metaOf(o)) {
      outputsMetaChanged.push({ key: k, label: o.label });
    }
  }
  for (const [k, o] of oo) {
    if (!no.has(k)) outputsRemoved.push({ key: k, label: o.label });
  }

  const oldTables = new Set(Object.keys(oldR.lookups));
  const newTables = new Set(Object.keys(newR.lookups));
  const lookupsAdded = [...newTables].filter((t) => !oldTables.has(t));
  const lookupsRemoved = [...oldTables].filter((t) => !newTables.has(t));
  const lookupsChanged = [...newTables].filter(
    (t) =>
      oldTables.has(t) &&
      JSON.stringify(oldR.lookups[t]) !== JSON.stringify(newR.lookups[t]),
  );

  return {
    fieldsAdded,
    fieldsRemoved,
    fieldsChanged,
    outputsAdded,
    outputsRemoved,
    outputsMetaChanged,
    outputsLogicChanged,
    lookupsAdded,
    lookupsRemoved,
    lookupsChanged,
  };
}

/**
 * Classify an update into one of three tiers (see the plan's "three-tier update model"):
 *  - data-only  : only lookups / field options / labels changed  -> safe self-serve.
 *  - logic-change: an output expression changed, or a field added/changed -> review recommended.
 *  - structural : outputs or fields added/removed -> developer review.
 */
export function preflight(oldR: Ruleset, newR: Ruleset): Preflight {
  const diff = diffRulesets(oldR, newR);

  const structural =
    diff.outputsAdded.length > 0 ||
    diff.outputsRemoved.length > 0 ||
    diff.fieldsAdded.length > 0 ||
    diff.fieldsRemoved.length > 0;

  const logic = diff.outputsLogicChanged.length > 0 || diff.fieldsChanged.length > 0;

  let classification: UpdateClass;
  if (structural) classification = "structural";
  else if (logic) classification = "logic-change";
  else classification = "data-only";

  const selfServe = classification === "data-only";

  const summary =
    classification === "data-only"
      ? "Data-only change (lookups / options / labels). Safe to activate without a developer."
      : classification === "logic-change"
        ? "An output expression or field definition changed. Review recommended before activating."
        : "Fields or outputs were added/removed. Developer review recommended.";

  return { classification, selfServe, summary, diff };
}
