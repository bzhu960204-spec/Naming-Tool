# DSV EDI Naming Tool — 项目历史与路线图

> 目标：把 `AAAAXXXXXXX - DSV EDI Naming Tool v63.xltm`（DSV 物流 EDI 命名生成器宏 Excel）
> 重建为一个配置驱动的全栈 TypeScript Web 应用。
>
> 本文档随 Git 仓库同步，换电脑后 `git pull` 即可读到完整的阶段历史与后续计划。

## 源文件（分析必需，已在 `.gitignore` 中放行）

- `AAAAXXXXXXX - DSV EDI Naming Tool v63.xltm` — 原始宏 Excel，API 启动时的
  `resolveSeedXltm()` 会在仓库根目录找最新的 `*.xltm` 做初始 seed，缺它无法 seed。
- `AAAAXXXXXXX - DSV EDI Naming Tool - Instructions re ITX map naming.docx` — 2026-07-03
  ITX map 命名更新说明（MsgType 拆分为 ITX 侧 + SI 侧字段的依据）。

## 大目标

让 importer 能复现 .xltm 里 **全部 24 个 sheet**（最初只支持 "Resource and file naming" 一个）。

## 阶段计划

P0 重构(✅) → P1 基础设施(✅) → P2 简单门控 sheet(✅) → P3 大 sheet(✅) → **P4 收尾（✅ P4b/P4c 完成，P4a 不可行）**

---

## ✅ P0 重构（已完成）

把 610 行的 `apps/api/src/xltm.ts` 拆分为 `apps/api/src/xltm/` 下的模块：

- `index.ts`（facade）、`text.ts`
- `ooxml/`：`zip.ts` / `xml.ts` / `workbook.ts`（`Workbook.load`，懒加载 sheet、解析 definedNames）
- `formula/`：`tokenizer.ts` / `parser.ts`
- `domain/`：`build-ruleset.ts`

结果：typecheck 全绿，17 个测试通过，重传 v63 = data-only 20 outputs 0/0/0，行为不变。目标每个文件 <~280 行。

## ✅ P1 基础设施（已完成）

可注入 resolver + DropDown 查表 + VLOOKUP / 定义名解析。

- `formula/resolve.ts`：`ResolveContext`（`resolveName` / `resolveLookupTable`）
- `domain/lookups.ts`：`buildDropdownLookups(wb)`，解析 "DropDown - DO NOT EDIT" 区域，构建 6 张查表
- `domain/resolve.ts`：`buildDsvResolver`，FIELD_MAP 别名，其它定义名 → `var(lowerFirst(name))`
- parser 支持 VLOOKUP → `{kind:"lookup",table,key}`，IFNA/IFERROR fallback

关键发现：cell 里只有 1 个真正的 VLOOKUP（`Identities!C1`）；其它“跨 sheet”都走定义名。
结果：6 张查表，重传 v63 = data-only，typecheck 绿，17 测试通过。

## ✅ P2 简单门控 sheet + 跨 sheet 计算名内联（已完成）

outputs 20 → 101，fields → 35，6 张查表，0 warning；重传 v63 = data-only 0/0/0；17 测试通过。
导入的 7 个 sheet：Encoding、Control Number、SI HTTP URI settings、Mail client adapter settings、
SFTP Server SSH Keys、Virtual roots、Routing rules。

- `dsv-edi.ts`：新增 10 个 Selection 布尔字段（默认 `"true"`）+ Master data / adapter 输入字段
- `resolve.ts`：`resolveName` 现在会 **内联展开** 指向带公式单元格的定义名（含环路保护）
- 新增 `domain/sheet-specs.ts`（SheetSpec 表）+ `domain/generic-sheet.ts`（`importGatedSheets`）

门控逻辑在每个公式内部（外层 IF 判断开关），关掉开关时输出 `""`。

## ✅ UI：结果按 section（来源 sheet）分组 + 折叠 + 隐藏空值（已完成）

- `types.ts`：`OutputDef` / `GeneratedName` 增加 `section?`
- `Results.tsx` 重写：按 section→category 树，折叠、计数徽标、"Hide empty" 复选框（默认开）

---

## ✅ P3（已完成 2026-07-25）：大 sheet

outputs 101 → **752**，fields → **92**，22 个测试通过；重传 v63 = data-only 0/0/0；typecheck 全绿。
新增导入 6 个 sheet，分两个子阶段：

- **P3.1**（User accounts、Identities、AS2、Mailboxes）：只需给编译器加 `CHAR()` + 给
  `SheetSpec` 加“每列独立 label 列”（`labelColsByCol`，Mailboxes 的 I 列 label 在 H 列）。
- **P3.2**（HTTP(S) / FTP / SFTP Client）：需要给引擎加新原语。

**编译器新支持**（`formula/parser.ts` + `tokenizer.ts`）：`CHAR` / `LEFT` / `LEN` / `FIND` /
`REPLACE` / 算术 `+` `-` / 数字比较 `>`；tokenizer 现在也识别 `-`；`IFERROR(FIND(...),0)`
把第二参数当 FIND 的 fallback（和 lookup 一样）。

