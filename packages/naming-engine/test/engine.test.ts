import { describe, expect, it } from "vitest";
import {
  dsvEdiRuleset,
  evalCond,
  evalExpr,
  fieldsForOutputs,
  generateNames,
  mapNameOutputs,
  validateInputs,
  validateRuleset,
  visibleFields,
} from "../src/index.js";
import type { GeneratedName } from "../src/index.js";

const v = (key: string) => ({ kind: "var" as const, key });

function byKey(names: GeneratedName[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n.key, n.value]));
}

const baseSi = {
  ritmNumber: "RITM1234567",
  partnerName: "Manticore",
  partnerCode: "MANTICORE",
  typeOfMap: "SI",
  resolvedPartnerId: "ABCDE",
};

describe("ruleset integrity", () => {
  it("is a valid ruleset", () => {
    const res = validateRuleset(dsvEdiRuleset);
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });
});

describe("fieldsForOutputs (result-oriented input filtering)", () => {
  it("derives only the inputs a selected output actually reads", () => {
    const deps = fieldsForOutputs(dsvEdiRuleset, new Set(["resourceTag"]));
    expect(deps.has("ritmNumber")).toBe(true);
    expect(deps.has("partnerCode")).toBe(true);
    // Business-process inputs are unrelated to the resource tag.
    expect(deps.has("bpFunctionName")).toBe(false);
  });

  it("collects fields referenced in an output's `when` and conditions", () => {
    const deps = fieldsForOutputs(dsvEdiRuleset, new Set(["businessProcess"]));
    expect(deps.has("bpFunctionName")).toBe(true);
    expect(deps.has("bpPartnerSpecific")).toBe(true);
    expect(deps.has("partnerCode")).toBe(true);
    // The RITM number is not part of the BP name.
    expect(deps.has("ritmNumber")).toBe(false);
  });

  it("unions dependencies across multiple selected outputs", () => {
    const one = fieldsForOutputs(dsvEdiRuleset, new Set(["resourceTag"]));
    const both = fieldsForOutputs(
      dsvEdiRuleset,
      new Set(["resourceTag", "businessProcess"]),
    );
    for (const k of one) expect(both.has(k)).toBe(true);
    expect(both.has("bpFunctionName")).toBe(true);
  });

  it("returns nothing when no outputs are selected", () => {
    expect(fieldsForOutputs(dsvEdiRuleset, new Set()).size).toBe(0);
  });
});

describe("SI naming outputs", () => {
  const out = byKey(generateNames(dsvEdiRuleset, baseSi));

  it("Resource Tag", () => {
    expect(out.resourceTag).toBe("DSV_RITM1234567_MANTICORE_0.1_rt");
  });

  it("Resource Tag export (no ITXA_ prefix for SI)", () => {
    expect(out.resourceTagExport).toBe("DSV_RITM1234567_MANTICORE_0.1_exp.xml");
  });

  it("SQL script + rollback", () => {
    expect(out.sqlScript).toBe("DSV_RITM1234567_MANTICORE_0.1_sql.sql");
    expect(out.sqlRollback).toBe(
      "DSV_RITM1234567_MANTICORE_ROLLBACK_0.1_sql.sql",
    );
  });

  it("Lightwell Framework export files", () => {
    expect(out.lwFwReceiveRule).toBe("DSV_RITM1234567_MANTICORE_0.1_frer.json");
    expect(out.lwFwSendRule).toBe("DSV_RITM1234567_MANTICORE_0.1_fser.json");
    expect(out.lwFwBpWebService).toBe(
      "DSV_RITM1234567_MANTICORE_0.1_fwsr.json",
    );
  });

  it("Source ID Lookup code list", () => {
    expect(out.sourceIdCodeList).toBe(
      "DSV_CL_SourceIDLookup_ABCDE_D10B_CDM_V2_cl",
    );
  });

  it("does not emit ITX-only outputs for SI", () => {
    expect(out.siMapDescription).toBeUndefined();
    expect(out.itxMapName).toBeUndefined();
  });
});

