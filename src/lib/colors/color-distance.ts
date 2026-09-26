export type DistanceColor = {
  key: string;
  hex: string;
};

type Oklab = readonly [number, number, number];

/**
 * OKLab distance below which two Group colors are hard to tell apart on a
 * phone. Calibrated on the original 20 presets: it flags เขียว/เขียวมะนาว
 * (0.045), น้ำตาล/ทอง (0.056) and เขียวอมฟ้า/คราม (0.058) while leaving
 * clearly different pairs such as แดง/ส้ม (0.087) unflagged.
 */
export const NEAR_COLOR_DISTANCE = 0.08;

const oklabCache = new Map<string, Oklab>();

function linearize(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function toOklab(hex: string): Oklab {
  const cached = oklabCache.get(hex);
  if (cached) return cached;
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error(`Invalid color hex: ${hex}`);
  }

  const [r, g, b] = [1, 3, 5].map((start) =>
    linearize(Number.parseInt(hex.slice(start, start + 2), 16)),
  );
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lab: Oklab = [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
  oklabCache.set(hex, lab);
  return lab;
}

/** Perceptual distance between two sRGB hex colors (Euclidean OKLab). */
export function colorDistance(first: string, second: string): number {
  const a = toOklab(first);
  const b = toOklab(second);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Chooses `count` colors from `available`, each time taking the color whose
 * nearest already-assigned color is farthest away. Ties keep list order, so
 * the result is deterministic for a given preset order.
 */
export function pickDistinctColors<T extends DistanceColor>(
  available: readonly T[],
  assigned: readonly DistanceColor[],
  count: number,
): T[] {
  const taken = new Set(assigned.map((color) => color.key));
  const chosenHexes = assigned.map((color) => color.hex);
  const picked: T[] = [];

  while (picked.length < count) {
    let best: T | undefined;
    let bestDistance = -1;
    for (const candidate of available) {
      if (taken.has(candidate.key)) continue;
      const nearest = chosenHexes.length
        ? Math.min(...chosenHexes.map((hex) => colorDistance(hex, candidate.hex)))
        : Number.POSITIVE_INFINITY;
      if (nearest > bestDistance) {
        best = candidate;
        bestDistance = nearest;
      }
    }
    if (!best) break;
    picked.push(best);
    taken.add(best.key);
    chosenHexes.push(best.hex);
  }

  return picked;
}

/** Other colors closer than the threshold to `target`, nearest first. */
export function findNearColors<T extends DistanceColor>(
  target: DistanceColor,
  others: readonly T[],
  threshold = NEAR_COLOR_DISTANCE,
): T[] {
  return others
    .filter((other) => other.key !== target.key)
    .map((other) => ({ other, distance: colorDistance(target.hex, other.hex) }))
    .filter(({ distance }) => distance < threshold)
    .sort((a, b) => a.distance - b.distance)
    .map(({ other }) => other);
}
