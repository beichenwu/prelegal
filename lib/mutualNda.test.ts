import { describe, expect, it } from "vitest";
import {
  DEFAULT_VALUES,
  NdaFormValues,
  STANDARD_TERMS_MD,
  buildAgreement,
  buildCoverPage,
  formatEffectiveDate,
  validate,
} from "./mutualNda";

const complete: NdaFormValues = {
  ...DEFAULT_VALUES,
  purpose: "Evaluating a potential partnership.",
  effectiveDate: "2026-01-02",
  governingLaw: "Delaware",
  jurisdiction: "New Castle, Delaware",
  party1: {
    name: "Ada Lovelace",
    title: "CEO",
    company: "Analytical Engines Inc.",
    noticeAddress: "ada@analyticalengines.example",
  },
  party2: {
    name: "Alan Turing",
    title: "Director",
    company: "Bombe Systems LLC",
    noticeAddress: "legal@bombe.example",
  },
};

describe("formatEffectiveDate", () => {
  it("formats an ISO date as a US long date in UTC", () => {
    expect(formatEffectiveDate("2026-01-02")).toBe("January 2, 2026");
  });

  it("returns a placeholder for malformed input", () => {
    expect(formatEffectiveDate("not-a-date")).toBe("[Effective Date]");
  });
});

describe("validate", () => {
  it("passes for a fully completed form", () => {
    expect(validate(complete)).toEqual([]);
  });

  it("flags every missing required field", () => {
    const fields = validate(DEFAULT_VALUES).map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        "effectiveDate",
        "governingLaw",
        "jurisdiction",
        "party1.name",
        "party1.company",
        "party1.noticeAddress",
        "party2.name",
        "party2.company",
        "party2.noticeAddress",
      ]),
    );
  });

  it("rejects a non-positive or fractional year term", () => {
    expect(
      validate({ ...complete, mndaTermKind: "years", mndaTermYears: 0 }).map((e) => e.field),
    ).toContain("mndaTermYears");
    expect(
      validate({ ...complete, confidentialityTermYears: 1.5 }).map((e) => e.field),
    ).toContain("confidentialityTermYears");
  });

  it("does not require a year value when the term is not year-based", () => {
    const errors = validate({
      ...complete,
      mndaTermKind: "until_terminated",
      mndaTermYears: 0,
      confidentialityTermKind: "perpetuity",
      confidentialityTermYears: 0,
    });
    expect(errors).toEqual([]);
  });
});

describe("buildCoverPage", () => {
  it("fills in the party table and merged fields", () => {
    const md = buildCoverPage(complete);
    expect(md).toContain("Evaluating a potential partnership.");
    expect(md).toContain("January 2, 2026");
    expect(md).toContain("Governing Law: Delaware");
    expect(md).toContain("Jurisdiction: courts located in New Castle, Delaware");
    expect(md).toContain("| Print Name | Ada Lovelace | Alan Turing |");
    expect(md).toContain("| Company | Analytical Engines Inc. | Bombe Systems LLC |");
  });

  it("expresses the year-based terms with the entered number", () => {
    const md = buildCoverPage({
      ...complete,
      mndaTermYears: 3,
      confidentialityTermYears: 5,
    });
    expect(md).toContain("Expires 3 year(s) from the Effective Date.");
    expect(md).toContain("5 year(s) from the Effective Date, but in the case of trade secrets");
  });

  it("expresses the non-year term variants", () => {
    const md = buildCoverPage({
      ...complete,
      mndaTermKind: "until_terminated",
      confidentialityTermKind: "perpetuity",
    });
    expect(md).toContain("Continues until terminated in accordance with the terms of the MNDA.");
    expect(md).toContain("In perpetuity.");
  });

  it("defaults modifications to \"None.\" when blank", () => {
    expect(buildCoverPage(complete)).toMatch(/### MNDA Modifications\n\nNone\./);
  });

  it("escapes pipe characters in party fields so the table stays intact", () => {
    const md = buildCoverPage({
      ...complete,
      party1: { ...complete.party1, company: "Smith | Jones" },
    });
    expect(md).toContain("Smith \\| Jones");
  });
});

describe("STANDARD_TERMS_MD", () => {
  it("has the span wrappers stripped", () => {
    expect(STANDARD_TERMS_MD).not.toContain("<span");
    expect(STANDARD_TERMS_MD).not.toContain("</span>");
  });

  it("keeps the substantive clause text", () => {
    expect(STANDARD_TERMS_MD).toContain("**Equitable Relief**");
    expect(STANDARD_TERMS_MD).toContain("governed by, and construed in accordance with");
  });

  it("demotes its heading to level 2", () => {
    expect(STANDARD_TERMS_MD.startsWith("## Standard Terms\n")).toBe(true);
    expect(STANDARD_TERMS_MD).not.toMatch(/^# Standard Terms$/m);
  });
});

describe("buildAgreement", () => {
  it("joins the cover page and standard terms with a rule", () => {
    const doc = buildAgreement(complete);
    expect(doc.indexOf("## Cover Page")).toBeLessThan(doc.indexOf("\n\n---\n\n"));
    expect(doc.indexOf("\n\n---\n\n")).toBeLessThan(doc.indexOf("## Standard Terms"));
    expect(doc.endsWith("\n")).toBe(true);
  });
});
