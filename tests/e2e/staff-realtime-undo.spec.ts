import { expect, test } from "@playwright/test";

import { E2E_ORIGIN } from "./support/origin";

function scoreFrom(text: string | null) {
  return Number((text ?? "").replace(/[^0-9]/g, ""));
}

test("two Staff sessions receive Realtime Score and Quick Undo", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const staffA = await contextA.newPage();
  const staffB = await contextB.newPage();

  await Promise.all([
    staffA.goto(`${E2E_ORIGIN}/join/DEMO-STAFF-2026`),
    staffB.goto(`${E2E_ORIGIN}/join/DEMO-STAFF-2026`),
  ]);
  await staffA.getByRole("button", { name: "Staff A" }).click();
  await staffB.getByRole("button", { name: "Staff B" }).click();
  await Promise.all([
    expect(staffA.getByRole("heading", { name: "EQCAMP Demo" })).toBeVisible(),
    expect(staffB.getByRole("heading", { name: "EQCAMP Demo" })).toBeVisible(),
  ]);

  const bananaA = staffA.getByRole("listitem", { name: "เหลือง — Banana" });
  const bananaB = staffB.getByRole("listitem", { name: "เหลือง — Banana" });
  const startingScore = scoreFrom(
    await bananaA.getByText(/^-?[\d,]+ คะแนน$/).textContent(),
  );

  await bananaA.getByRole("button", { name: "เพิ่มคะแนน 500" }).click();
  await expect(
    bananaB.getByText(`${(startingScore + 500).toLocaleString("en-US")} คะแนน`),
  ).toBeVisible({
    timeout: 5_000,
  });

  await staffA.getByRole("button", { name: "ย้อนกลับ" }).click();
  await expect(
    bananaA.getByText(`${startingScore.toLocaleString("en-US")} คะแนน`),
  ).toBeVisible();
  await expect(
    bananaB.getByText(`${startingScore.toLocaleString("en-US")} คะแนน`),
  ).toBeVisible({
    timeout: 5_000,
  });

  await contextA.close();
  await contextB.close();
});
