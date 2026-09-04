import { describe, expect, it } from "vitest";

import { formatScore } from "@/lib/score/format-score";

describe("formatScore", () => {
  it("formats a whole-number Score with comma separators and no currency symbol", () => {
    expect(formatScore(18_500)).toBe("18,500");
  });

  it("preserves the sign used by Score Transaction history", () => {
    expect(formatScore(-1_000, { showSign: true })).toBe("-1,000");
    expect(formatScore(500, { showSign: true })).toBe("+500");
  });
});
