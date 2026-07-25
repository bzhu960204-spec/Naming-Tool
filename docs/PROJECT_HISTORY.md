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

P0 重构(✅) → P1 基础设施(✅) → P2 简单门控 sheet(✅) → **P3 大 sheet（下一步）** → P4 收尾

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

## 🔜 P3（下一步）：大 sheet

跨 sheet 计算名内联在 P2 已可用，所以主要工作是 **补每个 sheet 的输入字段 + SheetSpec**：

- **FTP Client(118) / SFTP Client(129)**：有 profile1/profile2 + Test 列（D/E），大量 `ClientFTP*` / `ClientSFTP*` 输入定义名
- **AS2(191)**：4 个消息类型块（D13/74/135/196）
- **Mailboxes(240)**：D5/D14 已内联，其余含嵌套 PartnerType→CUSTOMERS/PARTNERS/INTERNALS/UTIL
- **User accounts(15)**：col D
- **Identities(9)**：唯一的活 VLOOKUP（C1），需要 `cellRefs B1→orgNameType`
- **HTTP(S) Client profiles(32)**、**Certificates(rows 25)**

可用 `apps/api/src/xltm/_dump.ts` 模式先 dump 公式再写。

## 🔜 P4（收尾）

Master data 作为字段来源、Source ID lookup、ITX/SI 紧凑命名。

---

## 关键坑（GOTCHAS）

1. 改完 importer 必须重新 seed：杀掉 API + 删 `apps/api/data/naming.db*` + 重启，否则 active(旧) vs 重传(新) 会显示 structural。
2. 杀 node 进程时按 `'*tsx src/index.ts*'` 精确匹配，**不要**用宽泛的 `vite` 过滤（会误杀别的项目）。
3. PowerShell 5.1：multipart 上传用 `curl.exe -F`，且要在仓库根目录运行。
4. 文件保持 <~280 行；临时脚本用完即删。

## 验证命令

```powershell
npm test            # naming-engine 单元测试（17 通过）
npm run typecheck   # 所有 workspace 全绿
# 重传 v63 应为 data-only 0/0/0：
curl.exe -s -F "file=@AAAAXXXXXXX - DSV EDI Naming Tool v63.xltm" -F "note=x" http://localhost:8787/api/versions/import-xltm
```
