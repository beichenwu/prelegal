import { describe, expect, it } from "vitest";
import { buildDocument, cleanStandardTerms, missingFields } from "./buildDocument";
import { DOCUMENTS } from "./documents";

function fullValues(slug: string): Record<string, string> {
  const doc = DOCUMENTS.find((d) => d.slug === slug)!;
  const values: Record<string, string> = {};
  for (const f of doc.fields) values[f.name] = `value-for-${f.name}`;
  for (const p of doc.parties) {
    for (const attr of ["signatory", "title", "entity", "noticeAddress"]) {
      values[`${p.key}.${attr}`] = `${p.key}-${attr}`;
    }
  }
  return values;
}

describe("buildDocument", () => {
  it.each(DOCUMENTS.map((d) => d.slug))(
    "leaves no unresolved token for %s and appends the standard terms",
    (slug) => {
      const doc = DOCUMENTS.find((d) => d.slug === slug)!;
      const md = buildDocument(slug, fullValues(slug));
      expect(md).not.toMatch(/\{\{/);
      expect(md).not.toMatch(/<span/);
      expect(md).toContain("\n\n---\n\n");
      expect(
        md.trimEnd().endsWith(cleanStandardTerms(doc.termsText).trimEnd()),
      ).toBe(true);
    },
  );

  it.each(DOCUMENTS.map((d) => d.slug))(
    "renders blanks (never raw tokens) for %s when nothing is provided",
    (slug) => {
      const md = buildDocument(slug, {});
      expect(md).not.toMatch(/\{\{/);
      expect(md).toContain("\\_\\_\\_\\_\\_\\_");
    },
  );

  it("substitutes party labels from the document definition", () => {
    const md = buildDocument("mutual-nda", {});
    expect(md).toContain("| Party 1 | Party 2 |");
  });

  it("throws on an unknown slug", () => {
    expect(() => buildDocument("nope", {})).toThrow(/Unknown document/);
  });
});

describe("cleanStandardTerms", () => {
  it("strips span wrappers and demotes the top heading", () => {
    const raw = '# Standard Terms\n\n<span class="coverpage_link">Purpose</span> text';
    expect(cleanStandardTerms(raw)).toBe("## Standard Terms\n\nPurpose text");
  });
});

describe("missingFields", () => {
  it("lists all fields when empty and none when filled", () => {
    const all = missingFields("pilot-agreement", {});
    expect(all.length).toBeGreaterThan(0);
    expect(missingFields("pilot-agreement", fullValues("pilot-agreement"))).toEqual([]);
  });
});
