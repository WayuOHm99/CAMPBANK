import { expect, test } from "@playwright/test";

test("opens the Thai EQ-BANK entry on Mobile Safari", async ({ page }) => {
  await page.goto("/");

  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("ให้คะแนนเร็ว");
  await expect(heading).toContainText("ตรวจสอบย้อนหลังได้");

  await expect(page.getByLabel("EQ-BANK")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /เข้าสู่ระบบผู้ดูแล/ }),
  ).toHaveAttribute("href", "/admin");

  // Staff are told to use their private Camp link; the entry surface must not
  // become a second way in, so it offers no field to type into and no Camp list.
  await expect(page.getByText(/Staff เข้าผ่านลิงก์เฉพาะค่าย/)).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);

  // ADR-0012 reversed ADR-0010 here: the owner credit is now shown.
  await expect(page.getByText(/บริษัท อีคิวกรุ๊ป จำกัด/)).toBeVisible();
});

test("serves basic PWA metadata without an offline transaction queue", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    display?: string;
    name?: string;
    start_url?: string;
  };
  expect(manifest).toMatchObject({
    display: "standalone",
    name: "EQ-BANK — ระบบคะแนนกิจกรรมค่าย",
    start_url: "/",
  });

  const serviceWorkerResponse = await request.get("/sw.js");
  expect(serviceWorkerResponse.ok()).toBe(true);
  expect(await serviceWorkerResponse.text()).not.toContain(
    'addEventListener("fetch"',
  );
});
