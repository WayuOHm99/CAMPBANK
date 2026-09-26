import { expect, test, type Page } from "@playwright/test";

async function expectAccessibleInteractiveElements(page: Page) {
  const findings = await page
    .locator("button, a, input, select, textarea, summary")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const style = window.getComputedStyle(element);
          const rectangle = element.getBoundingClientRect();
          return (
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            rectangle.width > 0
          );
        })
        .map((element) => {
          const rectangle = element.getBoundingClientRect();
          const input = element as HTMLInputElement;
          const labelText = Array.from(input.labels ?? [])
            .map((label) => label.textContent?.trim())
            .filter(Boolean)
            .join(" ");
          const name =
            element.getAttribute("aria-label") ||
            element.getAttribute("aria-labelledby") ||
            labelText ||
            element.textContent?.trim() ||
            input.placeholder;
          const targetRectangle =
            input.type === "checkbox" && input.closest("label")
              ? input.closest("label")!.getBoundingClientRect()
              : rectangle;

          return {
            height: Math.round(targetRectangle.height),
            name: name?.trim() ?? "",
            tag: element.tagName.toLowerCase(),
            width: Math.round(targetRectangle.width),
          };
        })
        .filter((item) => item.name !== "Open Next.js Dev Tools")
        .filter((item) => !item.name || item.height < 44 || item.width < 44),
    );

  expect(findings).toEqual([]);
}

test("Home, Admin entry, and Staff controls have names and 44px touch targets", async ({
  page,
}) => {
  await page.goto("/");
  await expectAccessibleInteractiveElements(page);

  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบ Admin" }),
  ).toBeVisible();
  await expectAccessibleInteractiveElements(page);

  await page.goto("/join/TEST-30000000-0000-4000-8000-000000000003");
  await page.getByRole("button", { name: "Staff C" }).click();
  await expect(
    page.getByRole("heading", { name: "EQCAMP Demo" }),
  ).toBeVisible();
  await expectAccessibleInteractiveElements(page);

  let appFocus: { inMain: boolean; outlineWidth: string } | undefined;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.keyboard.press("Tab");
    const focusState = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return {
        inMain: Boolean(
          active && document.querySelector("main")?.contains(active),
        ),
        outlineWidth: active
          ? window.getComputedStyle(active).outlineWidth
          : "0px",
      };
    });
    if (focusState.inMain) {
      appFocus = focusState;
      break;
    }
  }
  expect(appFocus?.inMain).toBe(true);
  expect(appFocus?.outlineWidth).not.toBe("0px");
});
