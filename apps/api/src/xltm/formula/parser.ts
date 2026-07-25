import type { Cond, Expr } from "@dsv/naming-engine";
import { UnsupportedError, tokenize, type Tok } from "./tokenizer.js";
import type { ResolveContext } from "./resolve.js";
import { camel } from "../text.js";

/**
 * Recursive-descent compiler from the Excel formula subset used by the DSV
 * workbook (CONCATENATE / CONCAT / IF / ISBLANK / OR / AND / NOT / UPPER / LOWER
 * / TRIM / & / = / <> / VLOOKUP / IFNA / IFERROR) into the engine's Expr/Cond
 * model. Defined-name and VLOOKUP-table resolution is delegated to an injected
 * ResolveContext so this compiler stays domain-independent; anything outside the
 * subset throws UnsupportedError so the caller can report it as a warning.
 */

export interface CompileOptions {
  /** Bare cell reference (e.g. "A41") -> engine field key, for formulas that
   *  reference free input cells (the Business Process rows). */
  cellRefs?: Record<string, string>;
  /** Resolves defined names and VLOOKUP tables (supplied by the domain layer). */
  ctx?: ResolveContext;
}

class Parser {
  private pos = 0;
  readonly unmapped = new Set<string>();
  private readonly cellRefs: Record<string, string>;
  private readonly ctx: ResolveContext | undefined;
  constructor(private toks: Tok[], opts: CompileOptions = {}) {
    this.cellRefs = opts.cellRefs ?? {};
    this.ctx = opts.ctx;
  }

  private peek(n = 0): Tok | undefined {
    return this.toks[this.pos + n];
  }
  private next(): Tok {
    const t = this.toks[this.pos];
    if (!t) throw new UnsupportedError("Unexpected end of formula");
    this.pos++;
    return t;
  }
  private isOp(v: string, n = 0): boolean {
    const t = this.peek(n);
    return !!t && t.t === "op" && t.v === v;
  }
  private consumeOp(v: string): boolean {
    if (this.isOp(v)) {
      this.pos++;
      return true;
    }
    return false;
  }
  private expectOp(v: string): void {
    if (!this.consumeOp(v)) throw new UnsupportedError(`Expected '${v}'`);
  }

  parse(): Expr {
    const e = this.parseValue();
    if (this.pos !== this.toks.length) throw new UnsupportedError("Trailing tokens");
    return e;
  }

  private parseValue(): Expr {
    let left = this.parsePrimary();
    while (this.isOp("&")) {
      this.next();
      const right = this.parsePrimary();
      left = { kind: "concat", parts: flat(left).concat(flat(right)) };
    }
    return left;
  }

  private parsePrimary(): Expr {
    const t = this.next();
    if (t.t === "str") return t.v;
    if (t.t === "num") return t.v;
    if (t.t === "op" && t.v === "(") {
      const e = this.parseValue();
      this.expectOp(")");
      return e;
    }
    if (t.t === "name") {
      if (this.isOp("(")) return this.parseFunction(t.v);
      return this.nameToExpr(t.v);
    }
    throw new UnsupportedError(`Unexpected token '${t.v}'`);
  }

  private parseFunction(rawName: string): Expr {
    this.expectOp("(");
    const fn = rawName.replace(/^_xlfn\./i, "").toUpperCase();
    switch (fn) {
      case "CONCATENATE":
      case "CONCAT": {
        const parts: Expr[] = [];
        if (!this.isOp(")")) {
          do parts.push(this.parseValue());
          while (this.consumeOp(","));
        }
        this.expectOp(")");
        return { kind: "concat", parts };
      }
      case "IF": {
        const cond = this.parseCond();
        this.expectOp(",");
        const thenE = this.parseValue();
        let elseE: Expr = "";
        if (this.consumeOp(",")) elseE = this.parseValue();
        this.expectOp(")");
        return { kind: "if", cond, then: thenE, else: elseE };
      }
      case "UPPER": {
        const v = this.parseValue();
        this.expectOp(")");
        return { kind: "upper", value: v };
      }
      case "LOWER": {
        const v = this.parseValue();
        this.expectOp(")");
        return { kind: "lower", value: v };
      }
      case "TRIM": {
        const v = this.parseValue();
        this.expectOp(")");
        return v;
      }
      case "VLOOKUP": {
        const key = this.parseValue();
        this.expectOp(",");
        const tbl = this.next();
        if (tbl.t !== "name")
          throw new UnsupportedError("VLOOKUP table must be a named range");
        this.expectOp(",");
        const idx = this.next();
        if (idx.t !== "num")
          throw new UnsupportedError("VLOOKUP column index must be a literal");
        if (this.consumeOp(",")) this.parseValue(); // optional range_lookup flag
        this.expectOp(")");
        const table = this.ctx?.resolveLookupTable(tbl.v, Number(idx.v)) ?? null;
        if (!table) throw new UnsupportedError(`Unknown VLOOKUP table '${tbl.v}'`);
        return { kind: "lookup", table, key };
      }
      case "IFNA":
      case "IFERROR": {
        const primary = this.parseValue();
        this.expectOp(",");
        const alt = this.parseValue();
        this.expectOp(")");
        // The engine has no error concept; when wrapping a lookup use the second
        // argument as the lookup fallback, otherwise keep the primary value.
        if (typeof primary === "object" && primary.kind === "lookup")
          return { ...primary, fallback: alt };
        return primary;
      }
      default:
        throw new UnsupportedError(`Unsupported function ${fn}`);
    }
  }

