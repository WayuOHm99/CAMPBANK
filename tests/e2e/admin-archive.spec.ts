import { expect, test } from "@playwright/test";

async function loginAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin");

  const loginHeading = page.getByRole("heading", {
    name: "เข้าสู่ระบบ Admin",
  });
  const campsHeading = page.getByRole("heading", { name: "ค่ายของฉัน" });
  await loginHeading
    .or(campsHeading)
    .waitFor({ state: "visible", timeout: 10_000 });
  if (await loginHeading.isVisible()) {
    await page.getByLabel("PIN", { exact: true }).fill("1234");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await page
      .getByRole("heading", { name: "ตั้ง PIN ใหม่" })
      .or(campsHeading)
      .waitFor({ state: "visible", timeout: 10_000 });
  }

  const changePinHeading = page.getByRole("heading", { name: "ตั้ง PIN ใหม่" });
  if (await changePinHeading.isVisible().catch(() => false)) {
    await page.getByLabel("PIN ชั่วคราว", { exact: true }).fill("1234");
    await page.getByLabel("PIN ใหม่", { exact: true }).fill("6543");
    await page.getByLabel("ยืนยัน PIN ใหม่", { exact: true }).fill("6543");
    await page.getByRole("button", { name: "บันทึก PIN ใหม่" }).click();
  } else if (!(await campsHeading.isVisible())) {
    await expect(loginHeading).toBeVisible();
    await page.getByLabel("PIN", { exact: true }).fill("6543");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  }

  await expect(campsHeading).toBeVisible();
}

test("Admin archives and restores a closed Camp from the Camp list", async ({
  page,
}) => {
  test.setTimeout(process.env.CI ? 120_000 : 60_000);
  await loginAdmin(page);

  await page.goto("/admin/camps/10000000-0000-4000-8000-000000000002");
  await expect(
    page.getByRole("heading", { name: "EQCAMP Concurrency Test" }),
  ).toBeVisible();

  if (
    !(await page.getByText("ค่ายนี้ปิดแล้ว", { exact: true }).isVisible())
  ) {
    await page.getByText("ปิด Camp", { exact: true }).click();
    await page.locator("#close-reason").fill("ปิดเพื่อทดสอบการจัดการคลัง");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "ตรวจสอบและปิด Camp" }).click();
  }

  await expect(page.getByText("ค่ายนี้ปิดแล้ว", { exact: true })).toBeVisible();
  const management = page.getByRole("region", { name: "จัดการค่าย" });
  page.once("dialog", (dialog) => dialog.accept());
  await management.getByRole("button", { name: "เก็บเข้าคลัง" }).click();
  await expect(
    management.getByText("ค่ายนี้อยู่ในคลัง", { exact: true }),
  ).toBeVisible();

  await page.goto("/admin");
  await expect(
    page.getByRole("link", { name: /EQCAMP Concurrency Test/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /แสดงค่ายที่เก็บเข้าคลัง/ }).click();

  const campCheckbox = page.getByRole("checkbox", {
    name: "เลือกค่าย EQCAMP Concurrency Test",
  });
  await expect(campCheckbox).toBeVisible();
  await campCheckbox.check();
  await expect(
    page.getByText("เลือกแล้ว 1 ค่าย", { exact: true }),
  ).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "นำออกจากคลัง" }).click();
  await expect(
    page.getByRole("link", { name: /EQCAMP Concurrency Test/ }),
  ).toBeVisible();
  await expect(page.getByText("เก็บเข้าคลังแล้ว", { exact: true })).toHaveCount(
    0,
  );
});
