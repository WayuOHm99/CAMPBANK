import { expect, test } from "@playwright/test";

test("Public and Staff error states retain deterministic Back navigation", async ({
  page,
}) => {
  await page.goto("/leaderboard/INVALID-PUBLIC-CODE");
  await expect(
    page.getByRole("heading", { name: "ยังไม่เปิดแสดงอันดับ" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "กลับหน้าแรก" })).toHaveAttribute(
    "href",
    "/",
  );

  await page.goto("/join/INVALID-STAFF-CODE");
  await expect(
    page.getByRole("heading", { name: "เปิดค่ายไม่ได้" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "กลับหน้าแรก" })).toHaveAttribute(
    "href",
    "/",
  );
});
