import { describe, expect, it } from "vitest";

import {
  isStaleAnonymousSessionError,
  resolveSupabaseBrowserUrl,
} from "@/lib/supabase/client";

describe("resolveSupabaseBrowserUrl", () => {
  it("keeps loopback Supabase for a browser on the same machine", () => {
    expect(
      resolveSupabaseBrowserUrl("http://127.0.0.1:54321", "localhost"),
    ).toBe("http://127.0.0.1:54321");
  });

  it("uses the page host when a LAN device opens a loopback-configured app", () => {
    expect(
      resolveSupabaseBrowserUrl("http://127.0.0.1:54321", "192.168.0.38"),
    ).toBe("http://192.168.0.38:54321");
  });

  it("never rewrites a configured hosted Supabase URL", () => {
    expect(
      resolveSupabaseBrowserUrl(
        "https://example-project.supabase.co",
        "eqcamp.example.com",
      ),
    ).toBe("https://example-project.supabase.co");
  });
});

describe("isStaleAnonymousSessionError", () => {
  it("recognizes an access session whose anonymous Auth user no longer exists", () => {
    expect(
      isStaleAnonymousSessionError({
        code: "23503",
        details:
          'Key (auth_user_id)=(example) is not present in table "users".',
        message:
          'insert on table "access_sessions" violates foreign key constraint "access_sessions_auth_user_id_fkey"',
      }),
    ).toBe(true);
  });

  it("does not retry unrelated database failures", () => {
    expect(
      isStaleAnonymousSessionError({
        code: "23503",
        details: "Key (camp_id)=(example) is not present in table camps.",
        message: "another foreign key failed",
      }),
    ).toBe(false);
  });
});
