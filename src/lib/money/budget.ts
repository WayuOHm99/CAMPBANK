export function calculateRemainingBudget(
  totalBudget: number,
  distributedAmount: number,
) {
  if (
    !Number.isInteger(totalBudget) ||
    !Number.isInteger(distributedAmount) ||
    totalBudget < 0 ||
    distributedAmount < 0 ||
    distributedAmount > totalBudget
  ) {
    throw new Error("Budget invariant is invalid");
  }
  return totalBudget - distributedAmount;
}

export function isBudgetWarningActive({
  distributedAmount,
  totalBudget,
  warningAmount,
  warningPercent,
}: {
  distributedAmount: number;
  totalBudget: number;
  warningAmount: number | null;
  warningPercent: number | null;
}) {
  const remaining = calculateRemainingBudget(totalBudget, distributedAmount);
  return (
    (warningAmount !== null && remaining <= warningAmount) ||
    (warningPercent !== null && remaining * 100 <= totalBudget * warningPercent)
  );
}

export function validateScoreChange({
  amount,
  currentScore,
  remainingBudget,
}: { amount: number; currentScore: number; remainingBudget: number }):
  | { ok: true }
  | { ok: false; code: "INSUFFICIENT_BUDGET" | "INSUFFICIENT_GROUP_SCORE" } {
  if (amount > 0 && amount > remainingBudget) {
    return { ok: false, code: "INSUFFICIENT_BUDGET" };
  }
  if (amount < 0 && currentScore + amount < 0) {
    return { ok: false, code: "INSUFFICIENT_GROUP_SCORE" };
  }
  return { ok: true };
}