  private parseCond(): Cond {
    let c = this.parseCondPrimary();
    // Fold trailing "= TRUE" / "= FALSE" / "<> TRUE" / "<> FALSE" (common in the
    // sheet, e.g. ISBLANK(x)=TRUE) into the boolean rather than a value compare.
    while (this.isOp("=") || this.isOp("<>")) {
      const save = this.pos;
      const op = this.next().v;
      const rhs = this.parseValue();
      const rv = typeof rhs === "string" ? rhs.toUpperCase() : "";
      if (rv === "TRUE" || rv === "FALSE") {
        const truthy = rv === "TRUE";
        if ((op === "=" && !truthy) || (op === "<>" && truthy)) c = { kind: "not", cond: c };
      } else {
        this.pos = save;
        throw new UnsupportedError("Unsupported comparison after boolean expression");
      }
    }
    return c;
  }

  private parseCondPrimary(): Cond {
    const t = this.peek();
    if (t && t.t === "name" && this.isOp("(", 1)) {
      const fn = t.v.toUpperCase();
      if (fn === "OR" || fn === "AND" || fn === "NOT" || fn === "ISBLANK") {
        this.next();
        this.expectOp("(");
        if (fn === "ISBLANK") {
          const val = this.parseValue();
          this.expectOp(")");
          if (typeof val === "object" && val.kind === "var")
            return { kind: "isBlank", key: val.key };
          throw new UnsupportedError("ISBLANK on non-field");
        }
        if (fn === "NOT") {
          const c = this.parseCond();
          this.expectOp(")");
          return { kind: "not", cond: c };
        }
        const parts: Cond[] = [];
        if (!this.isOp(")")) {
          do parts.push(this.parseCond());
          while (this.consumeOp(","));
        }
        this.expectOp(")");
        return { kind: fn === "OR" ? "or" : "and", parts };
      }
    }
    const left = this.parseValue();
    if (this.isOp("=") || this.isOp("<>")) {
      const op = this.next().v;
      const right = this.parseValue();
      const boolCmp = booleanCompare(left, op, right);
      if (boolCmp) return boolCmp;
      return op === "="
        ? { kind: "eq", left, right }
        : { kind: "neq", left, right };
    }
    throw new UnsupportedError("Unsupported boolean expression");
  }

  private nameToExpr(name: string): Expr {
    if (/[!:]/.test(name)) throw new UnsupportedError(`External/range reference '${name}'`);
    if (/^\$?[A-Z]{1,3}\$?\d+$/.test(name)) {
      const ref = name.replace(/\$/g, "").toUpperCase();
      const mapped = this.cellRefs[ref];
      if (mapped) return { kind: "var", key: mapped };
      throw new UnsupportedError(`Bare cell reference '${name}'`);
    }
    const upper = name.toUpperCase().replace(/\$/g, "");
    if (upper === "TRUE") return "TRUE";
    if (upper === "FALSE") return "FALSE";
    const resolved = this.ctx?.resolveName(name) ?? null;
    if (resolved !== null) return resolved;
    this.unmapped.add(name);
    return { kind: "var", key: camel(name) };
  }
}

function flat(e: Expr): Expr[] {
  if (typeof e === "object" && e.kind === "concat") return e.parts;
  return [e];
}

/**
 * Normalize an Excel comparison against the boolean literals TRUE/FALSE into a
 * truthy condition on the field (`eq(field, "true")`). Excel's `C41=FALSE` on a
 * checkbox cell means "unchecked", which maps to the engine's boolean field value
 * `"true"`/`"false"`. Returns null when neither side is a boolean literal, so a
 * normal string equality is used instead.
 */
function booleanCompare(left: Expr, op: string, right: Expr): Cond | null {
  const isBoolLit = (e: Expr): "TRUE" | "FALSE" | null =>
    typeof e === "string" && (e === "TRUE" || e === "FALSE") ? e : null;
  const lb = isBoolLit(left);
  const rb = isBoolLit(right);
  let field: Expr;
  let lit: "TRUE" | "FALSE";
  if (rb && !lb) {
    field = left;
    lit = rb;
  } else if (lb && !rb) {
    field = right;
    lit = lb;
  } else {
    return null;
  }
  const truthy: Cond = { kind: "eq", left: field, right: "true" };
  // op "=" TRUE or op "<>" FALSE  => field is truthy; otherwise negate.
  const wantTruthy = (op === "=") === (lit === "TRUE");
  return wantTruthy ? truthy : { kind: "not", cond: truthy };
}

export function compileFormula(
  src: string,
  opts: CompileOptions = {},
): { expr: Expr; unmapped: string[] } {
  const cleaned = src.replace(/^=/, "");
  const parser = new Parser(tokenize(cleaned), opts);
  const expr = parser.parse();
  return { expr, unmapped: [...parser.unmapped] };
}
