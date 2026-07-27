import {
  and,
  arith,
  concat,
  eq,
  gt,
  iff,
  join,
  left,
  len,
  lookup,
  notBlank,
  or,
  rept,
  right,
  upper,
  v,
} from "../../builders.js";
import type { Expr, OutputDef } from "../../types.js";

/**
 * The ITX & SI map-name outputs, transcribed from the workbook's VBA
 * (module that writes the "Resource and file naming" map-name rows). These have
 * NO cell formula in the workbook (the macro builds them at run time), so the
 * importer appends them via this factory, passing the actual DropDown lookup ids
 * (`MessageTypeLookup#2`, `DSVSystemITXLookup#2`).
 *
 * Verified against real samples:
 *   ITX: D_TX_CE_ROMDLZxCSRV1xxINRD96AOR
 *   SI : DSV_TR_A2A_CAENRCANON_940_4010_824_4010_OUT_RP_mp
 */
export function mapNameOutputs(msgTable: string, systemTable: string): OutputDef[] {
  const fmt = v("sourceFormat");
  const isDesFnx = or(eq(fmt, "DES"), eq(fmt, "FNX"));

  // IF(LEN(f)>=w, LEFT(UPPER(f),w), UPPER(f)&REPT("x",w-LEN(f)))
  const pad = (key: string, width: number): Expr =>
    iff(
      gt(len(v(key)), String(width - 1)),
      left(upper(v(key)), String(width)),
      concat(upper(v(key)), rept("x", arith("-", String(width), len(v(key))))),
    );

  const sysCode = lookup(systemTable, v("mapSystem"), "Z");
  const diffChar = iff(notBlank("differenceChar"), upper(v("differenceChar")), "");

  const itxDesFnx = concat(
    iff(eq(fmt, "DES"), "D_TX_DX_", "D_TX_FX_"),
    pad("partnerCode", 7),
    iff(notBlank("fnxFunctionality"), concat("_", pad("fnxFunctionality", 12)), ""),
    iff(
      notBlank("mapDirection"),
      concat("_", left(v("mapDirection"), "1")),
      "_DIRECTION_IS_MANDATORY",
    ),
    sysCode,
    diffChar,
  );

  const itxNormal = iff(
    notBlank("sourceFormat"),
    concat(
      "D_TX_",
      upper(left(fmt, "1")),
      upper(right(fmt, "1")),
      "_",
      pad("partnerCode", 7),
      lookup(msgTable, v("sourceMsgTypeItx"), "???"),
      pad("sourceVersion", 4),
      iff(
        and(eq(v("splitMapFlag"), "Yes"), isDesFnx),
        "DO NOT SELECT DES OR FNX FOR SPLIT MAP",
        iff(
          eq(v("splitMapFlag"), "Yes"),
          "SPLITxx",
          concat(lookup(msgTable, v("destMsgTypeItx"), "???"), pad("destVersion", 4)),
        ),
      ),
      upper(left(v("mapDirection"), "1")),
      sysCode,
      diffChar,
    ),
    "",
  );

  const itxMapName: OutputDef = {
    key: "itxMapName",
    label: "ITX map resource/file name",
    category: "ITX Maps",
    section: "Resource and file naming",
    when: and(eq(v("typeOfMap"), "ITX"), notBlank("sourceFormat")),
    note: "Transcribed from the workbook VBA; verified vs. D_TX_CE_ROMDLZxCSRV1xxINRD96AOR.",
    expr: iff(and(isDesFnx, eq(v("splitMapFlag"), "No")), itxDesFnx, itxNormal),
  };

  // SI: outer TEXTJOIN("_") of UPPER(inner TEXTJOIN) and a suffix ("mp" normal,
  // "dox"/"fnx" for DES/FNX). skipBlank drops empty segments (e.g. System="Z").
  const dirOrMandatory = iff(
    notBlank("mapDirection"),
    v("mapDirection"),
    "DIRECTION_IS_MANDATORY",
  );
  const systemUnlessZ = iff(eq(v("mapSystem"), "Z"), "", v("mapSystem"));

  const siDesFnx = join(
    "_",
    true,
    upper(
      join(
        "_",
        true,
        "DSV_TR",
        fmt,
        v("partnerCode"),
        v("fnxFunctionality"),
        dirOrMandatory,
        systemUnlessZ,
      ),
    ),
    iff(eq(fmt, "DES"), "dox", "fnx"),
  );

  const siNormal = iff(
    notBlank("sourceFormat"),
    join(
      "_",
      true,
      upper(
        join(
          "_",
          true,
          "DSV_TR",
          fmt,
          v("partnerCode"),
          iff(
            and(eq(v("mapDirection"), "IN"), notBlank("differenceChar")),
            concat(v("sourceMsgTypeSi"), v("differenceChar")),
            v("sourceMsgTypeSi"),
          ),
          v("sourceVersion"),
          v("destMsgTypeSi"),
          v("destVersion"),
          dirOrMandatory,
          systemUnlessZ,
        ),
      ),
      "mp",
    ),
    "",
  );

  const siMapDescription: OutputDef = {
    key: "siMapDescription",
    label: "SI Map name",
    category: "ITX Maps",
    section: "Resource and file naming",
    when: notBlank("sourceFormat"),
    note: "Transcribed from the workbook VBA; verified vs. DSV_TR_A2A_CAENRCANON_940_4010_824_4010_OUT_RP_mp.",
    expr: iff(isDesFnx, siDesFnx, siNormal),
  };

  return [siMapDescription, itxMapName];
}
