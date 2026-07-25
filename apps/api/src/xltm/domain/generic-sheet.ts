import type { OutputDef } from "@dsv/naming-engine";
import type { Workbook } from "../ooxml/workbook.js";
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
  const outputs: OutputDef[] = [];
  const warnings: string[] = [];

  for (const spec of SHEET_SPECS) {
    const sheet = wb.getSheet(spec.sheet);
    if (!sheet) {
      warnings.push(`Sheet "${spec.sheet}" not found; skipped.`);
      continue;
    }
    const multiCol = spec.formulaCols.length > 1;

    for (let r = spec.rows[0]; r <= spec.rows[1]; r++) {
      const baseLabel = pickLabel(sheet.text.bind(sheet), spec, r);
      for (const col of spec.formulaCols) {
        const cell = sheet.cells.get(`${col}${r}`);
        if (!cell?.formula) continue;

        const suffix = multiCol ? ` (${spec.colLabels?.[col] ?? col})` : "";
        const label = baseLabel + suffix;
        try {
          const { expr } = compileFormula(cell.formula, {
            cellRefs: spec.cellRefs,
            ctx,
          });
          const key = uniqueKey(`${spec.sheet} ${label}`, r, col, usedKeys);
          outputs.push({ key, label, category: spec.category, section: spec.sheet, expr });
        } catch (e) {
          warnings.push(
            `${spec.sheet} ${col}${r} "${label}": could not compile (${(e as Error).message}). Skipped.`,
          );
        }
      }
    }
  }

  return { outputs, warnings };
}

function pickLabel(
  text: (ref: string) => string,
  spec: SheetSpec,
  row: number,
): string {
  for (const col of spec.labelCols) {
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
