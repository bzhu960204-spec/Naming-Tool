import type { Field, GeneratedName, Ruleset } from "@dsv/naming-engine";

export interface VersionMeta {
  id: number;
  rulesetId: string;
  version: string;
  label: string;
  active: boolean;
  note: string;
  createdAt: string;
}

export interface GroupedNames {
  category: string;
  items: GeneratedName[];
}

export interface ValidationIssue {
  fieldKey: string;
  label: string;
  message: string;
}

export interface GenerateResponse {
  issues: ValidationIssue[];
  names: GeneratedName[];
  grouped: GroupedNames[];
  visibleFieldKeys: string[];
}

export interface RulesetDiff {
  fieldsAdded: { key: string; label: string }[];
  fieldsRemoved: { key: string; label: string }[];
  fieldsChanged: { key: string; label: string }[];
  outputsAdded: { key: string; label: string }[];
  outputsRemoved: { key: string; label: string }[];
  outputsMetaChanged: { key: string; label: string }[];
  outputsLogicChanged: { key: string; label: string }[];
  lookupsAdded: string[];
  lookupsRemoved: string[];
  lookupsChanged: string[];
}

export interface Preflight {
  classification: "data-only" | "logic-change" | "structural";
  selfServe: boolean;
  summary: string;
  diff: RulesetDiff;
}

export interface AuditEntry {
  id: number;
  action: string;
  detail: string;
  createdAt: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async active(): Promise<{ meta: VersionMeta; ruleset: Ruleset }> {
    return json(await fetch("/api/ruleset/active"));
  },
  async generate(values: Record<string, string>): Promise<GenerateResponse> {
    return json(
      await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values }),
      }),
    );
  },
  async versions(): Promise<VersionMeta[]> {
    return (await json<{ versions: VersionMeta[] }>(await fetch("/api/versions")))
      .versions;
  },
  async importRuleset(
    ruleset: unknown,
    note: string,
  ): Promise<{ version: VersionMeta; preflight: Preflight | null }> {
    return json(
      await fetch("/api/versions/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ruleset, note }),
      }),
    );
  },
  async importXltm(
    file: File,
    note: string,
  ): Promise<{
    version: VersionMeta;
    preflight: Preflight | null;
    warnings: string[];
    compiledCount: number;
  }> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("note", note);
    return json(
      await fetch("/api/versions/import-xltm", { method: "POST", body: fd }),
    );
  },
  async activate(id: number): Promise<{ version: VersionMeta }> {
    return json(
      await fetch(`/api/versions/${id}/activate`, { method: "POST" }),
    );
  },
  async audit(): Promise<AuditEntry[]> {
    return (await json<{ entries: AuditEntry[] }>(await fetch("/api/audit")))
      .entries;
  },
};

export type { Field, GeneratedName, Ruleset };
