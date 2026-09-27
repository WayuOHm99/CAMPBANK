import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { sanitizeSentryEvent } from "@/lib/monitoring/sentry";

describe("Sentry event privacy", () => {
  it("removes request data and exception values while retaining a useful stack", () => {
    const event: ErrorEvent = {
      type: undefined,
      message: "PIN 1234 failed",
      user: { username: "Private Name" },
      request: {
        url: "https://example.com/join/private-code?token=secret",
        data: "PIN 1234",
      },
      breadcrumbs: [{ message: "PIN 1234" }],
      extra: { token: "secret" },
      tags: { campCode: "private-code" },
      transaction: "/join/private-code",
      exception: {
        values: [
          {
            type: "TypeError",
            value: "PIN 1234 failed",
            stacktrace: {
              frames: [
                {
                  filename: "https://example.com/_next/static/app.js?token=secret",
                  lineno: 42,
                  vars: { pin: "1234" },
                  context_line: "const pin = '1234'",
                },
              ],
            },
          },
        ],
      },
    };

    const sanitized = sanitizeSentryEvent(event);
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toMatch(/1234|secret|private-code|Private Name/);
    expect(sanitized.exception?.values?.[0]?.type).toBe("TypeError");
    expect(sanitized.exception?.values?.[0]?.stacktrace?.frames?.[0]).toMatchObject({
      filename: "app.js",
      lineno: 42,
    });
  });
});
