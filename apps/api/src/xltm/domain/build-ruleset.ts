import { dsvEdiRuleset, mapNameOutputs } from "@dsv/naming-engine";
import type { OutputDef, Ruleset } from "@dsv/naming-engine";
import { Workbook } from "../ooxml/workbook.js";
import { rowOf } from "../ooxml/xml.js";
import { compileFormula } from "../formula/parser.js";
import { buildDropdownLookups } from "./lookups.js";
import { buildDsvResolver } from "./resolve.js";
import { importGatedSheets } from "./generic-sheet.js";
import { camel, normLabel } from "../text.js";

/**
 * Turns a loaded workbook into a DSV ruleset. Currently imports the
 * "Resource and file naming" sheet (including the Business Process rows that use
 * bare input-cell references). Additional sheets are added in later phases via
 * their own importer modules under this folder.
 */

export interface XltmImportResult {
  ruleset: Ruleset;
  warnings: string[];
  compiledCount: number;
}

const NAMING_SHEET = "Resource and file naming";

export function parseXltmToRuleset(
  buf: Buffer,
  opts: { version?: string; active?: Ruleset | null } = {},
): XltmImportResult {
  const warnings: string[] = [];
  const wb = Workbook.load(buf);

  // DropDown lookup tables + the defined-name/VLOOKUP resolver for the compiler.
  const { lookups, resolveLookupTable } = buildDropdownLookups(wb);
  const ctx = buildDsvResolver(wb, resolveLookupTable);

  const sheet = wb.getSheet(NAMING_SHEET);
  if (!sheet) throw new Error(`Worksheet "${NAMING_SHEET}" not found in workbook.`);
  const { cells } = sheet;
  const cellText = sheet.text;

  const rows = new Set<number>();
  for (const ref of cells.keys()) rows.add(rowOf(ref));

  // Align to active ruleset by label so re-imports keep stable keys/categories.
  const activeByLabel = new Map<string, { key: string; category: string }>();
  for (const o of opts.active?.outputs ?? [])
    activeByLabel.set(normLabel(o.label), { key: o.key, category: o.category });

  const outputs: OutputDef[] = [];
  const usedKeys = new Set<string>();
  const unmappedNames = new Set<string>();
  const bpSeen = new Set<string>();
  let compiled = 0;

  for (const r of [...rows].sort((a, b) => a - b)) {
    const bCell = cells.get(`B${r}`);
    if (!bCell?.formula) continue;
    const formula = bCell.formula;

    // Business Process rows reference free input cells (A{r}/C{r}) instead of
    // named ranges, and have no label in column A. Map those cells to the engine's
    // BP fields and collapse the repeated input slots into a single output each.
    let label = cellText(`A${r}`).trim();
    let cellRefs: Record<string, string> = {};
    if (/DSV_BP_/.test(formula)) {
      const isPlugin = /_plugin/i.test(formula);
      const bpKind = isPlugin ? "bpPlugin" : "businessProcess";
      if (bpSeen.has(bpKind)) continue;
      bpSeen.add(bpKind);
      cellRefs = { [`A${r}`]: "bpFunctionName", [`C${r}`]: "bpPartnerSpecific" };
      label = isPlugin ? "BP Plugin name" : "Business process name";
    } else if (!label) {
      continue;
    }

    try {
      const { expr, unmapped } = compileFormula(formula, { cellRefs, ctx });
      unmapped.forEach((u) => unmappedNames.add(u));
      const aligned = activeByLabel.get(normLabel(label));
      let key = aligned?.key ?? camel(label);
      if (usedKeys.has(key)) key = `${key}_${r}`;
      usedKeys.add(key);
      outputs.push({
        key,
        label,
        category: aligned?.category ?? "Imported (Resource & file naming)",
        section: NAMING_SHEET,
        expr,
      });
      compiled++;
    } catch (e) {
      warnings.push(
        `Row ${r} "${label}": could not compile formula (${(e as Error).message}). Skipped.`,
      );
    }
  }

  if (unmappedNames.size > 0) {
    warnings.push(
      `Unmapped named ranges (kept as camelCase fields): ${[...unmappedNames].join(", ")}.`,
    );
  }
  if (compiled === 0) {
    throw new Error(
      `No naming formulas could be compiled from "${NAMING_SHEET}". Is this the DSV EDI Naming Tool workbook?`,
    );
  }

  // Import the Selection-gated sheets (Encoding, Control Number, SI HTTP URI,
  // Mail client adapter, SSH keys, Virtual roots, Routing rules).
  const gated = importGatedSheets(wb, ctx, usedKeys);
  outputs.push(...gated.outputs);
  warnings.push(...gated.warnings);

  // ITX & SI map names have no cell formula (the VBA builds them at run time),
  // so append them from the transcribed algorithm, wired to the real lookup ids.
  appendMapNameOutputs(outputs, usedKeys, resolveLookupTable, warnings);

  const ruleset: Ruleset = {
    id: dsvEdiRuleset.id,
    name: dsvEdiRuleset.name,
    version: opts.version?.trim() || `imported-${new Date().toISOString().slice(0, 19)}`,
    description: `Imported from spreadsheet on ${new Date().toISOString()}. ${outputs.length} outputs compiled.`,
    fields: dsvEdiRuleset.fields,
    lookups,
    outputs,
  };

  return { ruleset, warnings, compiledCount: outputs.length };
}

/** Append the transcribed ITX/SI map-name outputs, resolving their lookup ids. */
function appendMapNameOutputs(
  outputs: OutputDef[],
  usedKeys: Set<string>,
  resolveLookupTable: (name: string, col: number) => string | null,
  warnings: string[],
): void {
  const msgTable = resolveLookupTable("MessageTypeLookup", 2);
  const sysTable = resolveLookupTable("DSVSystemITXLookup", 2);
  if (!msgTable || !sysTable) {
    warnings.push(
      "Map-name lookups (MessageTypeLookup / DSVSystemITXLookup) not found; ITX/SI map names skipped.",
    );
    return;
  }
  for (const o of mapNameOutputs(msgTable, sysTable)) {
    if (usedKeys.has(o.key)) continue;
    usedKeys.add(o.key);
    outputs.push(o);
  }
}
