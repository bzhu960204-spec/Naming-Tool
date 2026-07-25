import {
  and,
  arith,
  concat,
  eq,
  gt,
  iff,
  isBlank,
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
} from "../builders.js";
import type { Expr, Field, OutputDef, Ruleset } from "../types.js";

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

/** Compact helpers for the many HTTP/FTP/SFTP client-profile input fields. */
const txt = (key: string, label: string, group: string): Field => ({
  key,
  label,
  type: "text",
  group,
});
const bln = (key: string, label: string, group: string): Field => ({
  key,
  label,
  type: "boolean",
  group,
  default: "false",
});

/** Inputs for the HTTP(S) / FTP / SFTP client-profile worksheets. */
const clientFields: Field[] = [
  // HTTP(S) Client profiles
  bln("clientHTTPUseSSL", "HTTP: Use SSL?", "HTTP Client"),
  txt("clientHTTPProdDNSOrIP", "HTTP: Server DNS or IP (Prod)", "HTTP Client"),
  txt("clientHTTPProdPortNumber", "HTTP: Port number (Prod)", "HTTP Client"),
  txt("clientHTTPProdLoginName", "HTTP: Login name (Prod)", "HTTP Client"),
  txt("clientHTTPTestDNSOrIP", "HTTP: Server DNS or IP (Test)", "HTTP Client"),
  txt("clientHTTPTestPortNumber", "HTTP: Port number (Test)", "HTTP Client"),
  txt("clientHTTPTestLoginName", "HTTP: Login name (Test)", "HTTP Client"),
  txt("clientHTTPCACertDescription", "HTTP: CA certificate description", "HTTP Client"),
  bln("clientHTTPClientCertAuthUsed", "HTTP: Client certificate auth used?", "HTTP Client"),
  bln("clientHTTPLoginRequired", "HTTP: Username login required?", "HTTP Client"),

  // FTP Client
  txt("clientFTPLoginName", "FTP: Login name (Prod)", "FTP Client"),
  txt("clientFTPLoginNameTest", "FTP: Login name (Test)", "FTP Client"),
  txt("clientFTPDNSOrIP", "FTP: Server DNS or IP (Prod)", "FTP Client"),
  txt("clientFTPDNSOrIPTest", "FTP: Server DNS or IP (Test)", "FTP Client"),
  txt("clientFTPPort", "FTP: Port (Prod)", "FTP Client"),
  txt("clientFTPPortTest", "FTP: Port (Test)", "FTP Client"),
  txt("clientFTPPassword", "FTP: Password (Prod)", "FTP Client"),
  txt("clientFTPPasswordTest", "FTP: Password (Test)", "FTP Client"),
  txt("clientFTPMessageType1", "FTP: Message type (profile 1)", "FTP Client"),
  txt("clientFTPMessageType2", "FTP: Message type (profile 2)", "FTP Client"),
  txt("clientFTPBPVersion1", "FTP: BP version (profile 1)", "FTP Client"),
  txt("clientFTPBPVersion2", "FTP: BP version (profile 2)", "FTP Client"),
  txt("fTPGETVersion1", "FTP: GET rule version (profile 1)", "FTP Client"),

  // SFTP Client
  bln("isProtocolSFTP", "SFTP: Protocol is SFTP?", "SFTP Client"),
  txt("clientSFTPPartnerInCamelNotation", "SFTP: Partner in CamelNotation", "SFTP Client"),
  txt("clientFTPPartnerInCamelNotation", "SFTP: Partner in CamelNotation (legacy)", "SFTP Client"),
  txt("clientSFTPLoginName", "SFTP: Login name (Prod)", "SFTP Client"),
  txt("clientSFTPLoginNameTest", "SFTP: Login name (Test)", "SFTP Client"),
  txt("clientSFTPDNSOrIP", "SFTP: Server DNS or IP (Prod)", "SFTP Client"),
  txt("clientSFTPDNSOrIPTest", "SFTP: Server DNS or IP (Test)", "SFTP Client"),
  txt("clientSFTPPort", "SFTP: Port (Prod)", "SFTP Client"),
  txt("clientSFTPPortTest", "SFTP: Port (Test)", "SFTP Client"),
  txt("clientSFTPPassword", "SFTP: Password (Prod)", "SFTP Client"),
  txt("clientSFTPPasswordTest", "SFTP: Password (Test)", "SFTP Client"),
  txt("clientSFTPMessageType1", "SFTP: Message type (profile 1)", "SFTP Client"),
  txt("clientSFTPMessageType2", "SFTP: Message type (profile 2)", "SFTP Client"),
  txt("clientSFTPBPVersion1", "SFTP: BP version (profile 1)", "SFTP Client"),
  txt("clientSFTPBPVersion2", "SFTP: BP version (profile 2)", "SFTP Client"),
  txt("clientSFTPServerInsideDSVNetwork1", "SFTP: Server inside DSV network? (profile 1)", "SFTP Client"),
  txt("clientSFTPServerInsideDSVNetwork2", "SFTP: Server inside DSV network? (profile 2)", "SFTP Client"),
];


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
    {
      key: "mapDirection",
      label: "Direction",
      type: "select",
      group: "Map",
      options: [
        { value: "IN", label: "IN" },
        { value: "OUT", label: "OUT" },
      ],
      help: "Mandatory for map names. ITX uses the first letter (I/O).",
    },
    {
      key: "mapSystem",
      label: "System",
      type: "text",
      group: "Map",
      placeholder: "RP",
      help: 'ITX names use the 1-char code from DSVSystemITXLookup ("Z" if unknown/blank).',
    },
    {
      key: "differenceChar",
      label: "Difference Character",
      type: "text",
      group: "Map",
      help: "Optional trailing character to disambiguate otherwise-identical map names.",
    },
    {
      key: "splitMapFlag",
      label: "Split Map",
      type: "select",
      group: "Map",
      default: "No",
      showWhen: eq(v("typeOfMap"), "ITX"),
      options: [
        { value: "No", label: "No" },
        { value: "Yes", label: "Yes" },
      ],
      help: 'ITX only. "Yes" produces a SPLITxx destination segment (not valid for DES/FNX).',
    },
    {
      key: "fnxFunctionality",
      label: "FNX Functionality",
      type: "text",
      group: "Map",
      showWhen: or(eq(v("sourceFormat"), "DES"), eq(v("sourceFormat"), "FNX")),
      help: "Only for DES/FNX formats. Padded to 12 chars with 'x' in ITX names.",
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

    // ---- Identities (LW FW) ----
    {
      key: "orgNameType",
      label: "LW FW Identity Organization Name Type",
      type: "select",
      group: "Identities",
      options: [
        { value: "Customer connection - direct", label: "Customer connection - direct" },
        {
          value: "Customer connection - via third party",
          label: "Customer connection - via third party",
        },
        {
          value: "Third party solution - multiple customers - same identifier",
          label: "Third party solution - multiple customers - same identifier",
        },
        {
          value: "Third party solution - multiple customers - different identifier",
          label: "Third party solution - multiple customers - different identifier",
        },
      ],
      help: "Drives the Base Identity Organization Name.",
    },
    {
      key: "partnerName3PP",
      label: "3rd Party Partner Name",
      type: "text",
      group: "Identities",
      help: "Only used for third-party (3PP/3CC) identity organization names.",
    },

    // ---- AS2 ----
    {
      key: "aS2VANSPartner",
      label: "AS2 VANS partner",
      type: "text",
      group: "AS2",
      help: "Partner if the customer's files are transferred via a VANS (e.g. TRUECOMMERCE).",
    },
    {
      key: "aS2MessageType1",
      label: "AS2 message type (profile 1)",
      type: "text",
      group: "AS2",
      help: "Message type when multiple AS2 identifiers exist for the same customer/partner.",
    },
    {
      key: "aS2MessageType2",
      label: "AS2 message type (profile 2)",
      type: "text",
      group: "AS2",
    },
    {
      key: "aS2MessageType3",
      label: "AS2 message type (profile 3)",
      type: "text",
      group: "AS2",
    },
    {
      key: "aS2MessageType4",
      label: "AS2 message type (profile 4)",
      type: "text",
      group: "AS2",
    },
    {
      key: "trustedDigitalCertificate",
      label: "Trusted Digital Certificate",
      type: "text",
      group: "AS2",
      help: "The partner's trusted digital certificate name (Certificates worksheet).",
    },
    {
      key: "trustedDigitalCertificateTest",
      label: "Trusted Digital Certificate (TEST)",
      type: "text",
      group: "AS2",
      help: "The partner's trusted digital certificate name for the TEST environment.",
    },

    // ---- Mailboxes (batch / delay message types) ----
    {
      key: "delayMailboxMessageType1",
      label: "Delay mailbox message type 1",
      type: "text",
      group: "Mailboxes",
    },
    {
      key: "delayMailboxMessageType2",
      label: "Delay mailbox message type 2",
      type: "text",
      group: "Mailboxes",
    },
    {
      key: "delayMailboxMessageType3",
      label: "Delay mailbox message type 3",
      type: "text",
      group: "Mailboxes",
    },
    {
      key: "delayMailboxMessageType4",
      label: "Delay mailbox message type 4",
      type: "text",
      group: "Mailboxes",
    },
    {
      key: "batchMailboxMessageType1",
      label: "Batch mailbox message type 1",
      type: "text",
      group: "Mailboxes",
    },
    {
      key: "batchMailboxMessageType2",
      label: "Batch mailbox message type 2",
      type: "text",
      group: "Mailboxes",
    },
    {
      key: "batchMailboxMessageType3",
      label: "Batch mailbox message type 3",
      type: "text",
      group: "Mailboxes",
    },
    {
      key: "batchMailboxMessageType4",
      label: "Batch mailbox message type 4",
      type: "text",
      group: "Mailboxes",
    },
    {
      key: "sourceIdDestinationId",
      label: "Source ID destination",
      type: "text",
      group: "Master data",
      default: "DSV",
      help: "Destination ID appended to the Sender/Receiver codes in the Source ID Lookup sheet.",
    },
    ...clientFields,
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
  ],
};

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
