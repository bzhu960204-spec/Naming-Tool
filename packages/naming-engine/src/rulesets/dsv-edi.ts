import type { Ruleset } from "../types.js";
import { dsvEdiFields } from "./dsv-edi/fields.js";
import { dsvEdiOutputs } from "./dsv-edi/outputs.js";

export { mapNameOutputs } from "./dsv-edi/map-names.js";

/**
 * DSV EDI naming ruleset — reverse-engineered from
 * "AAAAXXXXXXX - DSV EDI Naming Tool v63.xltm" (sheets "Master data" and
 * "Resource and file naming") plus the 2026-07-03 ITX-map-naming update doc.
 *
 * The definition is split across `./dsv-edi/`:
 *   - `fields.ts`    — every user input (grouped as the form renders them)
 *   - `outputs.ts`   — the generated names with cell-formula parity
 *   - `map-names.ts` — the VBA-transcribed ITX/SI map names (`mapNameOutputs`)
 *   - `shared.ts`    — constants and the small builder helpers they reuse
 *
 * Every output mirrors an actual Excel formula. The ITX compact map/resource
 * name (3-char coded) still needs the DropDown code table imported, which is
 * why `mapNameOutputs` is wired to real lookup ids at import time rather than
 * being baked into `outputs` here.
 */
export const dsvEdiRuleset: Ruleset = {
  id: "dsv-edi-naming",
  name: "DSV EDI Naming Tool",
  version: "63",
  description:
    "Config-driven successor to the DSV EDI Naming Tool Excel template. " +
    "Outputs mirror the 'Resource and file naming' formulas. The ITX compact " +
    "map/resource name (3-char coded) still needs the DropDown code table imported.",
  fields: dsvEdiFields,
  lookups: {},
  outputs: dsvEdiOutputs,
};
