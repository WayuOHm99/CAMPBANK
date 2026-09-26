import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("Staff selection replaces a stale anonymous access session", async ({
  page,
}) => {
  let staleResponseSent = false;

  await page.route("**/rest/v1/rpc/join_staff_camp", async (route) => {
    if (staleResponseSent) {
      await route.continue();
      return;
    }

    staleResponseSent = true;
    await route.fulfill({
      body: JSON.stringify({
        code: "23503",
        details:
          'Key (auth_user_id)=(removed-user) is not present in table "users".',
        hint: null,
        message:
          'insert on table "access_sessions" violates foreign key constraint "access_sessions_auth_user_id_fkey"',
      }),
      contentType: "application/json",
      status: 409,
    });
  });

  await page.goto("/join/TEST-30000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "Staff A" }).click();

  await expect(
    page.getByRole("heading", { name: "EQCAMP Demo" }),
  ).toBeVisible();
  await expect(page.getByText("ไม่สามารถเลือก Staff ได้")).toHaveCount(0);
  expect(staleResponseSent).toBe(true);
});
