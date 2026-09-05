import { expect, test } from "@playwright/test";

import { E2E_ORIGIN } from "./support/origin";

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
  test.setTimeout(60_000);
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const staffA = await contextA.newPage();
  const staffB = await contextB.newPage();

  await Promise.all([
    staffA.goto(`${E2E_ORIGIN}/join/DEMO-STAFF-2026`),
    staffB.goto(`${E2E_ORIGIN}/join/DEMO-STAFF-2026`),
  ]);
  await staffA.getByRole("button", { name: "Staff A" }).click();
  await expect(
    staffA.getByRole("heading", { name: "EQCAMP Demo" }),
  ).toBeVisible({ timeout: 10_000 });
  await staffB.getByRole("button", { name: "Staff B" }).click();
  await expect(
    staffB.getByRole("heading", { name: "EQCAMP Demo" }),
  ).toBeVisible({ timeout: 10_000 });

  const bananaA = staffA.getByRole("listitem", { name: "เหลือง — Banana" });
  const bananaB = staffB.getByRole("listitem", { name: "เหลือง — Banana" });
  const sharkA = staffA.getByRole("listitem", { name: "น้ำเงิน — Shark" });
  const scoreLabel = /^-?[\d,]+ คะแนน$/;
  const startingBanana = Number(
    (await bananaA.getByText(scoreLabel).innerText()).replace(/[^\d-]/g, ""),
  );
  const startingShark = await sharkA.getByText(scoreLabel).innerText();

  await bananaA.getByRole("button", { name: "เพิ่มคะแนน 500" }).click();
  await expect(bananaA).toHaveAttribute("data-motion-feedback", "local");
  const firstToastId = await staffA
    .locator(".eq-toast")
    .getAttribute("data-toast-id");
  await expect(
    bananaB.getByText(
      `${(startingBanana + 500).toLocaleString("en-US")} คะแนน`,
      { exact: true },
    ),
  ).toBeVisible({
    timeout: 8_000,
  });
  await expect(bananaB).toHaveAttribute("data-motion-feedback", "remote", {
    timeout: 5_000,
  });

  await expect(
    sharkA.getByRole("button", { name: "เพิ่มคะแนน 500" }),
  ).toBeEnabled();
  await sharkA.getByRole("button", { name: "เพิ่มคะแนน 500" }).click();
  await expect(
    sharkA.getByText(
      `${(Number(startingShark.replace(/[^\d-]/g, "")) + 500).toLocaleString(
        "en-US",
      )} คะแนน`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(staffA.locator(".eq-toast")).toContainText(
    "ย้อนกลับได้ภายใน 15 วินาที",
  );
  await expect
    .poll(() => staffA.locator(".eq-toast").getAttribute("data-toast-id"))
    .not.toBe(firstToastId);
  const undoButton = staffA.getByRole("button", {
    name: "ย้อนกลับ",
    exact: true,
  });
  await expect(undoButton).toBeEnabled();
  await undoButton.click();
  await expect(sharkA.getByText(startingShark, { exact: true })).toBeVisible();
  await expect(sharkA).not.toHaveAttribute("data-motion-feedback", "remote");
  await expect(staffA.locator(".eq-toast")).toHaveCount(0);
  await expect(bananaA).not.toHaveAttribute("data-motion-feedback", /.+/);
  await bananaA.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  await expect(bananaA).toHaveScreenshot("staff-score-end-state.png", {
    animations: "disabled",
    mask: [bananaA.getByText(scoreLabel)],
    maskColor: "#e7f6fd",
  });

  await bananaA.getByRole("button", { name: "เพิ่มคะแนน 500" }).click();
  await expect(
    bananaB.getByText(
      `${(startingBanana + 1000).toLocaleString("en-US")} คะแนน`,
      { exact: true },
    ),
  ).toBeVisible();
  const previousCue = await bananaB
    .locator(".eq-group-feedback")
    .elementHandle();
  await bananaA.getByRole("button", { name: "เพิ่มคะแนน 500" }).click();
  await expect(
    bananaB.getByText(
      `${(startingBanana + 1500).toLocaleString("en-US")} คะแนน`,
      { exact: true },
    ),
  ).toBeVisible();
  expect(await previousCue!.evaluate((element) => element.isConnected)).toBe(
    false,
  );
  await expect(bananaB.locator(".eq-group-feedback")).toHaveCount(1);

  await contextA.close();
  await contextB.close();
});
