/**
 * Façade for the .xltm importer. The implementation is split under this folder:
 *   ooxml/   — ZIP + XML + Workbook reading (dependency-free)
 *   formula/ — Excel formula tokenizer + compiler
 *   domain/  — DSV-specific ruleset builder
 * Keeping this entry point stable means route code imports from one place.
 */
export {
  parseXltmToRuleset,
  type XltmImportResult,
} from "./domain/build-ruleset.js";
export { compileFormula } from "./formula/parser.js";
export { Workbook, type Sheet, type DefinedName } from "./ooxml/workbook.js";
