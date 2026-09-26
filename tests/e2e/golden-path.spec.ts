import { expect, test } from "@playwright/test";

function scoreFrom(text: string | null) {
  return Number((text ?? "").replace(/[^0-9]/g, ""));
}

test("Staff joins the Demo Camp and awards +500", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/join/TEST-30000000-0000-4000-8000-000000000001");

  await expect(
    page.getByRole("heading", { name: "เข้าใช้งาน Staff" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Staff A" }).click();

  await expect(
    page.getByRole("heading", { name: "EQCAMP Demo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "กลับหน้าเลือก Staff" }),
  ).toHaveAttribute("href", "/join/TEST-30000000-0000-4000-8000-000000000001");

  const activity = page.getByLabel("กิจกรรม");
  await activity.selectOption({ label: "เต้น" });
  const selectedActivity = await activity.inputValue();
  const round = page.getByLabel("รอบ");
  await round.selectOption({ label: "รอบ 2" });
  const selectedRound = await round.inputValue();

  await page.reload();
  await expect(page.getByLabel("กิจกรรม")).toHaveValue(selectedActivity);
  await expect(page.getByLabel("รอบ")).toHaveValue(selectedRound);

  const banana = page.getByRole("listitem", { name: "เหลือง — Banana" });
  const startingScore = scoreFrom(
    await banana.getByText(/^-?[\d,]+ คะแนน$/).textContent(),
  );
  const budget = page
    .getByRole("region", { name: "ทางลัดและงบค่าย" })
    .getByText(/[\d,]+ \/ 100,000/);
  const startingRemaining = scoreFrom(
    (await budget.textContent())?.split("/")[0] ?? null,
  );
  await banana.getByRole("button", { name: "เพิ่มคะแนน 500" }).click();

  await expect(
    banana.getByText(`${(startingScore + 500).toLocaleString("en-US")} คะแนน`),
  ).toBeVisible();
  await expect(
    page.getByText(
      `${(startingRemaining - 500).toLocaleString("en-US")} / 100,000`,
    ),
  ).toBeVisible();
});
