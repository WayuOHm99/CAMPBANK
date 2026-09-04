import { expect, test } from "@playwright/test";

test("Admin login shows four masked PIN positions and entry progress", async ({
  page,
}) => {
  await page.goto("/admin");

  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบ Admin" }),
  ).toBeVisible();
  await expect(page.getByText("EQ-BANK", { exact: true })).toBeVisible();
  await expect(page.locator("main").getByRole("img")).toHaveCount(0);
  await expect(page.getByText("เลือกชื่อและกรอก PIN 4 หลัก")).toBeVisible();

  const pinInput = page.getByLabel("PIN", { exact: true });
  await expect(pinInput).toHaveAttribute("inputmode", "numeric");
  await expect(pinInput).toHaveAttribute("type", "password");
  await expect(pinInput).toHaveAttribute("maxlength", "4");

  const pinPositions = page
    .getByRole("list", { name: "PIN 4 หลัก" })
    .getByRole("listitem");
  await expect(pinPositions).toHaveCount(4);
  await expect(page.getByText("กรอกแล้ว 0 จาก 4 หลัก")).toBeVisible();

  await pinInput.focus();
  await expect(pinPositions.nth(0)).toHaveAccessibleName(
    "หลักที่ 1: กำลังกรอก",
  );
  await expect(page.locator("[data-pin-caret]")).toBeVisible();

  await pinInput.fill("12");

  await expect(pinPositions.nth(0)).toHaveText("•");
  await expect(pinPositions.nth(1)).toHaveText("•");
  await expect(pinPositions.nth(2)).toHaveAttribute("aria-current", "step");
  await expect(pinPositions.nth(2)).toHaveAccessibleName(
    "หลักที่ 3: กำลังกรอก",
  );
  await expect(page.locator("[data-pin-caret]")).toHaveCount(1);
  await expect(page.getByText("กรอกแล้ว 2 จาก 4 หลัก")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
