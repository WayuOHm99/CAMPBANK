import { expect, test } from "@playwright/test";

test("Staff Group view starts in responsive Auto mode on every page open", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const vibrations: number[] = [];
    Object.defineProperty(window, "__eqcampVibrations", {
      configurable: true,
      value: vibrations,
    });
    Object.defineProperty(window.navigator, "vibrate", {
      configurable: true,
      value: (duration: number) => {
        vibrations.push(duration);
        return true;
      },
    });
  });
  await page.goto("/join/TEST-30000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "Staff A" }).click();
  await expect(
    page.getByRole("heading", { name: "EQCAMP Demo" }),
  ).toBeVisible();
  await expect(page.getByText(/^[\d,]+ \/ [\d,]+$/)).toBeVisible();
  await expect(
    page.locator("header").getByText("Staff A", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("header").getByText("ยังไม่ระบุกิจกรรม"),
  ).toBeVisible();
  await expect(page.locator("header").getByText("ยังไม่ระบุรอบ")).toBeVisible();
  await expect(
    page.locator("header").getByText(/^อัปเดตล่าสุด /),
  ).toBeVisible();
  await expect(
    page.locator("header").getByRole("button", { name: "รีเฟรชข้อมูล" }),
  ).toBeVisible();
  await page
    .getByLabel("กิจกรรม", { exact: true })
    .selectOption({ label: "เต้น" });
  await page
    .getByLabel("รอบ", { exact: true })
    .selectOption({ label: "รอบ 1" });
  await expect(
    page.locator("header").getByText("เต้น", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("header").getByText("รอบ 1", { exact: true }),
  ).toBeVisible();
  await page
    .locator("header")
    .getByRole("button", { name: "รีเฟรชข้อมูล" })
    .click();

  const layoutControls = page.getByRole("group", {
    name: "รูปแบบการแสดงกลุ่ม",
  });
  await expect(layoutControls).toBeVisible();
  await expect(
    layoutControls.getByRole("button", { name: "อัตโนมัติ" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    layoutControls.getByRole("button", { name: "1 คอลัมน์" }),
  ).toBeVisible();
  await expect(
    layoutControls.getByRole("button", { name: "2 คอลัมน์" }),
  ).toBeVisible();
  await expect(
    layoutControls.getByRole("button", { name: "แถวเลื่อน" }),
  ).toBeVisible();
  for (const label of ["อัตโนมัติ", "1 คอลัมน์", "2 คอลัมน์", "แถวเลื่อน"]) {
    const layoutButton = layoutControls.getByRole("button", { name: label });
    await expect(layoutButton.locator("svg")).toBeVisible();
    await expect(layoutButton).toHaveText("");
  }

  const yellowGroup = page.getByRole("listitem", { name: "เหลือง — Banana" });
  const renameButton = yellowGroup.getByRole("button", {
    name: "เปลี่ยนชื่อกลุ่ม Banana",
  });
  await expect(renameButton.locator("svg")).toBeVisible();
  await expect(renameButton).toHaveText("");

  const add500 = yellowGroup.getByRole("button", {
    name: "เพิ่มคะแนน 500",
  });
  const subtract500 = yellowGroup.getByRole("button", {
    name: "ลดคะแนน 500",
  });
  // The Thai direction word now appears once per group of buttons instead of
  // inside all four. Each button still carries the full accessible name, and
  // the signed value still states the direction without relying on colour.
  await expect(
    yellowGroup.getByText("เพิ่มคะแนน", { exact: true }),
  ).toBeVisible();
  await expect(yellowGroup.getByText("ลดคะแนน", { exact: true })).toBeVisible();
  await expect(add500).toHaveClass(/eq-score-action-add/);
  await expect(add500).toContainText("+500");
  await expect(add500).toHaveCSS("background-color", "rgb(32, 94, 145)");
  await expect(subtract500).toHaveClass(/eq-score-action-subtract/);
  await expect(subtract500).toContainText("-500");
  await expect(subtract500).toHaveCSS("background-color", "rgb(231, 246, 253)");
  await expect(subtract500).toHaveCSS("border-top-color", "rgb(54, 184, 242)");

  await add500.click();
  await expect(
    page.getByRole("dialog", { name: "ยืนยันการให้คะแนน" }),
  ).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "Staff A · เพิ่ม 500 คะแนนให้ เหลือง — Banana แล้ว",
  );
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __eqcampVibrations?: number[] })
          .__eqcampVibrations?.length ?? 0,
    ),
  ).toBeGreaterThan(0);

  await page.reload();
  await expect(
    page
      .getByRole("group", { name: "รูปแบบการแสดงกลุ่ม" })
      .getByRole("button", { name: "อัตโนมัติ" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("Staff can switch Group layouts without changing configured order", async ({
  page,
}) => {
  await page.goto("/join/TEST-30000000-0000-4000-8000-000000000002");
  await page.getByRole("button", { name: "Staff B" }).click();

  const controls = page.getByRole("group", {
    name: "รูปแบบการแสดงกลุ่ม",
  });
  const groups = page
    .getByRole("list", { name: "กลุ่มคะแนน" })
    .getByRole("listitem");
  const configuredOrder = [
    "เหลือง — Banana",
    "น้ำเงิน — Shark",
    "แดง — Dragon",
    "เขียว — Forest",
    "ม่วง — Grape",
    "ส้ม — Orange",
    "ฟ้า — Sky",
    "ชมพู — Pinky",
  ];

  await expect(groups).toHaveCount(configuredOrder.length);
  for (const [index, label] of configuredOrder.entries()) {
    await expect(groups.nth(index)).toHaveAccessibleName(label);
  }

  await controls.getByRole("button", { name: "2 คอลัมน์" }).click();
  const twoColumnFirst = await groups.nth(0).boundingBox();
  const twoColumnSecond = await groups.nth(1).boundingBox();
  expect(twoColumnFirst?.y).toBe(twoColumnSecond?.y);

  const firstGroup = groups.nth(0);
  const secondGroup = groups.nth(1);
  await firstGroup
    .getByRole("button", { name: "เปลี่ยนชื่อกลุ่ม Banana" })
    .click();
  await expect(firstGroup.getByLabel("ชื่อกลุ่มใหม่")).toBeVisible();
  await expect(secondGroup.getByLabel("ชื่อกลุ่มใหม่")).toHaveCount(0);
  const editingFirst = await firstGroup.boundingBox();
  const stableSecond = await secondGroup.boundingBox();
  expect(editingFirst?.y).toBe(stableSecond?.y);
  await firstGroup
    .getByRole("button", { name: "ยกเลิกเปลี่ยนชื่อกลุ่ม Banana" })
    .click();

  await controls.getByRole("button", { name: "1 คอลัมน์" }).click();
  const oneColumnFirst = await groups.nth(0).boundingBox();
  const oneColumnSecond = await groups.nth(1).boundingBox();
  expect(oneColumnSecond!.y).toBeGreaterThan(oneColumnFirst!.y);

  await controls.getByRole("button", { name: "แถวเลื่อน" }).click();
  const railFirst = await groups.nth(0).boundingBox();
  const railSecond = await groups.nth(1).boundingBox();
  expect(railFirst?.y).toBe(railSecond?.y);
  for (const [index, label] of configuredOrder.entries()) {
    await expect(groups.nth(index)).toHaveAccessibleName(label);
  }
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
