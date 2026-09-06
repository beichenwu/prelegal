import { describe, expect, it } from "vitest";
import { mergeFields, parseFrame } from "./chat";

describe("parseFrame", () => {
  it("parses a token frame", () => {
    expect(parseFrame('event: token\ndata: {"text": "hi"}')).toEqual({
      type: "token",
      text: "hi",
    });
  });

  it("parses a result frame with document + suggestion and defaults", () => {
    const frame =
      'event: result\ndata: {"reply": "Use the NDA", "document": "mutual-nda", "suggestion": null}';
    expect(parseFrame(frame)).toEqual({
      type: "result",
      reply: "Use the NDA",
      fields: {},
      missingFields: [],
      readyToGenerate: false,
      degraded: false,
      document: "mutual-nda",
      suggestion: null,
    });
  });

  it("normalises unknown error codes to provider", () => {
    expect(
      parseFrame('event: error\ndata: {"code": "weird", "message": "boom"}'),
    ).toEqual({ type: "error", code: "provider", message: "boom" });
  });

  it("returns null for malformed frames", () => {
    expect(parseFrame("event: token")).toBeNull();
    expect(parseFrame("event: token\ndata: {nope}")).toBeNull();
  });
});

describe("mergeFields", () => {
  it("keeps current values when the update is blank or null", () => {
    const next = mergeFields(
      { governingLaw: "Delaware", purpose: "x" },
      { governingLaw: null, purpose: "   ", jurisdiction: "New Castle" },
    );
    expect(next).toEqual({
      governingLaw: "Delaware",
      purpose: "x",
      jurisdiction: "New Castle",
    });
  });

  it("lets a non-blank update win and trims it", () => {
    expect(mergeFields({ a: "old" }, { a: "  new  " })).toEqual({ a: "new" });
  });
});
