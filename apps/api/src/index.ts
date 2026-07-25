import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  dsvEdiRuleset,
  generateNames,
  groupByCategory,
  validateInputs,
  validateRuleset,
  visibleFields,
  type Ruleset,
} from "@dsv/naming-engine";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { Store } from "./db.js";
import { preflight } from "./diff.js";
import { parseXltmToRuleset } from "./xltm/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const store = new Store(join(__dirname, "..", "data", "naming.db"));
initialSeed();

/**
 * Resolve the workbook to seed from: `SEED_XLTM` env var if set, otherwise the
 * most recently modified `*.xltm` found in the current working directory or the
 * repository root (three levels above apps/api/src).
 */
function resolveSeedXltm(): string | null {
  const fromEnv = process.env.SEED_XLTM;
  if (fromEnv) return fromEnv;
  const searchDirs = [process.cwd(), join(__dirname, "..", "..", "..")];
  const candidates: string[] = [];
  for (const dir of searchDirs) {
    try {
      for (const f of readdirSync(dir)) {
        if (f.toLowerCase().endsWith(".xltm")) candidates.push(join(dir, f));
      }
    } catch {
      // Directory unreadable — skip.
    }
  }
  candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return candidates[0] ?? null;
}

/**
 * Seed the DB (only when empty) from the *actual* .xltm so that re-uploading the
 * same workbook yields a data-only diff instead of a structural one. Falls back
 * to the bundled hand-authored ruleset if no workbook can be parsed.
 */
function initialSeed(): void {
  if (store.getActiveRuleset(dsvEdiRuleset.id)) return;
  try {
    const path = resolveSeedXltm();
    if (path) {
      const buf = readFileSync(path);
      const { ruleset } = parseXltmToRuleset(buf, { active: dsvEdiRuleset });
      store.addVersion(ruleset, `Initial seed from ${path}`, true);
      store.audit("seed", `Seeded ruleset ${ruleset.id} v${ruleset.version} from ${path}`);
      return;
    }
  } catch (e) {
    console.warn(`Could not seed from .xltm, falling back to bundled ruleset: ${(e as Error).message}`);
  }
  store.seedIfEmpty(dsvEdiRuleset);
}

const app = new Hono();
app.use("/api/*", cors());

app.get("/api/health", (c) => c.json({ ok: true }));

/** The currently active ruleset + its version metadata. */
app.get("/api/ruleset/active", (c) => {
  const active = store.getFirstActiveRuleset();
  if (!active) return c.json({ error: "No active ruleset" }, 404);
  return c.json({ meta: active.meta, ruleset: active.ruleset });
});

/** Generate names for a set of input values against the active ruleset. */
app.post("/api/generate", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const values = (body?.values ?? {}) as Record<string, string>;
  const active = store.getFirstActiveRuleset();
  if (!active) return c.json({ error: "No active ruleset" }, 404);

  const issues = validateInputs(active.ruleset, values);
  const names = generateNames(active.ruleset, values);
  return c.json({
    issues,
    names,
    grouped: groupByCategory(names),
    visibleFieldKeys: visibleFields(active.ruleset, values).map((f) => f.key),
  });
});

/** All stored ruleset versions (newest first). */
app.get("/api/versions", (c) => c.json({ versions: store.listVersions() }));

/**
 * Import a candidate ruleset (JSON). Validates it, runs the update pre-check
 * (data-only vs review), and stores it as an INACTIVE new version. Returns the
 * diff + classification so the user can decide whether to activate.
 */
app.post("/api/versions/import", async (c) => {
  const body = await c.req.json().catch(() => null);
  const candidate = body?.ruleset ?? body;
  const validation = validateRuleset(candidate);
  if (!validation.ok) {
    return c.json({ error: "Invalid ruleset", details: validation.errors }, 400);
  }
  const ruleset = candidate as Ruleset;

  const active = store.getActiveRuleset(ruleset.id);
  const pre = active ? preflight(active, ruleset) : null;

  const note =
    typeof body?.note === "string" && body.note.trim()
      ? body.note.trim()
      : "Imported ruleset";
  const meta = store.addVersion(ruleset, note, false);
  store.audit(
    "import",
    `Imported v${ruleset.version} as #${meta.id} (${pre?.classification ?? "initial"})`,
  );

  return c.json({ version: meta, preflight: pre });
});

/**
 * Import a new version directly from an uploaded .xltm/.xlsx spreadsheet. The
 * spreadsheet's naming formulas are compiled into the ruleset model, then run
 * through the same validate + diff + pre-check + version flow as a JSON import.
 */
app.post("/api/versions/import-xltm", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) {
    return c.json({ error: "Upload a .xltm/.xlsx file in the 'file' field." }, 400);
  }
  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim()
      : `Imported ${file.name}`;
  const versionLabel = typeof body.version === "string" ? body.version : undefined;

  let parsedRuleset: import("@dsv/naming-engine").Ruleset;
  let warnings: string[];
  let compiledCount: number;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const active = store.getActiveRuleset(dsvEdiRuleset.id);
    const result = parseXltmToRuleset(buf, {
      ...(versionLabel !== undefined ? { version: versionLabel } : {}),
      active,
    });
    parsedRuleset = result.ruleset;
    warnings = result.warnings;
    compiledCount = result.compiledCount;
  } catch (e) {
    return c.json({ error: `Could not parse spreadsheet: ${(e as Error).message}` }, 400);
  }

  const validation = validateRuleset(parsedRuleset);
  if (!validation.ok) {
    return c.json({ error: "Compiled ruleset is invalid", details: validation.errors }, 400);
  }

  const active = store.getActiveRuleset(parsedRuleset.id);
  const pre = active ? preflight(active, parsedRuleset) : null;
  const meta = store.addVersion(parsedRuleset, note, false);
  store.audit(
    "import-xltm",
    `Imported ${file.name} as #${meta.id} (${compiledCount} outputs, ${pre?.classification ?? "initial"})`,
  );

  return c.json({ version: meta, preflight: pre, warnings, compiledCount });
});

/** Activate a stored version (rollback = activate an older version). */
app.post("/api/versions/:id/activate", (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);
  const meta = store.activateVersion(id);
  if (!meta) return c.json({ error: "Version not found" }, 404);
  return c.json({ version: meta });
});

/** Audit log (who changed what, when). */
app.get("/api/audit", (c) => c.json({ entries: store.listAudit() }));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`[api] DSV EDI Naming API listening on http://localhost:${port}`);
