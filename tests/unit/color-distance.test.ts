import { describe, expect, it } from "vitest";

import {
  colorDistance,
  findNearColors,
  NEAR_COLOR_DISTANCE,
  pickDistinctColors,
} from "@/lib/colors/color-distance";

const yellow = { key: "yellow", hex: "#F4C430" };
const blue = { key: "blue", hex: "#2563EB" };
const red = { key: "red", hex: "#DC2626" };
const green = { key: "green", hex: "#15803D" };
const orange = { key: "orange", hex: "#EA580C" };
const lime = { key: "lime", hex: "#4D7C0F" };
const brown = { key: "brown", hex: "#8B5E3C" };
const gold = { key: "gold", hex: "#A16207" };
const black = { key: "black", hex: "#111827" };

describe("colorDistance", () => {
  it("is zero for identical colors, symmetric, and case-insensitive", () => {
    expect(colorDistance("#DC2626", "#dc2626")).toBe(0);
    expect(colorDistance(red.hex, blue.hex)).toBeCloseTo(
      colorDistance(blue.hex, red.hex),
      12,
    );
  });

  it("separates confusable preset pairs from clearly different ones", () => {
    expect(colorDistance(green.hex, lime.hex)).toBeLessThan(NEAR_COLOR_DISTANCE);
    expect(colorDistance(brown.hex, gold.hex)).toBeLessThan(NEAR_COLOR_DISTANCE);
    expect(colorDistance(red.hex, orange.hex)).toBeGreaterThan(
      NEAR_COLOR_DISTANCE,
    );
  });

  it("rejects malformed hex values", () => {
    expect(() => colorDistance("red", "#000000")).toThrow("Invalid color hex");
  });
});

describe("pickDistinctColors", () => {
  const presets = [yellow, green, lime, blue, red, orange, black];

  it("keeps familiar list order but skips colors near an earlier pick", () => {
    const picked = pickDistinctColors(presets, [], 6).map((color) => color.key);
    expect(picked).toEqual(["yellow", "green", "blue", "red", "orange", "black"]);
  });

  it("falls back to the most distant color once only near colors remain", () => {
    expect(pickDistinctColors([lime, blue], [green], 1)).toEqual([blue]);
    expect(pickDistinctColors([lime], [green], 1)).toEqual([lime]);
  });

  it("avoids colors near ones that are already assigned", () => {
    const picked = pickDistinctColors(presets, [green], 4).map(
      (color) => color.key,
    );
    expect(picked).not.toContain("green");
    expect(picked.indexOf("lime")).toBe(-1);
  });

  it("returns fewer colors when the library runs out", () => {
    expect(pickDistinctColors([red, blue], [red], 5)).toEqual([blue]);
  });
});

describe("findNearColors", () => {
  it("lists only other colors under the threshold, nearest first", () => {
    expect(findNearColors(green, [green, blue, lime, red])).toEqual([lime]);
    expect(findNearColors(red, [blue, yellow])).toEqual([]);
  });
});
