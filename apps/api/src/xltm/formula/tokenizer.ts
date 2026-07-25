/**
 * Excel formula tokenizer. Splits a formula body into string / number / name /
 * operator tokens. Kept separate from the parser so both stay small.
 */

export class UnsupportedError extends Error {}

export type Tok = { t: "str" | "num" | "name" | "op"; v: string };

export function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  const isName = (c: string) => /[A-Za-z0-9_.$!:]/.test(c);
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let str = "";
      while (j < s.length) {
        if (s[j] === '"') {
          if (s[j + 1] === '"') {
            str += '"';
            j += 2;
            continue;
          }
          break;
        }
        str += s[j];
        j++;
      }
      i = j + 1;
      toks.push({ t: "str", v: str });
      continue;
    }
    if (c === "<" && s[i + 1] === ">") {
      toks.push({ t: "op", v: "<>" });
      i += 2;
      continue;
    }
    if ("(),&=<>+".includes(c)) {
      toks.push({ t: "op", v: c });
      i++;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j]!)) j++;
      toks.push({ t: "num", v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (isName(c)) {
      let j = i;
      while (j < s.length && isName(s[j]!)) j++;
      toks.push({ t: "name", v: s.slice(i, j) });
      i = j;
      continue;
    }
    throw new UnsupportedError(`Unexpected character '${c}'`);
  }
  return toks;
}
