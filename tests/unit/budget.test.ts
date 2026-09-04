import { describe, expect, it } from "vitest";

import {
  calculateRemainingBudget,
  isBudgetWarningActive,
  validateScoreChange,
} from "@/lib/money/budget";

describe("Budget and Score rules", () => {
  it("calculates remaining Budget and rejects invalid invariants", () => {
    expect(calculateRemainingBudget(100_000, 61_500)).toBe(38_500);
    expect(() => calculateRemainingBudget(1_000, 1_500)).toThrow(
      "Budget invariant",
    );
  });

  it("activates Amount or Percentage warning at equality", () => {
    expect(
      isBudgetWarningActive({
        distributedAmount: 80_000,
        totalBudget: 100_000,
        warningAmount: null,
        warningPercent: 20,
      }),
    ).toBe(true);
    expect(
      isBudgetWarningActive({
        distributedAmount: 90_000,
        totalBudget: 100_000,
        warningAmount: 10_000,
        warningPercent: null,
      }),
    ).toBe(true);
    expect(
      isBudgetWarningActive({
        distributedAmount: 70_000,
        totalBudget: 100_000,
        warningAmount: 10_000,
        warningPercent: 20,
      }),
    ).toBe(false);
  });

  it("prevents negative Group Score and negative Remaining Budget", () => {
    expect(
      validateScoreChange({
        amount: -1_000,
        currentScore: 500,
        remainingBudget: 5_000,
      }),
    ).toEqual({
      ok: false,
      code: "INSUFFICIENT_GROUP_SCORE",
    });
    expect(
      validateScoreChange({
        amount: 1_000,
        currentScore: 500,
        remainingBudget: 500,
      }),
    ).toEqual({
      ok: false,
      code: "INSUFFICIENT_BUDGET",
    });
    expect(
      validateScoreChange({
        amount: 500,
        currentScore: 0,
        remainingBudget: 500,
      }),
    ).toEqual({ ok: true });
  });
});
