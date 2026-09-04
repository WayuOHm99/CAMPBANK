import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("leads with the product promise and one Admin action", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "ให้คะแนนเร็วตรวจสอบย้อนหลังได้",
    );
    expect(screen.getByLabelText("EQ-BANK")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /เข้าสู่ระบบผู้ดูแล/ }),
    ).toHaveAttribute("href", "/admin");
  });

  it("tells Staff to use their Camp link instead of offering a login", () => {
    render(<HomePage />);

    expect(
      screen.getByText(/Staff เข้าผ่านลิงก์เฉพาะค่าย/),
    ).toBeInTheDocument();
    // The entry surface must never become a second way in: no credential
    // field, and no Camp directory for a visitor to browse.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /เข้าสู่ระบบ/ })).toBeNull();
  });

  it("credits EQGROUP as the owner", () => {
    render(<HomePage />);

    expect(
      screen.getByText(/บริษัท อีคิวกรุ๊ป จำกัด \(EQGROUP\)/),
    ).toBeInTheDocument();
  });
});
