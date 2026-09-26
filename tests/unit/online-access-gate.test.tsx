import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnlineAccessGate } from "@/components/shared/online-access-gate";

afterEach(() => vi.unstubAllEnvs());

describe("online access gate", () => {
  it("does not mount the login client while access is disabled", () => {
    vi.stubEnv("EQCAMP_ACCESS_ENABLED", "false");
    const loginClient = vi.fn(() => <button>Sign in</button>);
    const Login = loginClient;
    render(
      <OnlineAccessGate>
        <Login />
      </OnlineAccessGate>,
    );
    expect(
      screen.getByRole("heading", { name: "ยังไม่เปิดให้เข้าใช้งาน" }),
    ).toBeInTheDocument();
    expect(loginClient).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Sign in" }),
    ).not.toBeInTheDocument();
  });

  it("preserves normal access when enabled", () => {
    vi.stubEnv("EQCAMP_ACCESS_ENABLED", "true");
    render(
      <OnlineAccessGate>
        <button>Sign in</button>
      </OnlineAccessGate>,
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