describe("ITX naming outputs", () => {
  const itx = {
    ...baseSi,
    typeOfMap: "ITX",
    sourceFormat: "E2C",
    sourceMsgTypeItx: "IFTMIN",
    sourceMsgTypeSi: "IFTMIN",
    sourceVersion: "D10B",
    destMsgTypeItx: "SHIPMENT",
    destMsgTypeSi: "MultStageImpMiss",
    destVersion: "V5",
  };
  const out = byKey(generateNames(dsvEdiRuleset, itx));

  it("Resource Tag is not required for ITX", () => {
    expect(out.resourceTag).toBe("RT not required for ITX resources");
  });

  it("Resource Tag export gets the ITXA_ prefix", () => {
    expect(out.resourceTagExport).toBe(
      "DSV_ITXA_RITM1234567_MANTICORE_0.1_exp.xml",
    );
  });
});

describe("business process naming", () => {
  it("non-partner-specific", () => {
    const out = byKey(
      generateNames(dsvEdiRuleset, {
        ...baseSi,
        bpFunctionName: "ArchiveDocument",
        bpPartnerSpecific: "false",
      }),
    );
    expect(out.businessProcess).toBe("DSV_BP_ArchiveDocument_bp");
    expect(out.bpPlugin).toBe("DSV_BP_ArchiveDocument_plugin_bp");
  });

  it("partner-specific", () => {
    const out = byKey(
      generateNames(dsvEdiRuleset, {
        ...baseSi,
        bpFunctionName: "ArchiveDocument",
        bpPartnerSpecific: "true",
      }),
    );
    expect(out.businessProcess).toBe(
      "DSV_BP_MANTICORE_ArchiveDocument_bp",
    );
  });

  it("is omitted when no function name is entered", () => {
    const out = byKey(generateNames(dsvEdiRuleset, baseSi));
    expect(out.businessProcess).toBeUndefined();
  });
});

describe("guards and validation", () => {
  it("shows the master-data warning when RITM/Partner missing", () => {
    const out = byKey(generateNames(dsvEdiRuleset, { typeOfMap: "SI" }));
    expect(out.resourceTag).toContain("Enter both the RITM/EDIT number");
  });

  it("flags missing required inputs", () => {
    const issues = validateInputs(dsvEdiRuleset, { typeOfMap: "SI" });
    const keys = issues.map((i) => i.fieldKey);
    expect(keys).toContain("ritmNumber");
    expect(keys).toContain("partnerCode");
  });

  it("hides ITX-only fields when type is SI", () => {
    const keys = visibleFields(dsvEdiRuleset, { typeOfMap: "SI" }).map(
      (f) => f.key,
    );
    expect(keys).not.toContain("destMsgTypeItx");
    expect(keys).toContain("destMsgTypeSi");
  });

  it("shows ITX-only fields when type is ITX", () => {
    const keys = visibleFields(dsvEdiRuleset, { typeOfMap: "ITX" }).map(
      (f) => f.key,
    );
    expect(keys).toContain("destMsgTypeItx");
  });
});

