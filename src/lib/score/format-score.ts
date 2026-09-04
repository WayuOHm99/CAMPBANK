type FormatScoreOptions = {
  showSign?: boolean;
};

const wholeNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  useGrouping: true,
});

export function formatScore(
  score: number,
  { showSign = false }: FormatScoreOptions = {},
): string {
  const formatted = wholeNumberFormatter.format(Math.abs(score));

  if (score < 0) {
    return `-${formatted}`;
  }

  if (showSign && score > 0) {
    return `+${formatted}`;
  }

  return formatted;
}
