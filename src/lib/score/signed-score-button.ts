import { formatScore } from "@/lib/score/format-score";

export type ScoreDirection = "add" | "subtract";

export const MAX_SCORE_BUTTON_MAGNITUDE = 2_147_483_647;

export function normalizeScoreMagnitudeInput(value: string) {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function getSignedScoreAmount(
  direction: ScoreDirection,
  magnitudeValue: string,
) {
  const magnitude = Number(normalizeScoreMagnitudeInput(magnitudeValue));
  if (
    !Number.isInteger(magnitude) ||
    magnitude <= 0 ||
    magnitude > MAX_SCORE_BUTTON_MAGNITUDE
  ) {
    return null;
  }

  return direction === "add" ? magnitude : -magnitude;
}

export function getAutomaticScoreButtonLabel(
  direction: ScoreDirection,
  magnitudeValue: string,
) {
  const amount = getSignedScoreAmount(direction, magnitudeValue);
  return amount === null ? "" : formatScore(amount, { showSign: true });
}
