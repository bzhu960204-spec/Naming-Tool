# DSV EDI Naming Tool — AI Session Handoff (raw memory export)

> This is a verbatim export of the repo-scoped AI memory (`/memories/repo/dsv-naming-tool.md`).
> The AI memory itself lives in VS Code's local workspace storage and does NOT sync across machines.
> This committed copy does. On a new machine you can tell the assistant:
> "Read docs/AI_SESSION_HANDOFF.md and write it into repo memory" to restore full context.
> Keep this file in sync when the memory changes.

---

# DSV EDI Naming Tool — project state (for new sessions)

## >>> SESSION HANDOFF — START HERE (updated 2026-07-25) <<<
Big goal: make the importer reproduce ALL 24 sheets of the .xltm (was only "Resource and file naming").
Phased plan: P0 refactor(DONE) -> P1 infra(DONE) -> P2 gated sheets(DONE) -> P3 big sheets(DONE) ->
  **P4 = DONE (P4b + P4c done; P4a not feasible)** -> finish.
DONE so far: structural-diff fix, BP outputs importer, P0 file split, P1 injectable resolver + DropDown
  lookups + VLOOKUP/defined-names, P2 7 gated sheets + computed-name inlining, P3 six more sheets
  (User accounts, Identities, AS2, Mailboxes, HTTP(S)/FTP/SFTP Client). See "DONE 2026-07-25 P3" below.
Current state: active seed = 752 outputs (each tagged `section`) + 6 lookup tables + 92 fields;
  re-upload v63 = data-only 0/0/0; 22 tests pass; typecheck green. Results UI groups by section
  (collapsible) + hide-empty toggle. Importer lives in apps/api/src/xltm/ (ooxml/ formula/ domain/ + index.ts).
P3 added compiler support for CHAR/LEFT/LEN/FIND/REPLACE/`+`/`-`/`>` and engine Expr kinds
  find/replace/left/len/arith + Cond kind gt. **When adding any new Expr/Cond kind you MUST update
  packages/naming-engine/src/schema.ts (zod union AND collectLookupTables walker) too, else the import
  route rejects "Compiled ruleset is invalid" (seed path skips zod; import path validates).**
START P4: Master data as dynamic field source, Source ID lookup, ITX/SI compact 3-char map name (needs
  the DropDown code table + VBA algorithm confirmed). Optional UX: hide the many constant "" config rows.
P4 STATUS (2026-07-25): active seed now = 754 outputs / 93 fields (re-upload v63 = data-only 0/0/0).
  - P4b DONE: imported "Source ID lookup" C2/C3 = CONCATENATE(ResolvedPartnerId,"_",E3), E3="DSV".
    New field sourceIdDestinationId (default "DSV"). Sender/Receiver Code = partnerId_DSV.
  - P4a SKIP (not feasible): Map1*/Map2*/CodeList* defined names are #REF! (macro-rebuilt). Existing
    hand-authored single-map fields already cover it.
  - P4c DONE (recovered from VBA, 2026-07-25): the map-name rows are NOT cell formulas — the macro WRITES
    Excel formulas into "Resource and file naming" B/C cells at run time. Extracted xl/vbaProject.bin
    (CFB/OLE parse + MS-OVBA decompress) and transcribed those formulas into engine exprs. Added engine
    primitives right/rept/join(TEXTJOIN skipBlank) + builders; added 5 fields (mapDirection, mapSystem,
    differenceChar, splitMapFlag, fnxFunctionality); mapNameOutputs(msgTable,systemTable) factory in
    dsv-edi.ts (removed old provisional outputs), appended in build-ruleset.ts via appendMapNameOutputs()
    resolving MessageTypeLookup#2 + DSVSystemITXLookup#2. active=756 outputs/98 fields, re-upload data-only
    0/0/0, 26 tests. Samples reproduced EXACTLY: ITX D_TX_CE_ROMDLZxCSRV1xxINRD96AOR,
    SI DSV_TR_A2A_CAENRCANON_940_4010_824_4010_OUT_RP_mp; server ORDERS/INVOIC -> D_TX_CE_ROMDLZxORDV1xxFIVD96AOR.
