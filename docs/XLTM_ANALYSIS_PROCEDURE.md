# Reverse-Engineering the DSV EDI Naming Tool `.xltm` — Analysis Procedure

> A field guide to how this macro-enabled Excel workbook was cracked open,
> made human-readable, and analyzed — with the exact PowerShell scripts used.
> Everything here is **zero-dependency** (no Excel, no Python, no npm packages):
> just Windows PowerShell + the built-in `System.IO.Compression` assembly.
>
> Written 2026-07-25 while confirming where the ITX/SI "map name" values come
> from (spoiler: a VBA macro behind the **"Generate Tables For Maps"** button on
> the *Master data* sheet — not any static cell).

---

## 0. TL;DR — the one thing to understand

An `.xltm` (like `.xlsx`/`.xlsm`) is **just a ZIP archive** of XML files plus,
for macro workbooks, one binary blob of compiled VBA. So the whole "program"
can be unpacked and read without Excel:

```
AAAAXXXXXXX - DSV EDI Naming Tool v63.xltm   ← rename to .zip and it opens
└── (ZIP)
    ├── xl/workbook.xml              ← list of sheets (name ↔ internal id)
    ├── xl/_rels/workbook.xml.rels   ← id ↔ file (sheetN.xml)
    ├── xl/worksheets/sheet1..24.xml ← the cells: formulas + cached values
    ├── xl/sharedStrings.xml         ← all text, referenced by index
    ├── xl/drawings/drawingN.xml     ← buttons/shapes on sheets
    ├── xl/drawings/vmlDrawingN.vml  ← form-control → macro wiring (FmlaMacro)
    ├── xl/ctrlProps/ctrlPropN.xml   ← form-control properties
    └── xl/vbaProject.bin            ← the VBA macros (compiled, compressed)
```

Two kinds of "logic" live inside:

| Where | How to read it | Faithfulness |
|-------|----------------|--------------|
| **Cell formulas** (`<f>` in `sheetN.xml`) | Plain text, directly readable | 100% — it *is* the formula |
| **VBA macros** (`vbaProject.bin`) | Compiled + MS-OVBA compressed | Partially readable via token/context extraction |

The naming tool is a **hybrid**: most names are live cell formulas, but the
compact ITX/SI map names are *written into the sheet at run time by a macro* —
which is why they don't exist in any static cell.

---

## 1. Why PowerShell + `System.IO.Compression`

- Available on any Windows box, no install.
- `[System.IO.Compression.ZipFile]::OpenRead(path)` reads ZIP entries **in place**
  (no need to copy/rename to `.zip` or extract to disk).
- The sheet/relationship/shared-string XML is simple and regular enough that
  **regex extraction is enough** — no XML DOM needed for a quick investigation.

> Convention used here: write each probe to a temporary `_*.ps1`, run it, read
> the output, then **delete it** (`Remove-Item _*.ps1`). Nothing permanent is
> added to the repo.

Common preamble used by every script below:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
$zip = [System.IO.Compression.ZipFile]::OpenRead(
  (Resolve-Path "AAAAXXXXXXX - DSV EDI Naming Tool v63.xltm"))

function ReadEntry($name){
  $e = $zip.Entries | Where-Object { $_.FullName -eq $name }
  if (-not $e) { return $null }
  $r = New-Object IO.StreamReader($e.Open()); $t = $r.ReadToEnd(); $r.Close(); $t
}
# ... probes ...
$zip.Dispose()
```

> **Gotcha:** paste-running a large here-string interactively can hang the
> console. The reliable pattern is: `Set-Content -Path "_probe.ps1" -Value $script`
> then `powershell -ExecutionPolicy Bypass -File "_probe.ps1"`.

---

## 2. Step 1 — map sheet **names** to their XML **files**

Excel doesn't store the sheet's display name in `sheetN.xml`. You must join two
files: `workbook.xml` (name → `r:id`) and `xl/_rels/workbook.xml.rels`
(`r:id` → target file).

```powershell
$wb   = ReadEntry "xl/workbook.xml"
$rels = ReadEntry "xl/_rels/workbook.xml.rels"

$rid2t = @{}
[regex]::Matches($rels,'Id="([^"]+)"[^>]*Target="([^"]+)"') |
  ForEach-Object { $rid2t[$_.Groups[1].Value] = ($_.Groups[2].Value -replace '^/?','') }

