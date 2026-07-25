import type { OutputDef } from "@dsv/naming-engine";
import type { Workbook, Sheet } from "../ooxml/workbook.js";
import type { ResolveContext } from "../formula/resolve.js";
import { compileFormula } from "../formula/parser.js";
import { camel } from "../text.js";
import { SHEET_SPECS, type SheetSpec } from "./sheet-specs.js";

/**
 * Imports the "gated" worksheets described by SHEET_SPECS. Every emitted-name
 * formula is compiled with the shared resolver (so Selection toggles, per-sheet
 * inputs and cross-sheet computed cells all resolve). The Selection gating is
 * already inside each formula, so the output simply evaluates to "" when its
 * sheet is switched off.
 */

export interface GatedImportResult {
  outputs: OutputDef[];
  warnings: string[];
}

export function importGatedSheets(
  wb: Workbook,
  ctx: ResolveContext,
  usedKeys: Set<string>,
): GatedImportResult {
  const result: GatedImportResult = { outputs: [], warnings: [] };

  for (const spec of SHEET_SPECS) {
    const sheet = wb.getSheet(spec.sheet);
    if (!sheet) {
      result.warnings.push(`Sheet "${spec.sheet}" not found; skipped.`);
      continue;
    }

    for (let r = spec.rows[0]; r <= spec.rows[1]; r++) {
      for (const col of spec.formulaCols) {
        emitCell(sheet, spec, r, col, ctx, usedKeys, result);
      }
    }
  }

  return result;
}

function emitCell(
  sheet: Sheet,
  spec: SheetSpec,
  row: number,
  col: string,
  ctx: ResolveContext,
  usedKeys: Set<string>,
  result: GatedImportResult,
): void {
  const cell = sheet.cells.get(`${col}${row}`);
  if (!cell?.formula) return;

  const labelCols = spec.labelColsByCol?.[col] ?? spec.labelCols;
  const baseLabel = pickLabel(sheet.text.bind(sheet), labelCols, spec, row);
  const cl = spec.colLabels?.[col];
  const label = cl ? `${baseLabel} (${cl})` : baseLabel;
  try {
    const { expr } = compileFormula(cell.formula, { cellRefs: spec.cellRefs, ctx });
    const key = uniqueKey(`${spec.sheet} ${label}`, row, col, usedKeys);
    result.outputs.push({
      key,
      label,
      category: spec.category,
      section: spec.sheet,
      expr,
    });
  } catch (e) {
    result.warnings.push(
      `${spec.sheet} ${col}${row} "${label}": could not compile (${(e as Error).message}). Skipped.`,
    );
  }
}

function pickLabel(
  text: (ref: string) => string,
  labelCols: string[],
  spec: SheetSpec,
  row: number,
): string {
  for (const col of labelCols) {
    const t = text(`${col}${row}`).replace(/\s+/g, " ").trim();
    if (t) return t;
  }
  return spec.fallbackLabel ?? `${spec.sheet} row ${row}`;
}

function uniqueKey(
  source: string,
  row: number,
  col: string,
  usedKeys: Set<string>,
): string {
  let key = camel(source);
  if (usedKeys.has(key)) key = `${key}_${col}${row}`;
  usedKeys.add(key);
  return key;
}
