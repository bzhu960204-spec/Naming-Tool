import { useMemo, useState } from "react";
import type { Ruleset } from "../api.js";

interface Props {
  ruleset: Ruleset;
  /** Selected section names. */
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

interface SectionInfo {
  section: string;
  count: number;
}

/** Section name for an output, mirroring the grouping used in Results. */
export function sectionOf(o: { section?: string; category: string }): string {
  return o.section ?? o.category ?? "Other";
}

function sectionsOf(ruleset: Ruleset): SectionInfo[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const o of ruleset.outputs) {
    const s = sectionOf(o);
    if (!counts.has(s)) {
      counts.set(s, 0);
      order.push(s);
    }
    counts.set(s, counts.get(s)! + 1);
  }
  return order.map((section) => ({ section, count: counts.get(section)! }));
}

export function OutputPicker({ ruleset, selected, onChange }: Props) {
  const [open, setOpen] = useState(true);
  const sections = useMemo(() => sectionsOf(ruleset), [ruleset]);

  const toggle = (section: string) => {
    const next = new Set(selected);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    onChange(next);
  };

  const selectAll = () => onChange(new Set(sections.map((s) => s.section)));
  const clear = () => onChange(new Set());

  const total = sections.length;
  const chosen = selected.size;

  return (
    <div className={`picker ${open ? "open" : "closed"}`}>
      <button
        type="button"
        className="picker-head"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="chevron">{open ? "▾" : "▸"}</span>
        <span className="picker-title">What do you want to name?</span>
        <span className="picker-count">
          {chosen} / {total}
        </span>
      </button>

      {open && (
        <div className="picker-body">
          <div className="picker-actions">
            <button type="button" onClick={selectAll}>
              Select all
            </button>
            <button type="button" onClick={clear}>
              Clear
            </button>
          </div>
          <div className="picker-chips">
            {sections.map((s) => {
              const on = selected.has(s.section);
              return (
                <button
                  type="button"
                  key={s.section}
                  className={`chip ${on ? "chip-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggle(s.section)}
                >
                  <span className="chip-check">{on ? "✓" : ""}</span>
                  <span className="chip-label">{s.section}</span>
                  <span className="chip-count">{s.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