GOTCHAS: (a) after ANY importer change, must re-seed: kill API+tsx, delete apps/api/data/naming.db*,
  restart `cd apps/api; node --import tsx src/index.ts` (async). Else active(old) vs reupload(new)=structural.
  ** When killing node, FILTER TIGHTLY: match CommandLine '*tsx src/index.ts*' only. A broad 'vite'
  filter KILLED vite dev servers of OTHER projects. Also: delete naming.db* FROM REPO ROOT (a stray cwd
  inside apps/api makes the relative path wrong and the delete silently no-ops). Verify Test-Path=False. **
  (b) run_in_terminal sometimes disabled — if so use get_errors + edits, ask user to run cmds.
  (c) PS 5.1: no -Form on Invoke-RestMethod; use curl.exe -F for multipart. RUN curl FROM REPO ROOT.
  (d) files kept <~280 lines. (e) temp inspect scripts: create apps/api/src/xltm/_dump.ts / _verify.ts,
  run with `node --import tsx ...`, DELETE when done.

## DONE 2026-07-25 P3: six more sheets (752 outputs, 92 fields, 22 tests)
Sub-phases: P3.1 = User accounts / Identities / AS2 / Mailboxes (only needed CHAR() + per-column label
cols). P3.2 = HTTP(S) / FTP / SFTP Client (needed new engine primitives).
- formula/tokenizer.ts: now emits `-` as an op (was Unexpected character).
- formula/parser.ts: added CHAR (folds to literal char), LEFT, LEN, FIND, REPLACE; parseAdditive layer
  for `+`/`-`; numeric `>` in parseCondPrimary -> {kind:gt}; IFERROR/IFNA sets fallback on find too.
- packages/naming-engine types.ts/expr.ts: Expr kinds find/replace/left/len/arith(+/-); Cond kind gt.
- packages/naming-engine schema.ts: SAME kinds added to zod exprSchema/condSchema + collectLookupTables.
- domain/sheet-specs.ts: SheetSpec + `labelColsByCol` (Mailboxes col I labels in H); colLabels now only
  suffixes the cols listed. New specs: User accounts(D), Identities(B, cellRefs B1->orgNameType),
  AS2(D/E rows18-257), Mailboxes(D + I "History"), HTTP main(D/E)+rename(A/B row36), FTP(D/E), SFTP(D/E).
- domain/generic-sheet.ts: extracted emitCell(); per-col label via labelColsByCol.
- rulesets/dsv-edi.ts: added orgNameType(select)/partnerName3PP, aS2VANSPartner/aS2MessageType1-4/
  trustedDigitalCertificate[/Test], batch/delayMailboxMessageType1-4, and clientFields[] (~40 HTTP/FTP/
  SFTP inputs via txt()/bln() helpers). Field key = lowerFirst(definedName).
VERIFIED names: cus.acme; "ACME - Direct"; ACME_TRUECOMMERCE_ORDERS_AS2;
  /DSV_ACCOUNTS_mb/DSV_CUSTOMERS_mb/DSV_cus.acme_mb; DSV_user_at_acme.com_edi.acme.com_443_SSL_http
  (@->_at_ via FIND/REPLACE); DSV_SSH_svc_at_acme.com_..._pf (LEFT/LEN truncation to 64). 0 warnings.
Skipped: Certificates = static template text (no formulas); FTP/SFTP A/B "rename profile" rows (D-col
  ProfileName already captured); HTTP A36/B36 rename IS imported (distinct _pf name).

## What this is
Rebuild of `AAAAXXXXXXX - DSV EDI Naming Tool v63.xltm` (macro Excel, DSV logistics
EDI naming generator) as a config-driven full-stack TypeScript web app.
Source files in workspace root: the .xltm and a .docx (ITX map naming update, 2026-07-03).

