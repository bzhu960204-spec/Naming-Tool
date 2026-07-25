import { readEntries, readZipFile, type ZipEntry } from "./zip.js";
import { parseSharedStrings, parseSheetCells, unescapeXml, type Cell } from "./xml.js";

/**
 * Loaded workbook object model. Ties the ZIP + XML layers together and exposes
 * lazily-parsed sheets, shared strings, and defined names — the raw material the
 * DSV domain layer turns into a ruleset. Sheets are parsed on first access and
 * cached.
 */

/** A workbook-level named range, e.g. `ConfigureAS2 = 'Selection'!$B$9`. */
export interface DefinedName {
  name: string;
  /** Sheet the range lives on (unquoted), or null when it could not be parsed. */
  sheet: string | null;
  /** The cell/range reference part, e.g. `$B$9` or `$O$2:$O$5` or `#REF!`. */
  ref: string;
  /** The original right-hand side, kept for diagnostics. */
  raw: string;
}

export interface Sheet {
  name: string;
  cells: Map<string, Cell>;
  /** Resolved display text of a cell (shared-string aware); "" when empty. */
  text(ref: string): string;
}

export class Workbook {
  private sheetCache = new Map<string, Sheet | null>();

  private constructor(
    private buf: Buffer,
    private entries: Map<string, ZipEntry>,
    readonly sharedStrings: string[],
    readonly definedNames: DefinedName[],
    private nameToRid: Map<string, string>,
    private ridToTarget: Map<string, string>,
  ) {}

  static load(buf: Buffer): Workbook {
    const entries = readEntries(buf);
    const workbookXml = readZipFile(buf, entries, "xl/workbook.xml");
    const relsXml = readZipFile(buf, entries, "xl/_rels/workbook.xml.rels");
    if (!workbookXml || !relsXml)
      throw new Error("Missing workbook parts — not an Excel file?");

    // sheet name -> r:id
    const nameToRid = new Map<string, string>();
    const sheetRe = /<sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g;
    let sm: RegExpExecArray | null;
    while ((sm = sheetRe.exec(workbookXml))) nameToRid.set(unescapeXml(sm[1]!), sm[2]!);

    // r:id -> worksheets/sheetN.xml
    const ridToTarget = new Map<string, string>();
    const relRe = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g;
    let rm: RegExpExecArray | null;
    while ((rm = relRe.exec(relsXml))) ridToTarget.set(rm[1]!, rm[2]!);

    const sharedStrings = parseSharedStrings(
      readZipFile(buf, entries, "xl/sharedStrings.xml"),
    );
    const definedNames = parseDefinedNames(workbookXml);

    return new Workbook(buf, entries, sharedStrings, definedNames, nameToRid, ridToTarget);
  }

  get sheetNames(): string[] {
    return [...this.nameToRid.keys()];
  }

  hasSheet(name: string): boolean {
    return this.nameToRid.has(name);
  }

  /** Parse (and cache) a sheet by its display name. Returns null if absent. */
  getSheet(name: string): Sheet | null {
    if (this.sheetCache.has(name)) return this.sheetCache.get(name)!;
    const sheet = this.loadSheet(name);
    this.sheetCache.set(name, sheet);
    return sheet;
  }

  private loadSheet(name: string): Sheet | null {
    const rid = this.nameToRid.get(name);
    if (!rid) return null;
    const target = this.ridToTarget.get(rid);
    if (!target) return null;
    const path = "xl/" + target.replace(/^\/?xl\//, "").replace(/^\//, "");
    const xml =
      readZipFile(this.buf, this.entries, path) ??
      readZipFile(this.buf, this.entries, "xl/" + target);
    if (!xml) return null;

    const cells = parseSheetCells(xml);
    const shared = this.sharedStrings;
    const text = (ref: string): string => {
      const c = cells.get(ref);
      if (!c || c.value === undefined) return "";
      return c.isString ? shared[Number(c.value)] ?? "" : c.value;
    };
    return { name, cells, text };
  }
}

function parseDefinedNames(workbookXml: string): DefinedName[] {
  const out: DefinedName[] = [];
  const re = /<definedName\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/definedName>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(workbookXml))) {
    const name = unescapeXml(m[1]!);
    const raw = unescapeXml(m[2]!).trim();
    // Sheet names cannot contain "!", so the first "!" always separates the
    // sheet qualifier from the reference (e.g. `'Master data'!#REF!`).
    const bang = raw.indexOf("!");
    let sheet: string | null = null;
    let ref = raw;
    if (bang >= 0) {
      let s = raw.slice(0, bang);
      ref = raw.slice(bang + 1);
      if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1).replace(/''/g, "'");
      sheet = s || null;
    }
    out.push({ name, sheet, ref, raw });
  }
  return out;
}
