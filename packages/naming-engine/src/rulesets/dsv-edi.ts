import {
  and,
  concat,
  eq,
  iff,
  isBlank,
  or,
  upper,
  v,
} from "../builders.js";
import type { Expr, OutputDef, Ruleset } from "../types.js";

/**
 * DSV EDI naming ruleset — reverse-engineered from
 * "AAAAXXXXXXX - DSV EDI Naming Tool v63.xltm" (sheets "Master data" and
 * "Resource and file naming") plus the 2026-07-03 ITX-map-naming update doc.
 *
 * Every output below mirrors an actual Excel formula. Provisional items (where the
 * exact VBA algorithm / 3-char-code lookup table still needs importing) are marked
 * with a `note` so they are transparent in the UI.
 */

const MISSING_MASTER =
  "Enter both the RITM/EDIT number and the Partner Code in Master data.";

/** Guard shared by most outputs: RITM + Partner Code must be present. */
const missingIds = or(isBlank("ritmNumber"), isBlank("partnerCode"));

/** DSV_{ritm}_{partner}_0.1_{suffix}  — the common export-file pattern. */
function exportFile(suffix: string): Expr {
  return iff(
    missingIds,
    MISSING_MASTER,
    concat("DSV_", v("ritmNumber"), "_", v("partnerCode"), "_0.1_", suffix),
  );
}

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

