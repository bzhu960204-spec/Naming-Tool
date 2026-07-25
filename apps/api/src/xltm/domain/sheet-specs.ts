/**
 * Declarative table of the "gated" worksheets whose names are switched on/off by
 * the Selection toggles. Each spec tells the generic importer where the emitted
 * names live (which columns hold formulas), which columns hold the human label,
 * and which rows to read. The on/off gating is already baked into every formula
 * (an outer IF on the Selection toggle), so no extra `when` is needed.
 */

export interface SheetSpec {
  /** Worksheet display name. */
  sheet: string;
  /** Category shown in the UI / grouped results. */
  category: string;
  /** Columns whose cells hold the emitted name formula (e.g. ["B"] or ["D","E"]). */
  formulaCols: string[];
  /** Columns tried in order for a human label (first non-empty text wins). */
  labelCols: string[];
  /** Inclusive [firstRow, lastRow] to scan. */
  rows: [number, number];
  /** Optional per-formula-column suffix (e.g. { D: "DEV", E: "TEST" }). */
  colLabels?: Record<string, string>;
  /** Label to use when no label cell has text. */
  fallbackLabel?: string;
  /** Bare cell reference -> engine field key, for formulas reading free cells. */
  cellRefs?: Record<string, string>;
}

export const SHEET_SPECS: SheetSpec[] = [
  {
    sheet: "Encoding",
    category: "Encoding code lists",
    formulaCols: ["B"],
    labelCols: ["A"],
    rows: [1, 11],
  },
  {
    sheet: "Control Number",
    category: "Control numbers",
    formulaCols: ["B"],
    labelCols: ["A"],
    rows: [2, 2],
    fallbackLabel: "Control Number Name",
    cellRefs: { A2: "controlNumberMessageType" },
  },
  {
    sheet: "SI HTTP URI settings",
    category: "SI HTTP URI adapter",
    formulaCols: ["B", "C"],
    labelCols: ["A"],
    rows: [13, 20],
    colLabels: { B: "Node1", C: "Node2" },
  },
  {
    sheet: "Mail client adapter settings",
    category: "Mail client adapter",
    formulaCols: ["D", "E", "F", "G"],
    labelCols: ["C", "B"],
    rows: [10, 44],
    colLabels: { D: "DEV", E: "TEST", F: "QA", G: "PROD" },
  },
  {
    sheet: "SFTP Server SSH Keys",
    category: "SFTP server SSH keys",
    formulaCols: ["D"],
    labelCols: ["C", "B"],
    rows: [7, 12],
  },
  {
    sheet: "Virtual roots",
    category: "Virtual roots",
    formulaCols: ["D"],
    labelCols: ["C", "B"],
    rows: [4, 5],
  },
  {
    sheet: "Routing rules",
    category: "Routing rules",
    formulaCols: ["D"],
    labelCols: ["C", "B"],
    rows: [5, 11],
  },
];
