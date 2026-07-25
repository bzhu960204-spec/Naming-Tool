/**
 * SpreadsheetML XML helpers: unescape, shared-strings, and per-sheet cell
 * parsing. Deliberately regex-based (no XML dependency) — the parts we read are
 * simple and well-formed, and this keeps the importer dependency-free.
 */

export function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

export function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const block = m[1] ?? "";
    let text = "";
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let t: RegExpExecArray | null;
    while ((t = tRe.exec(block))) text += unescapeXml(t[1] ?? "");
    out.push(text);
  }
  return out;
}

export interface Cell {
  formula?: string;
  value?: string;
  isString?: boolean;
}

export function parseSheetCells(xml: string): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  // Match both self-closing empty cells (<c r="A2"/>) and cells with content
  // (<c r="B14">…</c>). Handling the self-closing form is essential — otherwise a
  // greedy match swallows following cells and corrupts row associations.
  const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m: RegExpExecArray | null;
  while ((m = cRe.exec(xml))) {
    const attrs = m[1] ?? "";
    const inner = m[2] ?? "";
    const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
    if (!ref) continue;
    const isString = /\bt="s"/.test(attrs);
    const f = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(inner)?.[1];
    const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1];
    const cell: Cell = {};
    if (f !== undefined) cell.formula = unescapeXml(f);
    if (v !== undefined) cell.value = unescapeXml(v);
    if (isString) cell.isString = true;
    cells.set(ref, cell);
  }
  return cells;
}

export function colOf(ref: string): string {
  return ref.replace(/\d+/g, "");
}

export function rowOf(ref: string): number {
  return Number(ref.replace(/[A-Z]+/g, ""));
}