## Repo layout (monorepo, npm workspaces at C:\Users\BOBZHU01\Projects\Naming Tool)
- packages/naming-engine  Pure TS engine. Expr/Cond AST + evaluator (expr.ts), engine.ts
  (generateNames/validateInputs/visibleFields/groupByCategory), schema.ts (zod validateRuleset),
  builders.ts, rulesets/dsv-edi.ts (hand-authored seed), index.ts. 17 vitest tests PASS.
- apps/api   Hono + node:sqlite. index.ts (routes+seed), db.ts (Store), diff.ts (preflight
  data-only/logic-change/structural), xltm/ (zero-dep .xltm parser+formula compiler, split into
  ooxml/ formula/ domain/ + index.ts facade — see P0/P1 DONE sections). Data at apps/api/data/naming.db.
- apps/web   React+Vite+TS. App.tsx, api.ts, components/{NamingForm,Results,AdminPanel}.tsx,
  styles.css. Dynamic form + instant results + Admin(import/versions/activate/rollback/audit).

## Toolchain facts (IMPORTANT)
- Node 24, npm 11. pnpm NOT installed -> use npm workspaces.
- In ASYNC terminals npm is NOT on PATH; use `node` directly:
  - API: `node --import tsx apps/api/src/index.ts`  (port 8787)
  - Web: from apps/web: `node ..\..\node_modules\vite\bin\vite.js --port 5173`
