import { describe, expect, it } from "vitest";

import { getGroupDisplayName } from "@/lib/groups/get-group-display-name";

describe("getGroupDisplayName", () => {
  it("uses the trimmed Group Name when one has been chosen", () => {
    expect(getGroupDisplayName("เหลือง", "  Banana  ")).toBe("Banana");
  });

  it("uses a deterministic color-based fallback while the Group Name is blank", () => {
    expect(getGroupDisplayName("เหลือง", "   ")).toBe("กลุ่มสีเหลือง");
  });
});
