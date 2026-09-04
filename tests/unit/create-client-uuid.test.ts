import { describe, expect, it } from "vitest";

import { createClientUuid } from "@/lib/ids/create-client-uuid";

describe("createClientUuid", () => {
  it("uses a valid UUID v4 fallback when randomUUID is unavailable", () => {
    const source = {
      getRandomValues<T extends ArrayBufferView | null>(array: T) {
        const bytes = array as Uint8Array;
        bytes.set(Array.from({ length: 16 }, (_, index) => index));
        return array;
      },
    };

    expect(createClientUuid(source)).toBe(
      "00010203-0405-4607-8809-0a0b0c0d0e0f",
    );
  });

  it("returns a UUID-shaped value with the native Web Crypto implementation", () => {
    expect(createClientUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
