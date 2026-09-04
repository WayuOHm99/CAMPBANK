import { describe, expect, it } from "vitest";

import { rankGroups } from "@/lib/ranking/rank-groups";

describe("rankGroups", () => {
  it("orders by Score, reached time, then configured order", () => {
    const ranked = rankGroups([
      {
        id: "late",
        current_score: 10_000,
        score_reached_at: "2026-08-22T07:08:00Z",
        sort_order: 1,
      },
      {
        id: "low",
        current_score: 9_000,
        score_reached_at: "2026-08-22T07:00:00Z",
        sort_order: 2,
      },
      {
        id: "early-b",
        current_score: 10_000,
        score_reached_at: "2026-08-22T07:05:00Z",
        sort_order: 4,
      },
      {
        id: "early-a",
        current_score: 10_000,
        score_reached_at: "2026-08-22T07:05:00Z",
        sort_order: 3,
      },
    ]);

    expect(ranked.map((group) => [group.rank, group.id])).toEqual([
      [1, "early-a"],
      [2, "early-b"],
      [3, "late"],
      [4, "low"],
    ]);
  });
});
