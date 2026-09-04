import { describe, expect, it } from "vitest";
import { COMMON_JURISDICTIONS, US_STATES } from "./locations";

describe("US_STATES", () => {
  it("covers the 50 states plus DC", () => {
    expect(US_STATES).toHaveLength(51);
    expect(US_STATES).toContain("Delaware");
    expect(US_STATES).toContain("District of Columbia");
  });

  it("has no duplicates and is sorted", () => {
    expect(new Set(US_STATES).size).toBe(US_STATES.length);
    expect([...US_STATES]).toEqual([...US_STATES].sort());
  });
});

describe("COMMON_JURISDICTIONS", () => {
  it("has no duplicates", () => {
    expect(new Set(COMMON_JURISDICTIONS).size).toBe(COMMON_JURISDICTIONS.length);
  });

  it('entries are "City, State" pairs', () => {
    for (const place of COMMON_JURISDICTIONS) {
      expect(place).toMatch(/^.+, .+$/);
    }
  });
});
