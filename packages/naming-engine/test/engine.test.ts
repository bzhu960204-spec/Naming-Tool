import { describe, expect, it } from "vitest";
import {
  dsvEdiRuleset,
  generateNames,
  validateInputs,
  validateRuleset,
  visibleFields,
} from "../src/index.js";
import type { GeneratedName } from "../src/index.js";

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

  it("SI Map description matches the update-doc example", () => {
    expect(out.siMapDescription).toBe(
      "DSV_TR_E2C_MANTICORE_IFTMIN_D10B_MULTSTAGEIMPMISS_V5__mp",
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
