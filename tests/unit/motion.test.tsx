import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MotionPage } from "@/components/shared/motion";
import { ScreenState } from "@/components/shared/screen-state";

describe("EQ Motion System", () => {
  it("keeps page content usable when React View Transition is unavailable", () => {
    render(
      <MotionPage>
        <main>
          <h1>หน้าทดสอบ</h1>
          <button type="button">ทำงานต่อ</button>
        </main>
      </MotionPage>,
    );

    expect(screen.getByRole("heading", { name: "หน้าทดสอบ" })).toBeVisible();
    expect(screen.getByRole("button", { name: "ทำงานต่อ" })).toBeEnabled();
  });

  it("announces a stable loading state without relying on animation", () => {
    render(
      <ScreenState
        busy
        message="กำลังอ่านข้อมูลล่าสุดจากค่าย"
        title="กำลังโหลดคะแนน"
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("กำลังโหลดคะแนน");
    expect(status).toHaveTextContent("กำลังอ่านข้อมูลล่าสุดจากค่าย");
  });
});