export const dsvEdiRuleset: Ruleset = {
  id: "dsv-edi-naming",
  name: "DSV EDI Naming Tool",
  version: "63",
  description:
    "Config-driven successor to the DSV EDI Naming Tool Excel template. " +
    "Outputs mirror the 'Resource and file naming' formulas. The ITX compact " +
    "map/resource name (3-char coded) still needs the DropDown code table imported.",

  fields: [
    // ---- Master data ----
    {
      key: "ritmNumber",
      label: "RITM/EDIT number",
      type: "text",
      group: "Master data",
      required: true,
      placeholder: "RITM1234567",
      help: "Include the RITM/EDIT/INC prefix. Used in Resource Tag and document naming.",
    },
    {
      key: "partnerName",
      label: "Partner Name",
      type: "text",
      group: "Master data",
      required: true,
    },
    {
      key: "partnerCode",
      label: "Partner Code",
      type: "text",
      group: "Master data",
      required: true,
      help: 'Used in map names etc. Do not include "EDIIED".',
    },
    {
      key: "resolvedPartnerId",
      label: "Resolved Partner ID",
      type: "text",
      group: "Master data",
      help: "Used for the Source ID Lookup code list and Send encoding.",
    },
    {
      key: "typeOfMap",
      label: "SI or ITX Map and/or Code Lists",
      type: "select",
      group: "Master data",
      required: true,
      default: "SI",
      options: [
        { value: "SI", label: "SI" },
        { value: "ITX", label: "ITX" },
      ],
      help: "If an ITX map or ITXA code list is in the deploy package, set this to ITX.",
    },
    {
      key: "platform",
      label: "Platform",
      type: "select",
      group: "Master data",
      options: [
        { value: "Corporate EDI", label: "Corporate EDI" },
        { value: "EBIP", label: "EBIP" },
      ],
    },

    // ---- Map (single map for this version) ----
    {
      key: "sourceFormat",
      label: "Source & Destination Format",
      type: "text",
      group: "Map",
      placeholder: "E2C",
    },
    {
      key: "sourceMsgTypeItx",
      label: "Source Message Type – ITX",
      type: "text",
      group: "Map",
      showWhen: eq(v("typeOfMap"), "ITX"),
      help: "The message type name on the ITX (Transformation Extender) side.",
    },
    {
      key: "sourceMsgTypeSi",
      label: "Source Message Type – SI",
      type: "text",
      group: "Map",
      help: "The message type name on the SI (Sterling Integration) side.",
    },
    {
      key: "sourceVersion",
      label: "Source Version",
      type: "text",
      group: "Map",
      placeholder: "D10B",
    },
    {
      key: "destMsgTypeItx",
      label: "Destination Message Type – ITX",
      type: "text",
      group: "Map",
      showWhen: eq(v("typeOfMap"), "ITX"),
    },
    {
      key: "destMsgTypeSi",
      label: "Destination Message Type – SI",
      type: "text",
      group: "Map",
    },
    {
      key: "destVersion",
      label: "Destination Version",
      type: "text",
      group: "Map",
      placeholder: "V5",
    },

    // ---- Business Process ----
    {
      key: "bpFunctionName",
      label: "Business Process function name",
      type: "text",
      group: "Business Process",
      help: "Free-case function name, e.g. ArchiveDocument.",
    },
    {
      key: "bpPartnerSpecific",
      label: "Partner-specific business process",
      type: "boolean",
      group: "Business Process",
      default: "false",
    },

    // ---- Selection / Options (gate whether each sheet emits names) ----
    // Mirrors the "Selection" worksheet toggles. In Excel a blank cell means
    // "emit" and the user types FALSE to suppress; here the toggles default to
    // on (checked) which produces the same names, and unchecking suppresses them.
    {
      key: "inboundRequired",
      label: "Inbound required",
      type: "boolean",
      group: "Selection / Options",
      default: "true",
      help: "Gates the Receive encoding code list names.",
    },
    {
      key: "outboundRequired",
      label: "Outbound required",
      type: "boolean",
      group: "Selection / Options",
      default: "true",
      help: "Gates the Send encoding code list names.",
    },
    {
      key: "configureMailboxes",
      label: "Configure Mailboxes",
      type: "boolean",
      group: "Selection / Options",
      default: "true",
    },
    {
      key: "configureRoutingRule",
      label: "Configure Routing Rule",
      type: "boolean",
      group: "Selection / Options",
      default: "true",
    },
    {
      key: "configureSSHKeys",
      label: "Configure SFTP Server SSH Keys",
      type: "boolean",
      group: "Selection / Options",
      default: "true",
    },
    {
      key: "configureControlNumbers",
      label: "Configure Control Numbers",
      type: "boolean",
      group: "Selection / Options",
      default: "true",
    },
    {
      key: "configureMailClientAdapter",
      label: "Configure Mail Client Adapter",
      type: "boolean",
      group: "Selection / Options",
      default: "true",
    },
    {
      key: "configureHTTPURIAdapter",
      label: "Configure SI HTTP URI Adapter",
      type: "boolean",
      group: "Selection / Options",
      default: "true",
    },
    {
      key: "configureAS2",
      label: "Configure AS2",
      type: "boolean",
      group: "Selection / Options",
      default: "true",
    },
    {
      key: "configureCertificates",
      label: "Configure Certificates",
      type: "boolean",
      group: "Selection / Options",
      default: "true",
    },

    // ---- Additional Master data inputs (used by the extra sheets) ----
    {
      key: "unresolvedPartnerID",
      label: "Unresolved Partner ID",
      type: "text",
      group: "Master data",
      help: "Used for the Receive encoding code list and sender/recipient codes.",
    },
    {
      key: "encoding",
      label: "Partner encoding",
      type: "text",
      group: "Master data",
      help: "Character encoding, e.g. UTF-8. Used in the encoding code lists.",
    },
    {
      key: "partnerType",
      label: "Partner Type",
      type: "select",
      group: "Master data",
      options: [
        { value: "cus", label: "Customer (cus)" },
        { value: "par", label: "Partner (par)" },
        { value: "dsv", label: "DSV internal (dsv)" },
        { value: "util", label: "Utility (util)" },
      ],
      help: "Drives mailbox roots, user accounts, virtual roots and routing rules.",
    },
    {
      key: "framework",
      label: "Framework",
      type: "text",
      group: "Master data",
      placeholder: "LW",
      help: 'Enter "LW" for the Lightwell Framework; blank/other for native.',
    },
    {
      key: "mailboxProtocol",
      label: "Mailbox Protocol",
      type: "select",
      group: "Master data",
      options: [
        { value: "FTP", label: "FTP" },
        { value: "SFTP", label: "SFTP" },
      ],
      help: "Authentication host for the user account.",
    },

    // ---- Per-sheet inputs for the adapter/control-number sheets ----
    {
      key: "emailUser",
      label: "E-mail user",
      type: "text",
      group: "Adapter settings",
      placeholder: "diesel",
      help: "Mail Client Adapter: full e-mail user name.",
    },
    {
      key: "emailUser5Characters",
      label: "E-mail user (5-char abbreviation)",
      type: "text",
      group: "Adapter settings",
      placeholder: "diese",
    },
    {
      key: "useSSL",
      label: "Use SSL?",
      type: "boolean",
      group: "Adapter settings",
      help: "SI HTTP URI adapter: whether the server uses SSL.",
    },
    {
      key: "partnerInCamelNotation",
      label: "Partner in CamelNotation",
      type: "text",
      group: "Adapter settings",
      help: "SI HTTP URI adapter: partner code in CamelNotation.",
    },
    {
      key: "controlNumberMessageType",
      label: "Control Number message type (optional)",
      type: "text",
      group: "Adapter settings",
      help: "Optional message type for the control number; blank gives a GLOBAL control number.",
    },
  ],

  lookups: {},

  outputs: [
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
          concat("DSV_", v("ritmNumber"), "_", v("partnerCode"), "_0.1_rt"),
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
          "DSV_",
          iff(eq(v("typeOfMap"), "ITX"), "ITXA_", ""),
          v("ritmNumber"),
          "_",
          v("partnerCode"),
          "_0.1_exp.xml",
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
      expr: iff(
        missingIds,
        MISSING_MASTER,
        concat(
          "DSV_",
          v("ritmNumber"),
          "_",
          v("partnerCode"),
          "_ROLLBACK_0.1_sql.sql",
        ),
      ),
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
      expr: iff(
        missingIds,
        MISSING_MASTER,
        concat(
          "DSV_",
          v("ritmNumber"),
          "_",
          v("partnerCode"),
          "_ROLLBACK_0.1_sqlout.log",
        ),
      ),
    },

    // ---- Business Process ----
    {
      key: "businessProcess",
      label: "Business process name",
      category: "Business Process",
      when: { kind: "notBlank", key: "bpFunctionName" },
      expr: iff(
        eq(v("bpPartnerSpecific"), "true"),
        concat("DSV_BP_", v("partnerCode"), "_", v("bpFunctionName"), "_bp"),
        concat("DSV_BP_", v("bpFunctionName"), "_bp"),
      ),
    },
    {
      key: "bpPlugin",
      label: "BP Plugin name",
      category: "Business Process",
      when: { kind: "notBlank", key: "bpFunctionName" },
      expr: iff(
        eq(v("bpPartnerSpecific"), "true"),
        concat(
          "DSV_BP_",
          v("partnerCode"),
          "_",
          v("bpFunctionName"),
          "_plugin_bp",
        ),
        concat("DSV_BP_", v("bpFunctionName"), "_plugin_bp"),
      ),
    },

    // ---- ITX Maps ----
    {
      key: "siMapDescription",
      label: "SI Map description (for ITX maps)",
      category: "ITX Maps",
      when: eq(v("typeOfMap"), "ITX"),
      note: "Derived from the 2026-07-03 update-doc example; verify token order against VBA.",
      expr: concat(
        "DSV_TR_",
        v("sourceFormat"),
        "_",
        upper(v("partnerCode")),
        "_",
        upper(v("sourceMsgTypeSi")),
        "_",
        v("sourceVersion"),
        "_",
        upper(v("destMsgTypeSi")),
        "_",
        v("destVersion"),
        "__mp",
      ),
    },
    {
      key: "itxMapName",
      label: "ITX map resource/file name",
      category: "ITX Maps",
      when: and(
        eq(v("typeOfMap"), "ITX"),
        { kind: "notBlank", key: "sourceMsgTypeItx" },
      ),
      note:
        "PROVISIONAL: the compact 3-char-coded ITX name (e.g. D_TX_EC_...SHP...) " +
        "requires importing the DropDown message-type code table and confirming the VBA algorithm.",
      expr: concat(
        "D_TX_",
        v("sourceFormat"),
        "_",
        upper(v("sourceMsgTypeItx")),
        v("sourceVersion"),
        upper(v("destMsgTypeItx")),
        v("destVersion"),
      ),
    },
  ],
};
