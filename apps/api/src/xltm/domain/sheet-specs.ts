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
  /** Per-formula-column override of `labelCols` (e.g. Mailboxes col I labels in H). */
  labelColsByCol?: Record<string, string[]>;
  /** Inclusive [firstRow, lastRow] to scan. */
  rows: [number, number];
  /** Optional per-formula-column suffix (e.g. { D: "DEV", E: "TEST" }). Only the
   *  columns present here get a suffix; others are emitted without one. */
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
  {
    // Config values for the partner's SI user account (all gated by PartnerType).
    sheet: "User accounts",
    category: "User account",
    formulaCols: ["D"],
    labelCols: ["C", "B"],
    rows: [4, 18],
  },
  {
    // LW FW Base + Child Identity values. B1 (OrgNameType) is a free input cell
    // read by the C1 VLOOKUP; the emitted values live in column B.
    sheet: "Identities",
    category: "LW FW Identities",
    formulaCols: ["B"],
    labelCols: ["A"],
    rows: [5, 27],
    cellRefs: { B1: "orgNameType" },
  },
  {
    // Four AS2 profile blocks (D13/74/135/196 message types). Column D = value,
    // column E = TEST-specific value. Gated by ConfigureAS2 inside each formula.
    sheet: "AS2",
    category: "AS2",
    formulaCols: ["D", "E"],
    labelCols: ["C", "B"],
    rows: [18, 257],
    colLabels: { E: "Test" },
  },
  {
    // Mailbox trees. Column D = main mailbox value (labels in C); column I = the
    // parallel Inbox-History mailbox (labels in H). Gated by ConfigureMailboxes
    // and a non-blank PartnerType inside each formula.
    sheet: "Mailboxes",
    category: "Mailboxes",
    formulaCols: ["D", "I"],
    labelCols: ["C", "B"],
    labelColsByCol: { I: ["H", "G"] },
    rows: [5, 250],
    colLabels: { I: "History" },
  },
  {
    // HTTP(S) client profile config values. D = Production, E = Test.
    sheet: "HTTP(S) Client profiles",
    category: "HTTP client profiles",
    formulaCols: ["D", "E"],
    labelCols: ["C", "B"],
    rows: [16, 65],
    colLabels: { E: "Test" },
  },
  {
    // The "Rename Profile" name lives in columns A (Prod) / B (Test) at row 36.
    sheet: "HTTP(S) Client profiles",
    category: "HTTP client profiles",
    formulaCols: ["A", "B"],
    labelCols: [],
    rows: [36, 36],
    fallbackLabel: "Rename Profile Name",
    colLabels: { A: "Prod", B: "Test" },
  },
  {
    // FTP client — two profiles. D = Production value, E = Test value; profile
    // and BP names are computed in column D. Gated inside each formula on the
    // required inputs being present.
    sheet: "FTP Client",
    category: "FTP client profiles",
    formulaCols: ["D", "E"],
    labelCols: ["C", "B"],
    rows: [15, 132],
    colLabels: { E: "Test" },
  },
  {
    // SFTP client — two profiles, same layout as FTP.
    sheet: "SFTP Client",
    category: "SFTP client profiles",
    formulaCols: ["D", "E"],
    labelCols: ["C", "B"],
    rows: [15, 132],
    colLabels: { E: "Test" },
  },
  {
    // Source ID Lookup code-list values (Sender/Receiver codes). C2/C3 read the
    // destination-id helper cell E3 (default "DSV").
    sheet: "Source ID lookup",
    category: "Source ID lookup",
    formulaCols: ["C"],
    labelCols: ["A"],
    rows: [2, 3],
    cellRefs: { E3: "sourceIdDestinationId" },
  },
];