**引擎新增**（`types.ts` / `expr.ts` / `schema.ts`）：Expr 种类 `find`/`replace`/`left`/`len`/
`arith(+/-)`，Cond 种类 `gt`。⚠️ 新种类**必须**同时加到 `schema.ts` 的 zod union 和
`collectLookupTables` walker，否则 import 路由会报 "Compiled ruleset is invalid"（seed 路径不走 zod，
import 路径走 zod 校验）。

**字段**（`rulesets/dsv-edi.ts`）：新增 Identities（orgNameType 下拉、partnerName3PP）、AS2
（aS2VANSPartner、aS2MessageType1-4、trustedDigitalCertificate[/Test]）、Mailboxes（batch/delay
MailboxMessageType1-4）、以及 `clientFields[]`（~40 个 HTTP/FTP/SFTP 输入，用 `txt()`/`bln()` 生成）。
字段 key = `lowerFirst(定义名)`，会出现 aS2VANSPartner、clientHTTPUseSSL 这种略丑但必须一致的写法。

**已核对的名字**：User acct `cus.acme`；Identities `ACME - Direct`；AS2 `ACME_TRUECOMMERCE_ORDERS_AS2`；
Mailbox `/DSV_ACCOUNTS_mb/DSV_CUSTOMERS_mb/DSV_cus.acme_mb`；HTTP
`DSV_user_at_acme.com_edi.acme.com_443_SSL_http`（`@→_at_` 靠 FIND/REPLACE）；SFTP profile
`DSV_SSH_svc_at_acme.com_..._pf`（LEFT/LEN 截断到 64）。

**跳过**：Certificates 全是静态模板文字（没有公式单元格）；FTP/SFTP 的 A/B“Rename Profile”行未导入
（D 列 ProfileName 已覆盖），HTTP 的 A36/B36 重命名行有导入（是不同的 `_pf` 名字）。

## � P4（收尾）

- **P4b Source ID lookup（✅ 已完成 2026-07-25）**：导入 "Source ID lookup" sheet 的 C2/C3
  公式（`CONCATENATE(ResolvedPartnerId,"_",E3)`，E3=常量 "DSV"）。新增字段
  `sourceIdDestinationId`（默认 "DSV"）。Sender/Receiver Code = `伙伴ID_DSV`。
  active=754 outputs / 93 fields，重传 v63 = data-only 0/0/0，22 个单测通过。
- **P4a Master data 动态字段（⛔ 不可行 / 跳过）**：`Map1*`/`Map2*`/`CodeList*` 等定义名在工作簿里是
  `#REF!`（宏运行时重建，静态读不到）。现有手写的单映射字段已覆盖需求。
- **P4c ITX / SI 紧凑 map 名（✅ 已完成 2026-07-25，从 VBA 宏还原）**：这几行不是单元格公式——宏在运行时
  **把 Excel 公式写进** "Resource and file naming" 的 B/C 单元格。做法：解出 `xl/vbaProject.bin`
  （CFB/OLE 解析 + MS-OVBA 解压），读到宏写入的公式，逐字转成引擎表达式。
  新增引擎原语 `right`/`rept`/`join`（= TEXTJOIN skipBlank），新增 5 个字段（Direction、System、
  Difference Character、Split Map、FNX Functionality），并在导入器里用 `mapNameOutputs()` 工厂
  接上真实的 `MessageTypeLookup#2` + `DSVSystemITXLookup#2` 追加两个输出。
  active=756 outputs / 98 fields，重传 v63 = data-only 0/0/0，26 个单测通过。
  **两个真实样本精确复现**：`D_TX_CE_ROMDLZxCSRV1xxINRD96AOR` 与
  `DSV_TR_A2A_CAENRCANON_940_4010_824_4010_OUT_RP_mp`；服务端实测
  `ORDERS/INVOIC → D_TX_CE_ROMDLZxORDV1xxFIVD96AOR`。

---

## 关键坑（GOTCHAS）

1. 改完 importer 必须重新 seed：杀掉 API + 删 `apps/api/data/naming.db*` + 重启，否则 active(旧) vs 重传(新) 会显示 structural。
2. 杀 node 进程时按 `'*tsx src/index.ts*'` 精确匹配，**不要**用宽泛的 `vite` 过滤（会误杀别的项目）。
3. PowerShell 5.1：multipart 上传用 `curl.exe -F`，且要在仓库根目录运行。
4. 文件保持 <~280 行；临时脚本用完即删。

## 验证命令

```powershell
npm test            # naming-engine 单元测试（26 通过）
npm run typecheck   # 所有 workspace 全绿
# 重传 v63 应为 data-only 0/0/0：
curl.exe -s -F "file=@AAAAXXXXXXX - DSV EDI Naming Tool v63.xltm" -F "note=x" http://localhost:8787/api/versions/import-xltm
```
