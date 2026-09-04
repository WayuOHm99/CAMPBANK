import { describe, expect, it } from "vitest";

import { createRankingShareText } from "@/lib/leaderboard/create-ranking-share-text";

const ranking = [
  { color_name: "เหลือง", custom_name: "Banana", current_score: 12_500 },
  { color_name: "น้ำเงิน", custom_name: "", current_score: 11_000 },
];

describe("createRankingShareText", () => {
  it("creates a complete active-camp message with fallback Group names", () => {
    expect(
      createRankingShareText({
        campName: "EQCAMP Demo",
        closed: false,
        ranking,
      }),
    ).toBe(
      [
        "EQ-BANK",
        "อันดับล่าสุด: EQCAMP Demo",
        "",
        "1. เหลือง — Banana — 12,500 คะแนน",
        "2. น้ำเงิน — กลุ่มสีน้ำเงิน — 11,000 คะแนน",
        "",
        "สร้างจาก EQ-BANK",
      ].join("\n"),
    );
  });

  it("labels a closed-camp result without truncating the ranking", () => {
    const text = createRankingShareText({
      campName: "EQCAMP Demo",
      closed: true,
      ranking,
    });

    expect(text).toContain("ผลสรุปหลังปิดค่าย: EQCAMP Demo");
    expect(text).toContain("2. น้ำเงิน");
  });
});
