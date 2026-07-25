import { Fragment } from "react";
import type { Field, Ruleset } from "../api.js";

interface Props {
  ruleset: Ruleset;
  values: Record<string, string>;
  visibleKeys: Set<string>;
  onChange: (key: string, value: string) => void;
}

function groupOrder(fields: Field[]): string[] {
  const seen: string[] = [];
  for (const f of fields) {
    const g = f.group ?? "General";
    if (!seen.includes(g)) seen.push(g);
  }
  return seen;
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {!field.required && <option value="">—</option>}
        {(field.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label ?? o.value}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "boolean") {
    return (
      <label className="switch">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
        <span>{value === "true" ? "Yes" : "No"}</span>
      </label>
    );
  }
  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      value={value}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function NamingForm({ ruleset, values, visibleKeys, onChange }: Props) {
  return (
    <form className="form" onSubmit={(e) => e.preventDefault()}>
      {groupOrder(ruleset.fields).map((group) => {
        const fields = ruleset.fields.filter(
          (f) => (f.group ?? "General") === group && visibleKeys.has(f.key),
        );
        if (fields.length === 0) return null;
        return (
          <Fragment key={group}>
            <h3 className="group">{group}</h3>
            {fields.map((f) => (
              <div className="field" key={f.key}>
                <label>
                  {f.label}
                  {f.required && <span className="req">*</span>}
                </label>
                <FieldControl
                  field={f}
                  value={values[f.key] ?? ""}
                  onChange={(v) => onChange(f.key, v)}
                />
                {f.help && <p className="help">{f.help}</p>}
              </div>
            ))}
          </Fragment>
        );
      })}
    </form>
  );
}
