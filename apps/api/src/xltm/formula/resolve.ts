import type { Expr } from "@dsv/naming-engine";

/**
 * Injected resolution strategy for the formula compiler, so the `formula/` layer
 * stays domain-independent. The DSV domain layer supplies an implementation that
 * knows the workbook's defined names, Selection toggles, and DropDown lookup
 * tables.
 */
export interface ResolveContext {
  /**
   * Resolve a defined-name token (e.g. "ConfigureAS2", "PartnerDesignation") to
   * an engine expression. Return null when unknown, so the compiler records it as
   * unmapped and falls back to a camelCase variable.
   */
  resolveName(name: string): Expr | null;

  /**
   * Resolve a VLOOKUP table name + 1-based column index to a lookup-table id
   * registered in the ruleset's `lookups`. Return null when the table is unknown.
   */
  resolveLookupTable(tableName: string, colIndex: number): string | null;
}
