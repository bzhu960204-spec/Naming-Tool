import type { Workbook } from "../ooxml/workbook.js";

/**
 * Turns the "DropDown - DO NOT EDIT" sheet's multi-column named ranges into
 * engine lookup tables (used as VLOOKUP data sources). Each lookup id is
 * `${rangeName}#${colIndex}` and maps the range's first column to the requested
 * column, mirroring `VLOOKUP(key, range, colIndex, FALSE)`.
 */

const DROPDOWN_SHEET = "DropDown - DO NOT EDIT";

interface Range {
  c1: string;
  r1: number;
  c2: string;
  r2: number;
}

function parseRange(ref: string): Range | null {
  const m = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(ref);
  if (!m) return null;
  return { c1: m[1]!, r1: Number(m[2]!), c2: m[3]!, r2: Number(m[4]!) };
}

function colNum(c: string): number {
  let n = 0;
  for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function colName(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export interface DropdownLookups {
  lookups: Record<string, Record<string, string>>;
  /** Resolve VLOOKUP(tableName, colIndex) to a registered lookup id, or null. */
  resolveLookupTable(tableName: string, colIndex: number): string | null;
}

export function buildDropdownLookups(wb: Workbook): DropdownLookups {
  const lookups: Record<string, Record<string, string>> = {};
  const sheet = wb.getSheet(DROPDOWN_SHEET);

  // Defined-name (upper) -> its range on the DropDown sheet (width >= 2 columns).
  const ranges = new Map<string, { name: string; range: Range }>();
  if (sheet) {
    for (const dn of wb.definedNames) {
      if (dn.sheet !== DROPDOWN_SHEET) continue;
      const range = parseRange(dn.ref);
      if (!range) continue;
      if (colNum(range.c2) <= colNum(range.c1)) continue; // need >= 2 columns
      ranges.set(dn.name.toUpperCase(), { name: dn.name, range });
    }
  }

  const build = (name: string, range: Range, col: number): string => {
    const id = `${name}#${col}`;
    if (lookups[id]) return id;
    const valCol = colName(colNum(range.c1) + col - 1);
    const table: Record<string, string> = {};
    for (let r = range.r1; r <= range.r2; r++) {
      const key = sheet!.text(`${range.c1}${r}`).trim();
      if (!key) continue;
      table[key] = sheet!.text(`${valCol}${r}`);
    }
    lookups[id] = table;
    return id;
  };

  // Eagerly expose the recognised lookup tables (names ending in Lookup/VLOOKUP)
  // so ruleset.lookups is populated and inspectable; others build on demand.
  for (const { name, range } of ranges.values()) {
    if (/lookup$/i.test(name)) build(name, range, 2);
  }

  const resolveLookupTable = (tableName: string, colIndex: number): string | null => {
    const hit = ranges.get(tableName.toUpperCase());
    if (!hit) return null;
    const width = colNum(hit.range.c2) - colNum(hit.range.c1) + 1;
    if (colIndex < 1 || colIndex > width) return null;
    return build(hit.name, hit.range, colIndex);
  };

  return { lookups, resolveLookupTable };
}
