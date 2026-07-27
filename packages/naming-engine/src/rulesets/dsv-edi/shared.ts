import { concat, eq, iff, isBlank, or, v } from "../../builders.js";
import type { Expr, Field } from "../../types.js";

/**
 * Shared constants and small builder helpers for the DSV EDI ruleset.
 *
 * Everything here is factored out of the original single-file ruleset so the
 * `fields`, `outputs` and `map-names` modules can stay focused and free of
 * copy-pasted string patterns.
 */

/** Common literal fragments used across many DSV names. */
export const DSV = "DSV_";
/** The default version segment baked into most export/file names. */
export const VERSION = "0.1";

export const MISSING_MASTER =
  "Enter both the RITM/EDIT number and the Partner Code in Master data.";

/** Guard shared by most outputs: RITM + Partner Code must be present. */
export const missingIds = or(isBlank("ritmNumber"), isBlank("partnerCode"));

/** DSV_{ritm}_{partner}_0.1_{suffix} — the common export-file pattern. */
export function exportFile(suffix: string): Expr {
  return iff(
    missingIds,
    MISSING_MASTER,
    concat(DSV, v("ritmNumber"), "_", v("partnerCode"), `_${VERSION}_`, suffix),
  );
}

/** DSV_{ritm}_{partner}_ROLLBACK_0.1_{suffix} — the rollback-file variant. */
export function rollbackFile(suffix: string): Expr {
  return iff(
    missingIds,
    MISSING_MASTER,
    concat(
      DSV,
      v("ritmNumber"),
      "_",
      v("partnerCode"),
      `_ROLLBACK_${VERSION}_`,
      suffix,
    ),
  );
}

/**
 * DSV_BP_[{partner}_]{function}{suffix} — business-process names. The partner
 * code segment is only inserted when the BP is partner-specific.
 */
export function bpName(suffix: string): Expr {
  const fn = v("bpFunctionName");
  return iff(
    eq(v("bpPartnerSpecific"), "true"),
    concat("DSV_BP_", v("partnerCode"), "_", fn, suffix),
    concat("DSV_BP_", fn, suffix),
  );
}

/** Compact helper for a plain text input field. */
export const txt = (key: string, label: string, group: string): Field => ({
  key,
  label,
  type: "text",
  group,
});

/** Compact helper for a boolean input field (defaults to false). */
export const bln = (key: string, label: string, group: string): Field => ({
  key,
  label,
  type: "boolean",
  group,
  default: "false",
});

/**
 * Generate a run of numbered text fields, e.g. `aS2MessageType1..4`.
 * `label` receives the 1-based index so callers control the exact wording.
 */
export const numberedFields = (
  prefix: string,
  label: (n: number) => string,
  group: string,
  count = 4,
): Field[] =>
  Array.from({ length: count }, (_, i) =>
    txt(`${prefix}${i + 1}`, label(i + 1), group),
  );

/**
 * The Prod/Test connection + profile fields shared by the FTP and SFTP client
 * worksheets. Both protocols expose an identical set of slots, so they are
 * generated from one template instead of being hand-copied.
 */
export const clientConnectionFields = (
  proto: "FTP" | "SFTP",
  group: string,
): Field[] => {
  const p = `client${proto}`;
  return [
    txt(`${p}LoginName`, `${proto}: Login name (Prod)`, group),
    txt(`${p}LoginNameTest`, `${proto}: Login name (Test)`, group),
    txt(`${p}DNSOrIP`, `${proto}: Server DNS or IP (Prod)`, group),
    txt(`${p}DNSOrIPTest`, `${proto}: Server DNS or IP (Test)`, group),
    txt(`${p}Port`, `${proto}: Port (Prod)`, group),
    txt(`${p}PortTest`, `${proto}: Port (Test)`, group),
    txt(`${p}Password`, `${proto}: Password (Prod)`, group),
    txt(`${p}PasswordTest`, `${proto}: Password (Test)`, group),
    txt(`${p}MessageType1`, `${proto}: Message type (profile 1)`, group),
    txt(`${p}MessageType2`, `${proto}: Message type (profile 2)`, group),
    txt(`${p}BPVersion1`, `${proto}: BP version (profile 1)`, group),
    txt(`${p}BPVersion2`, `${proto}: BP version (profile 2)`, group),
  ];
};
