import { useMemo, useState } from "react";
import type { GeneratedName } from "@dsv/naming-engine";
import type { GenerateResponse } from "../api.js";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy"
      title="Copy"
      disabled={!text}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? "✓" : "Copy"}
    </button>
  );
}

interface CategoryGroup {
  category: string;
  items: GeneratedName[];
}
interface SectionGroup {
  section: string;
  count: number;
  categories: CategoryGroup[];
}

/** Group names by their source worksheet (section) then category, preserving order. */
function groupBySection(
  names: GeneratedName[],
  hideEmpty: boolean,
): SectionGroup[] {
  const order: string[] = [];
  const map = new Map<string, Map<string, GeneratedName[]>>();
  for (const n of names) {
    if (hideEmpty && n.value.trim() === "") continue;
    const section = n.section ?? n.category ?? "Other";
    if (!map.has(section)) {
      map.set(section, new Map());
      order.push(section);
    }
    const cats = map.get(section)!;
    if (!cats.has(n.category)) cats.set(n.category, []);
    cats.get(n.category)!.push(n);
  }
  return order.map((section) => {
    const cats = map.get(section)!;
    const categories = [...cats.entries()].map(([category, items]) => ({
      category,
      items,
    }));
    const count = categories.reduce((s, c) => s + c.items.length, 0);
    return { section, count, categories };
  });
}

function NameRow({ item }: { item: GeneratedName }) {
  return (
    <div className="name-row">
      <div className="name-meta">
        <span className="name-label">{item.label}</span>
        {item.note && <span className="name-note">{item.note}</span>}
      </div>
      <div className="name-value">
        <code>{item.value || <span className="muted">— empty —</span>}</code>
        <CopyButton text={item.value} />
      </div>
    </div>
  );
}

function Section({ group }: { group: SectionGroup }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`section ${open ? "open" : "closed"}`}>
      <button className="section-head" onClick={() => setOpen((o) => !o)}>
        <span className="chevron">{open ? "▾" : "▸"}</span>
        <span className="section-title">{group.section}</span>
        <span className="section-count">{group.count}</span>
      </button>
      {open && (
        <div className="section-body">
          {group.categories.map((c) => (
            <div className="cat" key={c.category}>
              {group.categories.length > 1 && <h5>{c.category}</h5>}
              {c.items.map((item) => (
                <NameRow key={item.key} item={item} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Results({ result }: { result: GenerateResponse | null }) {
  const [hideEmpty, setHideEmpty] = useState(true);
  const sections = useMemo(
    () => (result ? groupBySection(result.names, hideEmpty) : []),
    [result, hideEmpty],
  );

  if (!result) return <p className="muted">Enter values to generate names.</p>;

  const total = result.names.length;
  const shown = sections.reduce((s, g) => s + g.count, 0);

  return (
    <div className="results">
      {result.issues.length > 0 && (
        <div className="banner warn">
          {result.issues.map((i) => (
            <div key={i.fieldKey}>• {i.message}</div>
          ))}
        </div>
      )}

      <div className="results-toolbar">
        <label className="hide-empty">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
          />
          Hide empty
        </label>
        <span className="results-count muted">
          {shown} / {total} names
        </span>
      </div>

      {sections.length === 0 && (
        <p className="muted">No names generated yet.</p>
      )}

      {sections.map((g) => (
        <Section key={g.section} group={g} />
      ))}
    </div>
  );
}
