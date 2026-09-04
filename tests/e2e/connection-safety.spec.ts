import { expect, test } from "@playwright/test";

function scoreFrom(text: string | null) {
  return Number((text ?? "").replace(/[^0-9]/g, ""));
}

test("offline disables Score actions and reconnect restores authoritative state", async ({
  context,
  page,
}) => {
  await page.goto("/join/DEMO-STAFF-2026");
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
    page.goto("/join/DEMO-STAFF-2026"),
    actorPage.goto("http://127.0.0.1:3000/join/DEMO-STAFF-2026"),
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