describe("expression primitives (FIND / REPLACE / LEFT / LEN / arith / gt)", () => {
  const ctx = { values: { login: "user@acme.com" }, lookups: {} };

  it("FIND returns a 1-based position, or its fallback when absent", () => {
    expect(evalExpr({ kind: "find", needle: "@", haystack: v("login") }, ctx)).toBe("5");
    expect(
      evalExpr({ kind: "find", needle: "?", haystack: v("login"), fallback: "0" }, ctx),
    ).toBe("0");
  });

  it("REPLACE swaps the @ with _at_ using FIND for the position", () => {
    const replaced = {
      kind: "replace" as const,
      text: v("login"),
      start: { kind: "find" as const, needle: "@", haystack: v("login") },
      count: "1",
      newText: "_at_",
    };
    expect(evalExpr(replaced, ctx)).toBe("user_at_acme.com");
  });

  it("LEFT truncates and LEN measures", () => {
    expect(evalExpr({ kind: "left", text: "abcdef", count: "3" }, ctx)).toBe("abc");
    expect(evalExpr({ kind: "len", value: v("login") }, ctx)).toBe("13");
  });

  it("arithmetic computes truncation lengths (64-(8+LEN(x)))", () => {
    const expr = {
      kind: "arith" as const,
      op: "-" as const,
      left: "64",
      right: { kind: "arith" as const, op: "+" as const, left: "8", right: { kind: "len" as const, value: v("login") } },
    };
    expect(evalExpr(expr, ctx)).toBe("43");
  });

  it("gt compares numerically", () => {
    expect(evalCond({ kind: "gt", left: "5", right: "0" }, ctx)).toBe(true);
    expect(evalCond({ kind: "gt", left: "0", right: "0" }, ctx)).toBe(false);
  });
});

describe("expression primitives (RIGHT / REPT / JOIN)", () => {
  const ctx = { values: {}, lookups: {} };

  it("RIGHT takes the last N chars", () => {
    expect(evalExpr({ kind: "right", text: "abcdef", count: "2" }, ctx)).toBe("ef");
    expect(evalExpr({ kind: "right", text: "ab", count: "0" }, ctx)).toBe("");
  });

  it("REPT repeats a string (used for x-padding)", () => {
    expect(evalExpr({ kind: "rept", text: "x", count: "3" }, ctx)).toBe("xxx");
    expect(evalExpr({ kind: "rept", text: "x", count: "0" }, ctx)).toBe("");
  });

  it("JOIN mirrors TEXTJOIN, optionally skipping blanks", () => {
    expect(
      evalExpr({ kind: "join", delim: "_", skipBlank: true, parts: ["a", "", "b"] }, ctx),
    ).toBe("a_b");
    expect(
      evalExpr({ kind: "join", delim: "_", skipBlank: false, parts: ["a", "", "b"] }, ctx),
    ).toBe("a__b");
  });
});

describe("ITX / SI map names (transcribed from VBA)", () => {
  const mapRs = {
    id: "map-test",
    name: "map-test",
    version: "1",
    fields: [],
    lookups: { MSG: { X1: "CSR", X2: "INR" }, SYS: { RP: "R" } },
    outputs: mapNameOutputs("MSG", "SYS"),
  };

  it("reproduces the real ITX sample D_TX_CE_ROMDLZxCSRV1xxINRD96AOR", () => {
    const out = byKey(
      generateNames(mapRs, {
        typeOfMap: "ITX",
        sourceFormat: "CE",
        partnerCode: "ROMDLZ",
        sourceMsgTypeItx: "X1",
        sourceVersion: "V1",
        splitMapFlag: "No",
        destMsgTypeItx: "X2",
        destVersion: "D96A",
        mapDirection: "OUT",
        mapSystem: "RP",
      }),
    );
    expect(out.itxMapName).toBe("D_TX_CE_ROMDLZxCSRV1xxINRD96AOR");
  });

  it("reproduces the real SI sample DSV_TR_A2A_CAENRCANON_940_4010_824_4010_OUT_RP_mp", () => {
    const out = byKey(
      generateNames(mapRs, {
        typeOfMap: "SI",
        sourceFormat: "A2A",
        partnerCode: "CAENRCANON",
        sourceMsgTypeSi: "940",
        sourceVersion: "4010",
        destMsgTypeSi: "824",
        destVersion: "4010",
        mapDirection: "OUT",
        mapSystem: "RP",
      }),
    );
    expect(out.siMapDescription).toBe(
      "DSV_TR_A2A_CAENRCANON_940_4010_824_4010_OUT_RP_mp",
    );
  });
});

