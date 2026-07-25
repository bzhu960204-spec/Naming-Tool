import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fieldsForOutputs } from "@dsv/naming-engine";
import { api, type GenerateResponse, type Ruleset, type VersionMeta } from "./api.js";
import { NamingForm } from "./components/NamingForm.js";
import { OutputPicker, sectionOf } from "./components/OutputPicker.js";
import { Results } from "./components/Results.js";
import { AdminPanel } from "./components/AdminPanel.js";

type Tab = "generate" | "admin";

function initialValues(ruleset: Ruleset): Record<string, string> {
  const v: Record<string, string> = {};
  for (const f of ruleset.fields) {
    if (f.default !== undefined) v[f.key] = f.default;
    else if (f.type === "boolean") v[f.key] = "false";
    else v[f.key] = "";
  }
  return v;
}

export function App() {
  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [meta, setMeta] = useState<VersionMeta | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [tab, setTab] = useState<Tab>("generate");
  const [error, setError] = useState<string | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadActive = useCallback(async () => {
    try {
      const { ruleset, meta } = await api.active();
      setRuleset(ruleset);
      setMeta(meta);
      setValues((prev) =>
        Object.keys(prev).length ? prev : initialValues(ruleset),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  useEffect(() => {
    if (!ruleset) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        setResult(await api.generate(values));
      } catch (e) {
        setError((e as Error).message);
      }
    }, 150);
  }, [values, ruleset]);

  /** Output keys belonging to the sections the user selected. */
  const selectedOutputKeys = useMemo(() => {
    if (!ruleset) return new Set<string>();
    return new Set(
      ruleset.outputs
        .filter((o) => selectedSections.has(sectionOf(o)))
        .map((o) => o.key),
    );
  }, [ruleset, selectedSections]);

  /** Fields those selected outputs actually depend on (derived from the AST). */
  const requiredFieldKeys = useMemo(
    () => (ruleset ? fieldsForOutputs(ruleset, selectedOutputKeys) : new Set<string>()),
    [ruleset, selectedOutputKeys],
  );

  /** Shown inputs = required-by-outputs ∩ currently-applicable (showWhen). */
  const visibleKeys = useMemo(() => {
    const applicable = result?.visibleFieldKeys ?? ruleset?.fields.map((f) => f.key) ?? [];
    return new Set(applicable.filter((k) => requiredFieldKeys.has(k)));
  }, [result, ruleset, requiredFieldKeys]);

  /** Results limited to the selected sections. */
  const filteredResult = useMemo<GenerateResponse | null>(() => {
    if (!result) return null;
    return {
      ...result,
      names: result.names.filter((n) => selectedOutputKeys.has(n.key)),
    };
  }, [result, selectedOutputKeys]);

  const setValue = (key: string, val: string) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">DSV</span>
          <div>
            <h1>EDI Naming Tool</h1>
            {meta && (
              <p className="sub">
                Active ruleset <strong>{meta.label}</strong> v{meta.version} ·
                #{meta.id}
              </p>
            )}
          </div>
        </div>
        <nav className="tabs">
          <button
            className={tab === "generate" ? "active" : ""}
            onClick={() => setTab("generate")}
          >
            Generate
          </button>
          <button
            className={tab === "admin" ? "active" : ""}
            onClick={() => setTab("admin")}
          >
            Rules &amp; Versions
          </button>
        </nav>
      </header>

      {error && (
        <div className="banner error" onClick={() => setError(null)}>
          {error} (click to dismiss)
        </div>
      )}

      {tab === "generate" && ruleset && (
        <main className="grid">
          <section className="panel">
            <h2>Inputs</h2>
            <OutputPicker
              ruleset={ruleset}
              selected={selectedSections}
              onChange={setSelectedSections}
            />
            {visibleKeys.size === 0 ? (
              <p className="muted">
                Select what you want to name above to reveal only the inputs you need.
              </p>
            ) : (
              <NamingForm
                ruleset={ruleset}
                values={values}
                visibleKeys={visibleKeys}
                onChange={setValue}
              />
            )}
          </section>
          <section className="panel">
            <h2>Generated names</h2>
            <Results result={filteredResult} />
          </section>
        </main>
      )}

      {tab === "admin" && <AdminPanel onActivated={loadActive} />}

      {!ruleset && !error && <div className="loading">Loading ruleset…</div>}
    </div>
  );
}
