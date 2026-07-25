import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Ruleset } from "@dsv/naming-engine";

export interface VersionMeta {
  id: number;
  rulesetId: string;
  version: string;
  label: string;
  active: boolean;
  note: string;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  action: string;
  detail: string;
  createdAt: string;
}

/**
 * Thin persistence layer over Node's built-in SQLite (`node:sqlite`).
 * Rulesets are stored as JSON blobs, one row per version, with exactly one active
 * row per ruleset id. Kept behind this module so it can be swapped for
 * Prisma/PostgreSQL later without touching the routes.
 */
export class Store {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ruleset_version (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        ruleset_id TEXT NOT NULL,
        version    TEXT NOT NULL,
        label      TEXT NOT NULL DEFAULT '',
        json       TEXT NOT NULL,
        active     INTEGER NOT NULL DEFAULT 0,
        note       TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        action     TEXT NOT NULL,
        detail     TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
    `);
  }

  private rowToMeta(row: Record<string, unknown>): VersionMeta {
    return {
      id: Number(row.id),
      rulesetId: String(row.ruleset_id),
      version: String(row.version),
      label: String(row.label),
      active: Number(row.active) === 1,
      note: String(row.note),
      createdAt: String(row.created_at),
    };
  }

  seedIfEmpty(ruleset: Ruleset): void {
    const count = this.db
      .prepare("SELECT COUNT(*) AS n FROM ruleset_version WHERE ruleset_id = ?")
      .get(ruleset.id) as { n: number };
    if (count.n > 0) return;
    this.addVersion(ruleset, "Initial seed from bundled ruleset", true);
    this.audit("seed", `Seeded ruleset ${ruleset.id} v${ruleset.version}`);
  }

  addVersion(ruleset: Ruleset, note: string, activate = false): VersionMeta {
    const createdAt = new Date().toISOString();
    if (activate) {
      this.db
        .prepare("UPDATE ruleset_version SET active = 0 WHERE ruleset_id = ?")
        .run(ruleset.id);
    }
    const info = this.db
      .prepare(
        `INSERT INTO ruleset_version (ruleset_id, version, label, json, active, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ruleset.id,
        ruleset.version,
        ruleset.name,
        JSON.stringify(ruleset),
        activate ? 1 : 0,
        note,
        createdAt,
      );
    return this.getVersionMeta(Number(info.lastInsertRowid))!;
  }

  activateVersion(id: number): VersionMeta | null {
    const meta = this.getVersionMeta(id);
    if (!meta) return null;
    this.db
      .prepare("UPDATE ruleset_version SET active = 0 WHERE ruleset_id = ?")
      .run(meta.rulesetId);
    this.db.prepare("UPDATE ruleset_version SET active = 1 WHERE id = ?").run(id);
    this.audit("activate", `Activated version #${id} (v${meta.version})`);
    return this.getVersionMeta(id);
  }

  getActiveRuleset(rulesetId: string): Ruleset | null {
    const row = this.db
      .prepare(
        "SELECT json FROM ruleset_version WHERE ruleset_id = ? AND active = 1 LIMIT 1",
      )
      .get(rulesetId) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as Ruleset) : null;
  }

  getFirstActiveRuleset(): { meta: VersionMeta; ruleset: Ruleset } | null {
    const row = this.db
      .prepare("SELECT * FROM ruleset_version WHERE active = 1 LIMIT 1")
      .get() as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      meta: this.rowToMeta(row),
      ruleset: JSON.parse(String(row.json)) as Ruleset,
    };
  }

  getVersionMeta(id: number): VersionMeta | null {
    const row = this.db
      .prepare("SELECT * FROM ruleset_version WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToMeta(row) : null;
  }

  getRuleset(id: number): Ruleset | null {
    const row = this.db
      .prepare("SELECT json FROM ruleset_version WHERE id = ?")
      .get(id) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as Ruleset) : null;
  }

  listVersions(): VersionMeta[] {
    const rows = this.db
      .prepare("SELECT * FROM ruleset_version ORDER BY id DESC")
      .all() as Record<string, unknown>[];
    return rows.map((r) => this.rowToMeta(r));
  }

  audit(action: string, detail: string): void {
    this.db
      .prepare(
        "INSERT INTO audit (action, detail, created_at) VALUES (?, ?, ?)",
      )
      .run(action, detail, new Date().toISOString());
  }

  listAudit(limit = 100): AuditEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM audit ORDER BY id DESC LIMIT ?")
      .all(limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: Number(r.id),
      action: String(r.action),
      detail: String(r.detail),
      createdAt: String(r.created_at),
    }));
  }
}
