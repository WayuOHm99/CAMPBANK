import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://127.0.0.1:3000/join/DEMO-STAFF-2026", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Staff B" }).click();
await page.getByRole("group", { name: "รูปแบบการแสดงกลุ่ม" })
  .getByRole("button", { name: "แถวเลื่อน" }).click();
await page.waitForTimeout(400);
console.log(await page.evaluate(() => {
  const doc = document.documentElement;
  const out = [`scrollWidth=${doc.scrollWidth} clientWidth=${doc.clientWidth}`];
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.right > doc.clientWidth + 1) {
      out.push(`  ${el.tagName.toLowerCase()}.${(el.className.baseVal ?? el.className ?? "").toString().slice(0, 70)} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
      if (out.length > 8) break;
    }
  }
  return out.join("\n");
}));
await browser.close();
