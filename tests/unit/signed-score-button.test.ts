import { describe, expect, it } from "vitest";

import {
  getAutomaticScoreButtonLabel,
  getSignedScoreAmount,
  normalizeScoreMagnitudeInput,
} from "@/lib/score/signed-score-button";

describe("signed Score Button helpers", () => {
  it("keeps Admin input digit-only and applies the selected direction", () => {
    expect(normalizeScoreMagnitudeInput("-00,500 คะแนน")).toBe("500");
    expect(getSignedScoreAmount("add", "500")).toBe(500);
    expect(getSignedScoreAmount("subtract", "500")).toBe(-500);
  });

  it("derives comma-formatted labels without accepting a typed sign", () => {
    expect(getAutomaticScoreButtonLabel("add", "+1000")).toBe("+1,000");
    expect(getAutomaticScoreButtonLabel("subtract", "-1000")).toBe("-1,000");
  });

  it("rejects zero, empty, and values outside PostgreSQL int32", () => {
    expect(getSignedScoreAmount("add", "")).toBeNull();
    expect(getSignedScoreAmount("subtract", "0")).toBeNull();
    expect(getSignedScoreAmount("add", "2147483648")).toBeNull();
  });
});
