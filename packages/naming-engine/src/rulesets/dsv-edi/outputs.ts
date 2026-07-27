import { concat, eq, iff, isBlank, notBlank, v } from "../../builders.js";
import type { OutputDef } from "../../types.js";
import {
  DSV,
  VERSION,
  MISSING_MASTER,
  bpName,
  exportFile,
  missingIds,
  rollbackFile,
} from "./shared.js";

/** Lightwell Framework rule export files (sheet5 rows 18–28). */
const lwFwFiles: { key: string; label: string; suffix: string }[] = [
  { key: "lwFwReceiveRule", label: "LW FW receive rule export file", suffix: "frer.json" },
  { key: "lwFwSplitRule", label: "LW FW split rule export file", suffix: "fsir.json" },
  { key: "lwFwXmlIdRule", label: "LW FW XML identification rule export file", suffix: "fxir.json" },
  { key: "lwFwDocumentRule", label: "LW FW document rule export file", suffix: "fdor.json" },
  { key: "lwFwRouteRule", label: "LW FW route rule export file", suffix: "fror.json" },
  { key: "lwFwSendRule", label: "LW FW send rule export file", suffix: "fser.json" },
  { key: "lwFwNotificationRule", label: "LW FW notification rule export file", suffix: "fnor.json" },
  { key: "lwFwFtpGetRule", label: "LW FW FTP/SFTP get rule export file", suffix: "fger.json" },
  { key: "lwFwIdentities", label: "LW FW Framework Identities export file", suffix: "ffid.json" },
  { key: "lwFwBpParameter", label: "LW FW BP Parameter export file", suffix: "fbpp.json" },
  { key: "lwFwBpWebService", label: "LW FW BP web service rule export file", suffix: "fwsr.json" },
];

const lwFwOutputs: OutputDef[] = lwFwFiles.map((f) => ({
  key: f.key,
  label: f.label,
  category: "Lightwell Framework exports",
  expr: exportFile(f.suffix),
}));

export const dsvEdiOutputs: OutputDef[] = [
  // ---- Code Lists ----
  {
    key: "sourceIdCodeList",
    label: "Source ID Lookup code list",
    category: "Code Lists",
    expr: iff(
      isBlank("resolvedPartnerId"),
      "Enter the Resolved Partner ID in Master data to generate this name.",
      concat(
        "DSV_CL_SourceIDLookup_",
        v("resolvedPartnerId"),
        "_D10B_CDM_V2_cl",
      ),
    ),
  },

  // ---- Resource Tags ----
  {
    key: "resourceTag",
    label: "Resource Tag",
    category: "Resource Tags",
    expr: iff(
      missingIds,
      MISSING_MASTER,
      iff(
        eq(v("typeOfMap"), "ITX"),
        "RT not required for ITX resources",
        concat(DSV, v("ritmNumber"), "_", v("partnerCode"), `_${VERSION}_rt`),
      ),
    ),
  },
  {
    key: "resourceTagExport",
    label: "Resource Tag export file",
    category: "Resource Tags",
    expr: iff(
      missingIds,
      MISSING_MASTER,
      concat(
        DSV,
        iff(eq(v("typeOfMap"), "ITX"), "ITXA_", ""),
        v("ritmNumber"),
        "_",
        v("partnerCode"),
        `_${VERSION}_exp.xml`,
      ),
    ),
  },

  // ---- Lightwell Framework exports ----
  ...lwFwOutputs,

  // ---- SQL ----
  {
    key: "sqlScript",
    label: "SQL Script",
    category: "SQL",
    expr: exportFile("sql.sql"),
  },
  {
    key: "sqlRollback",
    label: "SQL Rollback Script",
    category: "SQL",
    expr: rollbackFile("sql.sql"),
  },
  {
    key: "sqlLog",
    label: "SQL log",
    category: "SQL",
    expr: exportFile("sqlout.log"),
  },
  {
    key: "sqlRollbackLog",
    label: "SQL Rollback log",
    category: "SQL",
    expr: rollbackFile("sqlout.log"),
  },

  // ---- Business Process ----
  {
    key: "businessProcess",
    label: "Business process name",
    category: "Business Process",
    when: notBlank("bpFunctionName"),
    expr: bpName("_bp"),
  },
  {
    key: "bpPlugin",
    label: "BP Plugin name",
    category: "Business Process",
    when: notBlank("bpFunctionName"),
    expr: bpName("_plugin_bp"),
  },
];
