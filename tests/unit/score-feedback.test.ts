import { describe, expect, it } from "vitest";

import { remoteScoreChanges } from "@/lib/score/score-feedback";

describe("remote Score feedback", () => {
  it("keeps another Group's update when the newest transaction is local", () => {
    const groups = [
      { id: "a", current_score: 500 },
      { id: "b", current_score: 500 },
    ];
    expect(
      remoteScoreChanges(
        groups,
        new Map([
          ["a", 0],
          ["b", 0],
        ]),
        [
          { id: "local", group_id: "a" },
          { id: "remote", group_id: "b" },
        ],
        new Set(["local"]),
      ),
    ).toEqual([groups[1]]);
  });

  it("does not announce a local Undo as a remote update", () => {
    expect(
      remoteScoreChanges(
        [{ id: "a", current_score: 0 }],
        new Map([["a", 500]]),
        [{ id: "undo", group_id: "a" }],
        new Set(["undo"]),
      ),
    ).toEqual([]);
  });

  it("returns every changed Group, but not unchanged or newly loaded Groups", () => {
    const groups = [
      { id: "a", current_score: 500 },
      { id: "b", current_score: 1000 },
      { id: "c", current_score: 0 },
    ];
    expect(
      remoteScoreChanges(
        groups,
        new Map([
          ["a", 0],
          ["b", 0],
        ]),
        [],
        new Set(),
      ),
    ).toEqual(groups.slice(0, 2));
    expect(
      remoteScoreChanges(
        groups,
        new Map(groups.map((group) => [group.id, group.current_score])),
        [],
        new Set(),
      ),
    ).toEqual([]);
  });
});
