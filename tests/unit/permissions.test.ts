import { describe, expect, it } from "vitest";

import { canPerform } from "@/lib/permissions/can-perform";

describe("canPerform", () => {
  it("keeps Staff on field actions and Admin on maintenance actions", () => {
    expect(canPerform("staff", "score")).toBe(true);
    expect(canPerform("staff", "history:read")).toBe(true);
    expect(canPerform("staff", "budget:update")).toBe(false);
    expect(canPerform("staff", "camp:close")).toBe(false);
    expect(canPerform("admin", "budget:update")).toBe(true);
    expect(canPerform("admin", "camp:close")).toBe(true);
  });
});