foreach ($m in [regex]::Matches($wb,'<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"')) {
  $name = $m.Groups[1].Value; $file = $rid2t[$m.Groups[2].Value]
  "{0,-32} -> {1}" -f $name, $file
}
```

**Result for this workbook (24 sheets):**

```
Document Control              -> worksheets/sheet1.xml
Info                          -> worksheets/sheet2.xml
Selection                     -> worksheets/sheet3.xml
Master data                   -> worksheets/sheet4.xml   ← the input + buttons
Resource and file naming      -> worksheets/sheet5.xml   ← the output names
DSV FW, Identities, Encoding, Source ID lookup, User accounts, Mailboxes,
Virtual roots, Routing rules, FTP/SFTP Client, SFTP Server SSH Keys, AS2,
Certificates, Mail client adapter settings, SI HTTP URI settings,
HTTP(S) Client profiles, Control Number,
DropDown - DO NOT EDIT        -> worksheets/sheet23.xml  ← VLOOKUP tables
Tech Team Notes               -> worksheets/sheet24.xml
```

---

## 3. Step 2 — dump a sheet's cells: formula **vs** cached value

Each `<c>` (cell) can carry a formula `<f>` **and** the value Excel last computed
`<v>`. For a formula that returns text, `<v>` holds the actual result string
(`t="str"`); for a plain text cell, `<v>` is an **index into sharedStrings**
(`t="s"`).

```powershell
$xml = ReadEntry "xl/worksheets/sheet5.xml"   # Resource and file naming
foreach ($m in [regex]::Matches($xml,'<c\s+r="([A-C](?:[1-9]|1[0-4]))"([^>]*?)(?:/>|>(.*?)</c>)')) {
  $ref = $m.Groups[1].Value; $inner = $m.Groups[3].Value
  $f = ([regex]::Match($inner,'<f[^>]*>(.*?)</f>')).Groups[1].Value
  $v = ([regex]::Match($inner,'<v[^>]*>(.*?)</v>')).Groups[1].Value
  "{0}  f=[{1}]  v=[{2}]" -f $ref, $f, $v
}
```

> **Critical regex gotcha:** cells can be **self-closing** (`<c r="A2"/>`). If you
> only match `<c ...>...</c>`, a greedy match swallows following cells and
> corrupts everything. The pattern above handles both forms with
> `(?:/>|>(.*?)</c>)`. (This same bug bit the TS importer once — see repo memory.)

**What this revealed on sheet5:**

- **`B3` doesn't exist** (empty). The map-name output people expect there is
  simply not a cell.
- The real live formulas *are* present and match the app, e.g.
  - `B5` = `IF(ISBLANK(ResolvedPartnerId)=TRUE,"…",CONCATENATE("DSV_CL_SourceIDLookup_",ResolvedPartnerId,"_D10B_CDM_V2_cl"))`
  - `B14` = the Resource Tag `IF(OR(ISBLANK(RITMNumber)…),"…",IF(TypeOfMap="ITX","RT not required…",_xlfn.CONCAT("DSV_",RITMNumber,"_",PartnerDesignation,"_0.1_rt")))`

---

## 4. Step 3 — resolve shared strings (optional but handy)

```powershell
$ss = ReadEntry "xl/sharedStrings.xml"
$strings = New-Object System.Collections.ArrayList
foreach ($m in [regex]::Matches($ss,'<si>([\s\S]*?)</si>')) {   # note [\s\S], not .
  $t = ""
  foreach ($tm in [regex]::Matches($m.Groups[1].Value,'<t[^>]*>([\s\S]*?)</t>')) { $t += $tm.Groups[1].Value }
  [void]$strings.Add($t)
}
$strings[125]   # look up index 125
```

> **Gotcha:** use `[\s\S]*?` not `.*?`. PowerShell regex is single-line by
> default, so `.` stops at newlines and a rich-text `<si>` split across lines
> gets miscounted, throwing off every subsequent index.

---

## 5. Step 4 — the decisive search: "does this value exist anywhere?"

To test the hypothesis *"the map name is a hidden formula / cached value
somewhere"*, search **every** worksheet's raw cell content, and all shared
strings, for the signature substrings:

```powershell
foreach ($e in $zip.Entries) {
  if ($e.FullName -match '^xl/worksheets/sheet\d+\.xml$') {
    $x = ReadEntry $e.FullName
    foreach ($m in [regex]::Matches($x,'<c\s+r="([A-Z]+\d+)"[^>]*?>(.*?)</c>')) {
      if ($m.Groups[2].Value -match 'D_TX_|DSV_TR|SPLITxx') {
        "$($e.FullName) $($m.Groups[1].Value): $($m.Groups[2].Value)"
      }
    }
  }
}
```

**Result: ZERO hits** across all 24 sheets and all shared strings. Combined with
Step 3 this *proves* the compact map name is not produced by any saved cell — it
must come from the macro.

---

## 6. Step 5 — detect and read the VBA (`vbaProject.bin`)

### 6a. Confirm it exists and raw-search it

```powershell
foreach ($e in $zip.Entries) {
  $ms = New-Object IO.MemoryStream; $s = $e.Open(); $s.CopyTo($ms); $s.Close()
  $txt = [System.Text.Encoding]::ASCII.GetString($ms.ToArray())
  if ($txt -match 'D_TX|DSV_TR') { "HIT in $($e.FullName)" }
}
# -> HIT in xl/vbaProject.bin
```

So the map-name logic lives **only** in the VBA.

### 6b. Why you can't just read it, and the trick that works

`vbaProject.bin` is a **Compound File (OLE/CFB)** whose module source streams are
**MS-OVBA compressed**. A full decode means parsing the CFB directory + running
the MS-OVBA LZ-style decompressor. But for *investigation* you rarely need that:
the compression leaves most identifiers and string literals **verbatim** in
place. So convert the binary to "printable-or-space" and mine it.

```powershell
$e  = $zip.Entries | Where-Object { $_.FullName -eq "xl/vbaProject.bin" }
$ms = New-Object IO.MemoryStream; $s = $e.Open(); $s.CopyTo($ms); $s.Close()
$b  = $ms.ToArray()

