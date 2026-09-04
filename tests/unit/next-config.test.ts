import { networkInterfaces } from "node:os";

import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("Next.js LAN development origins", () => {
  it("allows every active non-loopback IPv4 address on this machine", () => {
    const currentAddresses = Object.values(networkInterfaces())
      .flatMap((addresses) => addresses ?? [])
      .filter((address) => address.family === "IPv4" && !address.internal)
      .map((address) => address.address);

    expect(currentAddresses.length).toBeGreaterThan(0);
    expect(nextConfig.allowedDevOrigins).toEqual(
      expect.arrayContaining(currentAddresses),
    );
  });
});
