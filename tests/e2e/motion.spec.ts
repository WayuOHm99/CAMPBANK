import { expect, test } from "@playwright/test";

test("motion end states remain usable and contained with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const motionTokens = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    const toMilliseconds = (value: string) => {
      const normalized = value.trim();
      return normalized.endsWith("ms")
        ? Number.parseFloat(normalized)
        : Number.parseFloat(normalized) * 1_000;
    };
    return {
      fast: toMilliseconds(styles.getPropertyValue("--eq-motion-fast")),
      normal: toMilliseconds(styles.getPropertyValue("--eq-motion-normal")),
    };
  });
  expect(motionTokens).toEqual({ fast: 160, normal: 240 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await expect(page.locator("main")).toHaveScreenshot(
    "home-reduced-motion-end-state.png",
    { animations: "disabled" },
  );

  await page.getByRole("link", { name: /เข้าสู่ระบบผู้ดูแล/ }).click();
  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบ Admin" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("Score feedback distinguishes local and remote updates without blocking another action", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const staffA = await contextA.newPage();
  const staffB = await contextB.newPage();

  await Promise.all([
    staffA.goto("http://127.0.0.1:3000/join/DEMO-STAFF-2026"),
    staffB.goto("http://127.0.0.1:3000/join/DEMO-STAFF-2026"),
  ]);
  await staffA.getByRole("button", { name: "Staff A" }).click();
  await staffB.getByRole("button", { name: "Staff B" }).click();
  await Promise.all([
    expect(staffA.getByRole("heading", { name: "EQCAMP Demo" })).toBeVisible(),
    expect(staffB.getByRole("heading", { name: "EQCAMP Demo" })).toBeVisible(),
    expect(
      staffA.getByLabel("การเชื่อมต่อ: ข้อมูลสด"),
    ).toBeVisible(),
    expect(
      staffB.getByLabel("การเชื่อมต่อ: ข้อมูลสด"),
    ).toBeVisible(),
  ]);

  const bananaA = staffA.getByRole("listitem", { name: "เหลือง — Banana" });
  const bananaB = staffB.getByRole("listitem", { name: "เหลือง — Banana" });
  const sharkA = staffA.getByRole("listitem", { name: "น้ำเงิน — Shark" });

  await bananaA.getByRole("button", { name: "เพิ่มคะแนน 500" }).click();
  await expect(bananaA).toHaveAttribute("data-motion-feedback", "local");
  await expect(bananaB.getByText("500 คะแนน")).toBeVisible({
    timeout: 5_000,
  });
  await expect(bananaB).toHaveAttribute("data-motion-feedback", "remote", {
    timeout: 5_000,
  });

  await expect(
    sharkA.getByRole("button", { name: "เพิ่มคะแนน 500" }),
  ).toBeEnabled();
  await sharkA.getByRole("button", { name: "เพิ่มคะแนน 500" }).click();
  await expect(staffA.getByRole("status")).toContainText(
    "ย้อนกลับได้ภายใน 15 วินาที",
  );

  await contextA.close();
  await contextB.close();
});
