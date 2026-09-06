/**
 * Assemble a finished agreement: fill the cover page's `{{token}}` placeholders
 * with collected values, then append the (cleaned) Common Paper standard terms.
 */

import { getDocument } from "@/lib/documents";

/** Flat map of collected values. Party details use dotted keys, e.g.
 * `"provider.signatory"`, `"customer.entity"`. */
export type DocValues = Record<string, string>;

const BLANK = "\\_\\_\\_\\_\\_\\_";
const PARTY_TOKEN = /\{\{party\.([a-zA-Z]+)\.([a-zA-Z]+)\}\}/g;
const FIELD_TOKEN = /\{\{([a-zA-Z0-9]+)\}\}/g;

export const PREVIEW_DISCLAIMER =
  "> **Preview only — not legal advice.** This draft was generated from a " +
  "standard template. Have a qualified lawyer review it before signing.";

/** Remove Common Paper's inline `<span …>` wrappers and demote the top `#`
 * heading to `##` so the terms nest under the cover page. */
export function cleanStandardTerms(raw: string): string {
  return raw
    .replace(/<span[^>]*>/g, "")
    .replace(/<\/span>/g, "")
    .replace(/^#\s+/m, "## ");
}

export function buildDocument(slug: string, values: DocValues): string {
  const doc = getDocument(slug);
  if (!doc) throw new Error(`Unknown document: ${slug}`);

  const cover = doc.coverText
    .replace(PARTY_TOKEN, (_match, key: string, attr: string) => {
      if (attr === "label") {
        return doc.parties.find((p) => p.key === key)?.label ?? key;
      }
      const value = values[`${key}.${attr}`];
      return value && value.trim() ? value.trim() : "";
    })
    .replace(FIELD_TOKEN, (_match, name: string) => {
      const value = values[name];
      return value && value.trim() ? value.trim() : BLANK;
    });

  return `${PREVIEW_DISCLAIMER}\n\n${cover}\n\n---\n\n${cleanStandardTerms(
    doc.termsText,
  )}\n`;
}

/** Field names (from the document definition) that still have no value. */
export function missingFields(slug: string, values: DocValues): string[] {
  const doc = getDocument(slug);
  if (!doc) return [];
  return doc.fields
    .filter((f) => !(values[f.name] ?? "").trim())
    .map((f) => f.name);
}
