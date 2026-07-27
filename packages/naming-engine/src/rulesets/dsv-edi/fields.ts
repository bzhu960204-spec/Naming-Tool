import { eq, or, v } from "../../builders.js";
import type { Field } from "../../types.js";
import {
  bln,
  clientConnectionFields,
  numberedFields,
  txt,
} from "./shared.js";

/**
 * All user inputs for the DSV EDI ruleset, grouped exactly as they render in
 * the web form (the form re-groups by `field.group`, so the array order here is
 * for readability only). Repetitive runs — AS2/mailbox message types and the
 * FTP/SFTP client profiles — are generated from templates in `shared.ts`.
 */

const HTTP_CLIENT = "HTTP Client";
const FTP_CLIENT = "FTP Client";
const SFTP_CLIENT = "SFTP Client";

/** HTTP(S) client profile inputs (irregular set, kept explicit). */
const httpClientFields: Field[] = [
  bln("clientHTTPUseSSL", "HTTP: Use SSL?", HTTP_CLIENT),
  txt("clientHTTPProdDNSOrIP", "HTTP: Server DNS or IP (Prod)", HTTP_CLIENT),
  txt("clientHTTPProdPortNumber", "HTTP: Port number (Prod)", HTTP_CLIENT),
  txt("clientHTTPProdLoginName", "HTTP: Login name (Prod)", HTTP_CLIENT),
  txt("clientHTTPTestDNSOrIP", "HTTP: Server DNS or IP (Test)", HTTP_CLIENT),
  txt("clientHTTPTestPortNumber", "HTTP: Port number (Test)", HTTP_CLIENT),
  txt("clientHTTPTestLoginName", "HTTP: Login name (Test)", HTTP_CLIENT),
  txt("clientHTTPCACertDescription", "HTTP: CA certificate description", HTTP_CLIENT),
  bln("clientHTTPClientCertAuthUsed", "HTTP: Client certificate auth used?", HTTP_CLIENT),
  bln("clientHTTPLoginRequired", "HTTP: Username login required?", HTTP_CLIENT),
];

/** FTP client profile inputs: the shared connection block + a GET-rule version. */
const ftpClientFields: Field[] = [
  ...clientConnectionFields("FTP", FTP_CLIENT),
  txt("fTPGETVersion1", "FTP: GET rule version (profile 1)", FTP_CLIENT),
];

/** SFTP client profile inputs: protocol/CamelNotation extras wrap the shared block. */
const sftpClientFields: Field[] = [
  bln("isProtocolSFTP", "SFTP: Protocol is SFTP?", SFTP_CLIENT),
  txt("clientSFTPPartnerInCamelNotation", "SFTP: Partner in CamelNotation", SFTP_CLIENT),
  txt("clientFTPPartnerInCamelNotation", "SFTP: Partner in CamelNotation (legacy)", SFTP_CLIENT),
  ...clientConnectionFields("SFTP", SFTP_CLIENT),
  txt("clientSFTPServerInsideDSVNetwork1", "SFTP: Server inside DSV network? (profile 1)", SFTP_CLIENT),
  txt("clientSFTPServerInsideDSVNetwork2", "SFTP: Server inside DSV network? (profile 2)", SFTP_CLIENT),
];

/** Inputs for the HTTP(S) / FTP / SFTP client-profile worksheets. */
const clientFields: Field[] = [
  ...httpClientFields,
  ...ftpClientFields,
  ...sftpClientFields,
];

/** AS2 message-type profiles 1–4 (only #1 carries the explanatory help text). */
const aS2MessageTypeFields: Field[] = numberedFields(
  "aS2MessageType",
  (n) => `AS2 message type (profile ${n})`,
  "AS2",
);
aS2MessageTypeFields[0]!.help =
  "Message type when multiple AS2 identifiers exist for the same customer/partner.";

export const dsvEdiFields: Field[] = [
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
  {
    key: "sourceIdDestinationId",
    label: "Source ID destination",
    type: "text",
    group: "Master data",
    default: "DSV",
    help: "Destination ID appended to the Sender/Receiver codes in the Source ID Lookup sheet.",
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

  // ---- Adapter settings ----
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
  ...aS2MessageTypeFields,
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
  ...numberedFields(
    "delayMailboxMessageType",
    (n) => `Delay mailbox message type ${n}`,
    "Mailboxes",
  ),
  ...numberedFields(
    "batchMailboxMessageType",
    (n) => `Batch mailbox message type ${n}`,
    "Mailboxes",
  ),

  // ---- Client profiles (HTTP / FTP / SFTP) ----
  ...clientFields,
];
