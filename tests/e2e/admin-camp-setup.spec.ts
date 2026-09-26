import { expect, test, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { E2E_ORIGIN } from "./support/origin";

// Disclosures animate open; WebKit can miss a tap on content that is still
// moving, so wait for every animation inside the disclosure to settle.
async function settleAnimations(locator: Locator) {
  await locator.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

test("Admin changes a temporary PIN and activates a configured Camp", async ({
  browser,
  page,
}) => {
  // This long flow exceeded 60s on Linux WebKit in CI (run 36255362442).
  test.setTimeout(process.env.CI ? 180_000 : 60_000);
  await page.goto("/admin");

  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบ Admin" }),
  ).toBeVisible();
  const loginPin = page.getByLabel("PIN", { exact: true });
  await expect(loginPin).toHaveAttribute("inputmode", "numeric");
  await expect(loginPin).toHaveAttribute("type", "password");
  await expect(loginPin).toHaveAttribute("maxlength", "4");
  await loginPin.fill("1234");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  const changePinHeading = page.getByRole("heading", { name: "ตั้ง PIN ใหม่" });
  const campsHeading = page.getByRole("heading", { name: "ค่ายของฉัน" });
  await changePinHeading
    .or(campsHeading)
    .waitFor({ state: "visible", timeout: 5_000 })
    .catch(() => undefined);

  if (await changePinHeading.isVisible()) {
    const changePinInputs = [
      page.getByLabel("PIN ชั่วคราว", { exact: true }),
      page.getByLabel("PIN ใหม่", { exact: true }),
      page.getByLabel("ยืนยัน PIN ใหม่", { exact: true }),
    ];
    for (const pinInput of changePinInputs) {
      await expect(pinInput).toHaveAttribute("inputmode", "numeric");
      await expect(pinInput).toHaveAttribute("type", "password");
      await expect(pinInput).toHaveAttribute("maxlength", "4");
    }
    await changePinInputs[0].fill("1234");
    await changePinInputs[1].fill("6543");
    await changePinInputs[2].fill("6543");
    await page.getByRole("button", { name: "บันทึก PIN ใหม่" }).click();
  } else if (!(await campsHeading.isVisible())) {
    await expect(
      page.getByRole("heading", { name: "เข้าสู่ระบบ Admin" }),
    ).toBeVisible();
    await page.getByLabel("PIN", { exact: true }).fill("6543");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  }

  await expect(campsHeading).toBeVisible();
  await expect(page.getByText("NaN", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "+ สร้าง Camp ใหม่" }).click();

  await page.getByLabel("ชื่อ Camp").fill("EQCAMP E2E");
  await page.getByLabel("สถานที่ (ไม่บังคับ)").fill("โรงเรียน E2E");
  await page.getByLabel("วันที่ Camp").fill("2026-08-23");
  await page.getByRole("button", { name: "ต่อไป" }).click();
  await page.getByLabel("งบกิจกรรมทั้งหมด").fill("50000");
  await expect(page.getByLabel("งบกิจกรรมทั้งหมด")).toHaveValue("50,000");
  await page.getByRole("button", { name: "ต่อไป" }).click();
  await page.getByRole("button", { name: "สร้าง Draft" }).click();

  await expect(page.getByRole("heading", { name: "EQCAMP E2E" })).toBeVisible();
  await expect(page.getByText("ค่ายฉบับร่าง", { exact: true })).toBeVisible();
  await expect(page.getByText("ขั้นตอน 1 จาก 4")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ยกเลิกการตั้งค่า" }),
  ).toHaveAttribute("href", "/admin");
  await expect(page.getByText("0 กลุ่ม", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ลดจำนวนกลุ่ม" }),
  ).toBeDisabled();
  const groupCountInput = page.getByLabel("กรอกจำนวนกลุ่ม");
  await expect(groupCountInput).toHaveAttribute("inputmode", "numeric");
  await expect(groupCountInput).toHaveAttribute("min", "1");
  await expect(groupCountInput).toHaveAttribute("max", "30");
  await groupCountInput.fill("12");
  await expect(page.getByText("12 กลุ่ม", { exact: true })).toBeVisible();
  await groupCountInput.fill("8");
  await expect(page.getByText("8 กลุ่ม", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ลดจำนวนกลุ่ม" }),
  ).toBeEnabled();
  await expect(page.getByText("เหลือง", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "ต่อไป" }).click();

  const groupColors = page.getByRole("button", {
    name: /^เลือกสีของกลุ่ม \d+:/,
  });
  await expect(groupColors).toHaveCount(8);
  await expect(groupColors.first()).toHaveAccessibleName(
    "เลือกสีของกลุ่ม 1: ยังไม่เลือกสี",
  );
  await expect(page.getByText("ยังไม่เลือกสี").first()).toBeVisible();
  await expect(page.getByText("เลือกสีแล้ว 0 จาก 8 กลุ่ม")).toBeVisible();
  await expect(page.getByRole("button", { name: "ต่อไป" })).toBeDisabled();

  await page
    .getByRole("button", { name: "เติมสีที่ยังไม่ใช้ให้อัตโนมัติ" })
    .click();
  await expect(page.getByText("เลือกสีแล้ว 8 จาก 8 กลุ่ม")).toBeVisible();
  await expect(page.getByRole("button", { name: "ต่อไป" })).toBeEnabled();
  await page.getByRole("button", { name: "ล้างสีทั้งหมด" }).click();
  await expect(page.getByText("เลือกสีแล้ว 0 จาก 8 กลุ่ม")).toBeVisible();
  await expect(page.getByRole("button", { name: "ต่อไป" })).toBeDisabled();

  const colorNames = [
    "เหลือง",
    "น้ำเงิน",
    "แดง",
    "เขียว",
    "ม่วง",
    "ส้ม",
    "ฟ้า",
    "ชมพู",
  ];
  for (let index = 0; index < colorNames.length; index += 1) {
    await groupColors.nth(index).click();
    const colorDialog = page.getByRole("dialog", {
      name: "เลือกสีของกลุ่ม",
    });
    await expect(colorDialog).toBeVisible();
    await colorDialog
      .getByRole("radio", {
        exact: true,
        name: `สี${colorNames[index]} เลือกสีนี้`,
      })
      .click();
  }

  const groupInputs = page.locator('input[id^="group-name-"]');
  await expect(groupInputs).toHaveCount(8);
  await expect(groupColors.first()).toHaveAccessibleName(
    "เลือกสีของกลุ่ม 1: สีเหลือง",
  );
  await groupColors.nth(1).click();
  const reopenedColorDialog = page.getByRole("dialog", {
    name: "เลือกสีของกลุ่ม",
  });
  await expect(reopenedColorDialog).toHaveScreenshot(
    "color-dialog-end-state.png",
    { animations: "disabled" },
  );
  await expect(
    reopenedColorDialog.getByRole("radio", {
      exact: true,
      name: "สีเหลือง ใช้โดยกลุ่ม 1",
    }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(groupColors.nth(1)).toBeFocused();
  await expect(page.getByText("เลือกสีแล้ว 8 จาก 8 กลุ่ม")).toBeVisible();
  await expect(page.getByRole("button", { name: "ต่อไป" })).toBeEnabled();
  await groupInputs.first().fill("Banana");
  await page.getByRole("button", { name: "ต่อไป" }).click();

  await page.getByRole("button", { name: "ต่อไป" }).click();
  const readiness = page.getByRole("list", {
    name: "รายการตรวจความพร้อม",
  });
  await expect(readiness.getByRole("listitem")).toHaveCount(5);
  await expect(
    readiness.getByRole("listitem").filter({ hasText: "Staff อย่างน้อย 1 คน" }),
  ).toContainText("ยังไม่พร้อม");
  await expect(
    page.getByRole("button", { name: "บันทึกและเปิด Camp" }),
  ).toBeDisabled();
  await readiness.getByRole("button", { name: "แก้ไข Staff" }).click();
  await page.getByLabel("Staff 1").fill("Staff E2E");
  await page.getByRole("button", { name: "ต่อไป" }).click();
  await expect(readiness.getByText("พร้อม", { exact: true })).toHaveCount(5);
  await readiness.getByRole("button", { name: "แก้ไขจำนวนกลุ่ม" }).click();
  await expect(page.getByText("ขั้นตอน 1 จาก 4")).toBeVisible();
  await page.getByRole("button", { name: "ต่อไป" }).click();
  await page.getByRole("button", { name: "ต่อไป" }).click();
  await page.getByRole("button", { name: "ต่อไป" }).click();
  await expect(readiness).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "บันทึกและเปิด Camp" }).click();

  await expect(page.getByText("กำลังใช้งาน", { exact: true })).toBeVisible();
  const adminShortcuts = page.getByRole("navigation", {
    name: "ทางลัดจัดการค่าย",
  });
  await expect(adminShortcuts.getByRole("link")).toHaveCount(8);
  await expect(
    adminShortcuts.getByRole("link", { name: "กลุ่มและคน" }),
  ).toHaveAttribute("href", "#camp-groups-people");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const adminRanking = page.getByRole("region", { name: "อันดับทั้งหมด" });
  await expect(adminRanking.getByRole("listitem")).toHaveCount(5);
  await adminRanking
    .getByRole("button", { name: "ดูอันดับทั้งหมด (8 กลุ่ม)" })
    .click();
  await expect(adminRanking.getByRole("listitem")).toHaveCount(8);
  await expect(adminRanking).toContainText(
    "หากคะแนนเท่ากัน กลุ่มที่ได้คะแนนระดับนั้นก่อนจะอยู่สูงกว่า",
  );
  const [rankingDownload] = await Promise.all([
    page.waitForEvent("download"),
    adminRanking.getByRole("button", { name: "ดาวน์โหลดอันดับ CSV" }).click(),
  ]);
  expect(rankingDownload.suggestedFilename()).toMatch(
    /^eqcamp-ranking-.*\.csv$/,
  );
  const rankingDownloadPath = await rankingDownload.path();
  expect(rankingDownloadPath).toBeTruthy();
  const rankingCsv = await readFile(rankingDownloadPath!, "utf8");
  expect(rankingCsv.charCodeAt(0)).toBe(0xfeff);
  expect(rankingCsv).toContain("อันดับ,สี,ชื่อกลุ่ม,คะแนน");
  expect(rankingCsv).toContain("Banana");
  await expect(page.getByText("ปุ่มคะแนน", { exact: true })).toBeVisible();

  const scoreButtonSettings = page.locator("details").filter({
    has: page.locator("summary", { hasText: /^ปุ่มคะแนน$/ }),
  });
  await scoreButtonSettings.locator("summary").click();
  const confirmPlus500 = scoreButtonSettings.getByRole("checkbox", {
    name: "ยืนยันก่อนให้คะแนนด้วยปุ่ม +500",
  });
  const scoreButtonPreview = scoreButtonSettings.getByRole("region", {
    name: "ตัวอย่างปุ่มคะแนนหน้า Staff",
  });
  const addPreview = scoreButtonPreview.getByLabel("ตัวอย่าง เพิ่ม 500");
  const subtractPreview = scoreButtonPreview.getByLabel("ตัวอย่าง ลด 500");
  await expect(addPreview).toBeVisible();
  await expect(addPreview).toHaveClass(/eq-score-action-add/);
  await expect(addPreview).toContainText("เพิ่มคะแนน");
  await expect(addPreview).toContainText("+500");
  await expect(subtractPreview).toHaveClass(/eq-score-action-subtract/);
  await expect(subtractPreview).toContainText("ลดคะแนน");
  await expect(subtractPreview).toContainText("-500");
  await expect(
    scoreButtonSettings
      .getByRole("group", { name: "ประเภทคะแนนของปุ่ม 1" })
      .getByRole("button", { name: "ลดคะแนน" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(confirmPlus500).not.toBeChecked();
  await confirmPlus500.check();
  await expect(scoreButtonPreview).toContainText("ยืนยันก่อนบันทึก");
  await scoreButtonSettings
    .getByRole("button", { name: "บันทึกปุ่มคะแนน" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "บันทึกปุ่มคะแนนแล้ว" }),
  ).toBeVisible();
  await scoreButtonSettings.locator("summary").click();

  const groupManagement = page.locator("details").filter({
    has: page.locator("summary", { hasText: "ชื่อและสีกลุ่ม" }),
  });
  await groupManagement.locator("summary").click();
  await expect(
    groupManagement.getByRole("button", {
      name: /เลือกสีของBanana: สีเหลือง/,
    }),
  ).toBeVisible();
  await expect(groupManagement).toContainText(
    "ประวัติเก่าจะยังใช้ชื่อและสี ณ เวลาที่บันทึกรายการ",
  );
  await groupManagement.locator("summary").click();

  const budgetSettings = page.locator("details").filter({
    has: page.locator("summary", { hasText: "งบและการเตือน" }),
  });
  const activitySettings = page.locator("details").filter({
    has: page.locator("summary", { hasText: "กิจกรรมและรอบ" }),
  });
  await budgetSettings.locator("summary").click();
  await expect(budgetSettings).toHaveAttribute("open", "");
  await expect(activitySettings).not.toHaveAttribute("open", "");
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    expect(
      await activitySettings.evaluate(
        (element) => element.getBoundingClientRect().height,
      ),
    ).toBeLessThan(120);
  }
  await budgetSettings.locator("summary").click();

  const publicResultRange = page.getByRole("group", {
    name: "ช่วงผลสาธารณะ",
  });
  await publicResultRange.getByRole("button", { name: "Top 5" }).click();
  await expect(
    publicResultRange.getByRole("button", { name: "Top 5" }),
  ).toHaveAttribute("aria-pressed", "true");

  const adminManagement = page.locator("details").filter({
    has: page.locator("summary", { hasText: /^Admin$/ }),
  });
  await adminManagement.locator("summary").click();
  await settleAnimations(adminManagement);
  await adminManagement
    .getByRole("button", { name: "รีเซ็ต PIN" })
    .first()
    .click();
  const resetPin = adminManagement.getByLabel("PIN ชั่วคราวใหม่ 4 หลัก");
  await expect(resetPin).toBeVisible({ timeout: 10_000 });
  await expect(resetPin).toHaveAttribute("inputmode", "numeric");
  await expect(resetPin).toHaveAttribute("type", "password");
  await expect(resetPin).toHaveAttribute("maxlength", "4");
  await adminManagement.getByRole("button", { name: "ยกเลิก" }).click();

  const staffLink = page.getByRole("link", { name: "เปิดลิงก์ Staff E2E" });
  await expect(staffLink).toHaveAttribute("href", /\/join\/[a-f0-9]{48}/);
  const staffPath = await staffLink.getAttribute("href");
  expect(staffPath).toBeTruthy();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "เปิด", exact: true }).click();
  const publicLink = page.getByRole("link", { name: "เปิดหน้าสาธารณะ" });
  await expect(publicLink).toBeVisible();
  const publicPath = await publicLink.getAttribute("href");
  expect(publicPath).toBeTruthy();

  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(`${E2E_ORIGIN}${publicPath}`);
  await expect(
    publicPage.getByRole("link", { name: "กลับหน้าแรก" }),
  ).toHaveAttribute("href", "/");
  await expect(
    publicPage.getByRole("heading", { name: "EQCAMP E2E" }),
  ).toBeVisible();
  await expect(publicPage.getByText("อันดับคะแนนล่าสุด")).toBeVisible();
  await expect(publicPage.getByText("แสดง 5 อันดับแรก")).toBeVisible();
  await expect(publicPage.locator("main")).toHaveScreenshot(
    "leaderboard-end-state.png",
    { animations: "disabled" },
  );

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "ปิด", exact: true }).click();
  await expect(
    publicPage.getByRole("heading", { name: "ยังไม่เปิดแสดงอันดับ" }),
  ).toBeVisible({ timeout: 6_000 });
  await publicContext.close();

  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await staffPage.goto(`${E2E_ORIGIN}${staffPath}`);
  await expect(
    staffPage.getByRole("link", { name: "กลับหน้าแรก" }),
  ).toHaveAttribute("href", "/");
  await staffPage.getByRole("button", { name: "Staff E2E" }).click();
  await expect(
    staffPage.getByRole("heading", { name: "EQCAMP E2E" }),
  ).toBeVisible();
  await expect(
    staffPage.getByRole("link", { name: "ดูประวัติ →" }),
  ).toBeVisible();
  const yellowGroup = staffPage.getByRole("listitem", {
    name: "เหลือง — Banana",
  });
  await expect(yellowGroup.getByText("0 คะแนน", { exact: true })).toBeVisible();
  await yellowGroup.getByRole("button", { name: "เพิ่มคะแนน 500" }).click();
  const scoreConfirmation = staffPage.getByRole("dialog", {
    name: "ยืนยันการให้คะแนน",
  });
  await expect(scoreConfirmation).toContainText(
    "เพิ่ม 500 คะแนนให้ เหลือง — Banana",
  );
  await scoreConfirmation.getByRole("button", { name: "ยกเลิก" }).click();
  await expect(yellowGroup.getByText("0 คะแนน", { exact: true })).toBeVisible();
  await yellowGroup.getByRole("button", { name: "เพิ่มคะแนน 500" }).click();
  await scoreConfirmation
    .getByRole("button", { name: "ยืนยันเพิ่มคะแนน" })
    .click();
  await expect(
    yellowGroup.getByText("500 คะแนน", { exact: true }),
  ).toBeVisible();
  await yellowGroup
    .getByRole("button", { name: "เปลี่ยนชื่อกลุ่ม Banana" })
    .click();
  await yellowGroup.getByLabel("ชื่อกลุ่มใหม่").fill("");
  await yellowGroup.getByRole("button", { name: "บันทึกชื่อกลุ่ม" }).click();
  await expect(
    staffPage.getByRole("listitem", { name: "เหลือง — กลุ่มสีเหลือง" }),
  ).toBeVisible();

  const adjustment = page.locator("details").filter({
    has: page.locator("summary", { hasText: /^ปรับคะแนนโดย Admin$/ }),
  });
  // The previous steps typed on the Staff page. Bring the Admin page forward
  // so the browser does not restore stale focus into another field mid-fill.
  await page.bringToFront();
  await adjustment.getByText("ปรับคะแนนโดย Admin", { exact: true }).click();
  await settleAnimations(adjustment);
  // Both controls sit inside their <label>, so their accessible names grow
  // with the typed value; an exact label match stops resolving mid-fill.
  const adjustmentAmount = adjustment.locator("#adjustment-amount");
  const adjustmentReason = adjustment.locator("#adjustment-reason");
  await adjustmentAmount.fill("500");
  await adjustmentReason.fill("เพิ่มคะแนนจากการตรวจสอบ E2E");
  await expect(adjustmentAmount).toHaveValue("500");
  await expect(adjustmentReason).toHaveValue("เพิ่มคะแนนจากการตรวจสอบ E2E");
  page.once("dialog", (dialog) => dialog.accept());
  await adjustment
    .getByRole("button", { name: "ตรวจสอบและบันทึกการปรับคะแนน" })
    .click();
  await expect(page.getByText("บันทึกการปรับคะแนนแล้ว")).toBeVisible();

  await page.getByRole("link", { name: "ประวัติ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ประวัติคะแนน" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(
    page
      .getByRole("article")
      .getByText("การปรับคะแนนโดย Admin", { exact: true })
      .first(),
  ).toBeVisible();

  const originalAdjustment = page
    .getByRole("article")
    .filter({ hasText: "การปรับคะแนนโดย Admin" })
    .first();
  await originalAdjustment
    .getByRole("button", { name: "ปรับคะแนนจากรายการนี้" })
    .click();
  await page.getByLabel("จำนวนแบบมีเครื่องหมาย").fill("-100");
  await page
    .getByLabel("เหตุผล", { exact: true })
    .fill("เชื่อมการแก้ไขกับรายการเดิม E2E");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "บันทึกการปรับคะแนนที่เชื่อมรายการ" })
    .click();
  await expect(
    page.getByText("บันทึกการปรับคะแนนที่เชื่อมรายการแล้ว"),
  ).toBeVisible();
  await expect(page.getByText("เชื่อมกับรายการที่แก้ไข").first()).toBeVisible();

  await page.getByLabel("ประเภท").selectOption("adjustment");
  await page.getByRole("button", { name: "ใช้ตัวกรอง" }).click();
  const [historyDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "ดาวน์โหลด CSV ตามตัวกรอง" }).click(),
  ]);
  expect(historyDownload.suggestedFilename()).toMatch(
    /^eqcamp-history-.*\.csv$/,
  );
  const historyDownloadPath = await historyDownload.path();
  expect(historyDownloadPath).toBeTruthy();
  const historyCsv = await readFile(historyDownloadPath!, "utf8");
  expect(historyCsv).toContain("การปรับคะแนนโดย Admin");
  expect(historyCsv).toContain("เชื่อมการแก้ไขกับรายการเดิม E2E");
  expect(historyCsv).not.toContain("เพิ่มคะแนน,เหลือง");

  await page.getByRole("link", { name: "← กลับไปที่ Camp" }).click();
  await expect(page.getByRole("heading", { name: "EQCAMP E2E" })).toBeVisible();

  const closeCamp = page.locator("details").filter({ hasText: "ปิด Camp" });
  await closeCamp.getByText("ปิด Camp", { exact: true }).click();
  await expect(
    closeCamp.getByRole("region", { name: "ตัวอย่างสรุปก่อนปิดค่าย" }),
  ).toContainText("อันดับนำ");
  await closeCamp
    .getByLabel("เหตุผล", { exact: true })
    .fill("สิ้นสุดการทดสอบ E2E");
  page.once("dialog", (dialog) => dialog.accept());
  await closeCamp.getByRole("button", { name: "ตรวจสอบและปิด Camp" }).click();
  await expect(page.getByText("ค่ายนี้ปิดแล้ว")).toBeVisible();
  await expect(page.getByText("ปิดค่ายแล้ว", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "สรุปค่ายที่ปิดแล้ว" }),
  ).toContainText("ผู้ชนะ");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await expect(staffPage.getByText("ค่ายนี้ปิดแล้ว")).toBeVisible({
    timeout: 6_000,
  });
  await expect(
    staffPage
      .getByRole("listitem", { name: "เหลือง — กลุ่มสีเหลือง" })
      .getByRole("button", { name: "เพิ่มคะแนน 500" }),
  ).toBeDisabled();
  await staffContext.close();
});
