import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  api,
  type AuditEntry,
  type Preflight,
  type VersionMeta,
} from "../api.js";

const CLASS_LABEL: Record<Preflight["classification"], string> = {
  "data-only": "Data-only · self-serve",
  "logic-change": "Logic change · review",
  structural: "Structural · developer review",
};

function PreflightView({ pre }: { pre: Preflight }) {
  const d = pre.diff;
  const rows: { label: string; items: string[] }[] = [
    { label: "Fields added", items: d.fieldsAdded.map((x) => x.label) },
    { label: "Fields removed", items: d.fieldsRemoved.map((x) => x.label) },
    { label: "Fields changed", items: d.fieldsChanged.map((x) => x.label) },
    { label: "Outputs added", items: d.outputsAdded.map((x) => x.label) },
    { label: "Outputs removed", items: d.outputsRemoved.map((x) => x.label) },
    { label: "Output logic changed", items: d.outputsLogicChanged.map((x) => x.label) },
    { label: "Output labels changed", items: d.outputsMetaChanged.map((x) => x.label) },
    { label: "Lookups added", items: d.lookupsAdded },
    { label: "Lookups removed", items: d.lookupsRemoved },
    { label: "Lookups changed", items: d.lookupsChanged },
  ].filter((r) => r.items.length > 0);

  return (
    <div className={`preflight ${pre.classification}`}>
      <div className="pf-head">
        <span className="pf-tag">{CLASS_LABEL[pre.classification]}</span>
        <span>{pre.summary}</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted">No differences from the active ruleset.</p>
      ) : (
        <ul className="pf-list">
          {rows.map((r) => (
            <li key={r.label}>
              <strong>{r.label}:</strong> {r.items.join(", ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminPanel({ onActivated }: { onActivated: () => void }) {
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [pre, setPre] = useState<Preflight | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setVersions(await api.versions());
    setAudit(await api.audit());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function importFromText(raw: string, noteText: string) {
    setErr(null);
    setMsg(null);
    setPre(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setErr("The ruleset must be valid JSON.");
      return;
    }
    try {
      const res = await api.importRuleset(parsed, noteText || "Imported ruleset");
      setPre(res.preflight);
      setMsg(`Imported as version #${res.version.id} (inactive). Review, then activate.`);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function doImport() {
    void importFromText(text, note);
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    setErr(null);
    setMsg(null);
    setPre(null);
    setWarnings([]);

    if (/\.(xltm|xlsm|xltx|xlsx)$/.test(lower)) {
      setBusy(true);
      try {
        const noteText = note || file.name;
        setNote(noteText);
        const res = await api.importXltm(file, noteText);
        setPre(res.preflight);
        setWarnings(res.warnings ?? []);
        setMsg(
          `Parsed ${file.name}: compiled ${res.compiledCount} naming formula(s), ` +
            `stored as version #${res.version.id} (inactive). Review, then activate.`,
        );
        await refresh();
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (lower.endsWith(".json")) {
      const raw = await file.text();
      setText(raw);
      const noteText = note || file.name;
      setNote(noteText);
      await importFromText(raw, noteText);
      return;
    }

    setErr(
      `Unsupported file "${file.name}". Drop a .xltm/.xlsx spreadsheet or a ruleset .json.`,
    );
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    void handleFiles(e.target.files);
    e.target.value = "";
  }

  async function activate(id: number) {
    setErr(null);
    try {
      await api.activate(id);
      setMsg(`Activated version #${id}.`);
      await refresh();
      onActivated();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="admin">
      {err && <div className="banner error">{err}</div>}
      {msg && <div className="banner ok">{msg}</div>}
      {warnings.length > 0 && (
        <div className="banner warn">
          <strong>{warnings.length} warning(s):</strong>
          {warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}

      <div className="admin-grid">
        <section className="panel">
          <h2>Import a new ruleset version</h2>
          <p className="muted">
            Drop the new <code>.xltm</code> spreadsheet (its naming formulas are
            compiled automatically) or a ruleset <code>.json</code>. It is
            validated, compared to the active version, and stored as an inactive
            version until you activate it.
          </p>

          <div
            className={`dropzone${dragging ? " drag" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileInput}
              type="file"
              accept=".xltm,.xlsm,.xltx,.xlsx,.json,application/json"
              hidden
              onChange={onFileChange}
            />
            <span className="dz-icon">⬆</span>
            <p>
              <strong>
                {busy ? "Parsing spreadsheet…" : "Drag & drop the .xltm here"}
              </strong>
              <br />
              or click to browse (.xltm / .xlsx / .json)
            </p>
          </div>

          <input
            className="note-input"
            placeholder="Note (e.g. 'v64 – add SI message-type field')"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <details className="paste-details">
            <summary>Or paste JSON</summary>
            <textarea
              className="ruleset-input"
              placeholder='{ "id": "dsv-edi-naming", "version": "64", ... }'
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
            <button className="primary" onClick={doImport}>
              Import &amp; pre-check
            </button>
          </details>
          {pre && <PreflightView pre={pre} />}
        </section>

        <section className="panel">
          <h2>Versions</h2>
          <table className="versions">
            <thead>
              <tr>
                <th>#</th>
                <th>Version</th>
                <th>Note</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className={v.active ? "active-row" : ""}>
                  <td>{v.id}</td>
                  <td>{v.version}</td>
                  <td className="note-cell">{v.note}</td>
                  <td>{new Date(v.createdAt).toLocaleString()}</td>
                  <td>
                    {v.active ? (
                      <span className="badge">active</span>
                    ) : (
                      <button onClick={() => activate(v.id)}>Activate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ marginTop: "1.5rem" }}>Audit log</h2>
          <ul className="audit">
            {audit.map((a) => (
              <li key={a.id}>
                <span className="audit-action">{a.action}</span>
                <span>{a.detail}</span>
                <span className="audit-time">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
