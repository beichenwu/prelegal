import { describe, expect, it } from "vitest";
import { DEFAULT_VALUES, type NdaFormValues } from "./mutualNda";
import { applyExtracted, parseFrame } from "./ndaChat";

describe("parseFrame", () => {
  it("parses a token frame", () => {
    expect(parseFrame('event: token\ndata: {"text": "hi"}')).toEqual({
      type: "token",
      text: "hi",
    });
  });

  it("parses a result frame with defaults for missing keys", () => {
    const frame =
      'event: result\ndata: {"reply": "Done", "fields": {"purpose": "x"}, "readyToGenerate": true}';
    expect(parseFrame(frame)).toEqual({
      type: "result",
      reply: "Done",
      fields: { purpose: "x" },
      missingFields: [],
      readyToGenerate: true,
      degraded: false,
    });
  });

  it("parses an error frame and normalises unknown codes", () => {
    expect(parseFrame('event: error\ndata: {"code": "weird", "message": "boom"}')).toEqual(
      { type: "error", code: "provider", message: "boom" },
    );
    expect(
      parseFrame('event: error\ndata: {"code": "unavailable", "message": "no key"}'),
    ).toEqual({ type: "error", code: "unavailable", message: "no key" });
  });

  it("returns null for malformed or incomplete frames", () => {
    expect(parseFrame("")).toBeNull();
    expect(parseFrame("event: token")).toBeNull();
    expect(parseFrame("event: token\ndata: {not json}")).toBeNull();
  });
});

describe("applyExtracted", () => {
  const base: NdaFormValues = {
    ...DEFAULT_VALUES,
    effectiveDate: "2026-01-01",
    governingLaw: "Delaware",
  };

  it("fills blank fields and keeps existing ones when the update is blank/null", () => {
    const next = applyExtracted(base, {
      jurisdiction: "New Castle, Delaware",
      governingLaw: null,
      effectiveDate: "   ",
    });
    expect(next.jurisdiction).toBe("New Castle, Delaware");
    expect(next.governingLaw).toBe("Delaware");
    expect(next.effectiveDate).toBe("2026-01-01");
  });

  it("lets a non-blank extracted value win over an existing one", () => {
    expect(applyExtracted(base, { governingLaw: "California" }).governingLaw).toBe(
      "California",
    );
  });

  it("merges party details field by field", () => {
    const withParty1: NdaFormValues = {
      ...base,
      party1: { name: "Ada", title: "", company: "AE", noticeAddress: "" },
    };
    const next = applyExtracted(withParty1, {
      party1: { noticeAddress: "ada@ae.example", name: null },
      party2: null,
    });
    expect(next.party1).toEqual({
      name: "Ada",
      title: "",
      company: "AE",
      noticeAddress: "ada@ae.example",
    });
    expect(next.party2).toEqual(base.party2);
  });

  it("passes through enum kinds and ignores non-finite numbers", () => {
    const next = applyExtracted(
      { ...base, mndaTermYears: 3 },
      { mndaTermKind: "until_terminated", mndaTermYears: null },
    );
    expect(next.mndaTermKind).toBe("until_terminated");
    expect(next.mndaTermYears).toBe(3);
  });
});