$sb = New-Object System.Text.StringBuilder
foreach ($by in $b) { if ($by -ge 32 -and $by -le 126) { [void]$sb.Append([char]$by) } else { [void]$sb.Append(' ') } }
$clean = $sb.ToString()

# (i) Which identifiers/triggers survive?
$hits = @{}
foreach ($m in [regex]::Matches($clean,'[A-Za-z_][A-Za-z0-9_]{4,}')) {
  if ($m.Value -match 'Worksheet_|Workbook_|_Change|_Click|Generate|Build|MapName|Resource|Naming|D_TX|DSV_TR|Split') { $hits[$m.Value] = 1 }
}
$hits.Keys | Sort-Object
```

**Surviving tokens included:** `D_TX_`, `D_TX_DX_`, `D_TX_FX_`, `DSV_TR`,
`SPLITxx`, `SplitMapFlag`, `strFormulaMapNameCheck`, `building`, `generate`,
`naming`, `Resource`.

### 6c. Read the surrounding source with a context window

Print ~120 chars either side of each anchor to reconstruct near-readable code:

```powershell
foreach ($a in @('strFormulaMapNameCheck','D_TX_','DSV_TR','SplitMapFlag','Resource and file')) {
  $i = 0
  while (($i = $clean.IndexOf($a,$i)) -ge 0) {
    $start = [Math]::Max(0,$i-120); $len = [Math]::Min(300,$clean.Length-$start)
    "[$a] ..." + (($clean.Substring($start,$len)) -replace '\s{2,}',' ') + "..."
    $i += $a.Length
  }
}
```

**This laid the logic bare.** The macro *builds an Excel formula string* and its
comments narrate the intent:

- *"Then we create the name rows in the Resource and file names worksheet."*
- *"Creating map name rows in the Resource and file naming worksheet."*
- *"Which row currently has the header reading 'Code Lists' … in the 'Resource and file naming' worksheet."*
- *"Removing Bold format from the entire row in the table."*

And the formula it writes matches our TypeScript transcription **verbatim**:

```
IF(AND(OR(...="DES",...="FNX"), SplitMapFlag="No"),
   TEXTJOIN("",TRUE, IF(...="DES","D_TX_DX_","D_TX_FX_"),
     IF(LEN(PartnerDesignation)>=7, LEFT(UPPER(PartnerDesignation),7),
        UPPER(PartnerDesignation)&REPT("x",7-LEN(PartnerDesignation))), …
TEXTJOIN("_",TRUE, UPPER(TEXTJOIN("_",TRUE,"DSV_TR", …)), IF(...="DES","dox","fnx")) …
IFNA(VLOOKUP(DestinationMessageTypeITX, MessageTypeLookup, 2, FALSE), "???") …
IF(SplitMapFlag="Yes","SPLITxx", …) … "DIRECTION_IS_MANDATORY" …
"DO NOT SELECT DES OR FNX FOR SPLIT MAP"
```

Module list (from the readable `PROJECT`-area tokens) showed **only** `Document=`
modules (`ThisWorkbook`, `Sheet1..24`) — i.e. no standard `.bas` modules, so the
routines are workbook/sheet code-behind invoked by controls, not by
`Worksheet_Change`.

> If you need the *exact, complete* source, that's when you implement the real
> decode: CFB directory parse to find the module stream, then MS-OVBA
> decompression (`[MS-OVBA] 2.4.1`). For "what does it do and when", the
> printable-window mining above was sufficient.

---

## 7. Step 6 — find the button and the macro it calls

Form-control buttons wire to a macro through the legacy **VML** (`FmlaMacro`),
and their captions/anchors live in the **DrawingML** (`drawingN.xml`).

```powershell
# 7a. macro wiring (which Sub each button calls)
foreach ($n in 1..4) {
  $v = ReadEntry "xl/drawings/vmlDrawing$n.vml"
  if ($v) { foreach ($m in [regex]::Matches($v,'FmlaMacro>(.*?)<')) { "vml$n -> $($m.Groups[1].Value)" } }
}

# 7b. button captions
foreach ($n in 1..4) {
  $x = ReadEntry "xl/drawings/drawing$n.xml"
  if ($x) { foreach ($m in [regex]::Matches($x,'<a:t>(.*?)</a:t>')) { "drawing$n text=$($m.Groups[1].Value)" } }
}

# 7c. which sheet owns which drawing (via each sheet's rels)
foreach ($e in $zip.Entries) {
  if ($e.FullName -match 'xl/worksheets/_rels/(sheet\d+)\.xml\.rels') {
    $sheet = $Matches[1]; $r = ReadEntry $e.FullName
    foreach ($m in [regex]::Matches($r,'Target="([^"]*drawing\d+\.xml)"')) { "$sheet -> $($m.Groups[1].Value)" }
  }
}
```

**Results:**

| Button caption | Macro | On sheet |
|----------------|-------|----------|
| **Generate Tables For Maps** | `ThisWorkbook.CreateMapTable` | **Master data** (sheet4 → drawing1) |
| Generate Tables For Code Lists | `ThisWorkbook.CreateCodeListTable` | Master data |
| Generate Tables For Stylesheets | `ThisWorkbook.CreateStylesheetTable` | Master data |
| Generate Password | `ThisWorkbook.GeneratePassword` | User accounts (sheet10 → drawing2) |
| Copy … bpml to clipboard | `ThisWorkbook.CopyClientFTPBPbpmlToClipboard` | FTP/SFTP Client (sheet14/15) |

---

## 8. Conclusions reached from this procedure

1. **The ITX/SI compact map name is real**, and its logic is the formula built by
   `CreateMapTable` behind **Master data → "Generate Tables For Maps"**.
2. **It is not a static cell.** With macros disabled (or the button un-clicked),
   it exists nowhere — hence an empty `B3`. The macro *inserts rows* into
   *Resource and file naming* and writes the formula into them at run time.
3. **Our TypeScript reproduction is faithful** — it matches the VBA-built formula
   token-for-token (`D_TX_DX_/FX_`, `REPT("x",7-LEN(...))`, the `TEXTJOIN` shape,
   `IFNA(VLOOKUP(...,MessageTypeLookup,2,FALSE),"???")`, `SPLITxx`,
   `DIRECTION_IS_MANDATORY`, the DES/FNX branch, etc.).
4. **The web tool is arguably better** for this value: it computes the same name
   live from inputs with no macro, no button, and no workbook mutation.
5. Open question (not yet decoded): whether clicking the button repeatedly is
   idempotent (clears & rebuilds) or **appends** duplicate rows. Answering this
   precisely needs a full MS-OVBA decode of `CreateMapTable`.

---

## 9. Reusable checklist for any macro-enabled workbook

1. `OpenRead` the file as a ZIP; list `$zip.Entries`.
2. Join `workbook.xml` + `workbook.xml.rels` → **sheet name ↔ `sheetN.xml`**.
3. Dump target sheets' `<c>` cells, capturing **both** `<f>` and `<v>`
   (handle self-closing cells!).
4. Parse `sharedStrings.xml` with `[\s\S]` if you need text-cell values.
5. **Prove/disprove** a value's origin by searching *all* sheets + shared strings.
6. If absent, check for `vbaProject.bin`; raw-search it for the signature.
7. Mine the VBA with printable-or-space conversion + **anchor context windows**.
8. Trace buttons: `vmlDrawing*.vml` `FmlaMacro` (→ Sub) + `drawing*.xml` `<a:t>`
   (caption) + each sheet's `_rels` (→ owning sheet).
9. Only implement full **CFB + MS-OVBA** decode if you need exact/complete source.

---

## 10. Cleanup

Every probe here was a throwaway. When done:

```powershell
Remove-Item _*.ps1 -ErrorAction SilentlyContinue
```

Nothing in this procedure modifies the workbook — all reads are via
`ZipFile::OpenRead`, which cannot write.
