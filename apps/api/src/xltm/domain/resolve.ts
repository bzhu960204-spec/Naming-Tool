import type { Expr } from "@dsv/naming-engine";
import type { Workbook } from "../ooxml/workbook.js";
import type { ResolveContext } from "../formula/resolve.js";
import { compileFormula } from "../formula/parser.js";
import { lowerFirst } from "../text.js";

/**
 * Builds the DSV-specific ResolveContext for the formula compiler. A defined name
 * resolves to one of three things:
 *   - a curated engine field key (Master-data aliases like PartnerDesignation ->
 *     partnerCode),
 *   - the compiled expression of the cell it points to, when that cell holds a
 *     FORMULA (e.g. UserAccount = 'User accounts'!D5, PartnerTypeRootMailbox =
 *     Mailboxes!D5) — this lets one sheet reference another sheet's computed value,
 *   - a literal, when it points to a constant cell on the "DropDown" reference
 *     sheet,
 *   - otherwise a plain engine variable `var(lowerFirst(name))` (a user input such
 *     as a Selection toggle, EmailUser, UseSSL, PartnerType, …).
 */

/** Curated defined-name -> engine field key, where the key is not just camelCase. */
const FIELD_MAP: Record<string, string> = {
  RITMNUMBER: "ritmNumber",
  PARTNERDESIGNATION: "partnerCode",
  RESOLVEDPARTNERID: "resolvedPartnerId",
  TYPEOFMAP: "typeOfMap",
  PARTNERNAME: "partnerName",
  PARTNERENCODING: "partnerEncoding",
};

const DROPDOWN_SHEET = "DropDown - DO NOT EDIT";

/** "$D$5" / "D5" -> "D5"; ranges / #REF! -> null. */
function singleCellRef(ref: string): string | null {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref.trim());
  return m ? `${m[1]}${m[2]}` : null;
}

export function buildDsvResolver(
  wb: Workbook,
  resolveLookupTable: (tableName: string, colIndex: number) => string | null,
): ResolveContext {
  // upper-cased defined name -> its DefinedName entry (canonical spelling + target)
  const byUpper = new Map<string, (typeof wb.definedNames)[number]>();
  for (const dn of wb.definedNames) byUpper.set(dn.name.toUpperCase(), dn);

  // Guards against a computed name that (directly or transitively) references
  // itself while it is being expanded.
  const expanding = new Set<string>();

  const ctx: ResolveContext = {
    resolveName(name: string): Expr | null {
      const upper = name.replace(/\$/g, "").toUpperCase();
      const mapped = FIELD_MAP[upper];
      if (mapped) return { kind: "var", key: mapped };

      const dn = byUpper.get(upper);
      if (!dn) return null;

      const cellRef = dn.sheet ? singleCellRef(dn.ref) : null;
      if (cellRef && dn.sheet) {
        const sheet = wb.getSheet(dn.sheet);
        const cell = sheet?.cells.get(cellRef);
        if (cell?.formula) {
          // Computed cell on another sheet: inline its compiled expression.
          if (expanding.has(upper)) return null; // cycle -> give up (falls back)
          expanding.add(upper);
          try {
            return compileFormula(cell.formula, { ctx }).expr;
          } catch {
            return null;
          } finally {
            expanding.delete(upper);
          }
        }
        if (dn.sheet === DROPDOWN_SHEET) {
          // Constant reference value (e.g. MailClientAdapterCACertificates).
          return sheet?.text(cellRef) ?? "";
        }
      }

      // Plain user input.
      return { kind: "var", key: lowerFirst(dn.name) };
    },
    resolveLookupTable,
  };
  return ctx;
}