- node:sqlite works (experimental warning only). vite pinned ^5.4.11 (match vitest's vite5).
- Web calls API via Vite proxy (/api -> :8787). Multipart upload tested with curl.exe -F.

## API routes
GET /api/health, GET /api/ruleset/active, POST /api/generate,
GET /api/versions, POST /api/versions/import (JSON), POST /api/versions/import-xltm (file),
POST /api/versions/:id/activate, GET /api/audit.

## .xltm importer (apps/api/src/xltm.ts) — WORKING
Manual ZIP parse (node:zlib inflateRawSync) + formula compiler (tokenizer + recursive descent)
-> engine Expr/Cond. Supports CONCATENATE/CONCAT/_xlfn.CONCAT/IF/ISBLANK/OR/AND/NOT/UPPER/LOWER/
TRIM/& /=/<> and "ISBLANK(x)=TRUE" affirmations. NAME_MAP: RITMNumber->ritmNumber,
PartnerDesignation->partnerCode, ResolvedPartnerId->resolvedPartnerId, TypeOfMap->typeOfMap.
Reads only "Resource and file naming" sheet, column B formulas. Fields taken from
dsvEdiRuleset.fields. Aligns output keys to active ruleset by normalized label.
CRITICAL FIX: cell regex must handle self-closing cells:
  /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
VERIFIED: real v63.xltm -> 18 formulas compiled, names match Excel exactly.

## Excel naming logic (reverse-engineered from sheet5 "Resource and file naming")
- Resource Tag: DSV_{ritm}_{partnerCode}_0.1_rt  (=="RT not required for ITX resources" if TypeOfMap=ITX)
- RT export: DSV_{if ITX:"ITXA_"}{ritm}_{partnerCode}_0.1_exp.xml
- Source ID codelist: DSV_CL_SourceIDLookup_{resolvedPartnerId}_D10B_CDM_V2_cl
- LW FW exports: DSV_{ritm}_{partnerCode}_0.1_{frer|fsir|fxir|fdor|fror|fser|fnor|fger|ffid|fbpp|fwsr}.json
- SQL: DSV_{ritm}_{partnerCode}_0.1_sql.sql ; rollback inserts _ROLLBACK_ ; logs use _sqlout.log
- Business Process (B41/B47, use bare cell refs A41/C41 -> importer SKIPS them):
  DSV_BP_{name}_bp or DSV_BP_{partner}_{name}_bp ; plugin adds _plugin_bp
- SI Map description (ITX, from doc): DSV_TR_{format}_{PARTNER}_{srcMsgTypeSi}_{srcVer}_{dstMsgTypeSi}_{dstVer}__mp
- ITX compact map name (VBA/3-char codes) = PROVISIONAL, needs DropDown code table.
Master data inputs: ritmNumber, partnerName, partnerCode(=PartnerDesignation), resolvedPartnerId,
typeOfMap(SI|ITX), plus per-map: sourceFormat, source/dest MsgType ITX+SI, source/dest Version.
2026-07-03 doc enhancement: MsgType split into ITX-side + SI-side fields (ITX fields showWhen typeOfMap=ITX).

## RESOLVED 2026-07-21: structural-diff-on-reupload issue
FIXED in apps/api/src/index.ts: replaced `store.seedIfEmpty(dsvEdiRuleset)` with `initialSeed()`
which seeds from the actual .xltm. New helpers:
- resolveSeedXltm(): env SEED_XLTM, else newest *.xltm in [process.cwd(), repoRoot=join(__dirname,"..","..","..")].
- initialSeed(): if getActiveRuleset(dsvEdiRuleset.id) exists -> return; else parseXltmToRuleset(buf,
  {active: dsvEdiRuleset}) + store.addVersion(active=true); catch -> fallback store.seedIfEmpty(dsvEdiRuleset).
Deleted apps/api/data/naming.db and restarted API. VERIFIED: active seeded from v63 (18 outputs, 0 warn);
re-uploading v63 => classification=data-only, added/removed/changed all 0. DONE.

## RESOLVED 2026-07-21 (#2): BP outputs now imported from .xltm
BP formulas (rows 41/42 business process, 47/48/49 plugin) use bare input-cell refs A{r}/C{r}
and have NO label in col A. Formula shape:
  =IF(NOT(ISBLANK(A41)),IF(C41=FALSE,CONCATENATE("DSV_BP_",A41,"_bp"),
     CONCATENATE("DSV_BP_",PartnerDesignation,"_",A41,"_bp")),"")
Importer changes in apps/api/src/xltm.ts:
- compileFormula(src, cellRefs?) + Parser(toks, cellRefs). nameToExpr resolves a bare cell ref via
  cellRefs map -> {var,key}; else still throws.
- booleanCompare(left,op,right): normalizes `X=TRUE/FALSE`,`X<>TRUE/FALSE` to eq(field,"true") /
  not(eq(field,"true")). (engine eq is strict string; boolean fields store "true"/"false").
  Wired into parseCondPrimary.
- parseXltmToRuleset row loop: if formula has /DSV_BP_/, map A{r}->bpFunctionName, C{r}->
  bpPartnerSpecific (existing dsvEdiRuleset.fields), collapse repeated slot rows via bpSeen set,
  synth label "Business process name"/"BP Plugin name" (aligns to hand-authored keys businessProcess/
  bpPlugin + category "Business Process").
VERIFIED: seed=20 outputs; generate gives DSV_BP_ArchiveDocument_bp / DSV_BP_ACME_ArchiveDocument_bp
(+_plugin_bp), blank name -> "". Re-upload v63 = data-only 0/0/0. 17 tests pass, all typecheck green.
IMPORTANT re-seed gotcha: seed only runs on empty DB at process start; after importer changes must
kill API + delete apps/api/data/naming.db* + restart, else active(old) vs reupload(new) shows structural.

## BIG PLAN 2026-07-21: implement ALL 24 sheets (was: only "Resource and file naming")
Workbook has 24 sheets. Importer only read sheet5 "Resource and file naming". The Selection sheet
(sheet3) has 10 boolean toggles (ConfigureMailboxes/AS2/SSHKeys/Certificates/HTTPURIAdapter/
MailClientAdapter/ControlNumbers/RoutingRule + InboundRequired/OutboundRequired) exposed as defined
names; each gates whether OTHER sheets emit names via pattern:
  =IF(OR(NOT(ConfigureXxx=FALSE),ISBLANK(ConfigureXxx)), <name>, "")   (blank/absent => TRUE => emit)
Sheets w/ naming formulas to add: Encoding(8,Inbound/Outbound), Virtual roots(2), Routing rules(7),
SFTP Server SSH Keys(6), Control Number(6,row A<>"" gate), SI HTTP URI(29), Mail client adapter(43),
AS2(191), Mailboxes(240,nested IF PartnerType="cus"), FTP Client(118), SFTP Client(129), User
accounts(15), Identities(9), HTTP(S) Client profiles(32), Source ID lookup(2,VLOOKUP), DSV FW(3).
Support sheets: Master data(inputs source), DropDown - DO NOT EDIT(VLOOKUP tables -> ruleset.lookups).
Compiler still needs: defined-name resolution, cross-sheet refs ('AS2'!$D$13), VLOOKUP->{kind:lookup},
10 boolean fields + per-sheet input fields.
Phased: P0 refactor(DONE) -> P1 workbook model+definednames+DropDown lookups+VLOOKUP/crossref ->
P2 boolean fields + spec-driven generic gated-sheet importer(simple sheets) -> P3 big sheets ->
P4 Master data as field source + Source ID + ITX/SI compact names.

## DONE 2026-07-21 P0 REFACTOR: split apps/api/src/xltm.ts (610 lines) into apps/api/src/xltm/:
  index.ts (facade re-exports parseXltmToRuleset/XltmImportResult/compileFormula/Workbook)
  text.ts (camel, normLabel — domain-neutral)
  ooxml/zip.ts (readEntries/readZipFile), ooxml/xml.ts (unescapeXml/parseSharedStrings/parseSheetCells/
    colOf/rowOf/Cell), ooxml/workbook.ts (class Workbook.load(buf): getSheet(name) lazy+cached,
    sheetNames, hasSheet, sharedStrings, definedNames[] {name,sheet,ref,raw} parsed via first "!").
  formula/tokenizer.ts (UnsupportedError, Tok, tokenize), formula/parser.ts (Parser, compileFormula,
    booleanCompare, NAME_MAP — NAME_MAP to be injected in P1).
  domain/build-ruleset.ts (parseXltmToRuleset uses Workbook.getSheet).
index.ts import changed to "./xltm/index.js". Old xltm.ts DELETED. VERIFIED: typecheck all green,
17 tests pass, re-upload v63 = data-only 20 outputs 0/0/0. Behavior identical. Target: files <~280 lines.

## DONE 2026-07-21 P1 INFRA: injectable resolver + DropDown lookups + VLOOKUP/defined-names
New files under apps/api/src/xltm/:
- formula/resolve.ts: ResolveContext { resolveName(name):Expr|null, resolveLookupTable(name,col):string|null }.
- domain/lookups.ts: buildDropdownLookups(wb) -> { lookups, resolveLookupTable }. Parses "DropDown - DO
  NOT EDIT" defined-name ranges (width>=2). Lookup id = `${rangeName}#${col}` mapping col1->colN.
  Eagerly builds ranges whose name ends /lookup$/i (6 tables: DSVSystemAbbrToDescrVLOOKUP#2,
  DSVSystemITXLookup#2, FWIdentityOrgNameTypesDescrVLOOKUP#2, MessageTypeAbbrToDescrVLOOKUP#2,
  MessageTypeLookup#2 (665 rows), SourceToDestinationFormatVLOOKUP#2). Others build on demand.
- domain/resolve.ts: buildDsvResolver(wb, resolveLookupTable) -> ResolveContext. FIELD_MAP curated
  aliases (RITMNUMBER->ritmNumber, PARTNERDESIGNATION->partnerCode, RESOLVEDPARTNERID, TYPEOFMAP,
  PARTNERNAME, PARTNERENCODING). Any other defined name -> var(lowerFirst(name)) e.g. ConfigureMailboxes
  ->configureMailboxes, UserAccount->userAccount, PartnerType->partnerType. Unknown -> null (unmapped).
Changed: formula/parser.ts removed internal NAME_MAP; Parser(toks, CompileOptions{cellRefs?,ctx?});
  compileFormula(src, {cellRefs?,ctx?}); nameToExpr delegates to ctx.resolveName; added VLOOKUP (name
  table arg + literal col + optional range_lookup) -> {kind:"lookup",table,key}; IFNA/IFERROR(a,b) ->
  if a is lookup set fallback=b else return a. text.ts +lowerFirst. build-ruleset wires lookups+ctx,
  ruleset.lookups=lookups, compileFormula(formula,{cellRefs,ctx}).
KEY FINDING: only ONE live VLOOKUP in cells (Identities!C1 IFNA(VLOOKUP(B1,FWIdentity...,2,FALSE),"")).
Other sheets' "cross-sheet" is all via defined names (ConfigureAS2/UserAccount/AS2VANSPartner/PartnerType
/UseSSL/EmailUser...) -> handled by resolveName. Raw 'Sheet'!cell refs unused in live formulas (parser
still throws on them as safety). VLOOKUP key cell (B1) needs per-sheet cellRefs mapping -> that's P2.
VERIFIED: active seed now has 6 lookup tables; re-upload v63 = data-only 20 outputs 0/0/0; temp script
compiled VLOOKUP+AS2/Mailbox/Encoding gated formulas OK; typecheck green, 17 tests pass.
NEXT P2: add 10 boolean Selection fields + spec-driven generic gated-sheet importer (Encoding, Virtual
roots, Routing rules, SSH Keys, Control Number, SI HTTP URI, Mail client adapter). Per-sheet input
fields + cellRefs from that sheet's defined names (e.g. Identities B1->orgNameType).

## DONE 2026-07-21 UI: results grouped by SECTION (source sheet) + collapse + hide-empty
User complaint: all generated names piled together on the right. Implemented "option 2".
- packages/naming-engine/src/types.ts: OutputDef +section?:string; GeneratedName +section?:string.
- engine.ts generateNames spreads section into each result.
- Importer sets section: build-ruleset naming+BP outputs -> section=NAMING_SHEET ("Resource and file
  naming"); generic-sheet gated outputs -> section=spec.sheet.
- apps/web/src/components/Results.tsx REWRITTEN: groupBySection(names,hideEmpty) -> section -> category
  tree; each <Section> collapsible (useState open, ▾/▸, count badge); "Hide empty" checkbox (default ON,
  filters value.trim()===""); "shown/total" count; empty value renders "— empty —". Category sub-heading
  <h5> only shown when a section has >1 category. Uses result.names (NOT result.grouped anymore; grouped
  still returned by API, now unused).
- styles.css: added .results-toolbar/.hide-empty/.section/.section-head/.chevron/.section-count/
  .section-body/.cat h5/.copy:disabled.
Engine pkg resolves to SOURCE (package.json exports -> ./src/index.ts) so web/api pick up types w/o build.
VERIFIED: re-seed v13:21:05, all 101 outputs have section; /api/generate names group as Resource and file
naming 18, Encoding 8, Control Number 1, SI HTTP URI 12, Mail client 42, SSH Keys 6, Virtual roots 2,
Routing rules 7. typecheck all green, 17 tests pass. Web http://localhost:5173, API :8787.
PROCESS-KILL LESSON (important): the API command line is RELATIVE `node --import tsx src/index.ts` (cwd
apps/api) — it does NOT contain "Naming Tool", so a filter like '*Naming Tool*src\index.ts*' matches
NOTHING. Use CommandLine -like '*tsx src/index.ts*' to target THIS project's API specifically (avoids other
projects' vite/index.ts). A leftover unkilled API held naming.db + port 8787, so Remove-Item failed
silently (-EA SilentlyContinue) and restart served STALE db (spot the old version timestamp!). Always: kill
by '*tsx src/index.ts*', verify db actually deleted (Test-Path), then restart, then confirm new version ts.
Also: DO NOT use Start-Sleep (tooling forbids it).

## DONE 2026-07-21 P2: 7 gated sheets + cross-sheet computed-name inlining
Result: outputs 20 -> 101, fields -> 35, 6 lookups, valid, 0 warnings; re-upload v63 = data-only 0/0/0;
17 tests pass; typecheck green. Sheets imported: Encoding, Control Number, SI HTTP URI settings, Mail
client adapter settings, SFTP Server SSH Keys, Virtual roots, Routing rules.
Changes:
- packages/naming-engine/src/rulesets/dsv-edi.ts: appended fields — 10 Selection booleans (default "true":
  inboundRequired, outboundRequired, configureMailboxes, configureRoutingRule, configureSSHKeys,
  configureControlNumbers, configureMailClientAdapter, configureHTTPURIAdapter, configureAS2,
  configureCertificates), Master data inputs (unresolvedPartnerID, encoding, partnerType[select cus/par/
  dsv/util], framework[text], mailboxProtocol[select FTP/SFTP]), adapter inputs (emailUser,
  emailUser5Characters, useSSL[boolean], partnerInCamelNotation, controlNumberMessageType). build-ruleset
  uses dsvEdiRuleset.fields so these propagate automatically.
- apps/api/src/xltm/domain/resolve.ts: KEY CHANGE — resolveName now INLINE-EXPANDS computed defined names.
  If a defined name points to a single cell that has a FORMULA (UserAccount='User accounts'!D5,
  PartnerTypeRootMailbox=Mailboxes!D5, PartnerInboxParentMailbox=Mailboxes!D14 which itself nests the
  other two), compile that cell's formula (compileFormula(cell.formula,{ctx})) and return the Expr. Cycle
  guard via `expanding` Set. DropDown single-cell name -> literal text (MailClientAdapterCACertificates).
  Else -> var(lowerFirst(name)) user input. FIELD_MAP aliases unchanged. Verified: UserAccount ->
  cus.manticore; PartnerTypeRootMailbox -> DSV_CUSTOMERS_mb; routing Mailbox(es) -> full nested path.
- apps/api/src/xltm/domain/sheet-specs.ts (NEW): SheetSpec[] = {sheet,category,formulaCols,labelCols,
  rows:[first,last],colLabels?,fallbackLabel?,cellRefs?}. Formula col per sheet: Encoding B(rows1-11),
  Control Number B(row2 only, cellRefs A2->controlNumberMessageType), SI HTTP URI B+C(rows13-20,
  Node1/Node2; skips dup PROD block 27-36), Mail client D/E/F/G(rows10-44, DEV/TEST/QA/PROD),
  SSH Keys D(7-12), Virtual roots D(4-5), Routing rules D(5-11). labelCols pick first non-empty text.
- apps/api/src/xltm/domain/generic-sheet.ts (NEW): importGatedSheets(wb,ctx,usedKeys) -> {outputs,warnings}.
  Compiles each formula cell with {cellRefs:spec.cellRefs, ctx}; label=pickLabel+colSuffix; key=camel(sheet+
  label) deduped via usedKeys (+_${col}${row}). Gating is INSIDE each formula (outer IF on toggle) so no
  `when`; output value is "" when sheet toggled off (verified). Catch/warn+skip on unsupported.
- build-ruleset.ts: after naming loop, `const gated=importGatedSheets(wb,ctx,usedKeys); outputs.push(
  ...gated.outputs); warnings.push(...gated.warnings);` description/compiledCount use outputs.length.
NOTE UI noise: gated-off outputs still render (value ""), and Mail client emits ~40 mostly-constant rows.
Faithful to Excel; optional P4 UX filter to hide "" values. Control Number extra slots (rows 3-7) and
SI HTTP URI PRODUCTION dup block intentionally NOT imported (row ranges).

## P3 NEXT: big sheets. Cross-sheet computed inlining ALREADY works (P2), so mainly add per-sheet input
fields + SheetSpec entries. Watch: FTP Client(118)/SFTP Client(129) have profile1/profile2 + Test columns
(D/E) and many ClientFTP*/ClientSFTP* input defined names -> add as fields. AS2(191, 4 msg-type blocks
D13/74/135/196). Mailboxes(240, D5/D14 already inlined; import the rest incl. nested PartnerType->CUSTOMERS/
PARTNERS/INTERNALS/UTIL). User accounts(15, col D). Identities(9) has the ONLY live VLOOKUP (C1 IFNA(VLOOKUP(
B1,FWIdentityOrgNameTypesDescrVLOOKUP,2,FALSE),"")) -> needs cellRefs B1->orgNameType. HTTP(S) Client
profiles(32). Certificates(rows 25). Use apps/api/src/xltm/_dump.ts pattern to inspect first.

## P2 DETAILED PLAN (SUPERSEDED — see "DONE ... P2" above)
Goal: import the 7 "simple" gated sheets so their names generate, driven by the Selection toggles.
Steps:
1) Boolean fields: add the 10 Selection toggles as engine boolean Fields (group "Selection/Options").
   Keys MUST equal resolver output = lowerFirst(definedName): configureMailboxes, configureRoutingRule,
   configureSSHKeys, configureAS2, configureCertificates, configureHTTPURIAdapter, configureMailClientAdapter,
   configureControlNumbers, inboundRequired, outboundRequired. default "" (blank => TRUE => emit, matches
   Excel OR(NOT(x=FALSE),ISBLANK(x))). Decide: extend dsvEdiRuleset.fields OR synth in build-ruleset.
   NOTE build-ruleset currently sets ruleset.fields = dsvEdiRuleset.fields (hand-authored). For imported
   fields to appear, either (a) add these to dsvEdiRuleset.fields, or (b) build fields dynamically in
   build-ruleset from Master data + Selection + per-sheet inputs (that's P4 direction). For P2 simplest:
   append a small static list of Selection boolean fields + per-sheet input fields to the fields array.
2) Per-sheet input fields + cellRefs: each sheet has defined names whose target is THAT sheet (e.g.
   UserAccount='User accounts'!$D$5, EmailUser='Mail client adapter settings'!$D$3, UseSSL/PartnerInCamelNotation
   ='SI HTTP URI settings'!..., OrgNameType='Identities'!$B$1). Build a cellRefs map {CELL->fieldKey} for
   the sheet being compiled from wb.definedNames filtered by dn.sheet===sheetName (ref like $B$1 -> "B1"->
   lowerFirst(name)). Add those as text input fields. This resolves bare cell refs (e.g. VLOOKUP B1) and
   input cells the formulas read.
3) sheet-specs.ts (data table) + generic-sheet.ts: spec = { sheet, category, formulaCol (usually "B" or
   "D"), labelCol (col holding a human label, often the col left of formula or a header) }. Generic importer:
   for each row with a formula in formulaCol, compile with {cellRefs (from step2), ctx}, derive label
   (from labelCol/adjacent text or fall back to camel), key = lowerFirst/aligned, category = spec.category.
   Gating is ALREADY inside each formula (IF(OR(NOT(flag=FALSE),ISBLANK(flag)),name,"")) so no extra `when`
   needed — the compiled expr returns "" when the toggle is off. (Optionally lift to when: for cleaner UX later.)
   Which col has the emitted NAME differs per sheet: Encoding=B, Virtual roots=D, Routing rules=D, SSH Keys=D,
   Control Number=B, SI HTTP URI=B (and C for test), Mail client adapter=D. VERIFY per sheet before coding
   (dump formulas). Skip rows whose formula is a header/label or duplicate.
4) Wire generic importer into build-ruleset AFTER the naming-sheet loop; append outputs. Keep <~280 line files.
5) VERIFY: re-seed; generate names with e.g. configureMailboxes blank+PartnerType set -> mailbox names
   appear; toggle configureX=false -> those names become "". Re-upload v63 stays data-only (seed==reupload).
   Compare a few against Excel. Update tests/memory.
P3 later: AS2(191), Mailboxes(240 nested IF PartnerType="cus"->"CUSTOMERS"), FTP(118)/SFTP(129) multi-profile
  +Test columns, User accounts(15), Identities(9, uses the VLOOKUP), HTTP client(32). Each needs its own
  input fields; may need extra funcs. P4: Master data as field source, Source ID lookup, ITX/SI compact names.

## Verify commands
- npm test  (engine, 17 pass)
- npm run typecheck --workspaces --if-present  (all green)
- curl.exe -s -F "file=@AAAAXXXXXXX - DSV EDI Naming Tool v63.xltm" -F "note=x" http://localhost:8787/api/versions/import-xltm
