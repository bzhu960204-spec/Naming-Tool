/** Small, domain-neutral string helpers shared by the compiler and builder. */

/** camelCase a human label, collapsing any non-alphanumeric runs. */
export function camel(name: string): string {
  return name
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
}

/** Normalize a label for stable matching (lowercase, alphanumerics only). */
export function normLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Turn an already identifier-like Excel defined name (e.g. "ConfigureMailboxes",
 * "UserAccount") into an engine field key by lowercasing only the first letter,
 * preserving its internal casing. Use this for defined names; use `camel` for
 * human labels with spaces.
 */
export function lowerFirst(name: string): string {
  const s = name.replace(/[^A-Za-z0-9]+/g, "");
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
