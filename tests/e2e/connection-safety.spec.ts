import { expect, test } from "@playwright/test";

import { E2E_ORIGIN } from "./support/origin";

function scoreFrom(text: string | null) {
  return Number((text ?? "").replace(/[^0-9]/g, ""));
}

test("offline disables Score actions and reconnect restores authoritative state", async ({
  context,
  page,
}) => {
  await page.goto("/join/TEST-30000000-0000-4000-8000-000000000003");
  await page.getByRole("button", { name: "Staff C" }).click();
  await expect(
    page.getByRole("heading", { name: "EQCAMP Demo" }),
  ).toBeVisible();

  const plus500 = page
    .getByRole("listitem", { name: "เหลือง — Banana" })
    .getByRole("button", { name: "เพิ่มคะแนน 500" });
  await expect(plus500).toBeEnabled();

  await context.setOffline(true);
  await expect(page.getByText("การเชื่อมต่อขาดหาย").first()).toBeVisible();
  await expect(plus500).toBeDisabled();

  await context.setOffline(false);
  await expect(plus500).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByText(/ข้อมูลสด|อัปเดตสำรอง/).first()).toBeVisible();
});

test("Realtime failure falls back to authoritative two-second refreshes", async ({
  browser,
  context,
  page,
}) => {
  await context.routeWebSocket(/\/realtime\/v1\//, async (socket) => {
    await socket.close({ code: 1011, reason: "E2E Realtime failure" });
  });

  const actorContext = await browser.newContext();
  const actorPage = await actorContext.newPage();
  await Promise.all([
    page.goto("/join/TEST-30000000-0000-4000-8000-000000000002"),
    actorPage.goto(`${E2E_ORIGIN}/join/TEST-30000000-0000-4000-8000-000000000001`),
  ]);
  await page.getByRole("button", { name: "Staff B" }).click();
  await actorPage.getByRole("button", { name: "Staff A" }).click();
  await Promise.all([
    expect(page.getByRole("heading", { name: "EQCAMP Demo" })).toBeVisible(),
    expect(
      actorPage.getByRole("heading", { name: "EQCAMP Demo" }),
    ).toBeVisible(),
  ]);

  await expect(page.getByText("อัปเดตสำรอง").first()).toBeVisible({
    timeout: 10_000,
  });
  const bananaFallback = page.getByRole("listitem", {
    name: "เหลือง — Banana",
  });
  const bananaActor = actorPage.getByRole("listitem", {
    name: "เหลือง — Banana",
  });
  const startingScore = scoreFrom(
    await bananaFallback.getByText(/^-?[\d,]+ คะแนน$/).textContent(),
  );

  await bananaActor.getByRole("button", { name: "เพิ่มคะแนน 500" }).click();
  await expect(
    bananaFallback.getByText(
      `${(startingScore + 500).toLocaleString("en-US")} คะแนน`,
    ),
  ).toBeVisible({ timeout: 6_000 });

  await actorContext.close();
});
